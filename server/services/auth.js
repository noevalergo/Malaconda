/**
 * Passwordless sign-in with a 6-digit code sent by email.
 *
 * Two separate purposes, with separate codes and cookies:
 *  - "customer": B2C customers and B2B partners (cookie mlc_session, 30 days)
 *  - "admin":    team members listed in ADMIN_EMAILS (cookie mlc_admin, 8 hours)
 */
import { consumeVerificationCode, createSession, deleteSession, getSession, saveVerificationCode } from "../db/auth.js";
import { emailKey, getCustomer, getOrCreateCustomerByEmail, markEmailVerified } from "../db/customers.js";
import { HttpError, badRequest } from "../lib/errors.js";
import { hmac, randomToken, sha256, sixDigitCode } from "../lib/ids.js";
import * as templates from "../emails/templates.js";

export const SESSION_TYPES = {
  customer: { cookie: "mlc_session", maxAgeSeconds: 30 * 24 * 3600, sameSite: "Lax" },
  admin: { cookie: "mlc_admin", maxAgeSeconds: 8 * 3600, sameSite: "Strict" },
};

export function createAuthService({ db, config, mailer, log }) {
  const codeKey = (purpose, email) => `${purpose}__${emailKey(email)}`;
  const codeHash = (purpose, email, code) => hmac(config.sessionSecret, `${purpose}:${emailKey(email)}:${code}`);
  const isAdminEmail = (email) => config.adminEmails.includes(String(email).trim().toLowerCase());

  return {
    isAdminEmail,

    /**
     * Sends a code. The answer is the same whether or not the email is known,
     * so nobody can test which emails are customers or admins.
     */
    async requestCode(purpose, email) {
      if (purpose === "admin" && !isAdminEmail(email)) {
        log.warn("auth.admin_code_refused", {});
        return;
      }
      const code = sixDigitCode();
      const saved = await saveVerificationCode(db, codeKey(purpose, email), codeHash(purpose, email, code));
      if (!saved.ok) {
        throw new HttpError(429, "CODE_RECENTLY_SENT", `Please wait ${saved.retryAfterSeconds} seconds before requesting a new code.`);
      }
      await mailer.send({ to: email, ...templates.verificationCode(code) });
    },

    /** @returns {Promise<{token: string, customerId: string}>} */
    async verifyCode(purpose, email, code) {
      if (!/^\d{6}$/.test(String(code))) throw badRequest("CODE_INVALID", "Please enter the 6-digit code.");
      if (purpose === "admin" && !isAdminEmail(email)) throw badRequest("CODE_INVALID", "This code is not valid.");

      const result = await consumeVerificationCode(db, codeKey(purpose, email), codeHash(purpose, email, code));
      if (result === "EXPIRED") throw badRequest("CODE_EXPIRED", "This code has expired. Please request a new one.");
      if (result === "TOO_MANY_ATTEMPTS") throw badRequest("CODE_LOCKED", "Too many attempts. Please request a new code.");
      if (result !== "OK") throw badRequest("CODE_INVALID", "This code is not valid.");

      const customerId = await getOrCreateCustomerByEmail(db, email);
      await markEmailVerified(db, customerId);

      const token = randomToken();
      const type = SESSION_TYPES[purpose];
      await createSession(db, sha256(token), {
        customerId,
        role: purpose,
        expiresAt: new Date(Date.now() + type.maxAgeSeconds * 1000),
      });
      return { token, customerId };
    },

    async sessionFromToken(purpose, token) {
      if (!token) return null;
      const session = await getSession(db, sha256(token));
      if (!session || session.role !== purpose) return null;
      if (purpose === "admin") {
        // Removing an email from ADMIN_EMAILS revokes access immediately.
        const customer = await getCustomer(db, session.customerId);
        if (!customer || !isAdminEmail(customer.email)) return null;
        return { ...session, email: customer.email };
      }
      return session;
    },

    async logout(token) {
      if (token) await deleteSession(db, sha256(token));
    },
  };
}
