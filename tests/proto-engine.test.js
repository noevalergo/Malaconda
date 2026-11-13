const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../client/engine.js");
const S = E.DEFAULT_SETTINGS;

test("volume tiers: 9 -> 0, 10 -> 5, 20 -> 5, 21 -> 10", () => {
  assert.equal(E.tierPct(1, S), 0);
  assert.equal(E.tierPct(9, S), 0);
  assert.equal(E.tierPct(10, S), 5);
  assert.equal(E.tierPct(20, S), 5);
  assert.equal(E.tierPct(21, S), 10);
  assert.equal(E.tierPct(60, S), 10);
});

test("pro first order: 10% welcome after the tier, sequential", () => {
  const p = E.priceProOrder({ boxes: 25, settings: S, isFirst: true, creditAvailablePct: 0 });
  assert.equal(p.gross, 1470);          // 25 boxes of 24 bottles at 2.45 = 58.80 a box
  assert.equal(p.afterTier, 1323);      // 21+ boxes: -10%
  assert.equal(p.welcomePct, 10);
  assert.equal(p.net, 1190.7);
});

test("pro later order uses credit capped at 15%, never welcome", () => {
  const p = E.priceProOrder({ boxes: 25, settings: S, isFirst: false, creditAvailablePct: 20 });
  assert.equal(p.creditPct, 15);
  assert.equal(p.welcomePct, 0);
  assert.equal(p.net, E.round2(1323 * 0.85));
});

test("first order never combines welcome and credit", () => {
  const p = E.priceProOrder({ boxes: 10, settings: S, isFirst: true, creditAvailablePct: 15 });
  assert.equal(p.welcomePct, 10);
  assert.equal(p.creditPct, 0);
});

test("consumer: 10% on first order, no cap, none afterwards", () => {
  const a = E.priceConsumerOrder({ boxes: 50, settings: S, isFirst: true });
  assert.equal(a.gross, 1950);
  assert.equal(a.net, 1755);
  const b = E.priceConsumerOrder({ boxes: 2, settings: S, isFirst: false });
  assert.equal(b.net, 78);
});

test("price invariant: the pro bottle price (ex VAT) stays below the consumer first-order bottle price ex VAT", () => {
  const inv = E.checkPriceInvariant(S);
  assert.equal(E.listBoxPrice(S), 58.8);   // a pro box has 24 bottles
  assert.equal(inv.bottle, 2.45);
  assert.equal(inv.limit, 2.706);          // 39 / 12 bottles, less VAT, less the 10% welcome offer
  assert.ok(inv.ok);
  assert.ok(!E.checkPriceInvariant({ ...S, proBottlePrice: 2.75 }).ok, "a list price of 2.75 breaks the invariant");
  assert.equal(E.priceConsumerOrder({ boxes: 1, settings: S, isFirst: true }).perBox, 35.1);
});

test("worst pro case is not above 23.5% total discount", () => {
  const p = E.priceProOrder({ boxes: 30, settings: S, isFirst: false, creditAvailablePct: 99 });
  const totalDiscount = 1 - p.net / p.gross;
  assert.ok(Math.abs(totalDiscount - 0.235) < 1e-9);
});

const pros = [
  { id: "R", referredBy: null },
  { id: "A", referredBy: { kind: "pro", id: "R" } },
  { id: "B", referredBy: { kind: "pro", id: "R" } },
  { id: "C", referredBy: { kind: "pro", id: "R" } },
  { id: "D", referredBy: { kind: "ambassador", id: "amb1" } },
];
const ord = (id, proId, boxes, paidAt, extra = {}) => ({ id, proId, boxes, net: boxes * 20, status: paidAt ? "paid" : "placed", paidAt, creditPct: 0, ...extra });

test("referral: qualifies at >= 10 boxes on first paid order only", () => {
  const orders = [
    ord("1", "A", 10, "2026-09-01T10:00:00Z"),
    ord("2", "B", 9, "2026-09-02T10:00:00Z"),
    ord("3", "B", 40, "2026-09-20T10:00:00Z"), // later big order does not requalify B
    ord("4", "C", 12, null), // not paid yet
  ];
  const refs = E.referredStatuses("R", pros, orders, S);
  const st = Object.fromEntries(refs.map((r) => [r.pro.id, r.status]));
  assert.deepEqual(st, { A: "qualified", B: "below", C: "waiting" });
  const c = E.creditSummary("R", pros, orders, S);
  assert.equal(c.earned, 5);
  assert.equal(c.available, 5);
});

