import { badRequest } from "./errors.js";
import { isValidEmail } from "./email-address.js";

/**
 * Small input validators. Each returns the cleaned value or throws a 400.
 * Kept tiny on purpose instead of adding a validation library.
 */

export function text(body, field, { max = 200, required = true } = {}) {
  const raw = body?.[field];
  if (raw === undefined || raw === null || raw === "") {
    if (required) throw badRequest("INVALID_INPUT", `Field "${field}" is required.`);
    return "";
  }
  if (typeof raw !== "string") throw badRequest("INVALID_INPUT", `Field "${field}" must be text.`);
  // Remove control characters (keeps normal line breaks in long texts).
  const value = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (required && !value) throw badRequest("INVALID_INPUT", `Field "${field}" is required.`);
  if (value.length > max) throw badRequest("INVALID_INPUT", `Field "${field}" is too long (max ${max}).`);
  return value;
}

export function email(body, field = "email") {
  const value = text(body, field, { max: 254 });
  if (!isValidEmail(value)) throw badRequest("INVALID_EMAIL", "Please enter a valid email address.");
  return value;
}

export function integer(body, field) {
  const raw = body?.[field];
  if (!Number.isInteger(raw)) throw badRequest("INVALID_INPUT", `Field "${field}" must be a whole number.`);
  return raw;
}

export function oneOf(body, field, allowed) {
  const raw = body?.[field];
  if (!allowed.includes(raw)) {
    throw badRequest("INVALID_INPUT", `Field "${field}" must be one of: ${allowed.join(", ")}.`);
  }
  return raw;
}

/** Hidden "website" field in forms: real people leave it empty, bots fill it. */
export function isHoneypotFilled(body) {
  return typeof body?.website === "string" && body.website.trim() !== "";
}
