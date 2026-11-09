/**
 * B2B partner store integration tests.
 *   npm run test:emulator
 */
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { client, clearFirestore, hasEmulator, paidSession, sendWebhook, signIn, startApp, testConfig } from "./helpers.js";

const doc = async (t, col, id) => (await t.db.collection(col).doc(id).get()).data();
const PARTNER = { fullName: "Mia Bar", companyName: "Bar Mia GmbH", businessAddress: "Seestrasse 5, 6004 Luzern", phone: "+41 79 000 00 00" };

describe("B2B partner store", { skip: !hasEmulator && "Firestore emulator not running (use npm run test:emulator)" }, () => {
  let t;
  before(async () => {
    t = await startApp();
  });
  after(async () => t?.close());
  beforeEach(async () => {
    await clearFirestore();
    t.mailer.sent.length = 0;
    t.stripe.sessions.clear();
  });

  async function approvedPartner(email = "mia@barmia.ch") {
    const p = await signIn(t, email);
    const applied = await p.post("/api/b2b/apply", PARTNER);
    assert.equal(applied.body.approvalStatus, "PENDING");
    const admin = await signIn(t, "team@malaconda.test", "admin");
    const customerId = (await admin.get("/api/admin/partners?status=PENDING")).body.partners[0].customerId;
    const ok = await admin.post(`/api/admin/partners/${customerId}/approve`);
    assert.equal(ok.status, 200);
    return { p, admin, customerId };
  }

  test("Prices are hidden until the partner is approved", async () => {
    const anon = await client(t.base).get("/api/b2b/catalog");
    assert.equal(anon.status, 401);
    const p = await signIn(t, "noapp@bar.ch");
    assert.equal((await p.get("/api/b2b/catalog")).status, 403);
    await p.post("/api/b2b/apply", PARTNER);
    const pending = await p.get("/api/b2b/catalog");
    assert.equal(pending.body.error.code, "PARTNER_NOT_APPROVED");
    const cfg = await client(t.base).get("/api/public/config");
    assert.ok(!JSON.stringify(cfg.body).includes("5400"), "no B2B price in public config");
  });

  test("Approved partner: catalogue CHF 54 → 48.60, quantities 5 or 10, approval email sent", async () => {
    const { p } = await approvedPartner();
    assert.ok(t.mailer.sent.some((m) => m.to === "mia@barmia.ch" && /approved/.test(m.subject)));
    const cat = await p.get("/api/b2b/catalog");
    assert.equal(cat.status, 200);
    assert.deepEqual(cat.body.allowedQuantities, [5, 10]);
    assert.deepEqual(cat.body.products.map((x) => [x.sku, x.basePriceCents, x.partnerPriceCents]), [
      ["B2B_LULO_24", 5400, 4860],
      ["B2B_GUAVA_24", 5400, 4860],
    ]);
  });

  test("7–9. Stripe pre-order 5 cases: deposit CHF 48.60, webhook → DEPOSIT_PAID + CONFIRMED_PREORDER", async () => {
    const { p } = await approvedPartner();
    const r = await p.post("/api/b2b/preorder", { sku: "B2B_LULO_24", quantity: 5, workflow: "STRIPE" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const order = await doc(t, "orders", r.body.orderRef);
    assert.deepEqual([order.totalCents, order.depositCents, order.balanceCents], [24300, 4860, 19440]);
    assert.deepEqual([order.orderStatus, order.paymentStatus], ["PENDING_CONFIRMATION", "AWAITING_DEPOSIT"]);
    const params = t.stripe.sessions.get(order.stripe.checkoutSessionId).params;
    assert.equal(params.lineItems[0].unitAmountCents, 4860);
    assert.equal(params.shippingCents, null);

    await sendWebhook(t, "checkout.session.completed", paidSession(t, order.stripe.checkoutSessionId, { email: "mia@barmia.ch" }));
    const paid = await doc(t, "orders", r.body.orderRef);
    assert.deepEqual([paid.orderStatus, paid.paymentStatus, paid.amountPaidCents], ["CONFIRMED_PREORDER", "DEPOSIT_PAID", 4860]);
    assert.ok(t.mailer.sent.some((m) => m.to === "mia@barmia.ch" && /confirmed/.test(m.subject)));
  });

  test("8. 10 cases of Guava: deposit CHF 97.20", async () => {
    const { p } = await approvedPartner();
    const r = await p.post("/api/b2b/preorder", { sku: "B2B_GUAVA_24", quantity: 10, workflow: "STRIPE" });
    const order = await doc(t, "orders", r.body.orderRef);
    assert.deepEqual([order.totalCents, order.depositCents, order.balanceCents], [48600, 9720, 38880]);
  });

  test("Server rejects other quantities, B2C products and unknown workflows", async () => {
    const { p } = await approvedPartner();
    for (const q of [4, 6, 7, 9, 11]) {
      const r = await p.post("/api/b2b/preorder", { sku: "B2B_LULO_24", quantity: q, workflow: "STRIPE" });
      assert.equal(r.body.error.code, "INVALID_QUANTITY", `qty ${q}`);
    }
    assert.equal((await p.post("/api/b2b/preorder", { sku: "B2C_LULO_12", quantity: 5, workflow: "STRIPE" })).body.error.code, "INVALID_PRODUCT");
    assert.equal((await p.post("/api/b2b/preorder", { sku: "B2B_LULO_24", quantity: 5, workflow: "CASH" })).status, 400);
    // and B2B products can't be bought in the B2C shop
    assert.equal((await p.post("/api/b2c/checkout", { items: [{ sku: "B2B_LULO_24", quantity: 5 }] })).body.error.code, "INVALID_PRODUCT");
    assert.equal(t.stripe.sessions.size, 0);
  });

  test("10. Invoice workflow: AWAITING_DEPOSIT, emails, admin records bank payments → FULLY_PAID", async () => {
    const { p, admin } = await approvedPartner();
    const r = await p.post("/api/b2b/preorder", { sku: "B2B_GUAVA_24", quantity: 5, workflow: "INVOICE" });
    assert.equal(r.status, 200);
    assert.equal(r.body.url, undefined, "no Stripe for invoices");
    assert.ok(t.mailer.sent.some((m) => m.to === "mia@barmia.ch" && /received/.test(m.subject)), "registration confirmation (not payment)");
    assert.ok(t.mailer.sent.some((m) => m.to === "orders@malaconda.test" && /invoice/.test(m.subject)), "team notified");

    assert.equal((await admin.post(`/api/admin/orders/${r.body.orderRef}/invoice-sent`)).status, 200);
    const wrong = await admin.post(`/api/admin/orders/${r.body.orderRef}/payments`, { kind: "DEPOSIT", amountCents: 100 });
    assert.equal(wrong.body.error.code, "DEPOSIT_AMOUNT_MISMATCH");
    const dep = await admin.post(`/api/admin/orders/${r.body.orderRef}/payments`, { kind: "DEPOSIT" });
    assert.equal(dep.body.paymentStatus, "DEPOSIT_PAID");
    let order = await doc(t, "orders", r.body.orderRef);
    assert.equal(order.orderStatus, "CONFIRMED_PREORDER");
    assert.ok(t.mailer.sent.some((m) => m.to === "mia@barmia.ch" && /confirmed/.test(m.subject)));

    const bal = await admin.post(`/api/admin/orders/${r.body.orderRef}/payments`, { kind: "BALANCE" });
    assert.equal(bal.body.paymentStatus, "FULLY_PAID");
    order = await doc(t, "orders", r.body.orderRef);
    assert.equal(order.amountPaidCents, 24300);
    assert.equal((await admin.post(`/api/admin/orders/${r.body.orderRef}/status`, { orderStatus: "DELIVERED" })).status, 200);
    assert.equal((await admin.post(`/api/admin/orders/${r.body.orderRef}/status`, { orderStatus: "PENDING_CONFIRMATION" })).status, 409);
  });

  test("Double click on 'pre-order' doesn't create a second order", async () => {
    const { p } = await approvedPartner();
    const a = await p.post("/api/b2b/preorder", { sku: "B2B_LULO_24", quantity: 5, workflow: "STRIPE" });
    const b = await p.post("/api/b2b/preorder", { sku: "B2B_LULO_24", quantity: 5, workflow: "STRIPE" });
    assert.equal(a.body.orderRef, b.body.orderRef);
    assert.equal(t.stripe.sessions.size, 1);
  });

  test("Only the configured payment workflows are offered", async () => {
    const t2 = await startApp({ config: testConfig({ partnerPaymentModes: ["INVOICE"] }) });
    try {
      const p = await signIn(t2, "inv@bar.ch");
      await p.post("/api/b2b/apply", PARTNER);
      const admin = await signIn(t2, "team@malaconda.test", "admin");
      const id = (await admin.get("/api/admin/partners")).body.partners[0].customerId;
      await admin.post(`/api/admin/partners/${id}/approve`);
      const r = await p.post("/api/b2b/preorder", { sku: "B2B_LULO_24", quantity: 5, workflow: "STRIPE" });
      assert.equal(r.body.error.code, "WORKFLOW_NOT_AVAILABLE");
    } finally {
      await t2.close();
    }
  });
});
