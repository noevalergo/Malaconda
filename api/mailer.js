/* Emails through Brevo's transactional API. Without a key and a validated sender address nothing is sent: the message is logged instead. */
const config = require("./config");
const { esc } = require("./lib");

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

const { T } = require("./emails");

const orderConfirmation = (order, lines, name) => { const m = T.orderConfirmation({ order, lines, name: name || order.name }); return send({ to: order.email, subject: m.subject, html: m.html }); };
const welcome = (to, name) => { const m = T.welcome({ name }); return send({ to, subject: m.subject, html: m.html }); };
/* Other templates (shipped, proAccount, ambassadorAccount, passwordReset, ...) are in emails.js: mailer.sendTemplate("shipped", to, data). */
const sendTemplate = (key, to, data) => { const m = T[key](data); return send({ to, subject: m.subject, html: m.html }); };
const contactToTeam = (r) => config.brevo.teamEmail
  ? send({ to: config.brevo.teamEmail, subject: `Contact (${r.topic}): ${r.name}`, html: `<p><b>${esc(r.name)}</b> &lt;${esc(r.email)}&gt;<br>Topic: ${esc(r.topic)}</p><p>${esc(r.message).replace(/\n/g, "<br>")}</p>` })
  : (console.log("[mail skipped: TEAM_EMAIL not set] contact request stored in the database"), Promise.resolve({ skipped: true }));

module.exports = { send, orderConfirmation, welcome, sendTemplate, contactToTeam };
