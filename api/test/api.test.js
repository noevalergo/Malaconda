/* API tests against a real MySQL (set DB_PORT / DB_NAME, default: local test instance) and a fake Stripe client.
   Run: DB_PORT=3307 DB_NAME=malaconda_test npm test */
process.env.DB_NAME = process.env.DB_NAME || "malaconda_test";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.BREVO_API_KEY = ""; process.env.BREVO_SENDER_EMAIL = "";

const test = require("node:test");
const assert = require("node:assert/strict");
const config = require("../config");
const db = require("../db");
const migrate = require("../migrate");
const mailer = require("../mailer");
const L = require("../lib");
const { createApp } = require("../app");
const realStripe = require("stripe")("sk_test_dummy");

const created = { intents: [] };
const intentStatus = {};   // paymentIntent id -> status the fake Stripe reports
const fakeStripe = {
  webhooks: realStripe.webhooks,
  paymentIntents: {
    create: async (p) => { const id = "pi_test_" + (created.intents.length + 1); created.intents.push({ ...p, id }); intentStatus[id] = "requires_payment_method"; return { id, client_secret: `${id}_secret_abc`, status: intentStatus[id] }; },
    retrieve: async (id) => ({ id, client_secret: `${id}_secret_abc`, status: intentStatus[id] }),
  },
};
const sent = [];
mailer.orderConfirmation = async (o) => { sent.push(o.ref); return { skipped: true }; };
mailer.proOrderConfirmation = async (o) => { sent.push(o.ref); return { skipped: true }; };

let server, base;
test.before(async () => {
  assert.ok(config.db.database.endsWith("_test"), "refusing to run against a non-test database");
  await migrate();
  for (const t of ["pro_order_lines", "pro_orders", "pro_sessions", "pros", "order_lines", "orders", "sessions", "users", "stripe_events", "contact_requests"]) await db.query(`DELETE FROM ${t}`);
  server = createApp({ stripe: fakeStripe }).listen(0); await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { server.close(); await db.close(); });

async function call(method, path, body, cookie) {
  const res = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch (e) { /* not json */ }
  return { status: res.status, json, text, cookie: (res.headers.get("set-cookie") || "").split(";")[0] };
}
const ship = { name: "Test Buyer", address: "Seestrasse 1", zip: "8002", city: "Zurich" };
function signedEvent(id, intent) {
  const payload = JSON.stringify({ id, object: "event", type: "payment_intent.succeeded", data: { object: intent } });
  return { payload, header: realStripe.webhooks.generateTestHeaderString({ payload, secret: config.stripe.webhookSecret }) };
}
const hook = (payload, sig) => fetch(base + "/api/stripe/webhook", { method: "POST", headers: { "content-type": "application/json", "stripe-signature": sig }, body: payload });

test("health answers and every response says noindex", async () => {
  const r = await fetch(base + "/api/health");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("x-robots-tag"), "noindex, nofollow");
});

test("quote: a guest pays full price", async () => {
  const q = (await call("POST", "/api/quote", { cart: { lulo: 2, guava: 1 } })).json;
  assert.deepEqual([q.boxes, q.grossCents, q.discountCents, q.netCents, q.welcomePct], [3, 11700, 0, 11700, 0]);
});

test("config: the publishable key is served, never the secret", async () => {
  const r = await call("GET", "/api/config");
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.json), ["stripePublishableKey", "staging"]);
  assert.equal(r.json.staging, false, "no staging login configured: this is the live site");
});

test("guest checkout: pending order, server-side price, PaymentIntent in CHF with the order reference", async () => {
  const r = await call("POST", "/api/checkout", { email: "Guest@Example.test", ...ship, cart: { lulo: 2, guava: 1 }, prices: { lulo: 1 }, amount: 1 });
  assert.equal(r.status, 201);
  assert.match(r.json.clientSecret, /^pi_test_\d+_secret_/);
  const o = await db.one("SELECT * FROM orders WHERE ref = ?", [r.json.ref]);
  assert.deepEqual([o.status, o.email, o.net_cents, o.discount_cents, o.user_id], ["pending", "guest@example.test", 11700, 0, null]);
  const pi = created.intents.at(-1);
  assert.deepEqual([pi.amount, pi.currency, pi.receipt_email, pi.metadata.ref], [11700, "chf", "guest@example.test", r.json.ref]);
  assert.equal(o.stripe_payment_id, pi.id);
});

