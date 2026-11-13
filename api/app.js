/* The Express app. Built as a function so tests can inject a fake Stripe client. */
const express = require("express");
const config = require("./config");
const db = require("./db");
const mailer = require("./mailer");
const L = require("./lib");

const COOKIE = "mlc_session", PRO_COOKIE = "mlc_pro";
const cookieOpts = () => ({ httpOnly: true, sameSite: "lax", secure: config.production, path: "/", maxAge: 30 * 24 * 3600 * 1000 });

function createApp({ stripe } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  const stripeClient = () => { if (stripe) return stripe; if (!config.stripe.secretKey) throw httpError(503, "Payments are not configured."); return (stripe = require("stripe")(config.stripe.secretKey)); };

  // security headers and keep-out-of-search-engines (the temporary site is for the founders only)
  app.use((req, res, next) => {
    res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Robots-Tag": "noindex, nofollow" });
    next();
  });

  /* ---- Stripe webhook: needs the raw body, so it is declared before the JSON parser ---- */
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), wrap(async (req, res) => {
    let event;
    try { event = stripeClient().webhooks.constructEvent(req.body, req.get("stripe-signature"), config.stripe.webhookSecret); }
    catch (e) { return res.status(400).send(`Webhook signature check failed: ${e.message}`); }
    if (event.type === "payment_intent.succeeded") await markPaid(event);
    res.json({ received: true });
  }));

  app.use(express.json({ limit: "20kb" }));
  app.use(cookies);
  app.use(wrap(currentUser));
  app.use(wrap(currentPro));

  app.get("/api/health", wrap(async (req, res) => { await db.one("SELECT 1 AS ok"); res.json({ ok: true, stripe: !!(stripe || config.stripe.secretKey), mail: !!(config.brevo.apiKey && config.brevo.senderEmail) }); }));

  /* ---- public settings the page needs to start Stripe Elements (the publishable key is meant to be public) ---- */
  app.get("/api/config", (req, res) => res.json({ stripePublishableKey: config.stripe.publishableKey, staging: !!(process.env.STAGING_USER && process.env.STAGING_PASSWORD) }));

  /* ---- price quote for the cart (what the cart drawer shows) ---- */
  app.post("/api/quote", wrap(async (req, res) => res.json(L.quote(req.body && req.body.cart, await offerState(req.user)))));

  /* ---- accounts ---- */
  app.post("/api/auth/register", limit(10), wrap(async (req, res) => {
    const name = L.clean(req.body.name, 120), email = L.clean(req.body.email, 190).toLowerCase(), pw = String(req.body.password || "");
    if (!name || !L.isEmail(email)) throw httpError(400, "Enter your name and a valid email.");
    if (pw.length < 8) throw httpError(400, "Password: at least 8 characters.");
    if (await db.one("SELECT id FROM users WHERE email = ?", [email])) throw httpError(409, "An account with this email already exists.");
    const r = await db.query("INSERT INTO users (email, name, password_hash) VALUES (?,?,?)", [email, name, L.hashPassword(pw)]);
    await db.query("UPDATE orders SET user_id = ? WHERE email = ? AND user_id IS NULL", [r.insertId, email]);   // earlier guest orders join the account
    await startSession(res, r.insertId);
    mailer.welcome(email, name).catch((e) => console.error("welcome mail:", e.message));
    res.status(201).json({ user: publicUser(await db.one("SELECT * FROM users WHERE id = ?", [r.insertId])) });
  }));
  app.post("/api/auth/login", limit(20), wrap(async (req, res) => {
    const u = await db.one("SELECT * FROM users WHERE email = ?", [L.clean(req.body.email, 190).toLowerCase()]);
    if (!u || !L.checkPassword(String(req.body.password || ""), u.password_hash)) throw httpError(401, "Wrong email or password.");
    await startSession(res, u.id);
    res.json({ user: publicUser(u) });
  }));
  app.post("/api/auth/logout", wrap(async (req, res) => {
    if (req.cookies[COOKIE]) await db.query("DELETE FROM sessions WHERE token_hash = ?", [L.hashToken(req.cookies[COOKIE])]);
    res.clearCookie(COOKIE, { path: "/" }); res.json({ ok: true });
  }));
  app.get("/api/me", wrap(async (req, res) => res.json({ user: req.user ? publicUser(req.user) : null })));
  app.get("/api/me/orders", wrap(async (req, res) => {
    if (!req.user) throw httpError(401, "Log in first.");
    const orders = await db.query("SELECT ref, status, boxes, net_cents, discount_cents, welcome_pct, carrier, tracking, paid_at, created_at FROM orders WHERE user_id = ? ORDER BY id DESC", [req.user.id]);
    res.json({ orders });
  }));

  /* ---- checkout: the page shows Stripe's Payment Element; when the customer pays, this creates the order (pending) and a PaymentIntent
          priced by the server. The order becomes paid only when Stripe says so (webhook, or the status check below). ---- */
  app.post("/api/checkout", limit(20), wrap(async (req, res) => {
    const b = req.body || {}, u = req.user;
    const email = u ? u.email : L.clean(b.email, 190).toLowerCase(), name = L.clean(b.name, 120);
    const ship = { address: L.clean(b.address, 190), zip: L.clean(b.zip, 20), city: L.clean(b.city, 90), phone: L.clean(b.phone, 40) };
    if (!L.isEmail(email)) throw httpError(400, "Enter a valid email.");
    if (!name || !ship.address || !ship.zip || !ship.city) throw httpError(400, "Fill in your name and delivery address.");
    const q = L.quote(b.cart, await offerState(u));
    if (!q.boxes) throw httpError(400, "Your cart is empty.");

    const orderId = await db.tx(async (sql) => {
      const r = await sql("INSERT INTO orders (ref, user_id, email, name, ship_address, ship_zip, ship_city, ship_phone, boxes, gross_cents, discount_cents, net_cents, welcome_pct) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [L.orderRef(), u ? u.id : null, email, name, ship.address, ship.zip, ship.city, ship.phone, q.boxes, q.grossCents, q.discountCents, q.netCents, q.welcomePct]);
      for (const l of q.lines) await sql("INSERT INTO order_lines (order_id, flavor, boxes, unit_cents) VALUES (?,?,?,?)", [r.insertId, l.flavor, l.boxes, l.unitCents]);
      return r.insertId;
    });
    const order = await db.one("SELECT * FROM orders WHERE id = ?", [orderId]);

    let intent;
    try {
      intent = await stripeClient().paymentIntents.create({
        amount: q.netCents, currency: "chf", automatic_payment_methods: { enabled: true }, receipt_email: email,
        description: `Malaconda ${order.ref}: ${q.lines.map((l) => `${l.boxes} × ${L.FLAVOR_NAMES[l.flavor]}`).join(", ")}`,
        metadata: { orderId: String(order.id), ref: order.ref },
      });
    } catch (e) {
      await db.query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [order.id]);   // nothing was charged: do not leave a pending order behind
      throw e;
    }
    await db.query("UPDATE orders SET stripe_payment_id = ? WHERE id = ?", [intent.id, order.id]);
    res.status(201).json({ ref: order.ref, clientSecret: intent.client_secret });
  }));

  /* ---- after the payment (also after a redirect such as TWINT): what happened to this order.
          The client secret proves the caller is the payer. If Stripe says paid but the webhook has not arrived yet, the order is settled here (idempotent). ---- */
  app.post("/api/order/status", limit(60), wrap(async (req, res) => {
    const secret = String((req.body && req.body.clientSecret) || "");
    const piId = secret.split("_secret_")[0];
    if (!/^pi_\w+$/.test(piId)) throw httpError(400, "Unknown payment.");
    const pi = await stripeClient().paymentIntents.retrieve(piId);
    if (!pi || pi.client_secret !== secret) throw httpError(404, "Unknown payment.");
    if (pi.status === "succeeded") {
      await settleAndMail(pi.id);
    }
    const po = await db.one("SELECT * FROM pro_orders WHERE stripe_payment_id = ?", [pi.id]);
    if (po) {
      const lines = await db.query("SELECT flavor, boxes, unit_milli AS unitMilli FROM pro_order_lines WHERE order_id = ? ORDER BY flavor DESC", [po.id]);
      return res.json({ kind: "pro", lines, ref: po.ref, status: po.status, paymentStatus: pi.status, email: po.email, name: po.name, boxes: po.boxes, grossCents: po.gross_cents, tierPct: po.tier_pct, tierCents: po.tier_cents, welcomePct: po.welcome_pct, creditPct: po.credit_pct, extraCents: po.extra_cents, netCents: po.net_cents, vatCents: po.vat_cents, totalCents: po.total_cents });
    }
    const o = await db.one("SELECT ref, status, email, boxes, gross_cents, discount_cents, net_cents, welcome_pct, user_id FROM orders WHERE stripe_payment_id = ?", [pi.id]);
    if (!o) throw httpError(404, "Unknown payment.");
    const lines = await db.query("SELECT l.flavor, l.boxes, l.unit_cents AS unitCents FROM order_lines l JOIN orders o ON o.id = l.order_id WHERE o.stripe_payment_id = ? ORDER BY l.flavor DESC", [pi.id]);
    res.json({ lines, ref: o.ref, status: o.status, paymentStatus: pi.status, email: o.email, boxes: o.boxes, grossCents: o.gross_cents, discountCents: o.discount_cents, netCents: o.net_cents, welcomePct: o.welcome_pct, hasAccount: !!o.user_id });
  }));

  /* ---- pro accounts: the venue logs in, sees its own prices, pays by card at those prices (excl. VAT, VAT added at the end) ---- */
  const requirePro = (req) => { if (!req.pro) throw httpError(401, "Log in with your pro account."); return req.pro; };
  app.post("/api/pro/login", limit(20), wrap(async (req, res) => {
    const pro = await db.one("SELECT * FROM pros WHERE email = ?", [L.clean(req.body.email, 190).toLowerCase()]);
    if (!pro || !L.checkPassword(String(req.body.password || ""), pro.password_hash)) throw httpError(401, "Wrong email or password.");
    const token = L.newToken();
    await db.query("INSERT INTO pro_sessions (token_hash, pro_id, expires_at) VALUES (?,?, UTC_TIMESTAMP() + INTERVAL 30 DAY)", [L.hashToken(token), pro.id]);
    res.cookie(PRO_COOKIE, token, cookieOpts());
    res.json({ pro: publicPro(pro) });
  }));
  app.post("/api/pro/logout", wrap(async (req, res) => {
    if (req.cookies[PRO_COOKIE]) await db.query("DELETE FROM pro_sessions WHERE token_hash = ?", [L.hashToken(req.cookies[PRO_COOKIE])]);
    res.clearCookie(PRO_COOKIE, { path: "/" }); res.json({ ok: true });
  }));
  app.get("/api/pro/me", wrap(async (req, res) => res.json({ pro: req.pro ? publicPro(req.pro) : null })));
  app.post("/api/pro/quote", wrap(async (req, res) => { const pro = requirePro(req); res.json(L.proQuote(req.body && req.body.lines, pro, await proOfferState(pro))); }));
  app.post("/api/pro/checkout", limit(20), wrap(async (req, res) => {
    const pro = requirePro(req), b = req.body || {};
    const name = L.clean(b.name, 120) || pro.name;
    const ship = { address: L.clean(b.address, 190), zip: L.clean(b.zip, 20), city: L.clean(b.city, 90), phone: L.clean(b.phone, 40) || pro.phone };
    if (!name || !ship.address || !ship.zip || !ship.city) throw httpError(400, "Fill in the delivery address.");
    const q = L.proQuote(b.lines, pro, await proOfferState(pro));
    if (!q.boxes) throw httpError(400, "Choose at least one box.");

    const orderId = await db.tx(async (sql) => {
      const r = await sql("INSERT INTO pro_orders (ref, pro_id, email, name, ship_address, ship_zip, ship_city, ship_phone, boxes, gross_cents, tier_pct, tier_cents, welcome_pct, credit_pct, extra_cents, net_cents, vat_cents, total_cents) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [L.proOrderRef(), pro.id, pro.email, name, ship.address, ship.zip, ship.city, ship.phone, q.boxes, q.grossCents, q.tierPct, q.tierCents, q.welcomePct, q.creditPct, q.extraCents, q.netCents, q.vatCents, q.totalCents]);
      for (const l of q.lines) await sql("INSERT INTO pro_order_lines (order_id, flavor, boxes, unit_milli) VALUES (?,?,?,?)", [r.insertId, l.flavor, l.boxes, l.unitMilli]);
      return r.insertId;
    });
    const order = await db.one("SELECT * FROM pro_orders WHERE id = ?", [orderId]);
    let intent;
    try {
      intent = await stripeClient().paymentIntents.create({
        amount: q.totalCents, currency: "chf", automatic_payment_methods: { enabled: true }, receipt_email: pro.email,
        description: `Malaconda pro ${order.ref} (${pro.name}): ${q.lines.map((l) => `${l.boxes} × ${L.FLAVOR_NAMES[l.flavor]}`).join(", ")}`,
        metadata: { proOrderId: String(order.id), ref: order.ref },
      });
    } catch (e) { await db.query("UPDATE pro_orders SET status = 'cancelled' WHERE id = ?", [order.id]); throw e; }
    await db.query("UPDATE pro_orders SET stripe_payment_id = ? WHERE id = ?", [intent.id, order.id]);
    res.status(201).json({ ref: order.ref, clientSecret: intent.client_secret });
  }));

  /* ---- contact form ---- */
  app.post("/api/contact", limit(10), wrap(async (req, res) => {
    const r = { name: L.clean(req.body.name, 120), email: L.clean(req.body.email, 190), topic: L.clean(req.body.topic, 20), message: L.clean(req.body.message, 4000) };
    if (!r.name || !L.isEmail(r.email) || !["General", "Order", "Partner", "Press"].includes(r.topic) || !r.message) throw httpError(400, "Fill in every field.");
    await db.query("INSERT INTO contact_requests (name, email, topic, message) VALUES (?,?,?,?)", [r.name, r.email, r.topic, r.message]);
    mailer.contactToTeam(r).catch((e) => console.error("contact mail:", e.message));   // the message is already saved: a mail problem must not fail the request
    res.status(201).json({ ok: true });
  }));

  app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));
  app.use((err, req, res, next) => {   // eslint-disable-line no-unused-vars
    if (!err.status) console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Something went wrong." });
  });
  return app;
}

