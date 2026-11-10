const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const config = require("./config");
const { createApp } = require("./app");

const app = express();
app.disable("x-powered-by");

// Staging: the whole site sits behind a shared login (STAGING_USER / STAGING_PASSWORD) and is closed to search engines.
// /api/health and the Stripe webhook stay open: Stripe cannot type a password.
const gate = { user: process.env.STAGING_USER || "", pass: process.env.STAGING_PASSWORD || "" };
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
app.use((req, res, next) => {
  res.set("X-Robots-Tag", "noindex, nofollow");
  if (req.path === "/robots.txt") return res.type("text/plain").send("User-agent: *\nDisallow: /\n");
  if (!gate.user || !gate.pass || req.path === "/api/health" || req.path === "/api/stripe/webhook") return next();
  const m = /^Basic (.+)$/.exec(req.get("authorization") || "");
  const [u, ...p] = m ? Buffer.from(m[1], "base64").toString().split(":") : [""];
  if (m && same(u, gate.user) && same(p.join(":"), gate.pass)) return next();
  res.set("WWW-Authenticate", 'Basic realm="Malaconda staging"').status(401).send("Staging: login required.");
});

app.use(createApp());
// the same process also serves the static site (client/), so one Hostinger app is enough
const clientDir = [path.join(__dirname, "..", "client"), path.join(__dirname, "client")].find((d) => require("node:fs").existsSync(d));
app.get("/", (req, res) => res.redirect("/proto/index.html"));
app.use(express.static(clientDir, { extensions: ["html"] }));

app.listen(config.port, () => console.log(`Malaconda on ${config.baseUrl} (port ${config.port})`));
