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
const { createApp } = require("../app");
const realStripe = require("stripe")("sk_test_dummy");

const created = { sessions: [], coupons: [] };
const fakeStripe = {
  webhooks: realStripe.webhooks,
  coupons: { create: async (p) => { created.coupons.push(p); return { id: "co_" + created.coupons.length }; } },
  checkout: { sessions: { create: async (p) => { created.sessions.push(p); return { id: "cs_test_" + created.sessions.length, url: "https://checkout.stripe.test/" + created.sessions.length }; } } },
};
const sent = [];
mailer.orderConfirmation = async (o) => { sent.push(o.ref); return { skipped: true }; };

let server, base;
test.before(async () => {
  assert.ok(config.db.database.endsWith("_test"), "refusing to run against a non-test database");
  await migrate();
  for (const t of ["order_lines", "orders", "sessions", "users", "stripe_events", "contact_requests"]) await db.query(`DELETE FROM ${t}`);
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
function signedEvent(id, session) {
  const payload = JSON.stringify({ id, object: "event", type: "checkout.session.completed", data: { object: session } });
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

test("guest checkout: pending order, server-side price, Stripe session with the order reference", async () => {
  const r = await call("POST", "/api/checkout", { email: "Guest@Example.test", ...ship, cart: { lulo: 2, guava: 1 }, prices: { lulo: 1 } });
  assert.equal(r.status, 201);
  assert.match(r.json.url, /^https:\/\/checkout\.stripe\.test\//);
  const o = await db.one("SELECT * FROM orders WHERE ref = ?", [r.json.ref]);
  assert.deepEqual([o.status, o.email, o.net_cents, o.discount_cents, o.user_id], ["pending", "guest@example.test", 11700, 0, null]);
  const s = created.sessions.at(-1);
  assert.equal(s.mode, "payment"); assert.equal(s.metadata.ref, r.json.ref);
  assert.deepEqual(s.line_items.map((l) => [l.quantity, l.price_data.unit_amount, l.price_data.currency]), [[2, 3900, "chf"], [1, 3900, "chf"]]);
  assert.equal(s.discounts, undefined);
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

test("account first order: 10% off through a Stripe coupon; webhook marks it paid once and sends one email", async () => {
  const login = await call("POST", "/api/auth/login", { email: "ana@example.test", password: "longpassword1" });
  const r = await call("POST", "/api/checkout", { ...ship, cart: { lulo: 3 } }, login.cookie);
  assert.equal(r.status, 201);
  const o = await db.one("SELECT * FROM orders WHERE ref = ?", [r.json.ref]);
  assert.deepEqual([o.gross_cents, o.discount_cents, o.net_cents, o.welcome_pct], [11700, 1170, 10530, 10]);
  assert.equal(created.coupons.at(-1).amount_off, 1170);

  const bad = await hook(JSON.stringify({ id: "evt_bad" }), "t=1,v1=deadbeef");
  assert.equal(bad.status, 400);

  const ev = signedEvent("evt_1", { id: o.stripe_session_id, payment_status: "paid", payment_intent: "pi_test_1" });
  assert.equal((await hook(ev.payload, ev.header)).status, 200);
  assert.equal((await hook(ev.payload, ev.header)).status, 200);          // Stripe retries: must not double-process
  const paid = await db.one("SELECT status, stripe_payment_id, paid_at FROM orders WHERE id = ?", [o.id]);
  assert.deepEqual([paid.status, paid.stripe_payment_id, !!paid.paid_at], ["paid", "pi_test_1", true]);
  assert.deepEqual(sent.filter((x) => x === o.ref), [o.ref], "exactly one confirmation email");

  // the offer is used up: the next quote has no discount
  const q = (await call("POST", "/api/quote", { cart: { lulo: 1 } }, login.cookie)).json;
  assert.equal(q.welcomePct, 0);
  assert.equal((await call("GET", "/api/me/orders", null, login.cookie)).json.orders.length, 1, "only paid and own orders are listed for this user");
});

test("a payment that is not 'paid' does not mark the order paid", async () => {
  const r = await call("POST", "/api/checkout", { email: "late@example.test", ...ship, cart: { guava: 1 } });
  const o = await db.one("SELECT * FROM orders WHERE ref = ?", [r.json.ref]);
  const ev = signedEvent("evt_unpaid", { id: o.stripe_session_id, payment_status: "unpaid", payment_intent: null });
  await hook(ev.payload, ev.header);
  assert.equal((await db.one("SELECT status FROM orders WHERE id = ?", [o.id])).status, "pending");
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
