/**
 * Email sending over SMTP (nodemailer). Any SMTP provider works (Hostinger
 * mailbox, Brevo, Postmark…): only the environment variables change.
 *
 * Without SMTP configuration the app still runs: emails are written to the
 * log instead (subject and recipient only, never the content or codes in
 * production).
 */
import nodemailer from "nodemailer";

export function createMailer(emailConfig, log, { isProduction = false } = {}) {
  const configured = Boolean(emailConfig.smtpHost && emailConfig.from);
  const transport = configured
    ? nodemailer.createTransport({
        host: emailConfig.smtpHost,
        port: emailConfig.smtpPort,
        secure: emailConfig.smtpSecure,
        auth: emailConfig.smtpUser ? { user: emailConfig.smtpUser, pass: emailConfig.smtpPassword } : undefined,
      })
    : null;

  return {
    configured,
    teamAddress: emailConfig.teamTo || null,

    /** @returns {Promise<{sent: boolean}>} */
    async send({ to, subject, text, html, replyTo }) {
      if (!to) return { sent: false };
      if (!transport) {
        log.warn("email.not_configured", { to: maskEmail(to), subject });
        if (!isProduction) log.info("email.preview", { subject, text });
        return { sent: false };
      }
      await transport.sendMail({ from: emailConfig.from, to, subject, text, html, replyTo });
      log.info("email.sent", { to: maskEmail(to), subject });
      return { sent: true };
    },
  };
}

/** "ana.muster@gmail.com" → "an***@gmail.com" (for logs only). */
export function maskEmail(email) {
  const [local, domain] = String(email).split("@");
  return `${local.slice(0, 2)}***@${domain || ""}`;
}
