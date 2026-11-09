/**
 * Email verification codes and sessions (passwordless sign-in).
 * Codes and session tokens are stored ONLY as hashes.
 */
import { COL } from "./firestore.js";
import { toDate } from "../lib/dates.js";
import { safeEqualHex } from "../lib/ids.js";

export const CODE_TTL_MINUTES = 15;
export const CODE_MAX_ATTEMPTS = 5;
export const CODE_RESEND_SECONDS = 60;

/**
 * Stores a new code for an email (replaces any previous one).
 * @returns {Promise<{ok: true} | {ok: false, retryAfterSeconds: number}>}
 */
export async function saveVerificationCode(db, emailKey, codeHash, now = new Date()) {
  const ref = db.collection(COL.verificationCodes).doc(emailKey);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const last = snap.exists ? toDate(snap.data().lastSentAt) : null;
    if (last) {
      const elapsed = (now - last) / 1000;
      if (elapsed < CODE_RESEND_SECONDS) return { ok: false, retryAfterSeconds: Math.ceil(CODE_RESEND_SECONDS - elapsed) };
    }
    tx.set(ref, {
      codeHash,
      attempts: 0,
      expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60_000),
      lastSentAt: now,
    });
    return { ok: true };
  });
}

/**
 * Checks a code. Wrong attempts are counted; after 5 the code is dead.
 * A correct code is deleted immediately (single use).
 * @returns {Promise<"OK" | "INVALID" | "EXPIRED" | "TOO_MANY_ATTEMPTS">}
 */
export async function consumeVerificationCode(db, emailKey, codeHash, now = new Date()) {
  const ref = db.collection(COL.verificationCodes).doc(emailKey);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return "INVALID";
    const data = snap.data();
    if (toDate(data.expiresAt) <= now) {
      tx.delete(ref);
      return "EXPIRED";
    }
    if (data.attempts >= CODE_MAX_ATTEMPTS) return "TOO_MANY_ATTEMPTS";
    if (!safeEqualHex(data.codeHash, codeHash)) {
      tx.update(ref, { attempts: data.attempts + 1 });
      return data.attempts + 1 >= CODE_MAX_ATTEMPTS ? "TOO_MANY_ATTEMPTS" : "INVALID";
    }
    tx.delete(ref);
    return "OK";
  });
}

export async function createSession(db, tokenHash, { customerId, role, expiresAt }) {
  await db.collection(COL.sessions).doc(tokenHash).create({ customerId, role, expiresAt, createdAt: new Date() });
}

/** @returns {Promise<{customerId: string, role: string} | null>} */
export async function getSession(db, tokenHash, now = new Date()) {
  const snap = await db.collection(COL.sessions).doc(tokenHash).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (toDate(data.expiresAt) <= now) return null;
  return { customerId: data.customerId, role: data.role };
}

export async function deleteSession(db, tokenHash) {
  await db.collection(COL.sessions).doc(tokenHash).delete();
}
