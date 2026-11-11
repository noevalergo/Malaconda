/* Renders every email with sample data into dist/emails/*.html (open in a browser). Usage: node tools/preview-emails.js */
const fs = require("node:fs"), path = require("node:path");
const { T } = require("../api/emails");
const order = { ref: "M-4F2A9C1", email: "claire@example.ch", ship_address: "Rue du Lac 12", ship_zip: "1800", ship_city: "Vevey", discount_cents: 3900, welcome_pct: 10, net_cents: 35100 };
const lines = [{ flavor: "guava", boxes: 6, unit_cents: 3900 }, { flavor: "lulo", boxes: 4, unit_cents: 3900 }];
const samples = {
  welcome: { name: "Claire Dupont" },
  "order-confirmation": { order, lines, name: "Claire Dupont" },
  shipped: { order, name: "Claire Dupont", carrier: "La Poste", trackingNumber: "99.00.123456.78901234", trackingUrl: "https://service.post.ch/" },
  "request-received-pro": { name: "Marco Rossi", kind: "pro" },
  "request-received-ambassador": { name: "Sofia Ramirez", kind: "ambassador" },
  "pro-account": { name: "Marco Rossi", company: "Bar Le Zinc", email: "marco@lezinc.ch", tempPassword: "Tq7-Lm4x-Pz" },
  "pro-order-received": { name: "Marco Rossi", ref: "M-8B31D07", lines, netCents: 148320 },
  "ambassador-account": { name: "Sofia Ramirez", email: "sofia@example.ch", tempPassword: "Wk3-Hn8v-Rd", code: "SOFIA-MALA" },
  "commission-statement": { name: "Sofia Ramirez", period: "octobre 2026", totalCents: 18450, number: "2026-10-SR" },
  "referral-credit": { name: "Marco Rossi", referredCompany: "Café du Marché", creditPct: 5 },
  "password-reset": { name: "Claire Dupont", resetUrl: "https://malaconda.com/reset?token=abc123" },
  "contact-received": { name: "Claire Dupont" },
};
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const out = path.join(__dirname, "..", "dist", "emails"); fs.mkdirSync(out, { recursive: true });
for (const [file, data] of Object.entries(samples)) {
  const key = camel(file.replace(/-(pro|ambassador)$/, "")).replace("requestReceived", "requestReceived");
  const m = T[key]; if (!m) throw new Error("no template " + key);
  const r = m(data); fs.writeFileSync(path.join(out, file + ".html"), r.html); console.log(file.padEnd(30), r.subject);
}
