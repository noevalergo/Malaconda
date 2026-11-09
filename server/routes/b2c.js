/**
 * B2C shop.
 *   POST /api/b2c/promo/check  { code, items }  → shows the discount, reserves nothing
 *   POST /api/b2c/checkout     { items, promoCode?, lang? }  → { url } of Stripe Checkout
 *
 * items = [{ sku: "B2C_LULO_12", quantity: 2 }, …]. Prices are never accepted
 * from the browser.
 */
import { Router } from "express";
import * as v from "../lib/validate.js";
import { rateLimits } from "../middleware/security.js";

export function b2cRoutes(ctx) {
  const router = Router();

  router.post("/promo/check", rateLimits.checkout(), async (req, res) => {
    const code = v.text(req.body, "code", { max: 40 });
    const result = await ctx.b2c.checkPromo({ code, items: req.body.items, customerId: req.customerSession?.customerId });
    res.json(result);
  });

  router.post("/checkout", rateLimits.checkout(), async (req, res) => {
    const promoCode = v.text(req.body, "promoCode", { max: 40, required: false }) || null;
    const lang = req.body.lang === "de" ? "de" : "en";
    const result = await ctx.b2c.start({ items: req.body.items, promoCode, lang, customerId: req.customerSession?.customerId || null });
    res.json(result);
  });

  return router;
}
