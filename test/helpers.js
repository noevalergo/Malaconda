/**
 * Test helpers: runs the REAL app against the Firestore EMULATOR, with a
 * fake Stripe (no network) and a fake mailer that captures emails.
 * Webhook signatures are created and verified with Stripe's real library.
 *
 * Run with:  npm run test:emulator   (needs the Firebase CLI: npm i -g firebase-tools)
 */
import Stripe from "stripe";
import { createApp } from "../server/app.js";
import { initFirestore } from "../server/db/firestore.js";
import { seedWelcomeCode } from "../server/db/seed.js";
import { createLogger } from "../server/lib/log.js";
import { HttpError } from "../server/lib/errors.js";

export const WEBHOOK_SECRET = "whsec_test_secret";
export const ORIGIN = "http://localhost:3000";
export const ADMIN_EMAIL = "team@malaconda.test";
const PROJECT = "demo-malaconda";

export const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

export function testConfig(overrides = {}) {
  return {
    isProduction: false,
    port: 0,
    publicBaseUrl: ORIGIN,
    allowedOrigins: [ORIGIN],
    sessionSecret: "x".repeat(40),
    stripe: { secretKey: "sk_test_x", webhookSecret: WEBHOOK_SECRET, allowLive: false },
    firebase: { emulatorHost: process.env.FIRESTORE_EMULATOR_HOST, projectId: PROJECT },
    sheets: { spreadsheetId: "" },
    email: {},
    adminEmails: [ADMIN_EMAIL],
    shipping: { chCents: 900, freeFromCents: null },
    partnerPaymentModes: ["STRIPE", "INVOICE"],
    disableRateLimits: true,
    ...overrides,
  };
}

/** Fake Stripe service with the same interface as services/stripe.js. */
export function createFakeStripe() {
  const realWebhooks = new Stripe("sk_test_x").webhooks;
  let n = 0;
  const fake = {
    sessions: new Map(),
    coupons: [],
    fingerprints: new Map(), // paymentIntentId → card fingerprint
    failNextCreate: false,
    calls: [],

    constructEvent: (raw, sig) => realWebhooks.constructEvent(raw, sig, WEBHOOK_SECRET),

    async createCustomer({ email }) {
      return `cus_test_${++n}_${email.length}`;
    },

    async createCheckoutSession(p) {
      fake.calls.push({ op: "create", ...p });
      if (fake.failNextCreate) {
        fake.failNextCreate = false;
        throw new HttpError(502, "PAYMENT_PROVIDER_ERROR", "The payment service is not reachable. Please try again.");
      }
      const id = `cs_test_${++n}`;
      if (p.discountCents > 0) fake.coupons.push({ amountOff: p.discountCents, name: p.discountName });
      fake.sessions.set(id, { id, status: "open", params: p });
      return { id, url: `https://checkout.stripe.test/${id}`, expiresAt: new Date(Date.now() + 30 * 60_000) };
    },

    async closeSession(id) {
      const s = fake.sessions.get(id);
      fake.calls.push({ op: "close", id });
      if (s.status === "complete") return "COMPLETED";
      s.status = "expired";
      return "CLOSED";
    },

    async getSessionUrlIfOpen(id) {
      return fake.sessions.get(id)?.status === "open" ? `https://checkout.stripe.test/${id}` : null;
    },

    async cardFingerprint(pi) {
      return fake.fingerprints.get(pi) || null;
    },
  };
  return fake;
}

export function createFakeMailer({ teamAddress = "orders@malaconda.test" } = {}) {
  const sent = [];
  return {
    configured: true,
    teamAddress,
    sent,
    async send(msg) {
      sent.push(msg);
      return { sent: true };
    },
    lastCodeFor(email) {
      const msg = [...sent].reverse().find((m) => m.to === email && /verification code/.test(m.subject));
      return msg?.text.match(/(\d{6})/)?.[1];
    },
  };
}

