/**
 * Firestore connection.
 *
 * All database access in this project goes through server/db/*.js.
 * Nothing else imports firebase-admin, so switching database later only
 * means rewriting this folder.
 *
 * Firestore Security Rules (firestore.rules) deny ALL browser access:
 * only this server, authenticated with a service account, can read or write.
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/** Collection names, in one place. */
export const COL = Object.freeze({
  customers: "customers",
  emailIndex: "emailIndex", // {sha256(normalized email)} → { customerId } (uniqueness)
  verificationCodes: "verificationCodes",
  sessions: "sessions",
  partners: "partners",
  orders: "orders",
  payments: "payments",
  promoCodes: "promoCodes",
  promoRedemptions: "promoRedemptions", // {CODE}__{customerId}
  promoSignals: "promoSignals", // card / address fingerprints for duplicate detection
  ambassadors: "ambassadors",
  stripeEvents: "stripeEvents", // {stripeEventId} → webhook idempotency
});

export function initFirestore(firebaseConfig) {
  const appName = "malaconda";
  const existing = getApps().find((a) => a.name === appName);
  if (existing) return getFirestore(existing);

  let app;
  if (firebaseConfig.emulatorHost) {
    // Local development / tests: the emulator needs no credentials.
    app = initializeApp({ projectId: firebaseConfig.projectId || "demo-malaconda" }, appName);
  } else {
    const json = JSON.parse(Buffer.from(firebaseConfig.serviceAccountBase64, "base64").toString("utf8"));
    app = initializeApp({ credential: cert(json), projectId: json.project_id }, appName);
  }

  const db = getFirestore(app);
  db.settings({
    // REST (HTTP/1.1) instead of gRPC: lighter and friendlier to shared hosting.
    // The emulator only works with gRPC; FIRESTORE_PREFER_REST=false switches
    // production to gRPC too if ever needed. Transactions behave the same.
    preferRest: !firebaseConfig.emulatorHost && firebaseConfig.preferRest !== false,
    ignoreUndefinedProperties: true,
  });
  return db;
}

/** Service account JSON (also used for Google Sheets), or null with the emulator. */
export function serviceAccountFromConfig(firebaseConfig) {
  if (!firebaseConfig.serviceAccountBase64) return null;
  return JSON.parse(Buffer.from(firebaseConfig.serviceAccountBase64, "base64").toString("utf8"));
}
