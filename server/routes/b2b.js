/**
 * B2B partner store.
 *   POST /api/b2b/apply      (signed in)          partner application
 *   GET  /api/b2b/status     (signed in)          { approvalStatus }
 *   GET  /api/b2b/catalog    (approved partner)   prices and rules
 *   POST /api/b2b/preorder   (approved partner)   { sku, quantity, workflow: "STRIPE"|"INVOICE", lang? }
 */
import { Router } from "express";
import * as v from "../lib/validate.js";
import { rateLimits } from "../middleware/security.js";
import { requireApprovedPartner, requireCustomer } from "../middleware/session.js";
import { getCustomer } from "../db/customers.js";

export function b2bRoutes(ctx) {
  const router = Router();
  const approved = requireApprovedPartner(ctx);

  router.post("/apply", rateLimits.forms(), requireCustomer, async (req, res) => {
    const details = {
      fullName: v.text(req.body, "fullName", { max: 120 }),
      companyName: v.text(req.body, "companyName", { max: 160 }),
      businessAddress: v.text(req.body, "businessAddress", { max: 300 }),
      phone: v.text(req.body, "phone", { max: 40 }),
    };
    const customer = await getCustomer(ctx.db, req.customerSession.customerId);
    res.json(await ctx.b2b.apply(customer, details));
  });

  router.get("/status", requireCustomer, async (req, res) => {
    res.json(await ctx.b2b.status(req.customerSession.customerId));
  });

  router.get("/catalog", approved, (_req, res) => {
    res.json(ctx.b2b.catalog());
  });

  router.post("/preorder", rateLimits.checkout(), approved, async (req, res) => {
    const sku = v.text(req.body, "sku", { max: 40 });
    const quantity = v.integer(req.body, "quantity");
    const workflow = v.oneOf(req.body, "workflow", ["STRIPE", "INVOICE"]);
    const lang = req.body.lang === "de" ? "de" : "en";
    res.json(await ctx.b2b.preorder({ partner: req.partner, customer: req.customer, sku, quantity, workflow, lang }));
  });

  return router;
}
