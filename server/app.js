/**
 * Builds the Express application.
 *
 * createApp() receives its dependencies (database, Stripe, mailer, Sheets)
 * instead of creating them, so tests can run the real app against the
 * Firestore emulator with a fake Stripe and a fake mailer.
 */
import express from "express";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createAuthService } from "./services/auth.js";
import { createB2cCheckout } from "./services/checkout-b2c.js";
import { createB2bService } from "./services/b2b.js";
import { createNotifications } from "./services/notifications.js";
import { createReporting } from "./services/reporting.js";
import { createWebhookHandler } from "./services/webhook.js";
import { errorHandler, rateLimits, sameOriginOnly, securityHeaders } from "./middleware/security.js";
import { loadCustomerSession } from "./middleware/session.js";
import { publicRoutes } from "./routes/public.js";
import { authRoutes } from "./routes/auth.js";
import { b2cRoutes } from "./routes/b2c.js";
import { b2bRoutes } from "./routes/b2b.js";
import { formRoutes } from "./routes/forms.js";
import { adminRoutes } from "./routes/admin.js";
import { webhookRoutes } from "./routes/webhook.js";

const CLIENT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../client");

/**
 * @param {object} deps
 * @param {object} deps.config   from config/env.js
 * @param {object} deps.db       Firestore
 * @param {object} deps.stripe   from services/stripe.js (createStripeService)
 * @param {object} deps.mailer   from services/email.js
 * @param {object} deps.sheets   from services/sheets.js
 * @param {object} deps.log
 */
export function createApp(deps) {
  // Background work (emails, Sheets) that must not delay responses.
  const pending = new Set();
  const background = (promise) => {
    const p = Promise.resolve(promise)
      .catch((err) => deps.log.error("background.failed", { error: err?.message }))
      .finally(() => pending.delete(p));
    pending.add(p);
  };

  const ctx = { ...deps, background };
  ctx.auth = createAuthService(ctx);
  ctx.reporting = createReporting(ctx);
  ctx.notifications = createNotifications(ctx);
  ctx.b2c = createB2cCheckout(ctx);
  ctx.b2b = createB2bService(ctx);
  ctx.handleStripeEvent = createWebhookHandler(ctx);

  const app = express();
  app.locals.disableRateLimits = deps.config.disableRateLimits === true && !deps.config.isProduction;
  app.set("trust proxy", 1); // Hostinger runs the app behind a proxy (real client IP for rate limits)
  app.disable("x-powered-by");
  app.use(securityHeaders());

  // Stripe webhook: raw body + signature check, BEFORE the JSON parser and the origin check.
  app.use("/api/stripe/webhook", webhookRoutes(ctx));

  app.use("/api", rateLimits.api(), express.json({ limit: "20kb" }), sameOriginOnly(deps.config.allowedOrigins));
  app.use("/api/admin", adminRoutes(ctx));
  app.use("/api", loadCustomerSession(ctx));
  app.use("/api/public", publicRoutes(ctx));
  app.use("/api/auth", authRoutes(ctx, "customer"));
  app.use("/api/b2c", b2cRoutes(ctx));
  app.use("/api/b2b", b2bRoutes(ctx));
  app.use("/api/forms", formRoutes(ctx));
  app.use("/api", (_req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found." } }));

  // Static website (the existing Artifact design in client/).
  if (existsSync(CLIENT_DIR)) {
    app.use(express.static(CLIENT_DIR, { extensions: ["html"], index: "index.html", maxAge: deps.config.isProduction ? "1h" : 0 }));
  }

  app.use(errorHandler(deps.log));

  /** Waits for background work (used by tests and graceful shutdown). */
  app.locals.flushBackground = async () => {
    while (pending.size) await Promise.allSettled([...pending]);
  };
  app.locals.ctx = ctx;
  return app;
}
