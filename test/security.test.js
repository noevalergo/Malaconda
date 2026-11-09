/**
 * Security tests: webhook signatures, CSRF/origin check, admin access,
 * verification codes, rate limits, data exposure.
 *   npm run test:emulator
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { LULO, client, hasEmulator, sendWebhook, signIn, startApp, testConfig } from "./helpers.js";

describe("Security", { skip: !hasEmulator && "Firestore emulator not running (use npm run test:emulator)" }, () => {
  let t;
  before(async () => {
    t = await startApp();
  });
  after(async () => t?.close());

  test("Webhook with a wrong signature is rejected and changes nothing", async () => {
    const r = await sendWebhook(t, "checkout.session.completed", { metadata: { orderRef: "MLC-B2C-XXXX" } }, { secret: "whsec_wrong" });
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, "BAD_SIGNATURE");
    const unsigned = await fetch(`${t.base}/api/stripe/webhook`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(unsigned.status, 400);
    assert.equal((await t.db.collection("stripeEvents").get()).size, 0);
  });

  test("Requests from another website are blocked (CSRF)", async () => {
    const evil = client(t.base);
    const r = await evil.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }] }, { Origin: "https://evil.example" });
    assert.equal(r.status, 403);
    const noOrigin = await fetch(`${t.base}/api/b2c/checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(noOrigin.status, 403);
  });

  test("Admin: only allow-listed emails, customer cookies don't work, no code sent to others", async () => {
    const outsider = client(t.base);
    await outsider.post("/api/admin/auth/request-code", { email: "hacker@example.ch" });
    assert.equal(t.mailer.lastCodeFor("hacker@example.ch"), undefined, "no code sent");
    assert.equal((await outsider.get("/api/admin/orders")).status, 401);

    const customer = await signIn(t, "team@malaconda.test"); // customer session of an admin email
    assert.equal((await customer.get("/api/admin/orders")).status, 401, "customer session is not an admin session");

    const admin = await signIn(t, "team@malaconda.test", "admin");
    assert.equal((await admin.get("/api/admin/orders")).status, 200);
    const cookie = [...admin.cookies.entries()].find(([k]) => k === "mlc_admin");
    assert.ok(cookie);
  });

  test("Verification codes: wrong codes counted, locked after 5, single use, resend wait", async () => {
    const c = client(t.base);
    await c.post("/api/auth/request-code", { email: "lock@example.ch" });
    const again = await c.post("/api/auth/request-code", { email: "lock@example.ch" });
    assert.equal(again.status, 429, "resend only after 60 s");
    const real = t.mailer.lastCodeFor("lock@example.ch");
    const wrong = real === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i++) assert.equal((await c.post("/api/auth/verify-code", { email: "lock@example.ch", code: wrong })).body.error.code, "CODE_INVALID");
    assert.equal((await c.post("/api/auth/verify-code", { email: "lock@example.ch", code: wrong })).body.error.code, "CODE_LOCKED");
    assert.equal((await c.post("/api/auth/verify-code", { email: "lock@example.ch", code: real })).body.error.code, "CODE_LOCKED", "even the right code is dead now");

    const d = client(t.base);
    await d.post("/api/auth/request-code", { email: "once@example.ch" });
    const code = t.mailer.lastCodeFor("once@example.ch");
    assert.equal((await d.post("/api/auth/verify-code", { email: "once@example.ch", code })).status, 200);
    assert.equal((await d.post("/api/auth/verify-code", { email: "once@example.ch", code })).body.error.code, "CODE_INVALID", "single use");
  });

  test("Codes and tokens are stored only as hashes", async () => {
    const c = client(t.base);
    await c.post("/api/auth/request-code", { email: "hash@example.ch" });
    const code = t.mailer.lastCodeFor("hash@example.ch");
    const stored = (await t.db.collection("verificationCodes").get()).docs.map((d) => JSON.stringify(d.data()));
    assert.ok(!stored.some((s) => s.includes(code)));
    await c.post("/api/auth/verify-code", { email: "hash@example.ch", code });
    const token = c.cookies.get("mlc_session");
    const sessions = (await t.db.collection("sessions").get()).docs.map((d) => d.id + JSON.stringify(d.data()));
    assert.ok(!sessions.some((s) => s.includes(token)));
  });

  test("/api/auth/me returns only the signed-in customer's own data", async () => {
    const anon = await client(t.base).get("/api/auth/me");
    assert.deepEqual(anon.body, { signedIn: false });
    const c = await signIn(t, "me@example.ch");
    const me = await c.get("/api/auth/me");
    assert.deepEqual(Object.keys(me.body).sort(), ["email", "emailVerified", "partnerStatus", "signedIn"]);
  });

  test("Invalid JSON and oversized bodies get a clean 400", async () => {
    const r = await fetch(`${t.base}/api/b2c/checkout`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" }, body: "{bad" });
    assert.equal(r.status, 400);
    const big = await fetch(`${t.base}/api/forms/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({ message: "x".repeat(30_000) }),
    });
    assert.equal(big.status, 400);
  });

  test("Security headers are set", async () => {
    const r = await fetch(`${t.base}/api/public/health`);
    assert.ok(r.headers.get("content-security-policy"));
    assert.equal(r.headers.get("x-powered-by"), null);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  });

  test("Forms: contact goes to the team; bots (honeypot) are silently ignored", async () => {
    const c = client(t.base);
    const before = t.mailer.sent.length;
    const ok = await c.post("/api/forms/contact", { name: "Ana", email: "ana@example.ch", topic: "Order", message: "Hello" });
    assert.equal(ok.status, 200);
    assert.equal(t.mailer.sent.at(-1).to, "orders@malaconda.test");
    await c.post("/api/forms/contact", { name: "Bot", email: "bot@example.ch", message: "spam", website: "http://spam" });
    assert.equal(t.mailer.sent.length, before + 1, "bot message not sent");
  });

  test("Rate limit: max 5 code requests per 15 minutes per IP", async () => {
    const t2 = await startApp({ config: testConfig({ disableRateLimits: false }) });
    try {
      const c = client(t2.base);
      const statuses = [];
      for (let i = 0; i < 7; i++) statuses.push((await c.post("/api/auth/request-code", { email: `rl${i}@example.ch` })).status);
      assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429, 429]);
    } finally {
      await t2.close();
    }
  });
});
