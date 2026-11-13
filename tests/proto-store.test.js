/* Store-level rules: the seed profiles match docs/ACCOUNT_MODEL.md, negotiated prices, order requests, credit ledger.
   The store is a browser script, so it runs here against small localStorage / sessionStorage stubs. */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const DIR = path.join(__dirname, "..", "client");

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
  assert.deepEqual(cobra.unit, { lulo: 2.45, guava: 2.45 });
  assert.deepEqual([cobra.credit.earned, cobra.credit.used, cobra.credit.available], [15, 0, 15]);
  assert.deepEqual(cobra.next, { kind: "credit", pct: 15 });
  const selva = S.conditionsOf(byName(S, "Hotel Selva").id);
  assert.deepEqual(selva.unit, { lulo: 2.1, guava: 2.1 });
  assert.equal(selva.negotiated, true);
  assert.equal(selva.flags.extras, false);
  assert.equal(selva.next, null, "negotiated pro gets neither welcome nor credit");
  assert.equal(selva.sheet.flavors[0].boxPrice, 50.4);   // 24 bottles at 2.10
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
  assert.equal(o("Hotel Selva", 0).net, 1360.8); // 30 boxes x 50.40 = 1512, less 10% tier
  assert.equal(o("Cafe Lulo", 0).boxes, 5, "the minimum order");
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
  assert.throws(() => S.setProPrices(cafe.id, { lulo: 2.5, guava: "" }), /list price/);
  S.setProPrices(cafe.id, { lulo: 2.05, guava: 2.05, tiers: true, extras: true, note: "Volume promise" }, "Founders");
  assert.equal(S.unitPricesOf(cafe.id).lulo, 2.05);
  assert.equal(cafe.priceLog.length, 1);
  assert.equal(cafe.priceLog[0].note, "Volume promise");
  assert.equal(S.ordersOfPro(cafe.id)[0].net, before, "old orders are not repriced");
  S.setProPrices(cafe.id, { lulo: "", guava: "" }, "Founders");
  assert.equal(S.unitPricesOf(cafe.id).lulo, 2.45, "blank goes back to the list price");
  assert.equal(cafe.prices.lulo, null);
});

test("changing the list price flags pros whose negotiated price would be out of range", () => {
  const S = fresh();
  const settings = { ...S.get().settings, proBottlePrice: 2.0 };
  assert.deepEqual(S.priceConflicts(settings), ["Hotel Selva"], "2.10 is above a 2.00 list price");
  assert.deepEqual(S.priceConflicts({ ...S.get().settings, minBottlePrice: 2.15 }), ["Hotel Selva"], "2.10 is below a 2.15 floor");
});

