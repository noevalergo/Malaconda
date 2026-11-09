/**
 * Stripe: every call to Stripe goes through this file.
 *
 * Prices are sent to Stripe as `price_data` built from config/catalog.js, so
 * there is ONE price list (no Price IDs to keep in sync with the dashboard).
 * Discounts are one-time Stripe coupons whose amount was calculated by the
 * server; promotion-code entry on the Stripe page stays OFF.
 *
 * Which payment methods appear (card, Apple Pay / Google Pay, TWINT) is
 * controlled in the Stripe Dashboard → Settings → Payment methods.
 */
import Stripe from "stripe";
import { CHECKOUT_EXPIRY_MINUTES, CURRENCY } from "../config/catalog.js";
import { HttpError } from "../lib/errors.js";

export function createStripeClient(secretKey) {
  return new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 20_000 });
}

export function createStripeService(client, { publicBaseUrl, webhookSecret }) {
  const currency = CURRENCY.toLowerCase();

  async function call(label, fn) {
    try {
      return await fn();
    } catch (err) {
      const wrapped = new HttpError(502, "PAYMENT_PROVIDER_ERROR", "The payment service is not reachable. Please try again.");
      wrapped.cause = err;
      wrapped.stripeLabel = label;
      throw wrapped;
    }
  }

  return {
    /** Verifies the Stripe-Signature header. Throws if invalid. */
    constructEvent(rawBody, signature) {
      return client.webhooks.constructEvent(rawBody, signature, webhookSecret);
    },

    async createCustomer({ email, name, customerId }) {
      const c = await call("customers.create", () =>
        client.customers.create({ email, name: name || undefined, metadata: { customerId } }),
      );
      return c.id;
    },

    /**
     * @param {object} p
     * @param {"B2C"|"B2B"} p.channel
     * @param {string} p.orderRef
     * @param {Array<{name: string, unitAmountCents: number, quantity: number}>} p.lineItems
     * @param {number} [p.discountCents]   one-time coupon of this amount
     * @param {string} [p.discountName]    shown on the Stripe page, e.g. "WELCOME20"
     * @param {number|null} [p.shippingCents]  null = no shipping (B2B)
     * @param {string} [p.stripeCustomerId]
     * @param {"en"|"de"} [p.lang]
     */
    async createCheckoutSession(p) {
      const now = Math.floor(Date.now() / 1000);
      let couponId;
      if (p.discountCents > 0) {
        const coupon = await call("coupons.create", () =>
          client.coupons.create({
            amount_off: p.discountCents,
            currency,
            duration: "once",
            max_redemptions: 1,
            name: p.discountName,
            metadata: { orderRef: p.orderRef },
          }),
        );
        couponId = coupon.id;
      }

      const metadata = { orderRef: p.orderRef, channel: p.channel };
      const session = await call("checkout.sessions.create", () =>
        client.checkout.sessions.create({
          mode: "payment",
          client_reference_id: p.orderRef,
          metadata,
          payment_intent_data: { metadata },
          customer: p.stripeCustomerId || undefined,
          line_items: p.lineItems.map((li) => ({
            quantity: li.quantity,
            price_data: { currency, unit_amount: li.unitAmountCents, product_data: { name: li.name } },
          })),
          discounts: couponId ? [{ coupon: couponId }] : undefined,
          ...(p.shippingCents === null || p.shippingCents === undefined
            ? {}
            : {
                shipping_address_collection: { allowed_countries: ["CH"] },
                shipping_options: [
                  {
                    shipping_rate_data: {
                      type: "fixed_amount",
                      display_name: "Shipping (Switzerland)",
                      fixed_amount: { amount: p.shippingCents, currency },
                    },
                  },
                ],
              }),
          locale: p.lang === "de" ? "de" : "en",
          expires_at: now + CHECKOUT_EXPIRY_MINUTES * 60,
          success_url: `${publicBaseUrl}/success.html?order=${encodeURIComponent(p.orderRef)}`,
          cancel_url: `${publicBaseUrl}/cancel.html?order=${encodeURIComponent(p.orderRef)}`,
        }),
      );
      return { id: session.id, url: session.url, expiresAt: new Date(session.expires_at * 1000) };
    },

    /**
     * Closes an older open session so only ONE discounted checkout can be paid.
     * @returns {Promise<"CLOSED"|"COMPLETED">}
     */
    async closeSession(sessionId) {
      const s = await call("checkout.sessions.retrieve", () => client.checkout.sessions.retrieve(sessionId));
      if (s.status === "complete") return "COMPLETED";
      if (s.status === "open") {
        try {
          await client.checkout.sessions.expire(sessionId);
        } catch (err) {
          // It may have been completed or expired in the meantime: check again.
          const again = await call("checkout.sessions.retrieve", () => client.checkout.sessions.retrieve(sessionId));
          if (again.status === "complete") return "COMPLETED";
          if (again.status !== "expired") throw err;
        }
      }
      return "CLOSED";
    },

    async getSessionUrlIfOpen(sessionId) {
      const s = await call("checkout.sessions.retrieve", () => client.checkout.sessions.retrieve(sessionId));
      return s.status === "open" ? s.url : null;
    },

    /** Card fingerprint of a payment (identifies a card without card data). */
    async cardFingerprint(paymentIntentId) {
      const pi = await call("paymentIntents.retrieve", () =>
        client.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] }),
      );
      return pi.latest_charge?.payment_method_details?.card?.fingerprint || null;
    },
  };
}