test("a Stripe error leaves no pending order behind", async () => {
  const original = fakeStripe.paymentIntents.create;
  fakeStripe.paymentIntents.create = async () => { throw new Error("stripe down"); };
  const before = (await db.one("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'")).n;
  const r = await call("POST", "/api/checkout", { email: "x@example.test", ...ship, cart: { lulo: 1 } });
  fakeStripe.paymentIntents.create = original;
  assert.equal(r.status, 500);
  assert.equal((await db.one("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'")).n, before);
});

test("validation: empty cart, bad email, missing address", async () => {
  assert.equal((await call("POST", "/api/checkout", { email: "a@b.test", ...ship, cart: {} })).status, 400);
  assert.equal((await call("POST", "/api/checkout", { email: "nope", ...ship, cart: { lulo: 1 } })).status, 400);
  assert.equal((await call("POST", "/api/checkout", { email: "a@b.test", name: "X", cart: { lulo: 1 } })).status, 400);
});

test("accounts: register, session cookie, me, wrong password, duplicate", async () => {
  const reg = await call("POST", "/api/auth/register", { name: "Ana Muster", email: "ana@example.test", password: "longpassword1" });
  assert.equal(reg.status, 201); assert.ok(reg.cookie.startsWith("mlc_session="));
  assert.equal((await call("GET", "/api/me", null, reg.cookie)).json.user.email, "ana@example.test");
  assert.equal((await call("GET", "/api/me")).json.user, null);
  assert.equal((await call("POST", "/api/auth/login", { email: "ana@example.test", password: "wrong" })).status, 401);
  assert.equal((await call("POST", "/api/auth/register", { name: "Ana", email: "ana@example.test", password: "longpassword1" })).status, 409);
  assert.equal((await call("POST", "/api/auth/register", { name: "Ana", email: "x@example.test", password: "short" })).status, 400);
  const stored = await db.one("SELECT password_hash FROM users WHERE email = 'ana@example.test'");
  assert.ok(stored.password_hash.startsWith("scrypt$") && !stored.password_hash.includes("longpassword1"));
});

test("account first order: 10% off in the charged amount; webhook marks it paid once and sends one email", async () => {
  const login = await call("POST", "/api/auth/login", { email: "ana@example.test", password: "longpassword1" });
  const r = await call("POST", "/api/checkout", { ...ship, cart: { lulo: 3 } }, login.cookie);
  assert.equal(r.status, 201);
  const o = await db.one("SELECT * FROM orders WHERE ref = ?", [r.json.ref]);
  assert.deepEqual([o.gross_cents, o.discount_cents, o.net_cents, o.welcome_pct], [11700, 1170, 10530, 10]);
  assert.equal(created.intents.at(-1).amount, 10530);

  const bad = await hook(JSON.stringify({ id: "evt_bad" }), "t=1,v1=deadbeef");
  assert.equal(bad.status, 400);

  const ev = signedEvent("evt_1", { id: o.stripe_payment_id, status: "succeeded" });
  assert.equal((await hook(ev.payload, ev.header)).status, 200);
  assert.equal((await hook(ev.payload, ev.header)).status, 200);          // Stripe retries: must not double-process
  const paid = await db.one("SELECT status, paid_at FROM orders WHERE id = ?", [o.id]);
  assert.deepEqual([paid.status, !!paid.paid_at], ["paid", true]);
  assert.deepEqual(sent.filter((x) => x === o.ref), [o.ref], "exactly one confirmation email");

  // the offer is used up: the next quote has no discount
  const q = (await call("POST", "/api/quote", { cart: { lulo: 1 } }, login.cookie)).json;
  assert.equal(q.welcomePct, 0);
  assert.equal((await call("GET", "/api/me/orders", null, login.cookie)).json.orders.length, 1, "only paid and own orders are listed for this user");
});

test("a payment that has not succeeded does not mark the order paid", async () => {
  const r = await call("POST", "/api/checkout", { email: "late@example.test", ...ship, cart: { guava: 1 } });
  const o = await db.one("SELECT * FROM orders WHERE ref = ?", [r.json.ref]);
  const ev = signedEvent("evt_unpaid", { id: o.stripe_payment_id, status: "processing" });
  await hook(ev.payload, ev.header);
  assert.equal((await db.one("SELECT status FROM orders WHERE id = ?", [o.id])).status, "pending");
});

