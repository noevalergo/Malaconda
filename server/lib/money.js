/**
 * Money helpers. ALL amounts in this project are integer cents (CHF 48.60 → 4860).
 * Never use floating point for money.
 */

/** pct % of cents, rounded to the nearest cent. percentOf(11700, 20) → 2340 */
export function percentOf(cents, pct) {
  assertCents(cents);
  return Math.round((cents * pct) / 100);
}

/** 4860 → "CHF 48.60" */
export function formatChf(cents) {
  assertCents(cents);
  const sign = cents < 0 ? "−" : "";
  const abs = Math.abs(cents);
  return `${sign}CHF ${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function assertCents(value) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`Expected integer cents, got ${value}`);
  }
}