/* ---- helpers ---- */
function httpError(status, message) { const e = new Error(message); e.status = status; return e; }
function wrap(fn) { return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next); }
function cookies(req, res, next) {
  req.cookies = {};
  for (const part of String(req.get("cookie") || "").split(";")) { const i = part.indexOf("="); if (i > 0) req.cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
  next();
}
async function currentUser(req, res, next) {
  req.user = null;
  const t = req.cookies[COOKIE];
  if (t) req.user = await db.one("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()", [L.hashToken(t)]);
  next();
}
async function startSession(res, userId) {
  const token = L.newToken();
  await db.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?, UTC_TIMESTAMP() + INTERVAL 30 DAY)", [L.hashToken(token), userId]);
  res.cookie(COOKIE, token, cookieOpts());
}
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, address: u.address, zip: u.zip, city: u.city });
async function offerState(user) {
  if (!user) return { isAccount: false, hasPaidOrder: false };
  const r = await db.one("SELECT COUNT(*) AS n FROM orders WHERE user_id = ? AND status IN ('paid','shipped','delivered')", [user.id]);
  return { isAccount: true, hasPaidOrder: r.n > 0 };
}
// tiny in-memory rate limiter, per IP and route: enough for a test site; a shared store is needed if the app runs on several processes
const hits = new Map();
function limit(max, windowMs = 15 * 60 * 1000) {
  return (req, res, next) => {
    const k = `${req.ip}|${req.path}`, now = Date.now(), h = (hits.get(k) || []).filter((t) => now - t < windowMs);
    if (h.length >= max) return next(httpError(429, "Too many attempts. Try again later."));
    h.push(now); hits.set(k, h); next();
  };
}

