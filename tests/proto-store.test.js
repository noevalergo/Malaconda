/* Store-level rules: the seed profiles match docs/ACCOUNT_MODEL.md, negotiated prices, order requests, credit ledger.
   The store is a browser script, so it runs here against small localStorage / sessionStorage stubs. */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const DIR = path.join(__dirname, "..", "client", "proto");

function fresh() {
  const ls = {}, ss = {};
  global.window = { addEventListener() {} };
  global.document = { dispatchEvent() {} };
  global.CustomEvent = function () {};
  global.localStorage = { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = v; }, removeItem: (k) => { delete ls[k]; } };
  global.sessionStorage = { getItem: (k) => (k in ss ? ss[k] : null), setItem: (k, v) => { ss[k] = v; }, removeItem: (k) => { delete ss[k]; } };
  for (const f of ["engine.js", "store.js"]) delete require.cache[require.resolve(path.join(DIR, f))];
  window.Engine = require(path.join(DIR, "engine.js"));
  require(path.join(DIR, "store.js"));
  window.Store.reset();
  return window.Store;
}
const byName = (S, n) => S.get().pros.find((p) => p.name === n);

test("seed: prices, credit and conditions match the model table", () => {
  const S = fresh();
  const cobra = S.conditionsOf(byName(S, "Bar Cobra").id);
  assert.deepEqual(cobra.unit, { lulo: 2.2, guava: 2.2 });
  assert.deepEqual([cobra.credit.earned, cobra.credit.used, cobra.credit.available], [15, 0, 15]);
  assert.deepEqual(cobra.next, { kind: "credit", pct: 15 });
  const selva = S.conditionsOf(byName(S, "Hotel Selva").id);
  assert.deepEqual(selva.unit, { lulo: 2.1, guava: 2.1 });
  assert.equal(selva.negotiated, true);
  assert.equal(selva.flags.extras, false);
  assert.equal(selva.next, null, "negotiated pro gets neither welcome nor credit");
  assert.equal(selva.sheet.flavors[0].boxPrice, 25.2);
  const terraza = S.conditionsOf(byName(S, "Terraza 7").id);
  assert.deepEqual(terraza.next, { kind: "welcome", pct: 10 });
  assert.equal(S.ordersOfPro(terraza.pro.id).length, 0);
});

test("seed: orders were priced with the conditions of the time", () => {
  const S = fresh();
  const o = (name, i) => S.ordersOfPro(byName(S, name).id)[i];
  assert.equal(o("Bar Cobra", 0).welcomePct, 10, "first order took the welcome offer");
  assert.equal(o("Bar Cobra", 1).creditPct, 0, "second order came before any referral qualified");
  assert.equal(o("Hotel Selva", 0).welcomePct, 0, "negotiated pro: no welcome");
  assert.equal(o("Hotel Selva", 0).unitPrices.lulo, 2.1);
  assert.equal(o("Hotel Selva", 0).net, 680.4); // 30 boxes x 25.20 = 756, less 10% tier
  assert.equal(o("Cafe Lulo", 0).boxes, 4);
});

test("seed: referral ledger has three qualified pros and one below the threshold", () => {
  const S = fresh();
  assert.equal(S.get().ledger.length, 3);
  const refs = S.creditOf(byName(S, "Bar Cobra").id).refs;
  const st = Object.fromEntries(refs.map((r) => [r.pro.name, r.status]));
  assert.deepEqual(st, { "Club Anaconda": "qualified", "Bodega Norte": "qualified", "Vinyl Room": "qualified", "Cafe Lulo": "below" });
});

test("seed: ambassadors see only their own venues and the commissions follow the net amounts", () => {
  const S = fresh();
  const camila = S.get().ambassadors.find((a) => a.name.startsWith("Camila"));
  const v = S.ambassadorView(camila.id);
  assert.deepEqual(v.venues.map((x) => x.name).sort(), ["Bar Cobra", "Hotel Selva"]);
  const luca = S.get().ambassadors.find((a) => a.name.startsWith("Luca"));
  assert.equal(S.ambassadorView(luca.id).totalEarned, 0);
});

