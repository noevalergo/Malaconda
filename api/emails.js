/* Transactional emails (English, founders' copy Nov 2026; numbers match the Figma file 'Malaconda – Emails'). Table layout, inline CSS, safe for Gmail / Apple Mail / Outlook; one <style> block only adds web fonts, base resets and the mobile breakpoint.
   Each template returns { subject, html, text }. Every dynamic value is escaped. No product prices or rates are shown to ambassadors; pro prices are excl. VAT. */
const config = require("./config");
const { esc, chf, FLAVOR_NAMES, SETTINGS } = require("./lib");   // { lulo: "Biting Lulo", guava: "Pink Guava" }

// Charter (client/css/styles.css)
const C = { ink: "#131313", surface: "#1B1B1B", charcoal: "#393938", graphite: "#4F4F4D", stone: "#ADADA7", paper: "#E9E9E1", lulo: "#FFD900", guava: "#FF7E6E", berry: "#95F6EE" };
const DISPLAY = "Andreas,'Arial Narrow',Arial,sans-serif", BODY = "Chivo,Arial,Helvetica,sans-serif", MONO = "'DM Mono','Courier New',monospace";
const WELCOME_PCT = 10;

const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "")) ? String(u) : "#");
const base = () => config.baseUrl;
const url = (p) => base() + p;

const p = (html, extra = "") => `<p style="margin:0 0 16px;font:400 16px/1.6 ${BODY};color:${C.stone};${extra}">${html}</p>`;
const label = (t) => `<p style="margin:0 0 10px;font:500 12px/1 ${MONO};letter-spacing:.12em;text-transform:uppercase;color:${C.stone}">${esc(t)}</p>`;
const h1 = (t) => `<h1 style="margin:0 0 20px;font:400 40px/1.05 ${DISPLAY};text-transform:uppercase;color:${C.paper}" class="h1">${esc(t)}</h1>`;
const strong = (t) => `<strong style="color:${C.paper};font-weight:600">${esc(t)}</strong>`;
const button = (text, href) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr><td align="center" bgcolor="${C.paper}" style="border-radius:6px"><a href="${esc(href)}" style="display:inline-block;padding:18px 28px;font:500 14px/1 ${MONO};letter-spacing:.1em;text-transform:uppercase;color:${C.ink};text-decoration:none;border-radius:6px" class="btn">${esc(text)} &rarr;</a></td></tr></table>`;
const box = (inner) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px"><tr><td style="background:${C.ink};border:1px solid ${C.charcoal};border-radius:12px;padding:20px 22px">${inner}</td></tr></table>`;
const code = (t) => `<span style="display:inline-block;padding:10px 14px;background:${C.paper};color:${C.ink};border-radius:6px;font:500 18px/1 ${MONO};letter-spacing:.08em">${esc(t)}</span>`;

function table(rows, { total } = {}) {
  const r = rows.map(([a, b, muted]) => `<tr><td style="padding:10px 0;border-bottom:1px solid ${C.charcoal};font:400 15px/1.4 ${BODY};color:${muted ? C.stone : C.paper}">${a}</td><td align="right" style="padding:10px 0 10px 12px;border-bottom:1px solid ${C.charcoal};font:400 15px/1.4 ${MONO};color:${muted ? C.stone : C.paper};white-space:nowrap">${b}</td></tr>`).join("");
  const t = total ? `<tr><td style="padding:14px 0 0;font:600 16px/1.4 ${BODY};color:${C.paper}">${total[0]}</td><td align="right" style="padding:14px 0 0 12px;font:500 18px/1.4 ${MONO};color:${C.paper};white-space:nowrap">${total[1]}</td></tr>` : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px">${r}${t}</table>`;
}

