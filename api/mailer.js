/* Emails through Brevo's transactional API. Without a key and a validated sender address nothing is sent: the message is logged instead. */
const config = require("./config");
const { esc, chf, FLAVOR_NAMES } = require("./lib");

async function send({ to, subject, html }) {
  const b = config.brevo;
  if (!b.apiKey || !b.senderEmail) { console.log(`[mail skipped: sender not configured] to=${to} subject="${subject}"`); return { skipped: true }; }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": b.apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { name: b.senderName, email: b.senderEmail }, to: [{ email: to }], subject, htmlContent: html }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return { sent: true };
}

const shell = (title, body) => `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#131313"><h1 style="font-size:22px;text-transform:uppercase">${esc(title)}</h1>${body}<p style="color:#888;font-size:12px">MALACONDA</p></div>`;

function orderConfirmation(order, lines) {
  const rows = lines.map((l) => `<tr><td>${l.boxes} × ${esc(FLAVOR_NAMES[l.flavor] || l.flavor)}</td><td style="text-align:right">${chf(l.boxes * l.unit_cents)}</td></tr>`).join("");
  return send({
    to: order.email, subject: `Your Malaconda order ${order.ref}`,
    html: shell("Thank you", `<p>Order <b>${esc(order.ref)}</b> is paid. Delivery within 4 weeks.</p><table style="width:100%">${rows}${order.discount_cents ? `<tr><td>First order −${order.welcome_pct}%</td><td style="text-align:right">−${chf(order.discount_cents)}</td></tr>` : ""}<tr><td><b>Total (VAT incl.)</b></td><td style="text-align:right"><b>${chf(order.net_cents)}</b></td></tr></table><p>Delivery to ${esc(order.ship_address)}, ${esc(order.ship_zip)} ${esc(order.ship_city)}.</p>`),
  });
}
const contactToTeam = (r) => config.brevo.teamEmail
  ? send({ to: config.brevo.teamEmail, subject: `Contact (${r.topic}): ${r.name}`, html: shell("New message", `<p><b>${esc(r.name)}</b> &lt;${esc(r.email)}&gt;<br>Topic: ${esc(r.topic)}</p><p>${esc(r.message).replace(/\n/g, "<br>")}</p>`) })
  : (console.log("[mail skipped: TEAM_EMAIL not set] contact request stored in the database"), Promise.resolve({ skipped: true }));

module.exports = { send, orderConfirmation, contactToTeam };
