/* Small shared helpers: pricing (same engine as the prototype), passwords, tokens, validation. */
const crypto = require("node:crypto");
const path = require("node:path");
const Engine = require(path.join(__dirname, "..", "client", "engine.js"));   // one source of truth for the price rules

const SETTINGS = Engine.DEFAULT_SETTINGS;
const FLAVOR_NAMES = { lulo: "Biting Lulo", guava: "Sweet Guava" };
const cents = (chf) => Math.round(chf * 100);

// Price an order from the cart. The browser is never trusted for prices: only flavours and box counts come from it.
// The first-order offer is for accounts only, and only while the account has no paid order yet.
function quote(cart, { hasPaidOrder, isAccount }) {
  const lines = Object.keys(FLAVOR_NAMES).map((k) => ({ flavor: k, boxes: Math.max(0, Math.min(500, Math.floor(Number(cart && cart[k]) || 0))) })).filter((l) => l.boxes > 0);
  const boxes = lines.reduce((n, l) => n + l.boxes, 0);
  const p = Engine.priceConsumerOrder({ boxes, settings: SETTINGS, isFirst: !!isAccount && !hasPaidOrder });
  return { lines: lines.map((l) => ({ ...l, unitCents: cents(SETTINGS.retailPrice) })), boxes, grossCents: cents(p.gross), discountCents: cents(p.discount), netCents: cents(p.net), vatCents: cents(Engine.vatIncluded(p.net, SETTINGS)), welcomePct: p.welcomePct };
}

// Price a pro order from the pro's own conditions (negotiated prices, volume tier, one extra discount: welcome offer or referral credit). Prices are excl. VAT; VAT is added at the end.
function proQuote(lines, pro, { hasPaidOrder }) {
  const clean = [];
  for (const l of Array.isArray(lines) ? lines : []) {
    if (!FLAVOR_NAMES[l && l.flavor]) continue;
    const boxes = Math.max(0, Math.min(500, Math.floor(Number(l.boxes) || 0)));
    const same = clean.find((c) => c.flavor === l.flavor);
    if (same) same.boxes = Math.min(500, same.boxes + boxes); else if (boxes) clean.push({ flavor: l.flavor, boxes });
  }
  const unitPrices = { lulo: pro.price_lulo == null ? null : Number(pro.price_lulo), guava: pro.price_guava == null ? null : Number(pro.price_guava) };
  const p = Engine.priceProOrder({ lines: clean, unitPrices, settings: SETTINGS, isFirst: !hasPaidOrder, creditAvailablePct: Number(pro.credit_pct) || 0, flags: { tiers: !!pro.tiers, extras: !!pro.extras } });
  const net = p.net, vat = Engine.round2(net * SETTINGS.vatPct / 100), total = Engine.round2(net + vat);
  return {
    lines: p.lines.map((r) => ({ flavor: r.flavor, boxes: r.boxes, unitMilli: Math.round(r.unit * 1000), boxCents: cents(r.boxPrice), amountCents: cents(r.amount) })),
    boxes: p.boxes, grossCents: cents(p.gross), tierPct: p.tierPct, tierCents: cents(p.tierAmount), welcomePct: p.welcomePct, creditPct: p.creditPct, extraCents: cents(p.extraAmount),
    netCents: cents(net), vatCents: cents(vat), totalCents: cents(total), vatPct: SETTINGS.vatPct,
  };
}

const hashToken = (t) => crypto.createHash("sha256").update(t).digest("hex");
const newToken = () => crypto.randomBytes(32).toString("base64url");
const proOrderRef = () => "P-" + crypto.randomBytes(5).toString("hex").toUpperCase().slice(0, 7);
const orderRef = () => "M-" + crypto.randomBytes(5).toString("hex").toUpperCase().slice(0, 7);

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${crypto.scryptSync(pw, salt, 64).toString("hex")}`;
}
function checkPassword(pw, stored) {
  const [algo, saltHex, hashHex] = String(stored).split("$");
  if (algo !== "scrypt") return false;
  const got = crypto.scryptSync(pw, Buffer.from(saltHex, "hex"), 64), want = Buffer.from(hashHex, "hex");
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

const isEmail = (s) => typeof s === "string" && s.length <= 190 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const clean = (s, max) => String(s == null ? "" : s).trim().slice(0, max);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const chf = (c) => `CHF ${(c / 100).toFixed(2)}`;

module.exports = { Engine, SETTINGS, FLAVOR_NAMES, cents, quote, proQuote, proOrderRef, hashToken, newToken, orderRef, hashPassword, checkPassword, isEmail, clean, esc, chf };