test("negotiated prices: validation, log, and existing orders keep their price", () => {
  const S = fresh();
  const cafe = byName(S, "Cafe Lulo");
  const before = S.ordersOfPro(cafe.id)[0].net;
  assert.throws(() => S.setProPrices(cafe.id, { lulo: 1.7, guava: "" }), /floor/);
  assert.throws(() => S.setProPrices(cafe.id, { lulo: 2.3, guava: "" }), /list price/);
  S.setProPrices(cafe.id, { lulo: 2.05, guava: 2.05, tiers: true, extras: true, note: "Volume promise" }, "Founders");
  assert.equal(S.unitPricesOf(cafe.id).lulo, 2.05);
  assert.equal(cafe.priceLog.length, 1);
  assert.equal(cafe.priceLog[0].note, "Volume promise");
  assert.equal(S.ordersOfPro(cafe.id)[0].net, before, "old orders are not repriced");
  S.setProPrices(cafe.id, { lulo: "", guava: "" }, "Founders");
  assert.equal(S.unitPricesOf(cafe.id).lulo, 2.2, "blank goes back to the list price");
  assert.equal(cafe.prices.lulo, null);
});

test("changing the list price flags pros whose negotiated price would be out of range", () => {
  const S = fresh();
  const settings = { ...S.get().settings, proBottlePrice: 2.0 };
  assert.deepEqual(S.priceConflicts(settings), ["Hotel Selva"], "2.10 is above a 2.00 list price");
  assert.deepEqual(S.priceConflicts({ ...S.get().settings, minBottlePrice: 2.15 }), ["Hotel Selva"], "2.10 is below a 2.15 floor");
});

test("order request: stores the quote, shows the difference, welcome is consumed when the order is created", () => {
  const S = fresh();
  const t = byName(S, "Terraza 7");
  const lines = [{ flavor: "lulo", boxes: 5 }, { flavor: "guava", boxes: 5 }];
  S.submitOrderRequest({ proId: t.id, lines });
  S.submitOrderRequest({ proId: t.id, lines });
  const reqs = S.get().requests.filter((r) => r.kind === "order" && r.proId === t.id);
  assert.equal(reqs.length, 2);
  assert.equal(reqs[0].quote.welcomePct, 10);
  assert.equal(reqs[1].quote.welcomePct, 10, "both open requests quote the welcome offer");
  const o1 = S.createOrderFromRequest(reqs[0].id);
  assert.equal(o1.welcomePct, 10);
  const diff = S.requestDiff(reqs[1].id);
  assert.equal(diff.changed, true, "the second request no longer gets the welcome offer");
  const o2 = S.createOrderFromRequest(reqs[1].id);
  assert.equal(o2.welcomePct, 0);
  assert.ok(o2.net > o1.net);
  assert.throws(() => S.createOrderFromRequest(reqs[1].id), /already handled/);
});

test("order request uses today's prices when a price changed after the quote", () => {
  const S = fresh();
  const cafe = byName(S, "Cafe Lulo");
  S.submitOrderRequest({ proId: cafe.id, lines: [{ flavor: "lulo", boxes: 10 }] });
  const req = S.get().requests.filter((r) => r.kind === "order").pop();
  S.setProPrices(cafe.id, { lulo: 2.0, guava: "" }, "Founders");
  assert.equal(S.requestDiff(req.id).changed, true);
  const order = S.createOrderFromRequest(req.id);
  assert.equal(order.unitPrices.lulo, 2.0);
  assert.equal(order.requestId, req.id);
});

test("credit ledger: percentage frozen, cancel revokes, settings changes do not rewrite it", () => {
  const S = fresh();
  const cobra = byName(S, "Bar Cobra");
  S.updateSettings({ referral: { ...S.get().settings.referral, pctPer: 9 } });
  assert.equal(S.creditOf(cobra.id).earned, 15, "earned credit keeps the 5% it was recorded with");
  const vinyl = byName(S, "Vinyl Room");
  const qualifying = S.ordersOfPro(vinyl.id)[0];
  S.cancelOrder(qualifying.id);
  assert.equal(S.creditOf(cobra.id).earned, 10, "cancelling the qualifying order revokes its credit");
});

test("credit used by a cancelled order is released", () => {
  const S = fresh();
  const cobra = byName(S, "Bar Cobra");
  const o = S.placeProOrder({ proId: cobra.id, lines: [{ flavor: "lulo", boxes: 20 }] });
  assert.equal(o.creditPct, 15);
  assert.equal(S.creditOf(cobra.id).available, 0);
  S.cancelOrder(o.id);
  assert.equal(S.creditOf(cobra.id).available, 15);
});