test("referral credit: used credit reduces availability, cancelled order restores it", () => {
  const orders = [
    ord("1", "A", 10, "2026-09-01T10:00:00Z"),
    ord("2", "B", 11, "2026-09-02T10:00:00Z"),
    ord("3", "C", 10, "2026-09-03T10:00:00Z"),
    ord("r1", "R", 5, null, { creditPct: 10 }),
  ];
  assert.equal(E.creditSummary("R", pros, orders, S).earned, 15);
  assert.equal(E.creditSummary("R", pros, orders, S).available, 5);
  orders[3].status = "cancelled";
  assert.equal(E.creditSummary("R", pros, orders, S).available, 15);
});

test("first order ignores cancelled orders", () => {
  assert.equal(E.isFirstOrder([]), true);
  assert.equal(E.isFirstOrder([{ status: "cancelled" }]), true);
  assert.equal(E.isFirstOrder([{ status: "placed" }]), false);
});

const amb = { id: "amb1", pct: null, months: null };
const D = S.commission;

test("commission: 5% of net on paid orders, month of payment", () => {
  const orders = [
    { id: "1", proId: "D", ambassadorId: "amb1", net: 1000, status: "paid", paidAt: "2026-09-10T10:00:00Z" },
    { id: "2", proId: "D", ambassadorId: "amb1", net: 500, status: "placed", paidAt: null },
  ];
  const r = E.commissionLines(amb, orders, D);
  assert.equal(r.lines.length, 1);
  assert.equal(r.lines[0].amount, 50);
  assert.equal(r.lines[0].month, "2026-09");
});

test("commission stops 12 months after the first paid order", () => {
  const orders = [
    { id: "1", proId: "D", ambassadorId: "amb1", net: 100, status: "paid", paidAt: "2026-01-15T10:00:00Z" },
    { id: "2", proId: "D", ambassadorId: "amb1", net: 100, status: "paid", paidAt: "2026-12-31T10:00:00Z" },
    { id: "3", proId: "D", ambassadorId: "amb1", net: 100, status: "paid", paidAt: "2027-01-15T10:00:00Z" },
  ];
  const r = E.commissionLines(amb, orders, D);
  assert.deepEqual(r.lines.map((l) => l.orderId), ["1", "2"]);
});

test("commission: cancelling a paid order deducts in the month of cancellation", () => {
  const orders = [
    { id: "1", proId: "D", ambassadorId: "amb1", net: 1000, status: "cancelled", paidAt: "2026-09-10T10:00:00Z", cancelledAt: "2026-10-05T10:00:00Z" },
  ];
  const r = E.commissionLines(amb, orders, D);
  assert.deepEqual(r.lines.map((l) => [l.month, l.amount]), [["2026-09", 50], ["2026-10", -50]]);
});

test("commission: orders attributed to another ambassador or nobody are excluded", () => {
  const orders = [
    { id: "1", proId: "D", ambassadorId: "amb2", net: 1000, status: "paid", paidAt: "2026-09-10T10:00:00Z" },
    { id: "2", proId: "D", ambassadorId: null, net: 1000, status: "paid", paidAt: "2026-09-11T10:00:00Z" },
  ];
  assert.equal(E.commissionLines(amb, orders, D).lines.length, 0);
});

test("per-ambassador rate and duration override defaults", () => {
  const orders = [{ id: "1", proId: "D", ambassadorId: "amb1", net: 1000, status: "paid", paidAt: "2026-09-10T10:00:00Z" }];
  const r = E.commissionLines({ id: "amb1", pct: 3, months: 6 }, orders, D);
  assert.equal(r.lines[0].amount, 30);
});

test("rounding is half-up and symmetric", () => {
  assert.equal(E.round2(18.525), 18.53);
  assert.equal(E.round2(-18.525), -18.53);
  assert.equal(E.round2(0.1 + 0.2), 0.3);
});


