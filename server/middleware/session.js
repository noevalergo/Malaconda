/**
 * Cookies and session checks.
 * Session cookies are HttpOnly (not readable by JavaScript), Secure on HTTPS,
 * and SameSite (Lax for customers, Strict for admin).
 */
import { SESSION_TYPES } from "../services/auth.js";
import { forbidden, unauthorized } from "../lib/errors.js";
import { getCustomer } from "../db/customers.js";
import { getPartner } from "../db/partners.js";

export function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function setSessionCookie(res, purpose, token, secure) {
  const t = SESSION_TYPES[purpose];
  const attrs = [`${t.cookie}=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", `SameSite=${t.sameSite}`, `Max-Age=${t.maxAgeSeconds}`];
  if (secure) attrs.push("Secure");
  res.append("Set-Cookie", attrs.join("; "));
}

export function clearSessionCookie(res, purpose, secure) {
  const t = SESSION_TYPES[purpose];
  const attrs = [`${t.cookie}=`, "Path=/", "HttpOnly", `SameSite=${t.sameSite}`, "Max-Age=0"];
  if (secure) attrs.push("Secure");
  res.append("Set-Cookie", attrs.join("; "));
}

/** Loads the customer session (if any) into req.customerSession. Never fails. */
export function loadCustomerSession(ctx) {
  return async (req, _res, next) => {
    try {
      req.customerSession = await ctx.auth.sessionFromToken("customer", readCookie(req, SESSION_TYPES.customer.cookie));
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireCustomer(req, _res, next) {
  if (!req.customerSession) return next(unauthorized());
  next();
}

/** Signed-in customer whose partner application is APPROVED. */
export function requireApprovedPartner(ctx) {
  return async (req, _res, next) => {
    try {
      if (!req.customerSession) throw unauthorized("Please sign in with your partner email.");
      const partner = await getPartner(ctx.db, req.customerSession.customerId);
      if (!partner || partner.approvalStatus !== "APPROVED") {
        throw forbidden("PARTNER_NOT_APPROVED", "Your partner account is not approved yet.");
      }
      req.partner = partner;
      req.customer = await getCustomer(ctx.db, req.customerSession.customerId);
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireAdmin(ctx) {
  return async (req, _res, next) => {
    try {
      const session = await ctx.auth.sessionFromToken("admin", readCookie(req, SESSION_TYPES.admin.cookie));
      if (!session) throw unauthorized("Admin sign-in required.");
      req.admin = session;
      next();
    } catch (err) {
      next(err);
    }
  };
}
