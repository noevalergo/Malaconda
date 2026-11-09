/**
 * Creates the WELCOME20 promo code in Firestore (safe to run more than once).
 *
 *   Local emulator:  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seed.js
 *   Real project:    node --env-file=.env scripts/seed.js
 */
import { loadConfig } from "../server/config/env.js";
import { initFirestore } from "../server/db/firestore.js";
import { seedWelcomeCode } from "../server/db/seed.js";

const { config } = loadConfig();
if (!config.firebase.emulatorHost && !config.firebase.serviceAccountBase64) {
  console.error("Set FIREBASE_SERVICE_ACCOUNT_BASE64 (or FIRESTORE_EMULATOR_HOST) first.");
  process.exit(1);
}
const db = initFirestore(config.firebase);
const created = await seedWelcomeCode(db);
console.log(created ? "WELCOME20 created." : "WELCOME20 already exists (unchanged).");
process.exit(0);
