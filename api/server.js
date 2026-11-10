const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const express = require("express");
const config = require("./config");
const { createApp } = require("./app");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

/* Staging: the whole site sits behind a shared login page (STAGING_USER / STAGING_PASSWORD) and is closed to search engines.
   A normal form + cookie is used (browsers and embedded viewers that cannot show a Basic-auth box still work).
   /api/health and the Stripe webhook stay open: Stripe cannot type a password. */
const gate = { user: process.env.STAGING_USER || "", pass: process.env.STAGING_PASSWORD || "" };
const enabled = !!(gate.user && gate.pass);
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const token = () => crypto.createHmac("sha256", gate.pass).update("malaconda-staging-gate:" + gate.user).digest("hex");
const cookieOf = (req) => { const m = /(?:^|;\s*)mlc_gate=([a-f0-9]{64})/.exec(req.get("cookie") || ""); return m ? m[1] : ""; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const page = (msg, next) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Malaconda staging</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#131313;color:#e9e9e1;font:16px/1.5 system-ui,sans-serif}form{width:min(360px,88vw);display:grid;gap:14px}h1{font:600 14px/1 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;margin:0 0 6px}input,button{font:inherit;padding:12px 14px;border-radius:6px;border:1px solid #393938;background:#1c1c1c;color:inherit}button{background:#e9e9e1;color:#131313;border-color:#e9e9e1;cursor:pointer;font-weight:600}p{margin:0;color:#ff8f7e;font-size:14px}</style></head>
<body><form method="post" action="/staging-login"><h1>Malaconda staging</h1><input name="user" autocomplete="username" placeholder="Username" required autofocus><input name="password" type="password" autocomplete="current-password" placeholder="Password" required><input type="hidden" name="next" value="${esc(next || "/")}">${msg ? `<p>${esc(msg)}</p>` : ""}<button type="submit">Enter</button></form></body></html>`;

const tries = new Map();
app.post("/staging-login", express.urlencoded({ extended: false, limit: "2kb" }), (req, res) => {
  const now = Date.now(), h = (tries.get(req.ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  if (h.length >= 10) return res.status(429).send(page("Too many attempts. Try again later."));
  h.push(now); tries.set(req.ip, h);
  const b = req.body || {};
  if (enabled && same(b.user, gate.user) && same(b.password, gate.pass)) {
    res.cookie("mlc_gate", token(), { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 30 * 24 * 3600 * 1000 });
    const next = typeof b.next === "string" && /^\/(?!\/)/.test(b.next) ? b.next : "/";
    return res.redirect(next);
  }
  res.status(401).send(page("Wrong username or password.", b.next));
});

app.use((req, res, next) => {
  res.set("X-Robots-Tag", "noindex, nofollow");
  if (req.path === "/robots.txt") return res.type("text/plain").send("User-agent: *\nDisallow: /\n");
  if (!enabled || req.path === "/api/health" || req.path === "/api/stripe/webhook") return next();
  if (same(cookieOf(req), token())) return next();
  // scripts and curl may still use a Basic header
  const m = /^Basic (.+)$/.exec(req.get("authorization") || "");
  if (m) { const [u, ...p] = Buffer.from(m[1], "base64").toString().split(":"); if (same(u, gate.user) && same(p.join(":"), gate.pass)) return next(); }
  if (req.method === "GET" && !req.path.startsWith("/api/")) return res.status(401).send(page("", req.originalUrl));
  res.status(401).json({ error: "Staging: login required." });
});

app.use(createApp());
// the same process also serves the static site (client/), so one Hostinger app is enough
const clientDir = [path.join(__dirname, "..", "client"), path.join(__dirname, "client")].find((d) => fs.existsSync(d));
app.get("/", (req, res) => res.redirect("/proto/index.html"));
app.use(express.static(clientDir, { extensions: ["html"] }));

app.listen(config.port, () => console.log(`Malaconda on ${config.baseUrl} (port ${config.port})`));
