/**
 * Promo code eligibility rules: pure functions, no database.
 * Called INSIDE the Firestore transaction that reserves a code, so the
 * decision is always based on the latest, locked data.
 *
 * Owner decisions (docs/ARCHITECTURE.md §11):
 *  - WELCOME20 and ambassador codes are both FIRST ORDER ONLY (C3, A1, A3).
 *  - Both need a verified email (A5).
 *  - One code per order; they can't be combined (A4).
 */
import { toDate } from "../lib/dates.js";

/**
 * Document ID of the redemption record.
 *
 * All first-order codes share ONE record per customer ("FIRST_ORDER__CUS-…"),
 * so a customer can never get two first-order discounts, not even with two
 * different codes in two parallel checkouts. Other codes (none yet) would get
 * one record per code and customer.
 */
export function redemptionId(promo, customerId) {
  const scope = promo.firstPurchaseOnly ? "FIRST_ORDER" : promo.code;
  return `${scope}__${customerId}`;
}

export function isReservationActive(redemption, now) {
  return redemption?.status === "RESERVED" && toDate(redemption.reservedUntil) > now;
}

/**
 * @returns {{ok: true} | {ok: false, status: number, code: string, message: string}}
 */
export function checkEligibility({ promo, customer, redemption, now }) {
  const no = (status, code, message) => ({ ok: false, status, code, message });

  if (!promo) return no(400, "PROMO_INVALID", "This code is not valid.");
  if (!promo.active) return no(400, "PROMO_INACTIVE", "This code is no longer active.");
  if (promo.startsAt && toDate(promo.startsAt) > now) return no(400, "PROMO_NOT_STARTED", "This code is not active yet.");
  if (promo.endsAt && toDate(promo.endsAt) <= now) return no(400, "PROMO_EXPIRED", "This code has expired.");
  if (promo.channel !== "B2C") return no(400, "PROMO_NOT_APPLICABLE", "This code can't be used in the shop.");

  if (promo.requiresVerifiedEmail && !customer?.emailVerifiedAt) {
    return no(401, "VERIFICATION_REQUIRED", "Please verify your email to use this code.");
  }
  if (promo.firstPurchaseOnly && (customer?.paidOrderCount ?? 0) > 0) {
    return no(409, "PROMO_FIRST_ORDER_ONLY", "This code is only valid on your first order.");
  }
  if (redemption?.status === "CONFIRMED") {
    return no(409, "PROMO_ALREADY_USED", "You have already used a first-order discount.");
  }
  if (redemption?.status === "PROCESSING") {
    return no(409, "PROMO_PAYMENT_PROCESSING", "A payment with this discount is still being confirmed.");
  }
  return { ok: true };
}
