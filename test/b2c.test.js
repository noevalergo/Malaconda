/**
 * B2C integration tests: real app + Firestore emulator + fake Stripe.
 *   npm run test:emulator
 */
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { GUAVA, LULO, client, clearFirestore, createFakeSheets, hasEmulator, paidSession, sendWebhook, signIn, startApp, testConfig } from "./helpers.js";
import { seedWelcomeCode } from "../server/db/seed.js";

const doc = async (t, col, id) => (await t.db.collection(col).doc(id).get()).data();
const lastSessionId = (t) => [...t.stripe.sessions.keys()].at(-1);

describe("B2C shop", { skip: !hasEmulator && "Firestore emulator not running (use npm run test:emulator)" }, () => {
  let t;
  before(async () => {
    t = await startApp();
  });
  after(async () => t?.close());
  beforeEach(async () => {
    await clearFirestore();
    await seedWelcomeCode(t.db);
    t.mailer.sent.length = 0;
    t.stripe.sessions.clear();
    t.stripe.calls.length = 0;
  });

  test("1–2. guest buys product one and product two: server prices, shipping CH only", async () => {
    for (const sku of [LULO, GUAVA]) {
      const c = client(t.base);
      const r = await c.post("/api/b2c/checkout", { items: [{ sku, quantity: 2, priceCents: 1 }] });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.match(r.body.url, /^https:\/\/checkout\.stripe\.test\//);
      const order = await doc(t, "orders", r.body.orderRef);
      assert.equal(order.subtotalCents, 7800);
      assert.equal(order.shippingCents, 900);
      assert.equal(order.totalCents, 8700);
      assert.equal(order.paymentStatus, "PENDING");
      const params = t.stripe.sessions.get(order.stripe.checkoutSessionId).params;
      assert.deepEqual(params.lineItems, [{ name: order.items[0].name, unitAmountCents: 3900, quantity: 2 }]);
      assert.equal(params.shippingCents, 900);
    }
  });

  test("3 + 6. successful payment → PAID, one email; duplicate webhook changes nothing", async () => {
    const c = client(t.base);
    const r = await c.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }] });
    const session = paidSession(t, lastSessionId(t), { email: "guest@example.ch" });

    const w1 = await sendWebhook(t, "checkout.session.completed", session, { id: "evt_dup_1" });
    assert.equal(w1.status, 200);
    const order = await doc(t, "orders", r.body.orderRef);
    assert.equal(order.paymentStatus, "PAID");
    assert.equal(order.amountPaidCents, 4800);
    assert.equal(order.shippingAddress.address.city, "Zürich");
    assert.ok(order.customerId, "guest order linked to a customer by email");
    assert.equal(t.mailer.sent.filter((m) => m.to === "guest@example.ch").length, 1);

    const w2 = await sendWebhook(t, "checkout.session.completed", session, { id: "evt_dup_1" });
    assert.equal(w2.body.result.duplicate, true);
    const w3 = await sendWebhook(t, "checkout.session.completed", session, { id: "evt_dup_other_id" });
    assert.equal(w3.body.result.applied, false);
    assert.equal(t.mailer.sent.filter((m) => m.to === "guest@example.ch").length, 1, "no second confirmation email");
    const customer = await doc(t, "customers", order.customerId);
    assert.equal(customer.paidOrderCount, 1, "counted once");
    const payments = await t.db.collection("payments").where("orderRef", "==", r.body.orderRef).get();
    assert.equal(payments.size, 1, "one payment record");
  });

  test("4. cancelled / expired checkout → EXPIRED and code released", async () => {
    const c = await signIn(t, "ana@example.ch");
    const r = await c.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }], promoCode: "WELCOME20" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const sid = lastSessionId(t);
    await sendWebhook(t, "checkout.session.expired", { id: sid, object: "checkout.session", metadata: { orderRef: r.body.orderRef } });
    assert.equal((await doc(t, "orders", r.body.orderRef)).paymentStatus, "EXPIRED");
    const order = await doc(t, "orders", r.body.orderRef);
    assert.equal((await doc(t, "promoRedemptions", order.promo.redemptionId)).status, "RELEASED");
    // can use the code again
    const again = await c.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }], promoCode: "WELCOME20" });
    assert.equal(again.status, 200);
  });

  test("5. failed delayed payment → FAILED and code released", async () => {
    const c = await signIn(t, "ben@example.ch");
    const r = await c.post("/api/b2c/checkout", { items: [{ sku: GUAVA, quantity: 1 }], promoCode: "WELCOME20" });
    const sid = lastSessionId(t);
    await sendWebhook(t, "checkout.session.completed", paidSession(t, sid, { paymentStatus: "unpaid" }));
    let order = await doc(t, "orders", r.body.orderRef);
    assert.equal(order.paymentStatus, "PROCESSING");
    assert.equal((await doc(t, "promoRedemptions", order.promo.redemptionId)).status, "PROCESSING");
    await sendWebhook(t, "checkout.session.async_payment_failed", { id: sid, object: "checkout.session", metadata: { orderRef: r.body.orderRef } });
    order = await doc(t, "orders", r.body.orderRef);
    assert.equal(order.paymentStatus, "FAILED");
    assert.equal((await doc(t, "promoRedemptions", order.promo.redemptionId)).status, "RELEASED");
  });

  test("WELCOME20 needs a verified email; 20% off; confirmed only after payment; never again", async () => {
    const guest = client(t.base);
    const noAuth = await guest.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 3 }], promoCode: "WELCOME20" });
    assert.equal(noAuth.status, 401);
    assert.equal(noAuth.body.error.code, "VERIFICATION_REQUIRED");

    const c = await signIn(t, "Carla.Test+promo@gmail.com");
    const preview = await c.post("/api/b2c/promo/check", { code: "welcome20", items: [{ sku: LULO, quantity: 3 }] });
    assert.deepEqual([preview.body.valid, preview.body.discountCents], [true, 2340]);

    const r = await c.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 3 }], promoCode: "welcome20" });
    assert.equal(r.status, 200);
    const order = await doc(t, "orders", r.body.orderRef);
    assert.deepEqual([order.discountCents, order.totalCents], [2340, 11700 - 2340 + 900]);
    assert.equal((await doc(t, "promoRedemptions", order.promo.redemptionId)).status, "RESERVED", "reserved, not consumed");

    await sendWebhook(t, "checkout.session.completed", paidSession(t, lastSessionId(t)));
    assert.equal((await doc(t, "promoRedemptions", order.promo.redemptionId)).status, "CONFIRMED");

    // same person: new browser, gmail alias, re-entered code → refused
    const other = await signIn(t, "carlatest@gmail.com");
    const second = await other.post("/api/b2c/checkout", { items: [{ sku: GUAVA, quantity: 1 }], promoCode: "WELCOME20" });
    assert.equal(second.status, 409);
    assert.equal(second.body.error.code, "PROMO_FIRST_ORDER_ONLY");
  });

  test("13. invalid / inactive codes are rejected", async () => {
    const c = await signIn(t, "dan@example.ch");
    const bad = await c.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }], promoCode: "NOPE123" });
    assert.equal(bad.body.error.code, "PROMO_INVALID");
    await t.db.collection("promoCodes").doc("WELCOME20").update({ active: false });
    const inactive = await c.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }], promoCode: "WELCOME20" });
    assert.equal(inactive.body.error.code, "PROMO_INACTIVE");
    assert.equal(t.stripe.sessions.size, 0, "no Stripe session for rejected codes");
  });

  test("First-order rule includes earlier guest purchases with the same email", async () => {
    const guest = client(t.base);
    await guest.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }] });
    await sendWebhook(t, "checkout.session.completed", paidSession(t, lastSessionId(t), { email: "eva@example.ch" }));
    const c = await signIn(t, "eva@example.ch");
    const r = await c.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }], promoCode: "WELCOME20" });
    assert.equal(r.body.error.code, "PROMO_FIRST_ORDER_ONLY");
  });

  test("Concurrency: 6 parallel discounted checkouts → only ONE payable discounted session", async () => {
    const c = await signIn(t, "fay@example.ch");
    const results = await Promise.all(
      Array.from({ length: 6 }, () => c.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }], promoCode: "WELCOME20" })),
    );
    const ok = results.filter((r) => r.status === 200);
    assert.ok(ok.length >= 1);
    for (const r of results.filter((r) => r.status !== 200)) assert.equal(r.status, 409, JSON.stringify(r.body));

    const openDiscounted = [...t.stripe.sessions.values()].filter((s) => s.status === "open" && s.params.discountCents > 0);
    assert.equal(openDiscounted.length, 1, "exactly one open session carries the discount");
    const reservations = await t.db.collection("promoRedemptions").get();
    assert.equal(reservations.size, 1);
    assert.equal(reservations.docs[0].data().checkoutSessionId, openDiscounted[0].id);
  });

  test("New checkout in another tab closes the older discounted session", async () => {
    const tab1 = await signIn(t, "gus@example.ch");
    const r1 = await tab1.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }], promoCode: "WELCOME20" });
    const s1 = lastSessionId(t);
    const r2 = await tab1.post("/api/b2c/checkout", { items: [{ sku: GUAVA, quantity: 2 }], promoCode: "WELCOME20" });
    assert.equal(r2.status, 200);
    assert.equal(t.stripe.sessions.get(s1).status, "expired");
    // the late "expired" webhook of the old session must not release the new reservation
    await sendWebhook(t, "checkout.session.expired", { id: s1, object: "checkout.session", metadata: { orderRef: r1.body.orderRef } });
    const order2 = await doc(t, "orders", r2.body.orderRef);
    assert.equal((await doc(t, "promoRedemptions", order2.promo.redemptionId)).orderRef, r2.body.orderRef);
    assert.equal((await doc(t, "promoRedemptions", order2.promo.redemptionId)).status, "RESERVED");
  });

  test("Old session already paid → no second discount", async () => {
    const c = await signIn(t, "hal@example.ch");
    await c.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }], promoCode: "WELCOME20" });
    t.stripe.sessions.get(lastSessionId(t)).status = "complete"; // paid, webhook not yet arrived
    const r2 = await c.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }], promoCode: "WELCOME20" });
    assert.equal(r2.status, 409);
    assert.equal(r2.body.error.code, "PROMO_PAYMENT_PROCESSING");
  });

  test("Stripe failure releases the reservation immediately", async () => {
    const c = await signIn(t, "ida@example.ch");
    t.stripe.failNextCreate = true;
    const r = await c.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }], promoCode: "WELCOME20" });
    assert.equal(r.status, 502);
    const reservations = await t.db.collection("promoRedemptions").get();
    assert.equal(reservations.docs[0].data().status, "RELEASED");
    const ok = await c.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }], promoCode: "WELCOME20" });
    assert.equal(ok.status, 200);
  });

  test("Ambassador code: verified email, 20% of one case, CHF 5 commission after payment, not with WELCOME20", async () => {
    const admin = await signIn(t, "team@malaconda.test", "admin");
    const created = await admin.post("/api/admin/ambassadors", { name: "Maria", email: "maria@example.ch", code: "maria" });
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const c = await signIn(t, "jon@example.ch");
    const r = await c.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 3 }], promoCode: "MARIA" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const order = await doc(t, "orders", r.body.orderRef);
    assert.equal(order.discountCents, 780);
    assert.equal(order.ambassador.status, "NOT_EARNED");

    await sendWebhook(t, "checkout.session.completed", paidSession(t, lastSessionId(t)));
    const paid = await doc(t, "orders", r.body.orderRef);
    assert.equal(paid.ambassador.status, "PENDING");
    assert.equal(paid.ambassador.commissionCents, 500);
    assert.match(paid.ambassador.month, /^\d{4}-\d{2}$/);

    // first order done: neither WELCOME20 nor another ambassador code
    const w = await c.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }], promoCode: "WELCOME20" });
    assert.equal(w.body.error.code, "PROMO_FIRST_ORDER_ONLY");

    const list = await admin.get(`/api/admin/commissions?month=${paid.ambassador.month}`);
    assert.equal(list.body.ambassadors[0].pendingCents, 500);
    const early = await admin.post("/api/admin/commissions/mark-paid", { month: paid.ambassador.month, ambassadorId: created.body.ambassadorId });
    assert.equal(early.body.error.code, "MONTH_NOT_ENDED", "paid only at month end");
  });

  test("Refund → REFUNDED, commission cancelled, discount not given back", async () => {
    const admin = await signIn(t, "team@malaconda.test", "admin");
    await admin.post("/api/admin/ambassadors", { name: "Leo", email: "leo@example.ch", code: "LEO" });
    const c = await signIn(t, "kim@example.ch");
    const r = await c.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }], promoCode: "LEO" });
    const session = paidSession(t, lastSessionId(t));
    await sendWebhook(t, "checkout.session.completed", session);
    await sendWebhook(t, "charge.refunded", { id: "ch_1", object: "charge", payment_intent: session.payment_intent, amount: 3020, amount_refunded: 3020, refunded: true });
    const order = await doc(t, "orders", r.body.orderRef);
    assert.equal(order.paymentStatus, "REFUNDED");
    assert.equal(order.ambassador.status, "CANCELLED");
    assert.equal((await doc(t, "promoRedemptions", order.promo.redemptionId)).status, "CONFIRMED");
  });

  test("Same card or address on a new email → order flagged for review (not blocked)", async () => {
    const a = await signIn(t, "first@example.ch");
    await a.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }], promoCode: "WELCOME20" });
    const s1 = lastSessionId(t);
    t.stripe.fingerprints.set(`pi_${s1}`, "fp_same_card");
    await sendWebhook(t, "checkout.session.completed", paidSession(t, s1));

    const b = await signIn(t, "second@example.ch");
    const r = await b.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }], promoCode: "WELCOME20" });
    const s2 = lastSessionId(t);
    t.stripe.fingerprints.set(`pi_${s2}`, "fp_same_card");
    await sendWebhook(t, "checkout.session.completed", paidSession(t, s2, { address: { line1: "Other 2", postal_code: "3000", city: "Bern", country: "CH" } }));
    const order = await doc(t, "orders", r.body.orderRef);
    assert.equal(order.paymentStatus, "PAID");
    assert.ok(order.flags.includes("FIRST_ORDER_DISCOUNT_POSSIBLE_DUPLICATE"));
  });

  test("Amount mismatch between Stripe and our order is flagged", async () => {
    const c = client(t.base);
    const r = await c.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }] });
    await sendWebhook(t, "checkout.session.completed", paidSession(t, lastSessionId(t), { amountTotal: 100 }));
    assert.ok((await doc(t, "orders", r.body.orderRef)).flags.includes("AMOUNT_MISMATCH"));
  });

  test("Checkout is closed while the shipping cost is not configured", async () => {
    const t2 = await startApp({ config: testConfig({ shipping: { chCents: null, freeFromCents: null } }) });
    try {
      const r = await client(t2.base).post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }] });
      assert.equal(r.status, 503);
      assert.equal(r.body.error.code, "SHIPPING_NOT_CONFIGURED");
      const cfg = await client(t2.base).get("/api/public/config");
      assert.equal(cfg.body.b2c.checkoutOpen, false);
    } finally {
      await t2.close();
    }
  });
});

