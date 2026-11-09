/**
 * Security middleware: headers, origin check, rate limits, error handler.
 */
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { HttpError, forbidden } from "../lib/errors.js";

export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
}

/**
 * Blocks cross-site requests that change data (CSRF protection): every
 * POST/PUT/PATCH/DELETE must come from our own website. Stripe webhooks are
 * mounted before this middleware and verified by signature instead.
 */
export function sameOriginOnly(allowedOrigins) {
  return (req, _res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.headers.origin || refererOrigin(req.headers.referer);
    if (!origin || !allowedOrigins.includes(origin)) {
      return next(forbidden("BAD_ORIGIN", "Request blocked."));
    }
    next();
  };
}

function refererOrigin(referer) {
  try {
    return referer ? new URL(referer).origin : null;
  } catch {
    return null;
  }
}

const limiter = (windowMinutes, limit) =>
  rateLimit({
    windowMs: windowMinutes * 60_000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    // Only automated tests switch limits off (config.disableRateLimits); never in production.
    skip: (req) => req.app.locals.disableRateLimits === true,
    handler: (_req, _res, next) => next(new HttpError(429, "TOO_MANY_REQUESTS", "Too many requests. Please try again later.")),
  });

export const rateLimits = {
  api: () => limiter(15, 300),
  requestCode: () => limiter(15, 5),
  verifyCode: () => limiter(15, 20),
  checkout: () => limiter(15, 20),
  forms: () => limiter(60, 10),
};

/** Last middleware: turns errors into JSON. Internal details are logged, never sent. */
export function errorHandler(log) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, _next) => {
    if (err instanceof HttpError) {
      if (err.status >= 500) log.error("request.failed", { path: req.path, code: err.code, cause: err.cause?.message });
      return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }
    if (err?.type === "entity.parse.failed" || err?.type === "entity.too.large") {
      return res.status(400).json({ error: { code: "INVALID_JSON", message: "Invalid request." } });
    }
    log.error("request.crashed", { path: req.path, error: err?.message, stack: err?.stack });
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } });
  };
}