test("attribution: no self-referral and no loops", () => {
  const S = fresh();
  const cobra = byName(S, "Bar Cobra"), anaconda = byName(S, "Club Anaconda");
  assert.throws(() => S.setAttribution(cobra.id, { kind: "pro", id: cobra.id }), /itself/);
  assert.throws(() => S.setAttribution(cobra.id, { kind: "pro", id: anaconda.id }), /loop/);
});

test("pro and customer visibility: the ambassador view never carries a price", () => {
  const S = fresh();
  const camila = S.get().ambassadors.find((a) => a.name.startsWith("Camila"));
  const json = JSON.stringify(S.ambassadorView(camila.id));
  assert.ok(!/unitPrices|boxPrice|welcomePct|creditPct|tierPct/.test(json), "no price or discount fields reach the ambassador view");
});

test("menu views map to the seeded accounts", () => {
  const S = fresh();
  const labels = S.DEMO_VIEWS.map((v) => v.label);
  assert.deepEqual(labels, ["Unlogged visitor", "Logged visitor", "New pro", "Pro with referral stacked", "Pro with negotiated prices", "Ambassador", "Admin"]);
  S.switchView("pro-stacked");
  assert.equal(S.currentUser("pro").name, "Bar Cobra");
  assert.equal(S.currentView(), "pro-stacked");
  S.switchView("visitor");
  assert.equal(S.currentView(), "visitor");
});


test("manual order: visit, cash, paid, shipped with a tracking number, all recorded at creation", () => {
  const S = fresh();
  const terraza = byName(S, "Terraza 7");
  const o = S.createManualOrder({
    proId: terraza.id, lines: [{ flavor: "lulo", boxes: 6 }, { flavor: "guava", boxes: 6 }], createdAt: "2026-11-10", via: "In person visit", reference: "Sofia, bar manager",
    paymentMethod: "Cash", paidAt: "2026-11-10", invoiceNo: "INV-2026-0099", invoicedAt: "2026-11-10",
    carrier: "DHL", tracking: "JD0146000", address: "Aarbergergasse 21", zip: "3011", city: "Bern", shippedAt: "2026-11-12", note: "Handed the invoice at the bar",
  }, "Founders");
  assert.equal(o.channel, "manual");
  assert.equal(o.via, "In person visit");
  assert.equal(o.payment.method, "Cash");
  assert.equal(o.status, "shipped", "status comes from the dates: shipped after paid");
  assert.deepEqual(o.history.map((h) => h.status), ["placed", "invoiced", "paid", "shipped"]);
  assert.equal(o.welcomePct, 10, "first order of a new pro");
  assert.equal(o.shipping.tracking, "JD0146000");
  assert.match(S.trackingUrl("DHL", "JD0146000"), /dhl\.com.*JD0146000/);
  assert.equal(S.trackingUrl("Swiss Post", "99.60.1"), null, "no link for carriers without a stable public URL");
  assert.equal(o.editLog[0].changes[0], "Order created");
});

test("manual order: an unpaid order stays 'placed' until a payment date is entered", () => {
  const S = fresh();
  const o = S.createManualOrder({ proId: byName(S, "Cafe Lulo").id, lines: [{ flavor: "lulo", boxes: 3 }], createdAt: "2026-11-10", via: "Email", paymentMethod: "Bank transfer" });
  assert.equal(o.status, "placed");
  assert.equal(o.paidAt, null);
});

test("edit an order: fix the date, payment, parcel and items; every change is logged and recomputed", () => {
  const S = fresh();
  const selva = byName(S, "Hotel Selva");
  const o = S.ordersOfPro(selva.id)[1];
  const netBefore = o.net;
  S.updateOrder(o.id, { "shipping.carrier": "DHL", "shipping.tracking": "JD0146999", "payment.method": "Card in person", paidAt: "2026-12-01", note: "Corrected" }, "Founders");
  assert.equal(o.shipping.tracking, "JD0146999");
  assert.equal(o.payment.method, "Card in person");
  assert.equal(o.paidAt.slice(0, 10), "2026-12-01");
  assert.ok(o.editLog.some((e) => e.changes.some((c) => /Tracking number/.test(c))));
  // change the items: priced again with the order's own unit prices (2.10), not today's
  S.updateOrder(o.id, { lines: [{ flavor: "lulo", boxes: 10 }, { flavor: "guava", boxes: 10 }] }, "Founders");
  assert.equal(o.boxes, 20);
  assert.equal(o.net, 478.8); // 20 x 25.20 = 504, less 5% tier, no welcome
  assert.notEqual(o.net, netBefore);
});

