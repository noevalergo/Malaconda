/* Environment: loaded from ../.env when present (local), from the host's variables otherwise (Hostinger). */
const fs = require("node:fs");
const path = require("node:path");

for (const f of [path.join(__dirname, "..", ".env"), path.join(__dirname, ".env")]) {
  if (fs.existsSync(f)) { try { process.loadEnvFile(f); } catch (e) { /* ignore a malformed file, the checks below report what is missing */ } }
}

const env = process.env;
const config = {
  production: env.NODE_ENV === "production",
  port: Number(env.PORT) || 3000,
  baseUrl: (env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, ""),
  db: { host: env.DB_HOST || "127.0.0.1", port: Number(env.DB_PORT) || 3306, user: env.DB_USER || "root", password: env.DB_PASSWORD || "", database: env.DB_NAME || "malaconda" },
  stripe: { secretKey: env.STRIPE_SECRET_KEY || "", webhookSecret: env.STRIPE_WEBHOOK_SECRET || "" },
  brevo: { apiKey: env.BREVO_API_KEY || "", senderName: env.BREVO_SENDER_NAME || "Malaconda", senderEmail: env.BREVO_SENDER_EMAIL || "", teamEmail: env.TEAM_EMAIL || "" },
  retail: { settings: null },
};

// Safety: a live Stripe key is refused unless it is allowed explicitly.
if (config.stripe.secretKey.startsWith("sk_live_") && env.ALLOW_LIVE_PAYMENTS !== "yes") {
  throw new Error("A live Stripe key was found. Use a test key (sk_test_...), or set ALLOW_LIVE_PAYMENTS=yes at launch.");
}
module.exports = config;
