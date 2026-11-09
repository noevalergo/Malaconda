/**
 * Orders and payments.
 *
 * Every function that reacts to a Stripe webhook runs in ONE transaction that
 * also records the Stripe event ID (stripeEvents/{eventId}). A repeated
 * delivery of the same event finds that record and changes nothing, so no
 * duplicate payment, status change, commission or email can happen.
 */
import { FieldValue } from "firebase-admin/firestore";
import { COL } from "./firestore.js";
import { zurichMonth } from "../lib/dates.js";

// ---------- Status vocabularies (order status and payment status are separate) ----------
export const B2C_ORDER_STATUS = ["NEW", "SHIPPED", "DELIVERED", "CANCELLED"];
export const B2C_PAYMENT_STATUS = ["PENDING", "PROCESSING", "PAID", "FAILED", "EXPIRED", "REFUNDED"];
export const B2B_ORDER_STATUS = ["PENDING_CONFIRMATION", "CONFIRMED_PREORDER", "DELIVERED", "CANCELLED"];
export const B2B_PAYMENT_STATUS = ["AWAITING_DEPOSIT", "PROCESSING", "DEPOSIT_PAID", "FULLY_PAID", "FAILED", "EXPIRED", "REFUNDED"];

/** Order statuses an admin may set by hand, per channel and current status. */
const ADMIN_ORDER_TRANSITIONS = {
  B2C: { NEW: ["SHIPPED", "CANCELLED"], SHIPPED: ["DELIVERED"], DELIVERED: [], CANCELLED: [] },
  B2B: { PENDING_CONFIRMATION: ["CANCELLED"], CONFIRMED_PREORDER: ["DELIVERED", "CANCELLED"], DELIVERED: [], CANCELLED: [] },
};

const PAYABLE = { B2C: ["PENDING", "PROCESSING"], B2B: ["AWAITING_DEPOSIT", "PROCESSING"] };

const orderRef = (db, ref) => db.collection(COL.orders).doc(ref);

export async function createOrder(db, ref, order) {
  await orderRef(db, ref).create(order);
}

export async function getOrder(db, ref) {
  const snap = await orderRef(db, ref).get();
  return snap.exists ? { ref: snap.id, ...snap.data() } : null;
}

export async function updateOrder(db, ref, fields) {
  await orderRef(db, ref).update({ ...fields, updatedAt: new Date() });
}

export async function listOrders(db, { channel, limit = 100 } = {}) {
  let q = db.collection(COL.orders);
  if (channel) q = q.where("channel", "==", channel);
  const snap = await q.orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs.map((d) => ({ ref: d.id, ...d.data() }));
}

/** Common start of every webhook transaction. */
async function readEventAndOrder(tx, db, eventId, ref) {
  const eventDoc = db.collection(COL.stripeEvents).doc(eventId);
  const eventSnap = await tx.get(eventDoc);
  const orderSnap = ref ? await tx.get(orderRef(db, ref)) : null;
  return { eventDoc, duplicate: eventSnap.exists, order: orderSnap?.exists ? orderSnap.data() : null };
}

function recordEvent(tx, eventDoc, type, ref, now) {
  tx.create(eventDoc, { type, orderRef: ref || null, receivedAt: now });
}

/**
 * Payment succeeded (checkout.session.completed with payment_status "paid",
 * or checkout.session.async_payment_succeeded).
 *
 * @returns {Promise<{applied: boolean, duplicate?: boolean, reason?: string, order?: object}>}
 */