test("edit an order: the commission follows the paid date, and un-paying revokes referral credit", () => {
  const S = fresh();
  const camila = S.get().ambassadors.find((a) => a.name.startsWith("Camila"));
  const selva = byName(S, "Hotel Selva");
  const o = S.ordersOfPro(selva.id)[1]; // paid 2026-11-04
  assert.ok(S.ledger(camila.id).lines.some((l) => l.orderId === o.id && l.month === "2026-11"));
  S.updateOrder(o.id, { paidAt: "2026-10-30" }, "Founders");
  assert.ok(S.ledger(camila.id).lines.some((l) => l.orderId === o.id && l.month === "2026-10"));
  const cobra = byName(S, "Bar Cobra"), vinyl = byName(S, "Vinyl Room");
  assert.equal(S.creditOf(cobra.id).earned, 15);
  S.updateOrder(S.ordersOfPro(vinyl.id)[0].id, { paidAt: "" }, "Founders");
  assert.equal(S.creditOf(cobra.id).earned, 10, "an order that is no longer paid no longer qualifies the referrer");
});

test("edit an order: cancel and reopen", () => {
  const S = fresh();
  const o = S.ordersOfPro(byName(S, "Club Anaconda").id)[0];
  S.updateOrder(o.id, { cancelled: true }, "Founders");
  assert.equal(o.status, "cancelled");
  S.updateOrder(o.id, { cancelled: false }, "Founders");
  assert.equal(o.status, "shipped");
});

test("shop orders carry payment and tracking, editable by the founders", () => {
  const S = fresh();
  const anna = S.get().consumers[0];
  const orders = S.consumerOrdersOf(anna.id);
  const shipped = orders.find((o) => o.shippedAt);
  assert.ok(shipped.shipping.tracking, "seeded shipped order has a tracking number");
  assert.equal(shipped.payment.method, "Card (online)");
  const open = orders.find((o) => !o.shippedAt);
  S.updateConsumerOrder(open.id, { shippedAt: "2026-11-09", "shipping.carrier": "DHL", "shipping.tracking": "JD0147777", "payment.method": "Bank transfer" }, "Founders");
  assert.equal(open.status, "shipped");
  assert.equal(open.shipping.tracking, "JD0147777");
  assert.ok(open.editLog[0].changes.length >= 3);
});

test("seeded orders have invoice numbers, payment methods and parcels that fit their status", () => {
  const S = fresh();
  for (const o of S.get().orders) {
    assert.ok(o.payment.method, `${o.id} has a payment method`);
    if (o.invoicedAt) assert.match(o.invoiceNo, /^INV-2026-\d{4}$/);
    if (o.shippedAt) { assert.ok(o.shipping.tracking, `${o.id} shipped with a tracking number`); assert.ok(o.shipping.address); }
  }
  const cash = S.get().orders.filter((o) => o.payment.method === "Cash");
  assert.equal(cash.length, 1);
  assert.equal(cash[0].via, "In person visit");
});

test("consumer first-order offer is for accounts only: a guest pays the full price", () => {
  const S = fresh();
  const anna = S.get().consumers[0];
  const guest = S.consumerPreview("new.person@example.test", 2, null);
  assert.equal(guest.welcomePct, 0);
  const buyer = S.registerConsumer({ name: "New Person", email: "new.person@example.test", password: "longpassword1" });
  assert.equal(S.consumerPreview(buyer.email, 2, buyer.id).welcomePct, S.get().settings.consumerWelcomePct);
  const o = S.consumerCheckout({ email: buyer.email, name: buyer.name, accountId: buyer.id, address: "a", zip: "1", city: "c", lines: [{ flavor: "lulo", boxes: 2 }], paid: true, paymentRef: "pi_test_x" });
  assert.equal(o.status, "paid"); assert.ok(o.paidAt);
  assert.equal(S.consumerPreview(buyer.email, 1, buyer.id).welcomePct, 0, "used once");
  assert.ok(anna);
});