test("the welcome offer is used once: a pro's second order pays full price, at the prices of the day", () => {
  const S = fresh();
  const tz = byName(S, "Terraza 7");
  const lines = [{ flavor: "lulo", boxes: 3 }, { flavor: "guava", boxes: 2 }];
  const a = S.payProOrder({ proId: tz.id, lines, paymentRef: "pi_a" });
  const b = S.payProOrder({ proId: tz.id, lines, paymentRef: "pi_b" });
  assert.equal(a.welcomePct, 10);
  assert.equal(b.welcomePct, 0);
  assert.ok(b.net > a.net);
  S.setProPrices(tz.id, { lulo: 2.0, guava: "" }, "Founders");
  const c = S.payProOrder({ proId: tz.id, lines, paymentRef: "pi_c" });
  assert.equal(c.unitPrices.lulo, 2.0);
  assert.equal(a.unitPrices.lulo, 2.45, "earlier orders keep their prices");
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
  assert.equal(S.trackingUrl("DHL", "JD0146000", "fr"), "https://parcelsapp.com/fr/tracking/JD0146000", "one tracker for every carrier, in the reader's language");
  assert.equal(S.trackingUrl("Swiss Post", "99.60 .1", "xx"), "https://parcelsapp.com/en/tracking/99.60.1", "spaces removed, unknown language falls back to English");
  assert.equal(S.trackingUrl("Swiss Post", ""), null);
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
  assert.equal(o.net, 957.6); // 20 x 50.40 = 1008, less 5% tier, no welcome
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
  const cobra = byName(S, "Bar Cobra"), anaconda = byName(S, "Club Anaconda");
  assert.equal(S.creditOf(cobra.id).earned, 15);
  S.updateOrder(S.ordersOfPro(anaconda.id)[0].id, { paidAt: "" }, "Founders");
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
  assert.throws(() => S.updateConsumerOrder(open.id, { "payment.method": "Bank transfer" }, "Founders"), /placed on the website/, "what the customer paid is locked");
  S.updateConsumerOrder(open.id, { shippedAt: "2026-11-09", "shipping.carrier": "DHL", "shipping.tracking": "JD0147777", note: "Fragile" }, "Founders");
  assert.equal(open.status, "shipped");
  assert.equal(open.shipping.tracking, "JD0147777");
  assert.ok(open.editLog[0].changes.length >= 2);
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

test("a pro pays online by card: the order is created paid, welcome offer and referral qualification apply", () => {
  const S = fresh();
  const t = byName(S, "Terraza 7");
  const before = S.ordersOfPro(t.id).length;
  const o = S.payProOrder({ proId: t.id, lines: [{ flavor: "lulo", boxes: 6 }, { flavor: "guava", boxes: 6 }], shipping: { address: "Rue 1", zip: "1200", city: "Geneva" }, paymentRef: "pi_test_x" });
  assert.equal(S.ordersOfPro(t.id).length, before + 1);
  assert.equal(o.status, "paid");
  assert.ok(o.paidAt);
  assert.equal(o.payment.method, "Card (online)");
  assert.equal(o.payment.reference, "pi_test_x");
  assert.equal(o.welcomePct, 10, "a first order keeps the welcome offer");
  assert.equal(o.shipping.city, "Geneva");
  assert.throws(() => S.payProOrder({ proId: t.id, lines: [] }), /Minimum order/);
  assert.throws(() => S.payProOrder({ proId: t.id, lines: [{ flavor: "lulo", boxes: 4 }] }), /Minimum order: 5 boxes of 24 bottles/);
  S.payProOrder({ proId: t.id, lines: [{ flavor: "lulo", boxes: 3 }, { flavor: "guava", boxes: 2 }], paymentRef: "pi_test_y" });   // 3 + 2 = 5: enough
});

test("shipping a shop order needs a carrier and a tracking number, and the edit form cannot skip it", () => {
  const S = fresh();
  const o = S.get().consumerOrders.find((x) => x.status === "paid");
  assert.throws(() => S.progress("shop", o.id, "shipped", { carrier: "", tracking: "", at: "2026-11-06" }), /carrier/);
  assert.throws(() => S.progress("shop", o.id, "shipped", { carrier: "DHL", tracking: "", at: "2026-11-06" }), /tracking number/);
  assert.throws(() => S.progress("shop", o.id, "shipped", { carrier: "DHL", tracking: "ab", at: "2026-11-06" }), /looks wrong/);
  assert.throws(() => S.progress("shop", o.id, "delivered", { at: "2026-11-06" }), /next step is shipped/, "no skipping a step");
  assert.throws(() => S.progress("shop", o.id, "shipped", { carrier: "DHL", tracking: "JD0146000", at: "2099-01-01" }), /future/);
  assert.throws(() => S.progress("shop", o.id, "shipped", { carrier: "DHL", tracking: "JD0146000", at: "2000-01-01" }), /before/);
  assert.equal(S.get().consumerOrders.find((x) => x.id === o.id).status, "paid", "failed attempts change nothing");
  S.progress("shop", o.id, "shipped", { carrier: "DHL", tracking: " JD0146000 ", at: o.paidAt.slice(0, 10), email: o.email }, "Founders");
  const after = S.get().consumerOrders.find((x) => x.id === o.id);
  assert.equal([after.status, after.shipping.carrier, after.shipping.tracking].join("|"), "shipped|DHL|JD0146000");
  assert.match(after.editLog.at(-1).changes[0], /JD0146000.*shipping email to/);
  S.progress("shop", o.id, "delivered", { at: o.paidAt.slice(0, 10) });
  assert.equal(S.get().consumerOrders.find((x) => x.id === o.id).status, "delivered");
  // the edit form cannot mark an order shipped without a number
  const p = S.get().consumerOrders.find((x) => x.status === "paid") || o;
  const q = S.consumerCheckout({ email: "x@y.demo", name: "X", lines: [{ flavor: "lulo", boxes: 1 }], paid: true });
  assert.throws(() => S.updateConsumerOrder(q.id, { shippedAt: "2026-11-09", "shipping.carrier": "DHL", "shipping.tracking": "" }, "t"), /tracking number/);
  assert.equal(S.get().consumerOrders.find((x) => x.id === q.id).shippedAt, null, "nothing was half-applied");
  S.updateConsumerOrder(q.id, { shippedAt: "2026-11-09", "shipping.carrier": "Own delivery", "shipping.tracking": "" }, "t");
});

test("pro order steps: invoice number, payment method, then shipping rules", () => {
  const S = fresh();
  const t = byName(S, "Terraza 7");
  const o = S.createManualOrder({ proId: t.id, lines: [{ flavor: "lulo", boxes: 3 }], createdAt: "2026-11-01", via: "Email" }, "t");
  assert.equal(o.status, "placed");
  assert.throws(() => S.progress("pro", o.id, "paid", { method: "Bank transfer", at: "2026-11-02" }), /next step is invoiced/);
  assert.throws(() => S.progress("pro", o.id, "invoiced", { invoiceNo: "", at: "2026-11-02" }), /invoice number/);
  S.progress("pro", o.id, "invoiced", { invoiceNo: "INV-2026-0100", at: "2026-11-02" });
  assert.throws(() => S.progress("pro", o.id, "paid", { method: "", at: "2026-11-03" }), /how it was paid/);
  S.progress("pro", o.id, "paid", { method: "Bank transfer", reference: "REF1", at: "2026-11-03" });
  assert.throws(() => S.progress("pro", o.id, "shipped", { carrier: "Swiss Post", tracking: "", at: "2026-11-04" }), /tracking number/);
  S.progress("pro", o.id, "shipped", { carrier: "Swiss Post", tracking: "99.60.310822.40215468", at: "2026-11-04" });
  const done = S.get().orders.find((x) => x.id === o.id);
  assert.equal([done.status, done.invoiceNo, done.payment.reference].join("|"), "shipped|INV-2026-0100|REF1");
});

test("a website order is locked: items, payment and dates cannot be rewritten, only delivery details", () => {
  const S = fresh();
  const o = S.get().consumerOrders.find((x) => x.status === "paid");
  assert.ok(S.isWebOrder("shop", o));
  const locked = [{ lines: [{ flavor: "lulo", boxes: 9 }] }, { paidAt: "2026-01-01" }, { createdAt: "2026-01-01" }, { "payment.reference": "x" }, { cancelled: true }];
  locked.forEach((patch) => assert.throws(() => S.updateConsumerOrder(o.id, patch, "t"), /website|refund/, JSON.stringify(patch)));
  S.updateConsumerOrder(o.id, { "shipTo.address": "Bahnhofstrasse 1", note: "call before" }, "t");
  assert.equal(o.shipTo.address, "Bahnhofstrasse 1", "the address can be corrected before it ships");
  S.progress("shop", o.id, "shipped", { carrier: "Swiss Post", noTracking: true, at: o.paidAt.slice(0, 10) });
  assert.equal(o.shipping.noTracking, true);
  assert.equal(o.shipping.tracking, "");
  assert.throws(() => S.updateConsumerOrder(o.id, { "shipTo.address": "Elsewhere 2" }, "t"), /once the parcel has shipped/);
  const pending = S.consumerCheckout({ email: "w@y.demo", name: "W", lines: [{ flavor: "lulo", boxes: 1 }] });
  assert.throws(() => S.progress("shop", pending.id, "paid", { method: "Cash", at: "2026-11-10" }), /card payment itself/, "never mark a website order paid by hand");
});

test("a manual pro order stays fully editable, and a parcel without tracking is allowed when said so", () => {
  const S = fresh();
  const o = S.createManualOrder({ proId: byName(S, "Terraza 7").id, lines: [{ flavor: "lulo", boxes: 3 }], createdAt: "2026-11-01", via: "Email", paymentMethod: "Bank transfer", paidAt: "2026-11-02" }, "t");
  assert.equal(S.isWebOrder("pro", o), false);
  S.updateOrder(o.id, { "payment.method": "Cash", lines: [{ flavor: "lulo", boxes: 4 }] }, "t");
  assert.equal(o.payment.method, "Cash");
  assert.throws(() => S.updateOrder(o.id, { shippedAt: "2026-11-05", "shipping.carrier": "Swiss Post", "shipping.tracking": "" }, "t"), /tracking number/);
  S.updateOrder(o.id, { shippedAt: "2026-11-05", "shipping.carrier": "Swiss Post", "shipping.tracking": "", "shipping.noTracking": true }, "t");
  assert.equal(o.status, "shipped");
  const w = S.payProOrder({ proId: byName(S, "Terraza 7").id, lines: [{ flavor: "lulo", boxes: 5 }], paymentRef: "pi_1" });
  assert.equal(S.isWebOrder("pro", w), true);
  assert.throws(() => S.updateOrder(w.id, { "payment.method": "Cash" }, "t"), /placed on the website/);
});
