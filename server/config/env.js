/**
 * Reads and checks environment variables ONCE at startup.
 *
 * - Locally: put them in a `.env` file (see .env.example). `npm run dev` loads it.
 * - On Hostinger: hPanel → Node.js app → Environment variables.
 *
 * Missing optional integrations (email, Google Sheets) are allowed: the app
 * starts and logs a warning, and those features are switched off. Missing
 * required values stop the app with a clear message.
 */

function list(value) {
  return (value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function optionalInt(name, value) {
  if (value === undefined || value === "") return null;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a whole number of cents (e.g. 900 for CHF 9.00).`);
  return Number(value);
}

export function loadConfig(env = process.env) {
  const problems = [];
  const warnings = [];
  const isProduction = env.NODE_ENV === "production";

  const config = {
    isProduction,
    port: Number(env.PORT) || 3000,
    publicBaseUrl: (env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, ""),
    allowedOrigins: list(env.CORS_ALLOWED_ORIGINS),

    sessionSecret: env.SESSION_SECRET || "",

    stripe: {
      secretKey: env.STRIPE_SECRET_KEY || "",
      webhookSecret: env.STRIPE_WEBHOOK_SECRET || "",
      allowLive: env.ALLOW_LIVE_PAYMENTS === "true",
    },

    firebase: {
      // Base64 of the service account JSON (Firebase → Project settings → Service accounts)
      serviceAccountBase64: env.FIREBASE_SERVICE_ACCOUNT_BASE64 || "",
      projectId: env.FIREBASE_PROJECT_ID || "",
      emulatorHost: env.FIRESTORE_EMULATOR_HOST || "",
      preferRest: env.FIRESTORE_PREFER_REST !== "false",
    },

    sheets: {
      spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID || "",
    },

    email: {
      smtpHost: env.SMTP_HOST || "",
      smtpPort: Number(env.SMTP_PORT) || 465,
      smtpSecure: env.SMTP_SECURE !== "false",
      smtpUser: env.SMTP_USER || "",
      smtpPassword: env.SMTP_PASSWORD || "",
      from: env.EMAIL_FROM || "",
      teamTo: env.EMAIL_TEAM_TO || "",
    },

    adminEmails: list(env.ADMIN_EMAILS).map((e) => e.toLowerCase()),

    shipping: {
      chCents: optionalInt("SHIPPING_CH_CENTS", env.SHIPPING_CH_CENTS),
      freeFromCents: optionalInt("FREE_SHIPPING_FROM_CENTS", env.FREE_SHIPPING_FROM_CENTS),
    },

    // Which B2B payment workflows partners can choose: "stripe", "invoice" or both.
    partnerPaymentModes: list(env.PARTNER_PAYMENT_MODES || "stripe,invoice").map((m) => m.toUpperCase()),
  };

  // The browser origin of the site is always allowed.
  config.allowedOrigins = [...new Set([new URL(config.publicBaseUrl).origin, ...config.allowedOrigins])];

  // ---- Required ----
  if (config.sessionSecret.length < 32) problems.push("SESSION_SECRET must be at least 32 characters.");
  if (!config.stripe.secretKey) problems.push("STRIPE_SECRET_KEY is missing.");
  if (!config.stripe.webhookSecret) problems.push("STRIPE_WEBHOOK_SECRET is missing.");
  if (config.stripe.secretKey.startsWith("sk_live_") && !config.stripe.allowLive) {
    problems.push("A LIVE Stripe key is set but ALLOW_LIVE_PAYMENTS is not \"true\". Use test keys during development.");
  }
  if (!config.firebase.emulatorHost && !config.firebase.serviceAccountBase64) {
    problems.push("FIREBASE_SERVICE_ACCOUNT_BASE64 is missing (or set FIRESTORE_EMULATOR_HOST for local development).");
  }
  for (const mode of config.partnerPaymentModes) {
    if (!["STRIPE", "INVOICE"].includes(mode)) problems.push(`PARTNER_PAYMENT_MODES contains unknown value "${mode}".`);
  }
  if (isProduction && !config.publicBaseUrl.startsWith("https://")) problems.push("PUBLIC_BASE_URL must use https:// in production.");

  // ---- Optional (feature switched off when missing) ----
  if (!config.email.smtpHost || !config.email.from) warnings.push("Email is not configured (SMTP_HOST / EMAIL_FROM): emails will only be logged.");
  if (!config.email.teamTo) warnings.push("EMAIL_TEAM_TO is not set: team notifications are disabled.");
  if (!config.sheets.spreadsheetId) warnings.push("GOOGLE_SHEETS_SPREADSHEET_ID is not set: Google Sheets reporting is disabled.");
  if (config.shipping.chCents === null) warnings.push("SHIPPING_CH_CENTS is not set: B2C checkout is disabled until the shipping cost is decided.");
  if (config.adminEmails.length === 0) warnings.push("ADMIN_EMAILS is empty: nobody can sign in to /admin.");

  return { config, problems, warnings };
}
