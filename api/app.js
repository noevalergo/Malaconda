/* The Express app. Built as a function so tests can inject a fake Stripe client. */
const express = require("express");
const config = require("./config");
const db = require("./db");
const mailer = require("./mailer");
const L = require("./lib");

const COOKIE = "mlc_session";
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
    if (event.type === "checkout.session.completed") await markPaid(event);
    res.json({ received: true });
  }));

  app.use(express.json({ limit: "20kb" }));
  app.use(cookies);
  app.use(wrap(currentUser));

  app.get("/api/health", wrap(async (req, res) => { await db.one("SELECT 1 AS ok"); res.json({ ok: true, stripe: !!(stripe || config.stripe.secretKey), mail: !!(config.brevo.apiKey && config.brevo.senderEmail) }); }));

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

  /* ---- checkout: creates the order (pending) and a Stripe Checkout session; the order is paid only when the webhook says so ---- */
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

    const s = stripeClient();
    const params = {
      mode: "payment", customer_email: email, client_reference_id: order.ref, metadata: { orderId: String(order.id), ref: order.ref },
      line_items: q.lines.map((l) => ({ quantity: l.boxes, price_data: { currency: "chf", unit_amount: l.unitCents, product_data: { name: `${L.FLAVOR_NAMES[l.flavor]}, box of 12 × 20 cl` } } })),
      success_url: `${config.baseUrl}/proto/checkout.html?paid=1&ref=${order.ref}`, cancel_url: `${config.baseUrl}/proto/checkout.html?cancelled=1`,
    };
    if (q.discountCents) params.discounts = [{ coupon: (await s.coupons.create({ amount_off: q.discountCents, currency: "chf", duration: "once", name: `First order −${q.welcomePct}%` })).id }];
    const session = await s.checkout.sessions.create(params);
    await db.query("UPDATE orders SET stripe_session_id = ? WHERE id = ?", [session.id, order.id]);
    res.status(201).json({ ref: order.ref, url: session.url });
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

async function markPaid(event) {
  const s = event.data.object;
  const result = await db.tx(async (sql) => {
    try { await sql("INSERT INTO stripe_events (id, type) VALUES (?,?)", [event.id, event.type]); }
    catch (e) { if (e.code === "ER_DUP_ENTRY") return null; throw e; }   // already processed: Stripe retries
    if (s.payment_status !== "paid") return null;
    const upd = await sql("UPDATE orders SET status = 'paid', paid_at = UTC_TIMESTAMP(), stripe_payment_id = ? WHERE stripe_session_id = ? AND status = 'pending'", [s.payment_intent || null, s.id]);
    if (!upd.affectedRows) return null;
    const [order] = await sql("SELECT * FROM orders WHERE stripe_session_id = ?", [s.id]);
    const lines = await sql("SELECT flavor, boxes, unit_cents FROM order_lines WHERE order_id = ?", [order.id]);
    return { order, lines };
  });
  if (result) mailer.orderConfirmation(result.order, result.lines).catch((e) => console.error("order mail:", e.message));
}

module.exports = { createApp, httpError };
