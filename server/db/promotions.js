/**
 * Promo codes, ambassadors and the redemption reservation.
 *
 * Life of a redemption record (promoRedemptions/{FIRST_ORDER__customerId}):
 *
 *   (none) ──reserve──► RESERVED ──payment confirmed──► CONFIRMED (final)
 *                          │  └──delayed payment──► PROCESSING ──► CONFIRMED / RELEASED
 *                          └──expired / failed / cancelled──► RELEASED ──reserve──► RESERVED …
 *
 * A RESERVED record whose reservedUntil has passed counts as released.
 */
import { FieldValue } from "firebase-admin/firestore";
import { COL } from "./firestore.js";
import { toDate } from "../lib/dates.js";
import { checkEligibility, isReservationActive, redemptionId } from "../services/promo-rules.js";
import { randomRef, sha256 } from "../lib/ids.js";

export function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

export async function getPromo(db, code) {
  const id = normalizeCode(code);
  if (!/^[A-Z0-9_-]{2,40}$/.test(id)) return null;
  const snap = await db.collection(COL.promoCodes).doc(id).get();
  return snap.exists ? { code: snap.id, ...snap.data() } : null;
}

/** Read-only check (no reservation), used to show the discount in the cart. */
export async function previewEligibility(db, code, customerId, now = new Date()) {
  const promo = await getPromo(db, code);
  if (!promo) return { promo: null, result: checkEligibility({ promo: null, now }) };
  const customer = customerId ? (await db.collection(COL.customers).doc(customerId).get()).data() : null;
  const redemption = customerId
    ? (await db.collection(COL.promoRedemptions).doc(redemptionId(promo, customerId)).get()).data()
    : null;
  const result = checkEligibility({ promo, customer, redemption, now });
  return { promo, result, activeReservation: isReservationActive(redemption, now) ? redemption : null };
}

/**
 * Reserves a promo code for a new order, and creates the order, in ONE
 * transaction. Firestore server transactions lock the documents they read,
 * so two parallel checkouts of the same customer can't both succeed.
 *
 * @returns {Promise<
 *   {ok: true, redemptionId: string} |
 *   {ok: false, status: number, code: string, message: string, activeSessionId?: string, activeOrderRef?: string}
 * >}
 */
export async function reservePromoAndCreateOrder(db, { code, customerId, orderRef, order, reservedUntil, now = new Date() }) {
  const promoRef = db.collection(COL.promoCodes).doc(normalizeCode(code));
  const customerRef = db.collection(COL.customers).doc(customerId);
  const orderDocRef = db.collection(COL.orders).doc(orderRef);

  return db.runTransaction(async (tx) => {
    const promoSnap = await tx.get(promoRef);
    const promo = promoSnap.exists ? { code: promoSnap.id, ...promoSnap.data() } : null;
    const customerSnap = await tx.get(customerRef);
    const rid = promo ? redemptionId(promo, customerId) : null;
    const redemptionRef = rid ? db.collection(COL.promoRedemptions).doc(rid) : null;
    const redemption = redemptionRef ? (await tx.get(redemptionRef)).data() : null;

    const result = checkEligibility({ promo, customer: customerSnap.data(), redemption, now });
    if (!result.ok) return result;

    if (isReservationActive(redemption, now)) {
      // Another checkout with this discount is open. The caller decides what to do.
      return {
        ok: false,
        status: 409,
        code: redemption.checkoutSessionId ? "ACTIVE_CHECKOUT" : "CHECKOUT_IN_PROGRESS",
        message: "Another checkout with this discount is in progress.",
        activeSessionId: redemption.checkoutSessionId || undefined,
        activeOrderRef: redemption.orderRef,
      };
    }

    tx.set(redemptionRef, {
      status: "RESERVED",
      code: promo.code,
      kind: promo.kind,
      ambassadorId: promo.ambassadorId || null,
      customerId,
      orderRef,
      checkoutSessionId: null,
      reservedUntil,
      updatedAt: now,
      history: FieldValue.arrayUnion({ status: "RESERVED", orderRef, at: now }),
    });
    tx.create(orderDocRef, { ...order, promo: { code: promo.code, kind: promo.kind, redemptionId: rid, ambassadorId: promo.ambassadorId || null } });
    return { ok: true, redemptionId: rid };
  });
}

