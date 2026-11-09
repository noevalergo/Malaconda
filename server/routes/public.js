/**
 * Public, read-only data for the website. Never returns customer data or
 * B2B prices (those require an approved partner session).
 */
import { Router } from "express";
import { B2C_PRODUCTS, B2C_RULES, CURRENCY, PREORDER_TIMELINE } from "../config/catalog.js";

export function publicRoutes(ctx) {
  const router = Router();

  router.get("/health", (_req, res) => res.json({ ok: true }));

  router.get("/config", (_req, res) => {
    res.json({
      currency: CURRENCY,
      b2c: {
        products: Object.values(B2C_PRODUCTS).map(({ sku, flavour, name, bottles, priceCents }) => ({ sku, flavour, name, bottles, priceCents })),
        maxCasesPerOrder: B2C_RULES.maxCasesPerOrder,
        shippingCents: ctx.config.shipping.chCents,
        freeShippingFromCents: ctx.config.shipping.freeFromCents,
        checkoutOpen: ctx.config.shipping.chCents !== null,
      },
      preorderTimeline: PREORDER_TIMELINE,
    });
  });

  return router;
}