describe("Google Sheets outage", { skip: !hasEmulator && "Firestore emulator not running" }, () => {
  test("11. Sheets failing never breaks checkout or payment confirmation", async () => {
    const t = await startApp({ sheets: createFakeSheets({ fail: true }) });
    try {
      const r = await client(t.base).post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }] });
      const sid = [...t.stripe.sessions.keys()].at(-1);
      const w = await sendWebhook(t, "checkout.session.completed", paidSession(t, sid));
      assert.equal(w.status, 200);
      const order = (await t.db.collection("orders").doc(r.body.orderRef).get()).data();
      assert.equal(order.paymentStatus, "PAID");
      assert.equal(order.sheetsSyncedAt, null);
    } finally {
      await t.close();
    }
  });

  test("11. Sheets receives order, customer, redemption and payment rows", async () => {
    const sheets = createFakeSheets();
    const t = await startApp({ sheets });
    try {
      const c = await signIn(t, "rows@example.ch");
      const r = await c.post("/api/b2c/checkout", { items: [{ sku: LULO, quantity: 1 }], promoCode: "WELCOME20" });
      const sid = [...t.stripe.sessions.keys()].at(-1);
      await sendWebhook(t, "checkout.session.completed", paidSession(t, sid));
      const tabs = new Set(sheets.rows.map((x) => x.tab));
      for (const tab of ["Orders", "Customers", "Discount redemptions", "Payments"]) assert.ok(tabs.has(tab), tab);
      assert.ok(sheets.rows.some((x) => x.tab === "Orders" && x.key === r.body.orderRef));
      const order = (await t.db.collection("orders").doc(r.body.orderRef).get()).data();
      assert.ok(order.sheetsSyncedAt);
    } finally {
      await t.close();
    }
  });
});
