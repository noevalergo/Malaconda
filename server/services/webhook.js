/**
 * Stripe webhook handling.
 *
 * The route verifies the signature first (services/stripe.js). Each event is
 * then applied in one Firestore transaction that also records the event ID,
 * so repeated deliveries change nothing (see db/orders.js).
 *
 * Emails, Google Sheets and duplicate-use checks run AFTER the database
 * update, in the background: Stripe gets its "200 OK" quickly, and a slow
 * email server or Sheets outage can't break payment confirmation.
 */
import { addOrderFlag, applyCheckoutEnded, applyPaymentProcessing, applyPaymentSucceeded, applyRefund, getOrder } from "../db/orders.js";
import { getOrCreateCustomerByEmail } from "../db/customers.js";
import { recordPromoSignal } from "../db/promotions.js";

export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "charge.refunded",
];

export function createWebhookHandler(ctx) {
  const { db, stripe, notifications, reporting, log, background } = ctx;

  async function onPaid(event, session) {
    const ref = session.metadata?.orderRef;
    const order = await getOrder(db, ref);
    const payerEmail = session.customer_details?.email || null;

    // Guest checkout: link the order to a customer record by email, so the
    // first-order rule also knows about guest purchases.
    let customerId = order?.customerId || null;
    if (order && !customerId && payerEmail) customerId = await getOrCreateCustomerByEmail(db, payerEmail);

    const result = await applyPaymentSucceeded(db, {
      eventId: event.id,
      eventType: event.type,
      ref,
      paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
      amountCents: session.amount_total,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
      payerEmail,
      shippingAddress: shippingFrom(session),
      customerId,
    });
    log.info("webhook.paid", { orderRef: ref, applied: result.applied, duplicate: Boolean(result.duplicate), reason: result.reason });
    if (!result.applied) return result;

    background(afterPayment(result.order, session));
    return result;
  }

  async function afterPayment(order, session) {
    const expected = order.channel === "B2C" ? order.totalCents : order.depositCents;
    if (session.amount_total !== expected) {
      log.error("webhook.amount_mismatch", { orderRef: order.ref, expected, paid: session.amount_total });
      await addOrderFlag(db, order.ref, "AMOUNT_MISMATCH");
    }
    await notifications.sendOrderConfirmation(order.ref);
    await notifications.notifyTeamOfPayment(order);
    if (order.promo) await checkDuplicateSignals(order).catch((err) => log.error("promo.signals_failed", { orderRef: order.ref, error: err.message }));
    reporting.syncOrder(order.ref);
  }

  /** Flags (never blocks) a first-order discount used again with the same card or address. */
  async function checkDuplicateSignals(order) {
    const signals = [];
    if (order.stripe?.paymentIntentId) {
      const fingerprint = await stripe.cardFingerprint(order.stripe.paymentIntentId);
      if (fingerprint) signals.push({ type: "card", value: fingerprint });
    }
    const a = order.shippingAddress?.address;
    if (a) signals.push({ type: "address", value: [a.line1, a.postal_code, a.city].join("|").toLowerCase().replace(/\s+/g, " ").trim() });

    for (const s of signals) {
      const { duplicateOfOrder } = await recordPromoSignal(db, { ...s, customerId: order.customerId, orderRef: order.ref });
      if (duplicateOfOrder) {
        await addOrderFlag(db, order.ref, "FIRST_ORDER_DISCOUNT_POSSIBLE_DUPLICATE");
        log.warn("promo.possible_duplicate", { orderRef: order.ref, signal: s.type, previousOrder: duplicateOfOrder });
      }
    }
  }

  /** @returns {Promise<object>} what happened, for logs and tests */
  return async function handle(event) {
    const session = event.data.object;
    const ref = session.metadata?.orderRef;

    switch (event.type) {
      case "checkout.session.completed":
        if (!ref) return { ignored: "NO_ORDER_REF" };
        if (session.payment_status === "paid" || session.payment_status === "no_payment_required") return onPaid(event, session);
        return applyPaymentProcessing(db, { eventId: event.id, eventType: event.type, ref });

      case "checkout.session.async_payment_succeeded":
        if (!ref) return { ignored: "NO_ORDER_REF" };
        return onPaid(event, session);

      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        if (!ref) return { ignored: "NO_ORDER_REF" };
        const outcome = event.type === "checkout.session.expired" ? "EXPIRED" : "FAILED";
        const result = await applyCheckoutEnded(db, { eventId: event.id, eventType: event.type, ref, outcome });
        if (result.applied) reporting.syncOrder(ref);
        return result;
      }

      case "charge.refunded": {
        const charge = session;
        const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (!paymentIntentId) return { ignored: "NO_PAYMENT_INTENT" };
        const result = await applyRefund(db, {
          eventId: event.id,
          eventType: event.type,
          paymentIntentId,
          fullyRefunded: charge.refunded === true || charge.amount_refunded >= charge.amount,
        });
        if (result.applied) reporting.syncOrder(result.ref);
        return result;
      }

      default:
        return { ignored: "UNHANDLED_EVENT_TYPE" };
    }
  };
}

function shippingFrom(session) {
  const details = session.collected_information?.shipping_details;
  if (!details) return null;
  const a = details.address || {};
  return {
    name: details.name || null,
    address: { line1: a.line1 || null, line2: a.line2 || null, postal_code: a.postal_code || null, city: a.city || null, country: a.country || null },
  };
}
