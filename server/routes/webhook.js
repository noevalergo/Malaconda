/**
 * POST /api/stripe/webhook
 *
 * Needs the RAW request body for the signature check, so it is mounted
 * before the JSON body parser (see server/app.js).
 */
import express, { Router } from "express";

export function webhookRoutes(ctx) {
  const router = Router();

  router.post("/", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
    let event;
    try {
      event = ctx.stripe.constructEvent(req.body, req.headers["stripe-signature"]);
    } catch {
      ctx.log.warn("webhook.bad_signature", {});
      return res.status(400).json({ error: { code: "BAD_SIGNATURE", message: "Invalid signature." } });
    }

    try {
      const result = await ctx.handleStripeEvent(event);
      res.json({ received: true, result });
    } catch (err) {
      // 500 → Stripe retries later. Safe: processing is idempotent.
      ctx.log.error("webhook.failed", { eventId: event.id, type: event.type, error: err.message });
      res.status(500).json({ error: { code: "WEBHOOK_FAILED", message: "Temporary error." } });
    }
  });

  return router;
}