test("order status: needs the client secret; settles the order if Stripe says paid before the webhook arrives, without a second email", async () => {
  const r = await call("POST", "/api/checkout", { email: "back@example.test", ...ship, cart: { lulo: 1 } });
  const o = await db.one("SELECT * FROM orders WHERE ref = ?", [r.json.ref]);
  assert.equal((await call("POST", "/api/order/status", { clientSecret: `${o.stripe_payment_id}_secret_wrong` })).status, 404);
  assert.equal((await call("POST", "/api/order/status", { clientSecret: "nonsense" })).status, 400);

  const waiting = (await call("POST", "/api/order/status", { clientSecret: r.json.clientSecret })).json;
  assert.deepEqual([waiting.status, waiting.paymentStatus, waiting.netCents], ["pending", "requires_payment_method", 3900]);

  intentStatus[o.stripe_payment_id] = "succeeded";
  const done = (await call("POST", "/api/order/status", { clientSecret: r.json.clientSecret })).json;
  assert.deepEqual([done.ref, done.status, done.email], [o.ref, "paid", "back@example.test"]);
  await call("POST", "/api/order/status", { clientSecret: r.json.clientSecret });
  const ev = signedEvent("evt_late", { id: o.stripe_payment_id, status: "succeeded" });
  await hook(ev.payload, ev.header);
  assert.deepEqual(sent.filter((x) => x === o.ref), [o.ref], "one email even with status checks and a late webhook");
});

test("registering joins earlier guest orders with the same email", async () => {
  const r = await call("POST", "/api/checkout", { email: "joiner@example.test", ...ship, cart: { lulo: 1 } });
  await call("POST", "/api/auth/register", { name: "Joiner", email: "joiner@example.test", password: "longpassword1" });
  const o = await db.one("SELECT user_id FROM orders WHERE ref = ?", [r.json.ref]);
  assert.ok(o.user_id);
});

test("contact form: stored, topic checked", async () => {
  assert.equal((await call("POST", "/api/contact", { name: "A", email: "a@b.test", topic: "Press", message: "Hello" })).status, 201);
  assert.equal((await call("POST", "/api/contact", { name: "A", email: "a@b.test", topic: "Spam", message: "Hello" })).status, 400);
  assert.equal((await db.one("SELECT COUNT(*) AS n FROM contact_requests")).n, 1);
});