export async function applyPaymentSucceeded(db, p) {
  const { eventId, eventType, ref, paymentIntentId, amountCents, stripeCustomerId, payerEmail, shippingAddress, customerId, now = new Date() } = p;

  return db.runTransaction(async (tx) => {
    const { eventDoc, duplicate, order } = await readEventAndOrder(tx, db, eventId, ref);
    if (duplicate) return { applied: false, duplicate: true };
    if (!order) {
      recordEvent(tx, eventDoc, eventType, ref, now);
      return { applied: false, reason: "UNKNOWN_ORDER" };
    }
    if (!PAYABLE[order.channel].includes(order.paymentStatus)) {
      recordEvent(tx, eventDoc, eventType, ref, now);
      return { applied: false, reason: `ALREADY_${order.paymentStatus}` };
    }

    const effectiveCustomerId = order.customerId || customerId || null;
    const customerDoc = effectiveCustomerId ? db.collection(COL.customers).doc(effectiveCustomerId) : null;
    const customerSnap = customerDoc ? await tx.get(customerDoc) : null;
    const redemptionDoc = order.promo?.redemptionId ? db.collection(COL.promoRedemptions).doc(order.promo.redemptionId) : null;
    const redemptionSnap = redemptionDoc ? await tx.get(redemptionDoc) : null;

    // ---- writes (Firestore requires all reads before writes) ----
    const update = {
      customerId: effectiveCustomerId,
      email: order.email || payerEmail || null,
      amountPaidCents: amountCents,
      paidAt: now,
      "stripe.paymentIntentId": paymentIntentId || null,
      "stripe.customerId": stripeCustomerId || null,
      updatedAt: now,
    };

    if (order.channel === "B2C") {
      update.paymentStatus = "PAID";
      if (shippingAddress) update.shippingAddress = shippingAddress;
      if (order.ambassador) {
        update["ambassador.status"] = "PENDING";
        update["ambassador.month"] = zurichMonth(now);
      }
      if (customerSnap?.exists) {
        const c = customerSnap.data();
        tx.update(customerDoc, {
          paidOrderCount: (c.paidOrderCount || 0) + 1,
          firstPaidOrderAt: c.firstPaidOrderAt || now,
          stripeCustomerId: c.stripeCustomerId || stripeCustomerId || null,
          updatedAt: now,
        });
      }
    } else {
      // B2B: the 20% deposit confirms the pre-order (decision B1).
      update.paymentStatus = "DEPOSIT_PAID";
      update.orderStatus = "CONFIRMED_PREORDER";
      update.confirmedAt = now;
    }
    tx.update(orderRef(db, ref), update);

    if (redemptionSnap?.exists && redemptionSnap.data().orderRef === ref) {
      tx.update(redemptionDoc, {
        status: "CONFIRMED",
        confirmedAt: now,
        updatedAt: now,
        history: FieldValue.arrayUnion({ status: "CONFIRMED", orderRef: ref, at: now }),
      });
    }

    const paymentId = paymentIntentId || `${ref}-${eventId}`;
    tx.set(db.collection(COL.payments).doc(paymentId), {
      orderRef: ref,
      kind: order.channel === "B2C" ? "FULL" : "DEPOSIT",
      provider: "STRIPE",
      amountCents,
      currency: order.currency,
      status: "SUCCEEDED",
      stripeReference: paymentIntentId || null,
      createdAt: now,
    });

    recordEvent(tx, eventDoc, eventType, ref, now);
    return { applied: true, order: deepMerge(order, { ...expand(update), ref }) };
  });
}

/** Checkout finished but the payment method confirms later (e.g. some bank methods). */
export async function applyPaymentProcessing(db, { eventId, eventType, ref, now = new Date() }) {
  return db.runTransaction(async (tx) => {
    const { eventDoc, duplicate, order } = await readEventAndOrder(tx, db, eventId, ref);
    if (duplicate) return { applied: false, duplicate: true };
    const redemptionDoc = order?.promo?.redemptionId ? db.collection(COL.promoRedemptions).doc(order.promo.redemptionId) : null;
    const redemptionSnap = redemptionDoc ? await tx.get(redemptionDoc) : null;

    const applies = order && PAYABLE[order.channel].includes(order.paymentStatus) && order.paymentStatus !== "PROCESSING";
    if (applies) {
      tx.update(orderRef(db, ref), { paymentStatus: "PROCESSING", updatedAt: now });
      if (redemptionSnap?.exists && redemptionSnap.data().orderRef === ref && redemptionSnap.data().status === "RESERVED") {
        tx.update(redemptionDoc, {
          status: "PROCESSING",
          updatedAt: now,
          history: FieldValue.arrayUnion({ status: "PROCESSING", orderRef: ref, at: now }),
        });
      }
    }
    recordEvent(tx, eventDoc, eventType, ref, now);
    return { applied: Boolean(applies) };
  });
}

/**
 * Checkout ended without payment: expired (customer left or cancelled) or
 * the delayed payment failed. Releases the promo reservation.
 * @param {"EXPIRED"|"FAILED"} outcome
 */
