import { COL } from "./firestore.js";
import { normalizeEmail } from "../lib/email-address.js";
import { randomRef, sha256 } from "../lib/ids.js";
import { toDate } from "../lib/dates.js";

export { toDate };


export function emailKey(email) {
  return sha256(normalizeEmail(email));
}

/**
 * Finds the customer for an email, or creates one.
 * One email (after normalisation) = one customer, guaranteed by the
 * deterministic document emailIndex/{sha256(email)} created in a transaction.
 * @returns {Promise<string>} customerId
 */
export async function getOrCreateCustomerByEmail(db, email, details = {}) {
  const normalized = normalizeEmail(email);
  const indexRef = db.collection(COL.emailIndex).doc(sha256(normalized));

  return db.runTransaction(async (tx) => {
    const index = await tx.get(indexRef);
    if (index.exists) return index.data().customerId;

    const customerId = randomRef("CUS", 8);
    const now = new Date();
    tx.create(indexRef, { customerId, createdAt: now });
    tx.create(db.collection(COL.customers).doc(customerId), {
      email: String(email).trim(),
      emailNormalized: normalized,
      emailVerifiedAt: null,
      fullName: details.fullName || null,
      phone: details.phone || null,
      stripeCustomerId: null,
      paidOrderCount: 0,
      firstPaidOrderAt: null,
      createdAt: now,
      updatedAt: now,
    });
    return customerId;
  });
}

export async function getCustomer(db, customerId) {
  const snap = await db.collection(COL.customers).doc(customerId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

export async function markEmailVerified(db, customerId) {
  const ref = db.collection(COL.customers).doc(customerId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.data().emailVerifiedAt) tx.update(ref, { emailVerifiedAt: new Date(), updatedAt: new Date() });
  });
}

export async function updateCustomer(db, customerId, fields) {
  await db.collection(COL.customers).doc(customerId).update({ ...fields, updatedAt: new Date() });
}

