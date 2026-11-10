/* =============================================================
   MALACONDA PROTOTYPE - Pricing, credit and commission engine
   Pure functions, no DOM. Rules: docs/ACCOUNT_MODEL.md
   Runs in the browser (window.Engine) and in Node (tests).
   ============================================================= */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== "undefined" ? self : this, function () {

  const FLAVORS = ["lulo", "guava"];

  const DEFAULT_SETTINGS = {
    retailPrice: 39,            // per box, VAT included
    bottlesPerBox: 12,
    vatPct: 8.1,
    proBottlePrice: 2.2,        // list price per bottle, excl. VAT
    minBottlePrice: 1.8,        // floor for a negotiated base price
    consumerWelcomePct: 10,
    proWelcomePct: 10,
    // Tier applies to the whole order. Sorted by min boxes.
    tiers: [
      { min: 10, pct: 5 },
      { min: 21, pct: 10 },
    ],
    referral: { pctPer: 5, maxPerOrder: 15, minBoxes: 10 },
    commission: { pct: 5, months: 12 },
  };

  // half-up to 2 decimals, symmetric for negatives; the 1e-9 absorbs float noise (18.525 -> 18.53)
  const round2 = (n) => (n < 0 ? -1 : 1) * Math.round((Math.abs(n) + 1e-9) * 100) / 100;
  const cents = (n) => Math.round((n + 1e-9) * 100);

  const listBoxPrice = (settings) => round2(settings.proBottlePrice * settings.bottlesPerBox);

  function tierPct(boxes, settings) {
    let pct = 0;
    for (const t of settings.tiers) if (boxes >= t.min) pct = t.pct;
    return pct;
  }

  /* ---- Price rules ---------------------------------------------- */

  // A negotiated price per bottle must be between the floor and the list price.
  function validateNegotiated(price, settings) {
    if (price == null || price === "") return null;
    const n = Number(price);
    if (!isFinite(n)) return "Enter a price in CHF.";
    if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return "Use at most two decimals.";
    if (n < settings.minBottlePrice) return `Below the floor of CHF ${settings.minBottlePrice.toFixed(2)} per bottle.`;
    if (n > settings.proBottlePrice) return `Above the list price of CHF ${settings.proBottlePrice.toFixed(2)} per bottle.`;
    return null;
  }

  // The most expensive pro price (list, undiscounted, excl. VAT) stays below the consumer first-order price excl. VAT.
  function checkPriceInvariant(settings) {
    const limit = round2((settings.retailPrice / (1 + settings.vatPct / 100)) * (1 - settings.consumerWelcomePct / 100));
    const box = listBoxPrice(settings);
    return { ok: box < limit, box, limit };
  }

  // Lowest price per bottle a pro could reach: base x best tier x maximum credit.
  function bestCaseBottle(base, settings) {
    const topTier = settings.tiers.length ? settings.tiers[settings.tiers.length - 1].pct : 0;
    return Math.round(base * (1 - topTier / 100) * (1 - settings.referral.maxPerOrder / 100) * 1000) / 1000;
  }

  /* ---- Orders -------------------------------------------------- */

  const isActive = (o) => o.status !== "cancelled";

  // "First order" = the pro has no earlier order that is not cancelled.
  function isFirstOrder(proOrders) {
    return !proOrders.some(isActive);
  }

  const unitFor = (unitPrices, flavor, settings) => (unitPrices && unitPrices[flavor] != null ? unitPrices[flavor] : settings.proBottlePrice);

  /* Pro order price.
     input: { lines:[{flavor,boxes}] | boxes, unitPrices:{lulo,guava}, settings, isFirst, creditAvailablePct, flags:{tiers,extras} }
     Base is each flavour at the pro's price; then the volume tier on the whole order; then ONE extra
     discount: the welcome offer (first order) or the referral credit, never both. */
  function priceProOrder({ lines, boxes, unitPrices, settings, isFirst, creditAvailablePct, flags }) {
    const f = Object.assign({ tiers: true, extras: true }, flags || {});
    const per = settings.bottlesPerBox;
    const rows = (lines || [{ flavor: "lulo", boxes: boxes || 0 }]).map((l) => {
      const unit = unitFor(unitPrices, l.flavor, settings);
      return { flavor: l.flavor, boxes: l.boxes, unit, boxPrice: round2(unit * per), amount: round2(l.boxes * per * unit) };
    });
    const totalBoxes = rows.reduce((n, r) => n + r.boxes, 0);
    const gross = round2(rows.reduce((n, r) => n + r.amount, 0));
    const tPct = f.tiers ? tierPct(totalBoxes, settings) : 0;
    const afterTier = round2(gross * (1 - tPct / 100));
    const welcomePct = f.extras && isFirst ? settings.proWelcomePct : 0;
    const creditPct = f.extras && !isFirst ? Math.min(Math.max(creditAvailablePct || 0, 0), settings.referral.maxPerOrder) : 0;
    const extraPct = welcomePct || creditPct;
    const net = round2(afterTier * (1 - extraPct / 100));
    return {
      boxes: totalBoxes, lines: rows, gross, tierPct: tPct, tierAmount: round2(gross - afterTier), afterTier,
      welcomePct, creditPct, extraPct, extraAmount: round2(afterTier - net),
      net, perBox: totalBoxes ? round2(net / totalBoxes) : 0,
    };
  }

  /* Consumer order price: retail price, welcome offer on the first order, no cap. */
  function priceConsumerOrder({ boxes, settings, isFirst }) {
    const gross = round2(boxes * settings.retailPrice);
    const welcomePct = isFirst ? settings.consumerWelcomePct : 0;
    const net = round2(gross * (1 - welcomePct / 100));
    return { boxes, gross, welcomePct, discount: round2(gross - net), net, perBox: boxes ? round2(net / boxes) : 0 };
  }

  /* What one pro sees as their price sheet (site, pro space and admin all use this).
     Tier rows give the box price for each flavour; per-bottle figures are exact only for the base. */
  function priceSheet({ unitPrices, settings, flags }) {
    const f = Object.assign({ tiers: true, extras: true }, flags || {});
    const per = settings.bottlesPerBox;
    const flavors = FLAVORS.map((k) => {
      const unit = unitFor(unitPrices, k, settings);
      return { flavor: k, unit, boxPrice: round2(unit * per), negotiated: unitPrices && unitPrices[k] != null && unitPrices[k] !== settings.proBottlePrice };
    });
    const bands = [{ from: 1, to: settings.tiers.length ? settings.tiers[0].min - 1 : null, pct: 0 }];
    settings.tiers.forEach((t, i) => bands.push({ from: t.min, to: settings.tiers[i + 1] ? settings.tiers[i + 1].min - 1 : null, pct: t.pct }));
    const tiers = bands.map((b) => {
      const pct = f.tiers ? b.pct : 0;
      return { from: b.from, to: b.to, pct, boxes: flavors.map((x) => ({ flavor: x.flavor, boxPrice: round2(x.boxPrice * (1 - pct / 100)), bottle: Math.round(x.unit * (1 - pct / 100) * 100) / 100 })) };
    });
    return { flavors, tiers, flags: f };
  }

  /* ---- Pro referral credit ------------------------------------- */

  function firstPaidOrder(orders) {
    const paid = orders.filter((o) => o.paidAt && isActive(o)).sort((a, b) => a.paidAt.localeCompare(b.paidAt));
    return paid[0] || null;
  }

  /* status of each referred pro: "waiting" | "qualified" | "below" */
  function referredStatuses(referrerId, pros, orders, settings) {
    return pros
      .filter((p) => p.referredBy && p.referredBy.kind === "pro" && p.referredBy.id === referrerId)
      .map((p) => {
        const first = firstPaidOrder(orders.filter((o) => o.proId === p.id));
        let status = "waiting";
        if (first) status = first.boxes >= settings.referral.minBoxes ? "qualified" : "below";
        return { pro: p, status, boxes: first ? first.boxes : 0 };
      });
  }

  /* Credit summary. With a ledger, earned credit comes from the entries (percentage frozen when earned).
     Without one (unit tests), it is recomputed from the orders. */
  function creditSummary(referrerId, pros, orders, settings, ledger) {
    const refs = referredStatuses(referrerId, pros, orders, settings);
    const earned = ledger
      ? ledger.filter((e) => e.referrerId === referrerId && !e.revokedAt).reduce((n, e) => n + e.pct, 0)
      : refs.filter((r) => r.status === "qualified").length * settings.referral.pctPer;
    const used = orders.filter((o) => o.proId === referrerId && isActive(o)).reduce((s, o) => s + (o.creditPct || 0), 0);
    return { refs, earned, used, available: Math.max(earned - used, 0) };
  }

  /* ---- Ambassador commission ----------------------------------- */

  const monthKey = (iso) => iso.slice(0, 7);

  function addMonths(iso, months) {
    const d = new Date(iso);
    d.setUTCMonth(d.getUTCMonth() + months);
    return d.toISOString();
  }

  /* Commission window per venue: from the venue's first paid order (cancelled or not), for `months` months. */
  function venueWindow(venueOrders, months) {
    const paid = venueOrders.filter((o) => o.paidAt).sort((a, b) => a.paidAt.localeCompare(b.paidAt));
    if (!paid.length) return null;
    return { start: paid[0].paidAt, end: addMonths(paid[0].paidAt, months) };
  }

  /* Ledger lines for one ambassador. Base = net invoiced amount excl. VAT.
     A paid order inside the window gives +pct of its net in the month it was paid.
     If that order is later cancelled, a -pct line lands in the month of the cancellation. */
  function commissionLines(ambassador, orders, defaults) {
    const pct = ambassador.pct != null ? ambassador.pct : defaults.pct;
    const months = ambassador.months != null ? ambassador.months : defaults.months;
    const byVenue = {};
    orders.filter((o) => o.ambassadorId === ambassador.id).forEach((o) => (byVenue[o.proId] = byVenue[o.proId] || []).push(o));
    const lines = [];
    Object.entries(byVenue).forEach(([proId, vOrders]) => {
      const win = venueWindow(vOrders, months);
      if (!win) return;
      vOrders.forEach((o) => {
        if (!o.paidAt || o.paidAt < win.start || o.paidAt >= win.end) return;
        const amount = round2((o.net * pct) / 100);
        lines.push({ proId, orderId: o.id, month: monthKey(o.paidAt), base: o.net, amount });
        if (!isActive(o) && o.cancelledAt) {
          lines.push({ proId, orderId: o.id, month: monthKey(o.cancelledAt), base: -o.net, amount: -amount });
        }
      });
    });
    return { pct, months, lines };
  }

  return {
    FLAVORS, DEFAULT_SETTINGS, round2, tierPct, listBoxPrice, validateNegotiated, checkPriceInvariant, bestCaseBottle,
    isFirstOrder, priceProOrder, priceConsumerOrder, priceSheet,
    firstPaidOrder, referredStatuses, creditSummary, venueWindow, commissionLines, monthKey, addMonths,
  };
});