/* ---- pros ---- */
async function addPro(email, extra = {}) {
  const d = { name: "Bar Test", price_lulo: null, price_guava: null, tiers: 1, extras: 1, credit_pct: 0, ...extra };
  await db.query("INSERT INTO pros (email, name, password_hash, address, zip, city, price_lulo, price_guava, tiers, extras, credit_pct) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    [email, d.name, L.hashPassword("demo"), "Bahnhofstrasse 1", "8001", "Zurich", d.price_lulo, d.price_guava, d.tiers, d.extras, d.credit_pct]);
}
const proLogin = async (email) => (await call("POST", "/api/pro/login", { email, password: "demo" })).cookie;

test("pro: login needed to price or pay; wrong password refused", async () => {
  await addPro("new@pro.test");
  assert.equal((await call("POST", "/api/pro/quote", { lines: [{ flavor: "lulo", boxes: 1 }] })).status, 401);
  assert.equal((await call("POST", "/api/pro/checkout", { lines: [{ flavor: "lulo", boxes: 1 }], ...ship })).status, 401);
  assert.equal((await call("POST", "/api/pro/login", { email: "new@pro.test", password: "nope" })).status, 401);
  const cookie = await proLogin("new@pro.test");
  assert.equal((await call("GET", "/api/pro/me", null, cookie)).json.pro.email, "new@pro.test");
  assert.equal((await call("GET", "/api/pro/me")).json.pro, null);
});

test("pro quote: list price excl. VAT, volume tier, welcome offer on the first order, VAT added at the end", async () => {
  const cookie = await proLogin("new@pro.test");
  // 10 boxes: 10 x 12 x 2.20 = 264.00; tier 5% -> 250.80; welcome 10% -> 225.72; VAT 8.1% = 18.28; total 244.00
  const q = (await call("POST", "/api/pro/quote", { lines: [{ flavor: "lulo", boxes: 6 }, { flavor: "guava", boxes: 4 }], total: 1 }, cookie)).json;
  assert.deepEqual([q.boxes, q.grossCents, q.tierPct, q.tierCents, q.welcomePct, q.creditPct, q.extraCents, q.netCents, q.vatCents, q.totalCents],
    [10, 26400, 5, 1320, 10, 0, 2508, 22572, 1828, 24400]);
});

test("pro with negotiated prices and no extras: own price, tier only", async () => {
  await addPro("selva@pro.test", { name: "Hotel Selva", price_lulo: 2.1, price_guava: 2.1, extras: 0 });
  const cookie = await proLogin("selva@pro.test");
  const q = (await call("POST", "/api/pro/quote", { lines: [{ flavor: "lulo", boxes: 10 }] }, cookie)).json;
  assert.deepEqual([q.lines[0].unitMilli, q.grossCents, q.tierPct, q.welcomePct, q.creditPct, q.netCents], [2100, 25200, 5, 0, 0, 23940]);
});

test("pro with referral credit: welcome offer on the first order, then the credit instead (never both)", async () => {
  await addPro("cobra@pro.test", { credit_pct: 5 });
  const cookie = await proLogin("cobra@pro.test");
  const q1 = (await call("POST", "/api/pro/quote", { lines: [{ flavor: "lulo", boxes: 2 }] }, cookie)).json;
  assert.deepEqual([q1.welcomePct, q1.creditPct], [10, 0]);
  const r = await call("POST", "/api/pro/checkout", { lines: [{ flavor: "lulo", boxes: 2 }], ...ship }, cookie);
  intentStatus[created.intents.at(-1).id] = "succeeded";
  await call("POST", "/api/order/status", { clientSecret: r.json.clientSecret });
  const q2 = (await call("POST", "/api/pro/quote", { lines: [{ flavor: "lulo", boxes: 2 }] }, cookie)).json;
  assert.deepEqual([q2.welcomePct, q2.creditPct], [0, 5]);
});

test("pro checkout: pending order priced by the server, PaymentIntent for the VAT-inclusive total; webhook marks it paid once with one email", async () => {
  const cookie = await proLogin("new@pro.test");
  const r = await call("POST", "/api/pro/checkout", { lines: [{ flavor: "lulo", boxes: 6 }, { flavor: "guava", boxes: 4 }], ...ship, name: "Bar Test", prices: { lulo: 0.01 }, totalCents: 1 }, cookie);
  assert.equal(r.status, 201);
  assert.match(r.json.ref, /^P-/);
  const o = await db.one("SELECT * FROM pro_orders WHERE ref = ?", [r.json.ref]);
  assert.deepEqual([o.status, o.net_cents, o.vat_cents, o.total_cents, o.welcome_pct], ["pending", 22572, 1828, 24400, 10]);
  const pi = created.intents.at(-1);
  assert.deepEqual([pi.amount, pi.currency, pi.metadata.ref], [24400, "chf", r.json.ref]);

  const ev = signedEvent("evt_pro_1", { id: o.stripe_payment_id, status: "succeeded" });
  assert.equal((await hook(ev.payload, ev.header)).status, 200);
  assert.equal((await hook(ev.payload, ev.header)).status, 200);
  assert.equal((await db.one("SELECT status FROM pro_orders WHERE id = ?", [o.id])).status, "paid");
  assert.deepEqual(sent.filter((x) => x === o.ref), [o.ref]);

  const st = (await call("POST", "/api/order/status", { clientSecret: r.json.clientSecret })).json;
  assert.deepEqual([st.kind, st.status, st.totalCents, st.lines.length], ["pro", "paid", 24400, 2]);

  // the welcome offer is used up
  const q2 = (await call("POST", "/api/pro/quote", { lines: [{ flavor: "lulo", boxes: 10 }] }, cookie)).json;
  assert.equal(q2.welcomePct, 0);
});

test("pro checkout: empty selection and missing address are refused; a Stripe error leaves nothing pending", async () => {
  const cookie = await proLogin("new@pro.test");
  assert.equal((await call("POST", "/api/pro/checkout", { lines: [], ...ship }, cookie)).status, 400);
  assert.equal((await call("POST", "/api/pro/checkout", { lines: [{ flavor: "lulo", boxes: 1 }], name: "X" }, cookie)).status, 400);
  const original = fakeStripe.paymentIntents.create;
  fakeStripe.paymentIntents.create = async () => { throw new Error("stripe down"); };
  const before = (await db.one("SELECT COUNT(*) AS n FROM pro_orders WHERE status = 'pending'")).n;
  assert.equal((await call("POST", "/api/pro/checkout", { lines: [{ flavor: "lulo", boxes: 1 }], ...ship }, cookie)).status, 500);
  fakeStripe.paymentIntents.create = original;
  assert.equal((await db.one("SELECT COUNT(*) AS n FROM pro_orders WHERE status = 'pending'")).n, before);
});