export async function applyCheckoutEnded(db, { eventId, eventType, ref, outcome, now = new Date() }) {
  return db.runTransaction(async (tx) => {
    const { eventDoc, duplicate, order } = await readEventAndOrder(tx, db, eventId, ref);
    if (duplicate) return { applied: false, duplicate: true };
    const redemptionDoc = order?.promo?.redemptionId ? db.collection(COL.promoRedemptions).doc(order.promo.redemptionId) : null;
    const redemptionSnap = redemptionDoc ? await tx.get(redemptionDoc) : null;

    const applies = order && PAYABLE[order.channel].includes(order.paymentStatus);
    if (applies) {
      tx.update(orderRef(db, ref), { paymentStatus: outcome, updatedAt: now });
      const r = redemptionSnap?.exists ? redemptionSnap.data() : null;
      if (r && r.orderRef === ref && ["RESERVED", "PROCESSING"].includes(r.status)) {
        tx.update(redemptionDoc, {
          status: "RELEASED",
          updatedAt: now,
          history: FieldValue.arrayUnion({ status: "RELEASED", orderRef: ref, reason: outcome, at: now }),
        });
      }
    }
    recordEvent(tx, eventDoc, eventType, ref, now);
    return { applied: Boolean(applies) };
  });
}

/**
 * Full refund (charge.refunded). The order becomes REFUNDED and an unpaid
 * ambassador commission is cancelled. The first-order discount is NOT given
 * back (proposed rule C5).
 */
export async function applyRefund(db, { eventId, eventType, paymentIntentId, fullyRefunded, now = new Date() }) {
  return db.runTransaction(async (tx) => {
    const eventDoc = db.collection(COL.stripeEvents).doc(eventId);
    if ((await tx.get(eventDoc)).exists) return { applied: false, duplicate: true };
    const paymentDoc = db.collection(COL.payments).doc(paymentIntentId);
    const paymentSnap = await tx.get(paymentDoc);
    const ref = paymentSnap.exists ? paymentSnap.data().orderRef : null;
    const orderSnap = ref ? await tx.get(orderRef(db, ref)) : null;

    let applied = false;
    if (fullyRefunded && orderSnap?.exists) {
      const order = orderSnap.data();
      const update = { paymentStatus: "REFUNDED", refundedAt: now, updatedAt: now };
      if (order.ambassador && order.ambassador.status !== "PAID") update["ambassador.status"] = "CANCELLED";
      tx.update(orderSnap.ref, update);
      tx.update(paymentDoc, { status: "REFUNDED" });
      applied = true;
    }
    tx.create(eventDoc, { type: eventType, orderRef: ref, receivedAt: now });
    return { applied, ref };
  });
}

// ---------- Admin actions ----------

/**
 * Records a bank transfer for a B2B invoice order.
 * DEPOSIT: AWAITING_DEPOSIT → DEPOSIT_PAID (+ CONFIRMED_PREORDER).
 * BALANCE: DEPOSIT_PAID → FULLY_PAID once the full total is paid.
 */
export async function recordManualPayment(db, { ref, kind, amountCents, adminEmail, now = new Date() }) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef(db, ref));
    if (!snap.exists) return { ok: false, code: "NOT_FOUND" };
    const order = snap.data();
    if (order.channel !== "B2B") return { ok: false, code: "NOT_B2B" };

    const expected = kind === "DEPOSIT" ? order.depositCents : order.totalCents - order.amountPaidCents;
    const amount = amountCents ?? expected;
    if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, code: "INVALID_AMOUNT" };

    const update = { updatedAt: now };
    if (kind === "DEPOSIT") {
      if (order.paymentStatus !== "AWAITING_DEPOSIT") return { ok: false, code: "DEPOSIT_NOT_EXPECTED" };
      if (amount !== order.depositCents) return { ok: false, code: "DEPOSIT_AMOUNT_MISMATCH" };
      update.paymentStatus = "DEPOSIT_PAID";
      update.orderStatus = "CONFIRMED_PREORDER";
      update.confirmedAt = now;
    } else {
      if (!["DEPOSIT_PAID"].includes(order.paymentStatus)) return { ok: false, code: "BALANCE_NOT_EXPECTED" };
      if (amount > order.totalCents - order.amountPaidCents) return { ok: false, code: "AMOUNT_TOO_HIGH" };
    }
    update.amountPaidCents = order.amountPaidCents + amount;
    if (kind === "BALANCE" && update.amountPaidCents >= order.totalCents) update.paymentStatus = "FULLY_PAID";

    tx.update(snap.ref, update);
    tx.create(db.collection(COL.payments).doc(), {
      orderRef: ref,
      kind,
      provider: "BANK_TRANSFER",
      amountCents: amount,
      currency: order.currency,
      status: "SUCCEEDED",
      stripeReference: null,
      recordedBy: adminEmail,
      createdAt: now,
    });
    return { ok: true, order: { ...order, ...update, ref } };
  });
}

