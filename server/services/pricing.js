/**
 * Pricing: pure functions, no database, no Stripe.
 * The ONLY place where order amounts are calculated.
 * Inputs come from the browser, so everything is validated here.
 */
import { B2B_PRODUCTS, B2B_RULES, B2C_PRODUCTS, B2C_RULES, PROMO_RULES } from "../config/catalog.js";
import { badRequest, unavailable } from "../lib/errors.js";
import { percentOf } from "../lib/money.js";

/**
 * Validates a B2C cart and returns the priced lines.
 * @param {Array<{sku: string, quantity: number}>} items  from the browser
 */
export function priceB2cCart(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw badRequest("CART_EMPTY", "Your cart is empty.");
  }
  if (items.length > Object.keys(B2C_PRODUCTS).length) {
    throw badRequest("INVALID_CART", "Invalid cart.");
  }

  const seen = new Set();
  const lines = items.map((item) => {
    const product = B2C_PRODUCTS[item?.sku];
    if (!product) throw badRequest("INVALID_PRODUCT", "This product is not available in the shop.");
    if (seen.has(product.sku)) throw badRequest("INVALID_CART", "Each product may appear only once in the cart.");
    seen.add(product.sku);
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw badRequest("INVALID_QUANTITY", "Quantity must be a whole number of cases.");
    }
    return {
      sku: product.sku,
      name: product.name,
      unitPriceCents: product.priceCents,
      quantity: item.quantity,
      lineTotalCents: product.priceCents * item.quantity,
    };
  });

  const totalCases = lines.reduce((n, l) => n + l.quantity, 0);
  if (totalCases > B2C_RULES.maxCasesPerOrder) {
    throw badRequest("TOO_MANY_CASES", `Maximum ${B2C_RULES.maxCasesPerOrder} cases per order.`);
  }

  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  return { lines, totalCases, subtotalCents };
}

/**
 * Discount for a promo code on a priced B2C cart.
 * @param {"WELCOME"|"AMBASSADOR"} kind
 */
export function b2cDiscountCents(kind, cart) {
  if (kind === "WELCOME") {
    return percentOf(cart.subtotalCents, PROMO_RULES.welcome.percentOffProducts);
  }
  if (kind === "AMBASSADOR") {
    // 20% of ONE case: the first case in the cart (all B2C cases cost the same today).
    return percentOf(cart.lines[0].unitPriceCents, PROMO_RULES.ambassador.percentOffOneCase);
  }
  throw new Error(`Unknown discount kind ${kind}`);
}

/**
 * Shipping for B2C (Switzerland only). The cost is still an open business
 * decision, so checkout is disabled until SHIPPING_CH_CENTS is configured.
 */
export function b2cShippingCents(shippingConfig, subtotalAfterDiscountCents) {
  if (shippingConfig.chCents === null) {
    throw unavailable("SHIPPING_NOT_CONFIGURED", "Online checkout is not open yet.");
  }
  if (shippingConfig.freeFromCents !== null && subtotalAfterDiscountCents >= shippingConfig.freeFromCents) return 0;
  return shippingConfig.chCents;
}

/**
 * B2B pre-order: exactly 5 or 10 cases of ONE flavour.
 * Returns all amounts the partner sees and the deposit to pay now.
 */
export function priceB2bPreorder(sku, quantity) {
  const product = B2B_PRODUCTS[sku];
  if (!product) throw badRequest("INVALID_PRODUCT", "Please choose Biting Lulo or Pink Guava.");
  if (!Number.isInteger(quantity) || !B2B_RULES.allowedQuantities.includes(quantity)) {
    throw badRequest("INVALID_QUANTITY", `Partner pre-orders are ${B2B_RULES.allowedQuantities.join(" or ")} cases.`);
  }

  const unitDiscountCents = percentOf(product.priceCents, B2B_RULES.partnerDiscountPct);
  const unitPartnerPriceCents = product.priceCents - unitDiscountCents;
  const subtotalCents = product.priceCents * quantity;
  const discountCents = unitDiscountCents * quantity;
  const totalCents = unitPartnerPriceCents * quantity;
  const depositCents = percentOf(totalCents, B2B_RULES.depositPct);

  return {
    lines: [
      {
        sku: product.sku,
        name: product.name,
        unitPriceCents: product.priceCents,
        unitPartnerPriceCents,
        quantity,
        lineTotalCents: totalCents,
      },
    ],
    subtotalCents,
    discountCents,
    totalCents,
    depositCents,
    balanceCents: totalCents - depositCents,
  };
}
