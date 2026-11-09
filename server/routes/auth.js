/**
 * Customer / partner sign-in with a 6-digit email code.
 *   POST /api/auth/request-code  { email }
 *   POST /api/auth/verify-code   { email, code }   → sets the session cookie
 *   POST /api/auth/logout
 *   GET  /api/auth/me            → own status only
 */
import { Router } from "express";
import * as v from "../lib/validate.js";
import { rateLimits } from "../middleware/security.js";
import { clearSessionCookie, readCookie, setSessionCookie } from "../middleware/session.js";
import { SESSION_TYPES } from "../services/auth.js";
import { getCustomer } from "../db/customers.js";
import { getPartner } from "../db/partners.js";

export function authRoutes(ctx, purpose = "customer") {
  const router = Router();
  const secure = ctx.config.publicBaseUrl.startsWith("https://");

  router.post("/request-code", rateLimits.requestCode(), async (req, res) => {
    const email = v.email(req.body);
    await ctx.auth.requestCode(purpose, email);
    res.json({ ok: true, message: "If this address can sign in, a 6-digit code is on its way." });
  });

  router.post("/verify-code", rateLimits.verifyCode(), async (req, res) => {
    const email = v.email(req.body);
    const code = v.text(req.body, "code", { max: 10 });
    const { token } = await ctx.auth.verifyCode(purpose, email, code);
    setSessionCookie(res, purpose, token, secure);
    res.json({ ok: true });
  });

  router.post("/logout", async (req, res) => {
    await ctx.auth.logout(readCookie(req, SESSION_TYPES[purpose].cookie));
    clearSessionCookie(res, purpose, secure);
    res.json({ ok: true });
  });

  if (purpose === "customer") {
    router.get("/me", async (req, res) => {
      if (!req.customerSession) return res.json({ signedIn: false });
      const customer = await getCustomer(ctx.db, req.customerSession.customerId);
      const partner = await getPartner(ctx.db, req.customerSession.customerId);
      res.json({
        signedIn: true,
        email: customer.email,
        emailVerified: Boolean(customer.emailVerifiedAt),
        partnerStatus: partner?.approvalStatus || "NONE",
      });
    });
  }

  return router;
}