test("negotiated prices: per flavour, per bottle, to the cent", () => {
  const unit = { lulo: 2.1, guava: 2.2 };
  const p = E.priceProOrder({ lines: [{ flavor: "lulo", boxes: 6 }, { flavor: "guava", boxes: 6 }], unitPrices: unit, settings: S, isFirst: false, creditAvailablePct: 0 });
  assert.equal(p.lines[0].boxPrice, 50.4);
  assert.equal(p.lines[1].boxPrice, 52.8);
  assert.equal(p.gross, 619.2); // 6 x 50.40 + 6 x 52.80
  assert.equal(p.tierPct, 5); // tier on the 12 boxes of the whole order
  assert.equal(p.net, 588.24);
});

test("validateNegotiated enforces the floor, the ceiling and two decimals", () => {
  assert.equal(E.validateNegotiated(null, S), null);
  assert.equal(E.validateNegotiated(2.1, S), null);
  assert.equal(E.validateNegotiated(1.8, S), null);
  assert.match(E.validateNegotiated(1.79, S), /floor/);
  assert.match(E.validateNegotiated(2.5, S), /list price/);
  assert.match(E.validateNegotiated(2.105, S), /two decimals/);
});

test("per-pro flags switch tiers and welcome/credit off", () => {
  const base = { boxes: 25, settings: S, isFirst: true, creditAvailablePct: 0 };
  const noExtras = E.priceProOrder({ ...base, flags: { extras: false } });
  assert.equal(noExtras.welcomePct, 0);
  assert.equal(noExtras.tierPct, 10);
  const noTiers = E.priceProOrder({ ...base, flags: { tiers: false } });
  assert.equal(noTiers.tierPct, 0);
  assert.equal(noTiers.welcomePct, 10);
});

test("price sheet gives each flavour's box price and the tier table", () => {
  const sheet = E.priceSheet({ unitPrices: { lulo: 2.1, guava: null }, settings: S });
  assert.equal(sheet.flavors[0].boxPrice, 50.4);
  assert.equal(sheet.flavors[0].negotiated, true);
  assert.equal(sheet.flavors[1].negotiated, false);
  assert.deepEqual(sheet.tiers.map((t) => [t.from, t.to, t.pct]), [[5, 9, 0], [10, 20, 5], [21, null, 10]]);
  assert.equal(sheet.tiers[2].boxes[0].boxPrice, 45.36); // 50.40 less 10%
});

test("best-case effective bottle price shows what the combined discounts can reach", () => {
  assert.equal(E.bestCaseBottle(1.8, S), 1.377);
  assert.equal(E.bestCaseBottle(2.2, S), 1.683);
});

test("credit from a ledger keeps the percentage frozen when it was earned", () => {
  const pros = [{ id: "R" }, { id: "A", referredBy: { kind: "pro", id: "R" } }];
  const ledger = [{ referrerId: "R", referredId: "A", pct: 5 }, { referrerId: "R", referredId: "B", pct: 5, revokedAt: "2026-10-01T00:00:00Z" }];
  const orders = [{ id: "x", proId: "R", status: "placed", creditPct: 0 }];
  const c = E.creditSummary("R", pros, orders, { ...S, referral: { ...S.referral, pctPer: 9 } }, ledger);
  assert.equal(c.earned, 5, "later settings changes do not rewrite earned credit; revoked entries do not count");
  assert.equal(c.available, 5);
});

test("VAT contained in a VAT-inclusive amount", () => {
  assert.equal(E.vatIncluded(117, E.DEFAULT_SETTINGS), 8.77);   // 117 / 1.081 = 108.23, VAT 8.77
  assert.equal(E.vatIncluded(0, E.DEFAULT_SETTINGS), 0);
});

test("pro minimum order: 5 boxes, all flavours together; tiers start at the minimum", () => {
  assert.equal(E.proMoqMessage(4, S), "Minimum order: 5 boxes of 24 bottles.");
  assert.equal(E.proMoqMessage(5, S), null);
  assert.equal(E.proMoqMessage(2 + 3, S), null, "3 of one flavour and 2 of the other make 5");
  assert.equal(E.tierPct(5, S), 0, "5 to 9 boxes: no discount");
});

test("delivery: a fee, free for a pickup, and the pickup can be switched off", () => {
  assert.equal(E.shippingCharge(S, "ship"), S.shippingFee);
  assert.equal(E.shippingCharge(S, "pickup"), 0);
  assert.equal(E.shippingCharge({ ...S, pickupEnabled: false }, "pickup"), S.shippingFee, "no pickup offered: the fee applies");
});
