/**
 * Unit tests: pure business rules (no database, no network).
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { b2cDiscountCents, b2cShippingCents, priceB2bPreorder, priceB2cCart } from "../server/services/pricing.js";
import { checkEligibility, redemptionId } from "../server/services/promo-rules.js";
import { isValidEmail, normalizeEmail } from "../server/lib/email-address.js";
import { formatChf, percentOf } from "../server/lib/money.js";
import { loadConfig } from "../server/config/env.js";

const err = (fn, code) => assert.throws(fn, (e) => e.code === code);

test("B2C: one case of each flavour costs CHF 39.00", () => {
  for (const sku of ["B2C_LULO_12", "B2C_GUAVA_12"]) {
    const cart = priceB2cCart([{ sku, quantity: 1 }]);
    assert.equal(cart.subtotalCents, 3900);
  }
});

test("B2C: mixed cart, browser price fields are ignored", () => {
  const cart = priceB2cCart([
    { sku: "B2C_LULO_12", quantity: 2, priceCents: 1 },
    { sku: "B2C_GUAVA_12", quantity: 1, price: 0.01 },
  ]);
  assert.equal(cart.subtotalCents, 3 * 3900);
  assert.equal(cart.totalCases, 3);
});

test("B2C: max 10 cases, whole cases only, no B2B products, no duplicates", () => {
  err(() => priceB2cCart([{ sku: "B2C_LULO_12", quantity: 11 }]), "TOO_MANY_CASES");
  err(() => priceB2cCart([{ sku: "B2C_LULO_12", quantity: 6 }, { sku: "B2C_GUAVA_12", quantity: 5 }]), "TOO_MANY_CASES");
  err(() => priceB2cCart([{ sku: "B2C_LULO_12", quantity: 1.5 }]), "INVALID_QUANTITY");
  err(() => priceB2cCart([{ sku: "B2C_LULO_12", quantity: 0 }]), "INVALID_QUANTITY");
  err(() => priceB2cCart([{ sku: "B2B_LULO_24", quantity: 1 }]), "INVALID_PRODUCT");
  err(() => priceB2cCart([{ sku: "LULO_BOTTLE", quantity: 1 }]), "INVALID_PRODUCT");
  err(() => priceB2cCart([{ sku: "B2C_LULO_12", quantity: 1 }, { sku: "B2C_LULO_12", quantity: 1 }]), "INVALID_CART");
  err(() => priceB2cCart([]), "CART_EMPTY");
  err(() => priceB2cCart("x"), "CART_EMPTY");
});

test("WELCOME20 = 20% of products; ambassador = 20% of ONE case", () => {
  const cart = priceB2cCart([{ sku: "B2C_LULO_12", quantity: 3 }]); // CHF 117
  assert.equal(b2cDiscountCents("WELCOME", cart), 2340);
  assert.equal(b2cDiscountCents("AMBASSADOR", cart), 780);
});

test("Shipping: disabled until configured; optional free-shipping threshold", () => {
  err(() => b2cShippingCents({ chCents: null, freeFromCents: null }, 3900), "SHIPPING_NOT_CONFIGURED");
  assert.equal(b2cShippingCents({ chCents: 900, freeFromCents: null }, 3900), 900);
  assert.equal(b2cShippingCents({ chCents: 900, freeFromCents: 10000 }, 11700), 0);
});

test("B2B: 5 or 10 cases of one flavour, 10% off, 20% deposit", () => {
  const five = priceB2bPreorder("B2B_LULO_24", 5);
  assert.deepEqual(
    { sub: five.subtotalCents, disc: five.discountCents, total: five.totalCents, dep: five.depositCents, bal: five.balanceCents, unit: five.lines[0].unitPartnerPriceCents },
    { sub: 27000, disc: 2700, total: 24300, dep: 4860, bal: 19440, unit: 4860 },
  );
  const ten = priceB2bPreorder("B2B_GUAVA_24", 10);
  assert.deepEqual([ten.totalCents, ten.depositCents, ten.balanceCents], [48600, 9720, 38880]);
  for (const q of [1, 4, 6, 7, 8, 9, 11, 5.5, "5"]) err(() => priceB2bPreorder("B2B_LULO_24", q), "INVALID_QUANTITY");
  err(() => priceB2bPreorder("B2C_LULO_12", 5), "INVALID_PRODUCT");
});

test("Promo rules: eligibility decisions", () => {
  const now = new Date("2027-01-10T10:00:00Z");
  const promo = { code: "WELCOME20", kind: "WELCOME", channel: "B2C", active: true, requiresVerifiedEmail: true, firstPurchaseOnly: true };
  const verified = { emailVerifiedAt: new Date("2027-01-01"), paidOrderCount: 0 };

  assert.equal(checkEligibility({ promo: null, now }).code, "PROMO_INVALID");
  assert.equal(checkEligibility({ promo: { ...promo, active: false }, customer: verified, now }).code, "PROMO_INACTIVE");
  assert.equal(checkEligibility({ promo: { ...promo, endsAt: new Date("2027-01-01") }, customer: verified, now }).code, "PROMO_EXPIRED");
  assert.equal(checkEligibility({ promo: { ...promo, channel: "B2B" }, customer: verified, now }).code, "PROMO_NOT_APPLICABLE");
  assert.equal(checkEligibility({ promo, customer: { paidOrderCount: 0 }, now }).code, "VERIFICATION_REQUIRED");
  assert.equal(checkEligibility({ promo, customer: { ...verified, paidOrderCount: 1 }, now }).code, "PROMO_FIRST_ORDER_ONLY");
  assert.equal(checkEligibility({ promo, customer: verified, redemption: { status: "CONFIRMED" }, now }).code, "PROMO_ALREADY_USED");
  assert.equal(checkEligibility({ promo, customer: verified, redemption: { status: "RELEASED" }, now }).ok, true);
  assert.equal(checkEligibility({ promo, customer: verified, now }).ok, true);
  // WELCOME20 and ambassador codes share one first-order record per customer
  assert.equal(redemptionId(promo, "CUS-1"), redemptionId({ ...promo, code: "MARIA", kind: "AMBASSADOR" }, "CUS-1"));
});

test("Email normalisation and validation", () => {
  assert.equal(normalizeEmail(" Ana.Muster+shop@GoogleMail.com "), "anamuster@gmail.com");
  assert.equal(normalizeEmail("a.b+x@bluewin.ch"), "a.b@bluewin.ch");
  assert.ok(isValidEmail("bar@hotel.ch"));
  assert.ok(!isValidEmail("not-an-email"));
  assert.ok(!isValidEmail("a b@c.ch"));
});

test("Money helpers use integer cents", () => {
  assert.equal(percentOf(5400, 10), 540);
  assert.equal(formatChf(4860), "CHF 48.60");
  assert.equal(formatChf(-780), "−CHF 7.80");
  assert.throws(() => percentOf(48.6, 10));
});

test("Config: refuses live Stripe keys unless explicitly allowed", () => {
  const base = { SESSION_SECRET: "y".repeat(40), STRIPE_WEBHOOK_SECRET: "whsec_x", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" };
  assert.ok(loadConfig({ ...base, STRIPE_SECRET_KEY: "sk_live_abc" }).problems.some((p) => p.includes("LIVE")));
  assert.equal(loadConfig({ ...base, STRIPE_SECRET_KEY: "sk_test_abc" }).problems.length, 0);
  assert.ok(loadConfig({ ...base, STRIPE_SECRET_KEY: "sk_test_abc", SESSION_SECRET: "short" }).problems.length > 0);
});
