import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

// No 0/O/1/I/L to avoid confusion when people read references aloud.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Random readable ID, e.g. randomRef("MLC-B2C") → "MLC-B2C-7F3K9Q". */
export function randomRef(prefix, length = 6) {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return `${prefix}-${out}`;
}

/** 6-digit numeric code for email verification ("000000"–"999999"). */
export function sixDigitCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Long random token for session cookies (URL-safe). */
export function randomToken() {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hex digest. Used for document IDs (email, session tokens). */
export function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

/** HMAC-SHA-256 with the server secret. Used for verification codes. */
export function hmac(secret, value) {
  return createHmac("sha256", secret).update(String(value)).digest("hex");
}

/** Constant-time comparison of two hex strings. */
export function safeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