export function createFakeSheets({ fail = false } = {}) {
  const rows = [];
  return {
    enabled: true,
    rows,
    async upsert(tab, _headers, row) {
      if (fail) throw new Error("Sheets API unavailable");
      rows.push({ tab, key: row[0] });
    },
    async rewrite(tab, _headers, list) {
      if (fail) throw new Error("Sheets API unavailable");
      rows.push({ tab, rewrite: list.length });
    },
  };
}

export async function clearFirestore() {
  const res = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Could not clear emulator: ${res.status}`);
}

/** Starts the app on a random port. */
export async function startApp({ config = testConfig(), sheets = { enabled: false } } = {}) {
  const db = initFirestore(config.firebase);
  await clearFirestore();
  await seedWelcomeCode(db);
  const stripe = createFakeStripe();
  const mailer = createFakeMailer();
  const app = createApp({ config, db, stripe, mailer, sheets, log: createLogger({ silent: true }) });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { app, db, stripe, mailer, sheets, base, close: () => new Promise((r) => server.close(r)) };
}

/** A browser-like client: keeps cookies, sends our Origin header. */
export function client(base) {
  const cookies = new Map();
  async function request(method, path, body, extraHeaders = {}) {
    const headers = { Origin: ORIGIN, ...extraHeaders };
    if (cookies.size) headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const [k, v] = pair.split("=");
      if (v) cookies.set(k, v);
      else cookies.delete(k);
    }
    const json = await res.json().catch(() => null);
    return { status: res.status, body: json };
  }
  return {
    get: (p, h) => request("GET", p, undefined, h),
    post: (p, b = {}, h) => request("POST", p, b, h),
    cookies,
  };
}

/** Full email sign-in, returns the client. */
export async function signIn(t, email, purpose = "customer") {
  const c = client(t.base);
  const prefix = purpose === "admin" ? "/api/admin/auth" : "/api/auth";
  const r1 = await c.post(`${prefix}/request-code`, { email });
  if (r1.status !== 200) throw new Error(`request-code failed: ${JSON.stringify(r1.body)}`);
  const code = t.mailer.lastCodeFor(email);
  const r2 = await c.post(`${prefix}/verify-code`, { email, code });
  if (r2.status !== 200) throw new Error(`verify-code failed: ${JSON.stringify(r2.body)}`);
  return c;
}

let eventCounter = 0;

/** Sends a correctly signed Stripe webhook. */
export async function sendWebhook(t, type, object, { id, secret = WEBHOOK_SECRET } = {}) {
  const event = { id: id || `evt_test_${++eventCounter}_${Date.now()}`, object: "event", type, data: { object } };
  const payload = JSON.stringify(event);
  const signature = new Stripe("sk_test_x").webhooks.generateTestHeaderString({ payload, secret });
  const res = await fetch(`${t.base}/api/stripe/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Stripe-Signature": signature },
    body: payload,
  });
  await t.app.locals.flushBackground();
  return { status: res.status, body: await res.json(), eventId: event.id };
}

/** Stripe Checkout Session object as the webhook would deliver it. */
export function paidSession(t, sessionId, { email = "buyer@example.ch", paymentIntent, amountTotal, paymentStatus = "paid", address } = {}) {
  const s = t.stripe.sessions.get(sessionId);
  s.status = "complete";
  const p = s.params;
  const total =
    amountTotal ??
    p.lineItems.reduce((sum, li) => sum + li.unitAmountCents * li.quantity, 0) - (p.discountCents || 0) + (p.shippingCents || 0);
  return {
    id: sessionId,
    object: "checkout.session",
    metadata: { orderRef: p.orderRef, channel: p.channel },
    payment_status: paymentStatus,
    payment_intent: paymentIntent || `pi_${sessionId}`,
    amount_total: total,
    customer: p.stripeCustomerId || null,
    customer_details: { email },
    collected_information: {
      shipping_details: { name: "Test Buyer", address: address || { line1: "Bahnhofstrasse 1", postal_code: "8001", city: "Zürich", country: "CH" } },
    },
  };
}

export const LULO = "B2C_LULO_12";
export const GUAVA = "B2C_GUAVA_12";
