/**
 * Email address helpers.
 *
 * normalizeEmail() maps common aliases of one mailbox to the same key, so
 * "Ana.Muster+shop@Gmail.com" and "anamuster@gmail.com" count as one customer.
 * It is a partial help only: it does NOT stop someone from using a different
 * mailbox. See docs/ARCHITECTURE.md §5.6.
 */

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

// Deliberately simple: one "@", no spaces, a dot in the domain, sane length.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  return typeof value === "string" && value.length <= 254 && EMAIL_PATTERN.test(value.trim());
}

export function normalizeEmail(value) {
  const email = String(value).trim().toLowerCase();
  const at = email.lastIndexOf("@");
  let local = email.slice(0, at);
  let domain = email.slice(at + 1);

  // "name+anything@domain" → "name@domain" (supported by most providers)
  const plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);

  if (GMAIL_DOMAINS.has(domain)) {
    domain = "gmail.com";
    local = local.replaceAll(".", ""); // Gmail ignores dots
  }
  return `${local}@${domain}`;
}
