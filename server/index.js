/**
 * Entry point: `npm start` (Hostinger) or `npm run dev` (local, loads .env).
 */
import { loadConfig } from "./config/env.js";
import { createApp } from "./app.js";
import { initFirestore, serviceAccountFromConfig } from "./db/firestore.js";
import { createLogger } from "./lib/log.js";
import { createMailer } from "./services/email.js";
import { createSheetsClient } from "./services/sheets.js";
import { createStripeClient, createStripeService } from "./services/stripe.js";

const log = createLogger();
const { config, problems, warnings } = loadConfig();

for (const w of warnings) log.warn("config.warning", { message: w });
if (problems.length) {
  for (const p of problems) log.error("config.error", { message: p });
  log.error("startup.aborted", { reason: "Fix the environment variables above (see .env.example)." });
  process.exit(1);
}

const db = initFirestore(config.firebase);
const app = createApp({
  config,
  db,
  log,
  stripe: createStripeService(createStripeClient(config.stripe.secretKey), {
    publicBaseUrl: config.publicBaseUrl,
    webhookSecret: config.stripe.webhookSecret,
  }),
  mailer: createMailer(config.email, log, { isProduction: config.isProduction }),
  sheets: createSheetsClient({
    spreadsheetId: config.sheets.spreadsheetId,
    serviceAccount: serviceAccountFromConfig(config.firebase),
  }),
});

const server = app.listen(config.port, () => {
  log.info("startup.ready", { port: config.port, mode: config.isProduction ? "production" : "development" });
});

// Graceful shutdown: finish background emails / Sheets updates first.
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, async () => {
    log.info("shutdown.started", { signal });
    server.close();
    await app.locals.flushBackground();
    process.exit(0);
  });
}