/** Admin changes the order (fulfilment) status, only along allowed transitions. */
export async function setOrderStatus(db, { ref, orderStatus, adminEmail, now = new Date() }) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef(db, ref));
    if (!snap.exists) return { ok: false, code: "NOT_FOUND" };
    const order = snap.data();
    const allowed = ADMIN_ORDER_TRANSITIONS[order.channel][order.orderStatus] || [];
    if (!allowed.includes(orderStatus)) return { ok: false, code: "TRANSITION_NOT_ALLOWED", allowed };
    tx.update(snap.ref, {
      orderStatus,
      updatedAt: now,
      adminLog: FieldValue.arrayUnion({ action: `orderStatus:${orderStatus}`, by: adminEmail, at: now }),
    });
    return { ok: true };
  });
}

export async function markInvoiceSent(db, { ref, adminEmail, now = new Date() }) {
  const snap = await orderRef(db, ref).get();
  if (!snap.exists || snap.data().paymentWorkflow !== "INVOICE") return { ok: false, code: "NOT_INVOICE_ORDER" };
  await snap.ref.update({
    invoiceSentAt: now,
    updatedAt: now,
    adminLog: FieldValue.arrayUnion({ action: "invoiceSent", by: adminEmail, at: now }),
  });
  return { ok: true };
}

// ---------- Ambassador commissions ----------

export async function listCommissions(db, month) {
  const snap = await db.collection(COL.orders).where("ambassador.month", "==", month).get();
  return snap.docs.map((d) => ({ ref: d.id, ...d.data() }));
}

/** Marks all PENDING commissions of a month (for one ambassador) as PAID. */
export async function markCommissionsPaid(db, { month, ambassadorId, adminEmail, now = new Date() }) {
  const orders = await listCommissions(db, month);
  const toPay = orders.filter((o) => o.ambassador.ambassadorId === ambassadorId && o.ambassador.status === "PENDING" && o.paymentStatus === "PAID");
  const batch = db.batch();
  for (const o of toPay) {
    batch.update(orderRef(db, o.ref), {
      "ambassador.status": "PAID",
      "ambassador.paidAt": now,
      "ambassador.paidBy": adminEmail,
      updatedAt: now,
    });
  }
  await batch.commit();
  return { count: toPay.length, totalCents: toPay.reduce((s, o) => s + o.ambassador.commissionCents, 0) };
}

/** {"a.b": 1} → {a: {b: 1}} (to build an updated copy of an order). */
function expand(update) {
  const out = {};
  for (const [key, value] of Object.entries(update)) {
    const parts = key.split(".");
    let target = out;
    while (parts.length > 1) {
      const k = parts.shift();
      target[k] = target[k] || {};
      target = target[k];
    }
    target[parts[0]] = value;
  }
  return out;
}

function deepMerge(base, extra) {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    const isPlainObject = v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);
    out[k] = isPlainObject && base[k] && typeof base[k] === "object" ? deepMerge(base[k], v) : v;
  }
  return out;
}


/** Adds a review flag to an order (e.g. "AMOUNT_MISMATCH"). */
export async function addOrderFlag(db, ref, flag) {
  await orderRef(db, ref).update({ flags: FieldValue.arrayUnion(flag), updatedAt: new Date() });
}

export async function listOrdersOfCustomer(db, customerId) {
  const snap = await db.collection(COL.orders).where("customerId", "==", customerId).get();
  return snap.docs.map((d) => ({ ref: d.id, ...d.data() }));
}