/**
 * Releases a reservation, but only if it still belongs to `orderRef`
 * (never touches a newer reservation or a confirmed one).
 */
export async function releaseRedemption(db, rid, orderRef, reason, now = new Date()) {
  const ref = db.collection(COL.promoRedemptions).doc(rid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const r = snap.data();
    if (r.orderRef !== orderRef || !["RESERVED", "PROCESSING"].includes(r.status)) return false;
    tx.update(ref, {
      status: "RELEASED",
      updatedAt: now,
      history: FieldValue.arrayUnion({ status: "RELEASED", orderRef, reason, at: now }),
    });
    return true;
  });
}

/** Writes the Stripe session ID on both the reservation and the order. */
export async function attachCheckoutSession(db, { rid, orderRef, sessionId }) {
  const batch = db.batch();
  if (rid) batch.update(db.collection(COL.promoRedemptions).doc(rid), { checkoutSessionId: sessionId });
  batch.update(db.collection(COL.orders).doc(orderRef), { "stripe.checkoutSessionId": sessionId, updatedAt: new Date() });
  await batch.commit();
}

// ---------- Ambassadors ----------

/** Creates an ambassador and their personal code (fails if the code exists). */
export async function createAmbassador(db, { name, email, code, commissionCents, now = new Date() }) {
  const promoRef = db.collection(COL.promoCodes).doc(normalizeCode(code));
  const ambassadorId = randomRef("AMB", 6);
  const ambassadorRef = db.collection(COL.ambassadors).doc(ambassadorId);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(promoRef);
    if (existing.exists) {
      const err = new Error("CODE_EXISTS");
      err.code = "CODE_EXISTS";
      throw err;
    }
    tx.create(ambassadorRef, { name, email, code: promoRef.id, commissionCents, active: true, createdAt: now });
    tx.create(promoRef, ambassadorPromo(promoRef.id, ambassadorId, now));
  });
  return { ambassadorId, code: promoRef.id };
}

export function ambassadorPromo(code, ambassadorId, now) {
  return {
    kind: "AMBASSADOR",
    channel: "B2C",
    active: true,
    startsAt: null,
    endsAt: null,
    ambassadorId,
    requiresVerifiedEmail: true,
    firstPurchaseOnly: true,
    createdAt: now,
  };
}

export function welcomePromo(now) {
  return {
    kind: "WELCOME",
    channel: "B2C",
    active: true,
    startsAt: null,
    endsAt: null,
    ambassadorId: null,
    requiresVerifiedEmail: true,
    firstPurchaseOnly: true,
    createdAt: now,
  };
}

export async function setAmbassadorActive(db, ambassadorId, active) {
  const ref = db.collection(COL.ambassadors).doc(ambassadorId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });
    tx.update(ref, { active });
    tx.update(db.collection(COL.promoCodes).doc(snap.data().code), { active });
  });
}

export async function listAmbassadors(db) {
  const snap = await db.collection(COL.ambassadors).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}


// ---------- Duplicate-use signals (recorded after payment, never blocking) ----------

/**
 * Remembers which customer first used a first-order discount with a given
 * card fingerprint or shipping address. If a DIFFERENT customer (other email)
 * later uses a first-order discount with the same card/address, the caller
 * flags the order for review. Values are stored hashed.
 * @returns {Promise<{duplicateOfOrder: string|null}>}
 */
export async function recordPromoSignal(db, { type, value, customerId, orderRef, now = new Date() }) {
  const ref = db.collection(COL.promoSignals).doc(`${type}__${sha256(value)}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const first = snap.data();
      return { duplicateOfOrder: first.customerId !== customerId ? first.orderRef : null };
    }
    tx.create(ref, { type, customerId, orderRef, createdAt: now });
    return { duplicateOfOrder: null };
  });
}
