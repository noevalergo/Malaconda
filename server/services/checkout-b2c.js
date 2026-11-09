/**
 * B2C checkout (individual customers, cases of 12).
 *
 *  1. Price the cart on the server (browser prices are ignored).
 *  2. If a code is used: check eligibility and RESERVE it together with the
 *     order in one Firestore transaction.
 *  3. Create the Stripe Checkout Session (30 min) and save its ID.
 *  4. The code is CONFIRMED only by the verified Stripe webhook.
 */
import { CHECKOUT_EXPIRY_MINUTES, CURRENCY, PROMO_RULES, RESERVATION_GRACE_MINUTES } from "../config/catalog.js";
import { attachCheckoutSession, getPromo, previewEligibility, releaseRedemption, reservePromoAndCreateOrder } from "../db/promotions.js";
import { createOrder, updateOrder } from "../db/orders.js";
import { getCustomer, updateCustomer } from "../db/customers.js";
import { HttpError, badRequest, conflict } from "../lib/errors.js";
import { randomRef } from "../lib/ids.js";
import { b2cDiscountCents, b2cShippingCents, priceB2cCart } from "./pricing.js";
import { redemptionId } from "./promo-rules.js";

export function createB2cCheckout(ctx) {
  const { db, stripe, config, log } = ctx;

  /** Shows the discount in the cart without reserving anything. */
  async function checkPromo({ code, items, customerId }) {
    const cart = priceB2cCart(items);
    const { promo, result } = await previewEligibility(db, code, customerId);
    if (!result.ok) return { valid: false, code: result.code, message: result.message };
    const discountCents = b2cDiscountCents(promo.kind, cart);
    return { valid: true, code: promo.code, kind: promo.kind, discountCents };
  }

  async function ensureStripeCustomer(customer) {
    if (customer.stripeCustomerId) return customer.stripeCustomerId;
    const id = await stripe.createCustomer({ email: customer.email, name: customer.fullName, customerId: customer.id });
    await updateCustomer(db, customer.id, { stripeCustomerId: id });
    return id;
  }

  /**
   * @param {{items: Array, promoCode?: string, lang?: string, customerId?: string|null}} input
   * @returns {Promise<{orderRef: string, url: string}>}
   */
  async function start({ items, promoCode, lang, customerId }) {
    const cart = priceB2cCart(items);
    const now = new Date();
    const orderRef = randomRef("MLC-B2C");

    let promo = null;
    if (promoCode) {
      promo = await getPromo(db, promoCode);
      if (!promo) throw badRequest("PROMO_INVALID", "This code is not valid.");
      if (!customerId) throw new HttpError(401, "VERIFICATION_REQUIRED", "Please verify your email to use this code.");
    }
    const discountCents = promo ? b2cDiscountCents(promo.kind, cart) : 0;
    const shippingCents = b2cShippingCents(config.shipping, cart.subtotalCents - discountCents);
    const customer = customerId ? await getCustomer(db, customerId) : null;

    const order = {
      channel: "B2C",
      customerId: customer?.id || null,
      email: customer?.email || null,
      orderStatus: "NEW",
      paymentStatus: "PENDING",
      items: cart.lines,
      currency: CURRENCY,
      subtotalCents: cart.subtotalCents,
      discountCents,
      shippingCents,
      totalCents: cart.subtotalCents - discountCents + shippingCents,
      amountPaidCents: 0,
      promo: null,
      ambassador:
        promo?.kind === "AMBASSADOR"
          ? { ambassadorId: promo.ambassadorId, code: promo.code, commissionCents: PROMO_RULES.ambassador.commissionCents, status: "NOT_EARNED", month: null }
          : null,
      stripe: { checkoutSessionId: null, paymentIntentId: null, customerId: null },
      shippingAddress: null,
      flags: [],
      lang: lang === "de" ? "de" : "en",
      confirmationEmailSentAt: null,
      sheetsSyncedAt: null,
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    };

    let rid = null;
    if (promo) {
      rid = await reserveWithTakeover({ promo, customerId, orderRef, order, now });
    } else {
      await createOrder(db, orderRef, order);
    }

    let session;
    try {
      session = await stripe.createCheckoutSession({
        channel: "B2C",
        orderRef,
        lineItems: cart.lines.map((l) => ({ name: l.name, unitAmountCents: l.unitPriceCents, quantity: l.quantity })),
        discountCents,
        discountName: promo ? (promo.kind === "WELCOME" ? promo.code : `Ambassador code ${promo.code}`) : undefined,
        shippingCents,
        stripeCustomerId: customer ? await ensureStripeCustomer(customer) : undefined,
        lang,
      });
    } catch (err) {
      // Stripe failed: free the code immediately and mark the order.
      if (rid) await releaseRedemption(db, rid, orderRef, "STRIPE_ERROR");
      await updateOrder(db, orderRef, { paymentStatus: "FAILED", flags: ["STRIPE_SESSION_NOT_CREATED"] });
      throw err;
    }

    await attachCheckoutSession(db, { rid, orderRef, sessionId: session.id });
    log.info("checkout.b2c.started", { orderRef, promo: promo?.code || null });
    return { orderRef, url: session.url };
  }

  /**
   * Reserves the code. If the customer already has an open discounted Stripe
   * checkout (another tab or browser), that older session is closed first so
   * only ONE discounted checkout can ever be paid.
   */
  async function reserveWithTakeover({ promo, customerId, orderRef, order, now }) {
    const reservedUntil = new Date(now.getTime() + (CHECKOUT_EXPIRY_MINUTES + RESERVATION_GRACE_MINUTES) * 60_000);
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await reservePromoAndCreateOrder(db, { code: promo.code, customerId, orderRef, order, reservedUntil, now });
      if (res.ok) return res.redemptionId;

      if (res.code === "ACTIVE_CHECKOUT" && attempt === 0) {
        const outcome = await stripe.closeSession(res.activeSessionId);
        if (outcome === "COMPLETED") {
          throw conflict("PROMO_PAYMENT_PROCESSING", "Your previous checkout with this discount was just paid.");
        }
        await releaseRedemption(db, redemptionId(promo, customerId), res.activeOrderRef, "REPLACED_BY_NEW_CHECKOUT");
        continue;
      }
      if (res.code === "CHECKOUT_IN_PROGRESS" || res.code === "ACTIVE_CHECKOUT") {
        throw conflict("CHECKOUT_IN_PROGRESS", "Another checkout is being prepared. Please try again in a moment.");
      }
      throw new HttpError(res.status, res.code, res.message);
    }
    throw conflict("CHECKOUT_IN_PROGRESS", "Another checkout is being prepared. Please try again in a moment.");
  }

  return { start, checkPromo };
}