async function currentPro(req, res, next) {
  req.pro = null;
  const t = req.cookies[PRO_COOKIE];
  if (t) req.pro = await db.one("SELECT p.* FROM pro_sessions s JOIN pros p ON p.id = s.pro_id WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()", [L.hashToken(t)]);
  next();
}
const publicPro = (p) => ({ id: p.id, name: p.name, contact: p.contact, email: p.email, phone: p.phone, address: p.address, zip: p.zip, city: p.city });
// the welcome offer is for the first order only: a pro that has paid an order here no longer gets it
async function proOfferState(pro) {
  const r = await db.one("SELECT COUNT(*) AS n FROM pro_orders WHERE pro_id = ? AND status IN ('paid','shipped','delivered')", [pro.id]);
  return { hasPaidOrder: r.n > 0 };
}

/* Marks the order of a succeeded PaymentIntent as paid, once. Returns the order and its lines the first time only (the caller sends the email then). */
async function settle(sql, paymentIntentId) {
  const upd = await sql("UPDATE orders SET status = 'paid', paid_at = UTC_TIMESTAMP() WHERE stripe_payment_id = ? AND status = 'pending'", [paymentIntentId]);
  if (!upd.affectedRows) return null;
  const [order] = await sql("SELECT * FROM orders WHERE stripe_payment_id = ?", [paymentIntentId]);
  const lines = await sql("SELECT flavor, boxes, unit_cents FROM order_lines WHERE order_id = ?", [order.id]);
  return { order, lines };
}
/* Same for a pro order. */
async function settlePro(sql, paymentIntentId) {
  const upd = await sql("UPDATE pro_orders SET status = 'paid', paid_at = UTC_TIMESTAMP() WHERE stripe_payment_id = ? AND status = 'pending'", [paymentIntentId]);
  if (!upd.affectedRows) return null;
  const [order] = await sql("SELECT * FROM pro_orders WHERE stripe_payment_id = ?", [paymentIntentId]);
  const lines = await sql("SELECT flavor, boxes, unit_milli FROM pro_order_lines WHERE order_id = ?", [order.id]);
  return { order, lines };
}
const mailSettled = (r) => {
  if (r.consumer) mailer.orderConfirmation(r.consumer.order, r.consumer.lines).catch((e) => console.error("order mail:", e.message));
  if (r.pro) mailer.proOrderConfirmation(r.pro.order, r.pro.lines).catch((e) => console.error("pro order mail:", e.message));
};
async function settleAndMail(paymentIntentId, extra) {
  const r = await db.tx(async (sql) => {
    if (extra && !(await extra(sql))) return null;
    return { consumer: await settle(sql, paymentIntentId), pro: await settlePro(sql, paymentIntentId) };
  });
  if (r) mailSettled(r);
}
async function markPaid(event) {
  const pi = event.data.object;
  if (pi.status !== "succeeded") return;
  await settleAndMail(pi.id, async (sql) => {
    try { await sql("INSERT INTO stripe_events (id, type) VALUES (?,?)", [event.id, event.type]); return true; }
    catch (e) { if (e.code === "ER_DUP_ENTRY") return false; throw e; }   // already processed: Stripe retries
  });
}

module.exports = { createApp, httpError };