function layout({ preheader, body, footerNote }) {
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>Malaconda</title>
<!--[if mso]><style>body,table,td,a{font-family:Arial,Helvetica,sans-serif!important}</style><![endif]-->
<style>
@import url("https://fonts.googleapis.com/css2?family=Chivo:wght@400;600&family=DM+Mono:wght@500&display=swap");
@font-face{font-family:"Andreas";src:url("${url("/fonts/Andreas-Regular.woff2")}") format("woff2"),url("${url("/fonts/Andreas-Regular.woff")}") format("woff");font-weight:400;font-style:normal}
body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
a{color:${C.paper}}
@media only screen and (max-width:620px){
  .wrap{width:100%!important}
  .px{padding-left:20px!important;padding-right:20px!important}
  .h1{font-size:32px!important}
  .btn{display:block!important;text-align:center!important}
}
</style></head>
<body style="margin:0;padding:0;background:${C.ink}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.ink};font-size:1px;line-height:1px">${esc(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.ink}" style="background:${C.ink}"><tr><td align="center" style="padding:24px 12px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="wrap" style="width:100%;max-width:600px">
  <tr><td class="px" style="padding:8px 32px 24px"><a href="${esc(base())}" style="font:400 34px/1 ${DISPLAY};letter-spacing:.02em;text-transform:uppercase;color:${C.paper};text-decoration:none">Malaconda</a></td></tr>
  <tr><td style="border-radius:12px 12px 0 0;overflow:hidden"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="34%" height="6" bgcolor="${C.lulo}" style="height:6px;font-size:0;line-height:0">&nbsp;</td><td width="33%" height="6" bgcolor="${C.guava}" style="height:6px;font-size:0;line-height:0">&nbsp;</td><td width="33%" height="6" bgcolor="${C.berry}" style="height:6px;font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>
  <tr><td class="px" bgcolor="${C.surface}" style="background:${C.surface};padding:40px 32px 24px;border-radius:0 0 12px 12px">${body}</td></tr>
  <tr><td class="px" style="padding:24px 32px 8px;font:400 12px/1.6 ${BODY};color:${C.stone}">
    ${footerNote ? `<p style="margin:0 0 12px">${footerNote}</p>` : ""}
    <p style="margin:0 0 4px;font:500 12px/1.6 ${MONO};letter-spacing:.08em;text-transform:uppercase">Malaconda &middot; Sparkling soda &middot; Made in Switzerland</p>
    <p style="margin:0">A question? Write to us at <a href="mailto:hello@malaconda.com" style="color:${C.paper}">hello@malaconda.com</a> &middot; <a href="${esc(base())}" style="color:${C.paper}">malaconda.com</a></p>
  </td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}

const flavorLabel = (f) => esc(FLAVOR_NAMES[f] || f);
const PRO_PER = SETTINGS.proBottlesPerBox;   // bottles in a pro box (24); a shop box has 12
const boxWord = (n, per = 12) => `${n}&nbsp;box${n > 1 ? "es" : ""} of ${per}`;
const boxText = (n, per = 12) => `${n} box${n > 1 ? "es" : ""} of ${per}`;
const firstRaw = (name) => String(name || "").trim().split(/\s+/)[0] || "";
const helloText = (name) => `Hi${firstRaw(name) ? " " + firstRaw(name) : ""},`;
const hello = (name) => esc(helloText(name));
const addr = (o) => `${esc(o.ship_address)}<br>${esc(o.ship_zip)} ${esc(o.ship_city)}, Switzerland`;
const TAGLINE = "MALACONDA. EMBRACE THE TEMPTATION.";
const tagline = () => `<p style="margin:8px 0 0;font:400 22px/1.1 ${DISPLAY};text-transform:uppercase;color:${C.paper}">${TAGLINE}</p>`;
const thanks = () => p("Thank you for being part of MALACONDA.", "margin-bottom:0");
const offer = (pct, line) => box(label("Your welcome gift") + `<p style="margin:0 0 6px;font:400 44px/1 ${DISPLAY};color:${C.lulo}">−${pct}%</p><p style="margin:0;font:400 15px/1.5 ${BODY};color:${C.stone}">Enjoy ${pct}% off your first order.<br>${line}</p>`);
const access = (email, tempPassword) => box(label("Your access") + p("Email: " + strong(email), "margin:0 0 10px") + p("Temporary password: " + code(tempPassword), "margin:0 0 10px") + p("You will be asked to create a new password the first time you log in.", "margin:0;font-size:14px"));
const AUTH_NOTE = "You are receiving this email because an action was taken with this address on malaconda.com.";
const linesText = (lines, per) => lines.map((l) => `- ${FLAVOR_NAMES[l.flavor] || l.flavor}: ${boxText(l.boxes, per)}`).join("\n");

const T = {
  /* #1. Registration, customer: 10% on the first order */
  welcome({ name }) {
    return {
      subject: `Welcome to MALACONDA: ${WELCOME_PCT}% off your first order`,
      html: layout({ preheader: `Your account is ready. Enjoy ${WELCOME_PCT}% off your first order.`, footerNote: AUTH_NOTE, body:
        h1("Welcome to MALACONDA") + p(hello(name)) +
        p(`Your account is ready. Now it is your turn to discover some of the world’s most extraordinary fruit flavors. Meet <b style="color:${C.lulo}">Biting Lulo</b> and <b style="color:${C.guava}">Pink Guava</b>.`) +
        offer(WELCOME_PCT, "The discount applies automatically at checkout.") +
        button("Pick your flavors", url("/#flavors")) + tagline() }),
      text: `Welcome to MALACONDA\n\n${helloText(name)}\nYour account is ready. Meet Biting Lulo and Pink Guava.\nEnjoy ${WELCOME_PCT}% off your first order. The discount applies automatically at checkout.\n${url("/#flavors")}\n\n${TAGLINE}`,
    };
  },

  /* #2A (delivery) and #2B (pickup in Luzern). Order confirmation, customer, paid */
  orderConfirmation({ order, lines, name }) {
    const rows = lines.map((l) => [`${flavorLabel(l.flavor)}<br><span style="color:${C.stone};font-size:13px">${boxWord(l.boxes)} bottles</span>`, chf(l.boxes * l.unit_cents)]);
    if (order.discount_cents) rows.push([`First order −${esc(order.welcome_pct)}%`, "−" + chf(order.discount_cents), true]);
    const pickup = order.delivery_method === "pickup", fee = order.shipping_cents || 0, total = order.net_cents + fee;
    rows.push([pickup ? "Pickup in Luzern" : "Delivery", pickup || !fee ? "Free" : chf(fee), true]);
    const after = pickup ? "Free pickup. We will send you another email as soon as your order is ready for collection in Luzern."
      : "Delivery in Switzerland within 5 working days. We will send you another email as soon as your order is on its way.";
    return {
      subject: `Your MALACONDA order ${order.ref} is confirmed`,
      html: layout({ preheader: `Order ${order.ref} is paid. ${pickup ? "Free pickup in Luzern." : "Delivery within 5 working days."}`, body:
        label(`Order ${order.ref}`) + h1("Thank you for your order") + p(hello(name)) +
        p(`Good choice! We have received your payment and your order is confirmed. Here is the summary of order ${strong(order.ref)}.`) +
        table(rows, { total: ["Total incl. VAT", chf(total)] }) +
        box(pickup ? label("Free pickup") + p(after, "margin:0;font-size:14px")
          : label("Delivery") + p(addr(order), "margin:0 0 8px;color:" + C.paper) + p(after, "margin:0;font-size:14px")) +
        button("View my orders", url("/account.html")) + thanks() }),
      text: `Thank you for your order ${order.ref}\n\n${helloText(name)}\nGood choice! We have received your payment and your order is confirmed.\n${lines.map((l) => `- ${FLAVOR_NAMES[l.flavor] || l.flavor}: ${boxText(l.boxes)} - ${chf(l.boxes * l.unit_cents)}`).join("\n")}\n${order.discount_cents ? `First order -${order.welcome_pct}%: -${chf(order.discount_cents)}\n` : ""}${pickup ? "Pickup in Luzern: free" : "Delivery: " + (fee ? chf(fee) : "free")}\nTotal incl. VAT: ${chf(total)}\n${pickup ? "" : `Delivery address: ${order.ship_address}, ${order.ship_zip} ${order.ship_city}, Switzerland.\n`}${after}\n\nThank you for being part of MALACONDA.`,
    };
  },

  /* #2C. Ready for pickup, customer: the one email with the day, time and place (sent by the founders once the order is ready) */
  pickupReady({ order, name, day, from, to, place }) {
    const when = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    return {
      subject: `Your MALACONDA order ${order.ref} is ready for pickup`,
      html: layout({ preheader: `Pick it up on ${when}, ${from}–${to}, in Luzern.`, body:
        label(`Order ${order.ref}`) + h1("Ready for pickup") + p(hello(name)) +
        p(`Good news! Order ${strong(order.ref)} is ready for collection.`) +
        box(label("Day") + p(strong(when), "margin:0 0 14px") + label("Time") + p(strong(`${from}–${to}`), "margin:0 0 14px") + label("Place") + p(strong(place), "margin:0")) +
        p("Bring your order number. The pickup is free.") +
        button("View my orders", url("/account.html")) + thanks() }),
      text: `Your order ${order.ref} is ready for pickup\n\n${helloText(name)}\nDay: ${when}\nTime: ${from}-${to}\nPlace: ${place}\nBring your order number. The pickup is free.\n\nThank you for being part of MALACONDA.`,
    };
  },

  /* #3. Shipment, customer (carrier + tracking; trackingUrl optional) */
  shipped({ order, name, carrier, trackingNumber, trackingUrl }) {
    return {
      subject: `Your MALACONDA is on its way`,
      html: layout({ preheader: `Order ${order.ref} has been shipped${trackingNumber ? ` · tracking ${trackingNumber}` : ""}.`, body:
        label(`Order ${order.ref}`) + h1("Your MALACONDA is on its way") + p(hello(name)) +
        p(`Good news! Order ${strong(order.ref)} has been shipped.`) +
        ((carrier || trackingNumber) ? box(label("Tracking") + (carrier ? p("Carrier: " + strong(carrier), "margin:0 0 8px") : "") + (trackingNumber ? p("Tracking number: " + code(trackingNumber), "margin:0") : "")) : "") +
        (trackingUrl ? button("Track my package", safeUrl(trackingUrl)) : "") +
        p("Store in a cool, dry place. Best served cold.") + tagline() }),
      text: `Your MALACONDA is on its way\n\n${helloText(name)}\nGood news! Order ${order.ref} has been shipped.\n${carrier ? `Carrier: ${carrier}\n` : ""}${trackingNumber ? `Tracking: ${trackingNumber}\n` : ""}${trackingUrl ? trackingUrl + "\n" : ""}Store in a cool, dry place. Best served cold.\n\n${TAGLINE}`,
    };
  },

  /* #4 (access request received) was removed by the founders to keep emails to a minimum. */

  /* #5. Pro account opened (temporary password, first-order welcome 10%) */
  proAccount({ name, company, email, tempPassword }) {
    return {
      subject: "Your MALACONDA Pro account is open",
      html: layout({ preheader: `The MALACONDA Pro account for ${company || "your venue"} is now open.`, footerNote: AUTH_NOTE, body:
        label("MALACONDA Pro") + h1("Welcome to MALACONDA") + p(hello(name)) +
        p(`The MALACONDA Pro account for ${strong(company || "your venue")} is now open.`) +
        p("Log in to your account to access your wholesale prices and start ordering Biting Lulo and Pink Guava.") +
        access(email, tempPassword) +
        offer(WELCOME_PCT, "This discount applies automatically at checkout.") +
        button("Log in", url("/pro-space.html")) + tagline() }),
      text: `Welcome to MALACONDA\n\n${helloText(name)}\nThe MALACONDA Pro account for ${company || "your venue"} is now open.\nEmail: ${email}\nTemporary password: ${tempPassword} (you will create a new one the first time you log in)\nEnjoy ${WELCOME_PCT}% off your first order.\n${url("/pro-space.html")}\n\n${TAGLINE}`,
    };
  },

  /* #6 (pro order received, invoice by email) was removed by the founders: pros pay online and find the invoice in their account. */

  /* #7. Order, pro, paid online (prices excl. VAT, VAT added at the end; invoice in the pro account) */
  proOrderConfirmation({ order, lines, name }) {
    const rows = lines.map((l) => [`${flavorLabel(l.flavor)}<br><span style="color:${C.stone};font-size:13px">${boxWord(l.boxes, PRO_PER)} bottles</span>`, chf(l.boxes * Math.round(l.unit_milli * PRO_PER / 10))]);
    if (order.tier_cents) rows.push([`Volume discount −${esc(order.tier_pct)}%`, "−" + chf(order.tier_cents), true]);
    if (order.extra_cents) rows.push([order.welcome_pct ? `First order −${esc(order.welcome_pct)}%` : `Referral credit −${esc(order.credit_pct)}%`, "−" + chf(order.extra_cents), true]);
    rows.push(["Total excl. VAT", chf(order.net_cents), true], [`VAT ${esc(String(SETTINGS.vatPct))}%`, chf(order.vat_cents), true]);
    return {
      subject: `Your MALACONDA Pro order ${order.ref} is confirmed`,
      html: layout({ preheader: `Order ${order.ref} is paid. Delivery within 4 weeks.`, body:
        label(`Order ${order.ref}`) + h1("Thank you for your order") + p(hello(name)) +
        p(`Good choice! We’ve received your payment and your order is confirmed. Here is the summary of order ${strong(order.ref)}.`) +
        table(rows, { total: ["Total incl. VAT", chf(order.total_cents)] }) +
        box(label("Delivery") + p(addr(order), "margin:0 0 8px;color:" + C.paper) + p("Delivery in Switzerland within 4 weeks.", "margin:0;font-size:14px")) +
        p("You will find the invoice on your account.") +
        button("View my orders", url("/pro-space.html")) + thanks() }),
      text: `Thank you for your order ${order.ref}\n\n${helloText(name)}\nGood choice! We’ve received your payment and your order is confirmed.\n${linesText(lines, PRO_PER)}\nTotal excl. VAT: ${chf(order.net_cents)}\nVAT: ${chf(order.vat_cents)}\nTotal incl. VAT: ${chf(order.total_cents)}\nDelivery: ${order.ship_address}, ${order.ship_zip} ${order.ship_city}, Switzerland, within 4 weeks.\nYou will find the invoice on your account: ${url("/pro-space.html")}\n\nThank you for being part of MALACONDA.`,
    };
  },

  /* #8. Referral credit earned, pro (the referred venue's first order reached the minimum) */
  referralCredit({ name, referredCompany, creditPct }) {
    const min = SETTINGS.referral.minBoxes;
    return {
      subject: `Thank you for the referral: ${creditPct}% off your next order`,
      html: layout({ preheader: `${referredCompany} has ordered a minimum of ${min} boxes.`, body:
        label("Referral") + h1("Thank you for the referral") + p(hello(name)) +
        p(`${strong(referredCompany)} has ordered a minimum of ${min} boxes.`) +
        box(label("Credit earned") + `<p style="margin:0 0 6px;font:400 44px/1 ${DISPLAY};color:${C.lulo}">${esc(creditPct)}%</p><p style="margin:0;font:400 15px/1.5 ${BODY};color:${C.stone}">Enjoy ${esc(creditPct)}% off your next order. This credit cannot be paid out in cash.</p>`) +
        button("See my credit", url("/pro-space.html")) + tagline() }),
      text: `Thank you for the referral\n\n${helloText(name)}\n${referredCompany} has ordered a minimum of ${min} boxes.\nCredit earned: ${creditPct}%. Enjoy ${creditPct}% off your next order. This credit cannot be paid out in cash.\n${url("/pro-space.html")}\n\n${TAGLINE}`,
    };
  },

  /* #9 (ambassador application received) was removed by the founders to keep emails to a minimum. */

  /* #10. Ambassador account opened: code + link */
  ambassadorAccount({ name, email, tempPassword, code: ambCode, link }) {
    const shareLink = link || url("/?ref=" + encodeURIComponent(ambCode || ""));
    return {
      subject: "You are a MALACONDA ambassador",
      html: layout({ preheader: "Your personal ambassador account is ready.", footerNote: AUTH_NOTE, body:
        label("Ambassador") + h1("You are an ambassador") + p(hello(name)) +
        p("Thank you for helping us to expand Malaconda in Switzerland.") +
        p("Your personal ambassador account is ready. You will find your referred venues, orders, and monthly commission statements in your space.") +
        box(label("Your code") + p(code(ambCode), "margin:0 0 14px") + label("Your link") + p(`<a href="${esc(shareLink)}" style="color:${C.paper};word-break:break-all">${esc(shareLink)}</a>`, "margin:0")) +
        access(email, tempPassword) +
        button("Open my space", url("/ambassador-space.html")) + tagline() }),
      text: `You are an ambassador\n\n${helloText(name)}\nThank you for helping us to expand Malaconda in Switzerland. Your personal ambassador account is ready.\nCode: ${ambCode}\nLink: ${shareLink}\nEmail: ${email}\nTemporary password: ${tempPassword} (you will create a new one the first time you log in)\n${url("/ambassador-space.html")}\n\n${TAGLINE}`,
    };
  },

  /* #11. Monthly commission statement available, ambassador (no prices, no order lines) */
  commissionStatement({ name, period }) {
    return {
      subject: `Your statement for ${period} is ready`,
      html: layout({ preheader: "Your commission statement is ready in your space.", body:
        label("Monthly statement") + h1("Your statement is ready") + p(hello(name)) +
        p(`Your commission statement for ${strong(period)} is ready.`) +
        p("Payment will be made by bank transfer to the IBAN registered in your account.") +
        button("View my statement", url("/ambassador-space.html")) + tagline() }),
      text: `Your statement is ready\n\n${helloText(name)}\nYour commission statement for ${period} is ready.\nPayment will be made by bank transfer to the IBAN registered in your account.\n${url("/ambassador-space.html")}\n\n${TAGLINE}`,
    };
  },

  /* #12. New password (link valid 1 hour) */
  passwordReset({ name, resetUrl }) {
    return {
      subject: "Choose a new MALACONDA password",
      html: layout({ preheader: "This link is valid for one hour.", footerNote: AUTH_NOTE, body:
        h1("New password") + p(hello(name)) +
        p("You requested to reset your password.") +
        p("Click the button below to choose a new password. This link is valid for one hour.") +
        button("Choose new password", safeUrl(resetUrl)) +
        p("Button not working? Copy and paste this link into your browser:", "margin-bottom:6px;font-size:14px") +
        p(`<a href="${esc(resetUrl)}" style="color:${C.paper};word-break:break-all">${esc(resetUrl)}</a>`, "font-size:13px") +
        p("If you did not request a password reset, simply ignore this email. Your current password will remain unchanged.", "font-size:14px") + tagline() }),
      text: `${helloText(name)}\nYou requested to reset your password. Choose a new one here (valid for one hour): ${resetUrl}\nIf you did not request a password reset, simply ignore this email. Your current password will remain unchanged.\n\n${TAGLINE}`,
    };
  },

  /* #13. Message received (contact form) */
  contactReceived({ name }) {
    return {
      subject: "Message received",
      html: layout({ preheader: "We will get back to you as soon as possible.", footerNote: "You are receiving this email because you wrote to us on malaconda.com.", body:
        h1("Message received") + p(hello(name)) +
        p("Thank you for getting in touch with MALACONDA.") +
        p("We will get back to you as soon as possible.") + tagline() }),
      text: `${helloText(name)}\nThank you for getting in touch with MALACONDA.\nWe will get back to you as soon as possible.\n\n${TAGLINE}`,
    };
  },
};

module.exports = { T, layout, WELCOME_PCT };
