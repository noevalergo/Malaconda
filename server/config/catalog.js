/**
 * MALACONDA — CATALOGUE AND BUSINESS RULES (single source of truth for prices)
 *
 * Every price, quantity limit and discount rule lives here. The browser never
 * decides a price: the server always recalculates from this file.
 *
 * All amounts are integer cents, VAT included (owner decisions C1, B7).
 * Changing a value here = a code change reviewed through a Pull Request.
 * See docs/ARCHITECTURE.md §11 for the decisions behind each value.
 */

export const CURRENCY = "CHF";

// ---------- B2C: individual customers (shop on "/") ----------
// Only one format: a case of 12 bottles. No single bottles, no 24-bottle cases.
export const B2C_PRODUCTS = Object.freeze({
  B2C_LULO_12: { sku: "B2C_LULO_12", flavour: "lulo", name: "Biting Lulo · case of 12 × 20 cl", bottles: 12, priceCents: 3900 },
  B2C_GUAVA_12: { sku: "B2C_GUAVA_12", flavour: "guava", name: "Pink Guava · case of 12 × 20 cl", bottles: 12, priceCents: 3900 },
});

export const B2C_RULES = Object.freeze({
  maxCasesPerOrder: 10, // decision C2: total cases per order
  shippingCountries: ["CH"], // decision G2: Switzerland only
  // Shipping cost is NOT decided yet (open question G2b) → environment
  // variable SHIPPING_CH_CENTS. B2C checkout refuses to run until it is set.
});

// ---------- B2B: approved partners (store on "/partners") ----------
// One flavour per case, and one flavour per order: 5 or 10 cases (decision B3).
export const B2B_PRODUCTS = Object.freeze({
  B2B_LULO_24: { sku: "B2B_LULO_24", flavour: "lulo", name: "Biting Lulo · case of 24 × 20 cl", bottles: 24, priceCents: 5400 },
  B2B_GUAVA_24: { sku: "B2B_GUAVA_24", flavour: "guava", name: "Pink Guava · case of 24 × 20 cl", bottles: 24, priceCents: 5400 },
});

export const B2B_RULES = Object.freeze({
  allowedQuantities: [5, 10], // exactly 5 or 10 cases
  partnerDiscountPct: 10, // CHF 54.00 → CHF 48.60 per case
  depositPct: 20, // paid now; the remaining 80% on delivery (never charged automatically)
});

// ---------- Promotions ----------
export const PROMO_RULES = Object.freeze({
  welcome: {
    code: "WELCOME20",
    percentOffProducts: 20, // 20% of the product subtotal (shipping excluded)
  },
  ambassador: {
    percentOffOneCase: 20, // decision A1: 20% of the FIRST case only
    commissionCents: 500, // decision A2: CHF 5 fixed per order
  },
});

// ---------- Partner pre-order timeline (shown on the website) ----------
export const PREORDER_TIMELINE = Object.freeze([
  { key: "registration-deadline", date: "2027-01-31", label: "Registration and 20% deposit deadline" },
  { key: "allocation-binding", date: "2027-02-28", label: "Full allocation becomes binding" },
  { key: "delivery", date: "2027-04", label: "Delivery and remaining 80% balance payment" },
]);

// ---------- Checkout ----------
export const CHECKOUT_EXPIRY_MINUTES = 30; // Stripe minimum is 30 minutes
export const RESERVATION_GRACE_MINUTES = 5; // promo reservation outlives the Stripe session a little
