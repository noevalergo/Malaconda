/* Transactional emails (French base). Table layout, inline CSS, safe for Gmail / Apple Mail / Outlook; one <style> block only adds web fonts, base resets and the mobile breakpoint.
   Each template returns { subject, html, text }. Every dynamic value is escaped. No product prices or rates are shown to ambassadors; pro prices are excl. VAT. */
const config = require("./config");
const { esc, chf, FLAVOR_NAMES, SETTINGS } = require("./lib");   // { lulo: "Biting Lulo", guava: "Sweet Guava" }

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
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>Malaconda</title>
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
    <p style="margin:0 0 4px;font:500 12px/1.6 ${MONO};letter-spacing:.08em;text-transform:uppercase">Malaconda &middot; Boisson gazeuse colombienne &middot; Suisse</p>
    <p style="margin:0">Une question&nbsp;? Écrivez-nous à <a href="mailto:hello@malaconda.com" style="color:${C.paper}">hello@malaconda.com</a> &middot; <a href="${esc(base())}" style="color:${C.paper}">malaconda.com</a></p>
  </td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}

const flavorLabel = (f) => esc(FLAVOR_NAMES[f] || f);
const boxWord = (n) => `${n}&nbsp;caisse${n > 1 ? "s" : ""} de 12`;
const first = (name) => esc(String(name || "").trim().split(/\s+/)[0] || "");
const firstRaw = (name) => String(name || "").trim().split(/\s+/)[0] || "";
const helloText = (name) => `Bonjour${firstRaw(name) ? " " + firstRaw(name) : ""},`;
const hello = (name) => `Bonjour${first(name) ? " " + first(name) : ""},`;
const addr = (o) => `${esc(o.ship_address)}<br>${esc(o.ship_zip)} ${esc(o.ship_city)}, Suisse`;
const AUTH_NOTE = "Vous recevez cet email car une action a été effectuée avec cette adresse sur malaconda.com.";

const T = {
  /* 1. Welcome after account creation (customer): 10% on the first order */
  welcome({ name }) {
    return {
      subject: `Bienvenue chez Malaconda : ${WELCOME_PCT} % sur votre première commande`,
      html: layout({ preheader: `Votre compte est créé. ${WELCOME_PCT} % de réduction sur votre première commande.`, footerNote: AUTH_NOTE, body:
        label("Compte créé") + h1("Bienvenue chez Malaconda") + p(hello(name)) +
        p("Votre compte est prêt. Malaconda, c’est le soda d’une bande d’amis colombiens installés en Suisse, en deux saveurs&nbsp;: <b style=\"color:" + C.guava + "\">Sweet Guava</b> et <b style=\"color:" + C.lulo + "\">Biting Lulo</b>.") +
        box(label("Votre cadeau de bienvenue") + `<p style="margin:0 0 6px;font:400 44px/1 ${DISPLAY};color:${C.lulo}">−${WELCOME_PCT} %</p><p style="margin:0;font:400 15px/1.5 ${BODY};color:${C.stone}">sur votre première commande. La réduction s’applique automatiquement lorsque vous êtes connecté, sans code à saisir. Elle est valable une seule fois.</p>`) +
        p(`Nous vendons par caisses de 12 bouteilles et livrons en Suisse uniquement.`) +
        button("Choisir mes saveurs", url("/#flavours")) +
        p("Merci d’avoir rejoint l’aventure. À votre santé&nbsp;!", "margin-bottom:0") }),
      text: `Bienvenue chez Malaconda\n\n${helloText(name)}\nVotre compte est créé. ${WELCOME_PCT} % de réduction sur votre première commande, appliqués automatiquement quand vous êtes connecté (valable une fois).\nCaisses de 12 bouteilles, livraison en Suisse uniquement.\n${url("/#flavours")}\n\nMalaconda`,
    };
  },

  /* 2. Order confirmation (paid) */
  orderConfirmation({ order, lines, name }) {
    const rows = lines.map((l) => [`${flavorLabel(l.flavor)}<br><span style="color:${C.stone};font-size:13px">${boxWord(l.boxes)} bouteilles</span>`, chf(l.boxes * l.unit_cents)]);
    if (order.discount_cents) rows.push([`Première commande −${esc(order.welcome_pct)} %`, "−" + chf(order.discount_cents), true]);
    return {
      subject: `Votre commande Malaconda ${order.ref} est confirmée`,
      html: layout({ preheader: `Merci ! Commande ${order.ref} payée. Livraison sous 4 semaines.`, body:
        label(`Commande ${order.ref}`) + h1("Merci pour votre commande") + p(hello(name)) +
        p(`Votre paiement est bien reçu. Voici le récapitulatif de la commande ${strong(order.ref)}.`) +
        table(rows, { total: ["Total TVA incluse", chf(order.net_cents)] }) +
        box(label("Livraison") + p(`${addr(order)}`, "margin:0 0 8px;color:" + C.paper) + p("Livraison en Suisse sous 4 semaines. Nous vous écrirons dès l’expédition de votre colis.", "margin:0;font-size:14px")) +
        button("Voir mes commandes", url("/account.html")) +
        p("À très vite, et merci de soutenir une petite bande d’amis.", "margin-bottom:0") }),
      text: `Commande ${order.ref} confirmée\n\n${helloText(name)}\n${lines.map((l) => `- ${FLAVOR_NAMES[l.flavor] || l.flavor}: ${l.boxes} caisse(s) de 12 — ${chf(l.boxes * l.unit_cents)}`).join("\n")}\n${order.discount_cents ? `Première commande -${order.welcome_pct} % : -${chf(order.discount_cents)}\n` : ""}Total TVA incluse: ${chf(order.net_cents)}\nLivraison: ${order.ship_address}, ${order.ship_zip} ${order.ship_city}, Suisse, sous 4 semaines.`,
    };
  },

  /* 2b. Pro order paid online (prices excl. VAT, VAT added at the end) */
  proOrderConfirmation({ order, lines, name }) {
    const rows = lines.map((l) => [`${flavorLabel(l.flavor)}<br><span style="color:${C.stone};font-size:13px">${boxWord(l.boxes)} bouteilles</span>`, chf(l.boxes * Math.round(l.unit_milli * 12 / 10))]);
    if (order.tier_cents) rows.push([`Remise de volume −${esc(order.tier_pct)} %`, "−" + chf(order.tier_cents), true]);
    if (order.extra_cents) rows.push([order.welcome_pct ? `Première commande −${esc(order.welcome_pct)} %` : `Crédit de recommandation −${esc(order.credit_pct)} %`, "−" + chf(order.extra_cents), true]);
    rows.push(["Total hors TVA", chf(order.net_cents), true], [`TVA ${esc(String(SETTINGS.vatPct).replace(".", ","))} %`, chf(order.vat_cents), true]);
    return {
      subject: `Votre commande pro Malaconda ${order.ref} est confirmée`,
      html: layout({ preheader: `Commande ${order.ref} payée. Livraison sous 4 semaines.`, body:
        label(`Commande ${order.ref}`) + h1("Merci pour votre commande") + p(hello(name)) +
        p(`Votre paiement est bien reçu. Voici le récapitulatif de la commande ${strong(order.ref)}, à vos prix professionnels.`) +
        table(rows, { total: ["Total TVA incluse", chf(order.total_cents)] }) +
        box(label("Livraison") + p(`${addr(order)}`, "margin:0 0 8px;color:" + C.paper) + p("Livraison en Suisse sous 4 semaines. Nous vous écrirons dès l’expédition.", "margin:0;font-size:14px")) +
        button("Mon espace pro", url("/pro-space.html")) +
        p("À très vite.", "margin-bottom:0") }),
      text: `Commande pro ${order.ref} confirmée\n\n${helloText(name)}\n${lines.map((l) => `- ${FLAVOR_NAMES[l.flavor] || l.flavor}: ${l.boxes} caisse(s) de 12`).join("\n")}\nTotal hors TVA: ${chf(order.net_cents)}\nTVA: ${chf(order.vat_cents)}\nTotal TVA incluse: ${chf(order.total_cents)}\nLivraison: ${order.ship_address}, ${order.ship_zip} ${order.ship_city}, Suisse, sous 4 semaines.`,
    };
  },

  /* 3. Shipped (carrier + tracking; trackingUrl optional) */
  shipped({ order, name, carrier, trackingNumber, trackingUrl }) {
    return {
      subject: `Votre commande ${order.ref} est en route`,
      html: layout({ preheader: `Commande ${order.ref} expédiée${trackingNumber ? ` · suivi ${trackingNumber}` : ""}.`, body:
        label(`Commande ${order.ref}`) + h1("Votre colis est parti") + p(hello(name)) +
        p(`Bonne nouvelle&nbsp;: la commande ${strong(order.ref)} vient d’être expédiée.`) +
        box(label("Suivi du colis") + (carrier ? p("Transporteur&nbsp;: " + strong(carrier), "margin:0 0 8px") : "") + (trackingNumber ? p("Numéro de suivi&nbsp;: " + code(trackingNumber), "margin:0 0 8px") : "") + p(`Livraison à&nbsp;:<br>${addr(order)}`, "margin:0;font-size:14px")) +
        (trackingUrl ? button("Suivre mon colis", safeUrl(trackingUrl)) : "") +
        p("Pensez à mettre les bouteilles au frais avant de les déguster.", "margin-bottom:0") }),
      text: `Votre commande ${order.ref} est expédiée.\n${carrier ? `Transporteur: ${carrier}\n` : ""}${trackingNumber ? `Suivi: ${trackingNumber}\n` : ""}${trackingUrl ? trackingUrl + "\n" : ""}Livraison: ${order.ship_address}, ${order.ship_zip} ${order.ship_city}, Suisse.`,
    };
  },

  /* 4. Access request received (pro or ambassador) */
  requestReceived({ name, kind }) {
    const amb = kind === "ambassador";
    return {
      subject: amb ? "Nous avons bien reçu votre candidature d’ambassadeur" : "Nous avons bien reçu votre demande d’accès pro",
      html: layout({ preheader: amb ? "Votre candidature est entre les mains des fondateurs. Réponse rapide." : "Votre demande est entre les mains des fondateurs. Réponse rapide.", footerNote: AUTH_NOTE, body:
        label(amb ? "Candidature ambassadeur" : "Demande d’accès pro") + h1("Merci, c’est bien reçu") + p(hello(name)) +
        p(amb ? "Merci de votre intérêt pour devenir ambassadeur Malaconda. Les fondateurs étudient votre candidature et reviennent vers vous très vite." : "Merci de votre intérêt pour Malaconda. Les fondateurs étudient votre demande d’accès professionnel et reviennent vers vous très vite pour ouvrir votre compte.") +
        (amb ? "" : p(`À l’ouverture de votre compte, ${WELCOME_PCT} % de réduction vous attendent sur votre première commande.`)) +
        p("En attendant, une question&nbsp;? Répondez simplement à cet email.", "margin-bottom:0") }),
      text: `${helloText(name)}\nVotre ${amb ? "candidature d’ambassadeur" : "demande d’accès pro"} est bien reçue. Les fondateurs reviennent vers vous très vite.`,
    };
  },

  /* 5. Pro account opened (temporary password, first-order welcome 10%) */
  proAccount({ name, company, email, tempPassword }) {
    return {
      subject: "Votre compte pro Malaconda est ouvert",
      html: layout({ preheader: `Compte pro ouvert pour ${company || "votre établissement"}. ${WELCOME_PCT} % sur votre première commande.`, footerNote: AUTH_NOTE, body:
        label("Compte professionnel") + h1("Votre compte pro est ouvert") + p(hello(name)) +
        p(`Le compte de ${strong(company || "votre établissement")} est prêt. Une fois connecté, vous voyez vos prix professionnels (hors TVA) directement sur le site.`) +
        box(label("Vos accès") + p("Email&nbsp;: " + strong(email), "margin:0 0 10px") + p("Mot de passe temporaire&nbsp;: " + code(tempPassword), "margin:0 0 10px") + p("Vous devrez le changer à la première connexion.", "margin:0;font-size:14px")) +
        box(label("Offre de bienvenue pro") + `<p style="margin:0 0 6px;font:400 44px/1 ${DISPLAY};color:${C.lulo}">−${WELCOME_PCT} %</p><p style="margin:0;font:400 15px/1.5 ${BODY};color:${C.stone}">sur votre première commande. Elle s’applique automatiquement.</p>`) +
        p("Nous vendons par caisses de 12 bouteilles (Sweet Guava et Biting Lulo) et livrons en Suisse uniquement.") +
        button("Me connecter", url("/pro-space.html")) +
        p("Bienvenue dans la famille Malaconda.", "margin-bottom:0") }),
      text: `Votre compte pro Malaconda est ouvert.\n\n${helloText(name)}\nEmail: ${email}\nMot de passe temporaire: ${tempPassword} (à changer à la première connexion)\n${WELCOME_PCT} % de réduction sur votre première commande.\n${url("/pro-space.html")}`,
    };
  },

  /* 6. Pro order received: payment by bank transfer, invoice to follow */
  proOrderReceived({ name, ref, lines, netCents, vatIncluded }) {
    const rows = lines.map((l) => [`${flavorLabel(l.flavor)}<br><span style="color:${C.stone};font-size:13px">${boxWord(l.boxes)} bouteilles</span>`, ""]);
    return {
      subject: `Commande ${ref} reçue`,
      html: layout({ preheader: `Nous préparons votre facture pour la commande ${ref}.`, body:
        label(`Commande ${ref}`) + h1("Commande bien reçue") + p(hello(name)) +
        p(`Nous avons bien reçu votre commande ${strong(ref)}.`) +
        table(rows, netCents != null ? { total: [vatIncluded ? "Total TVA incluse" : "Total hors TVA", chf(netCents)] } : {}) +
        p("Nous vous envoyons la facture par email. La commande part dès réception du paiement par virement. Livraison en Suisse sous 4 semaines.") +
        button("Voir mes commandes", url("/pro-space.html")) +
        p("Merci pour votre confiance.", "margin-bottom:0") }),
      text: `Commande ${ref} reçue.\n${lines.map((l) => `- ${FLAVOR_NAMES[l.flavor] || l.flavor}: ${l.boxes} caisse(s) de 12`).join("\n")}\nFacture à suivre par email; livraison en Suisse sous 4 semaines.`,
    };
  },

  /* 7. Ambassador account opened: code + link */
  ambassadorAccount({ name, email, tempPassword, code: ambCode, link }) {
    const shareLink = link || url("/?ref=" + encodeURIComponent(ambCode || ""));
    return {
      subject: "Bienvenue parmi les ambassadeurs Malaconda",
      html: layout({ preheader: "Votre espace, votre code et votre lien à partager.", footerNote: AUTH_NOTE, body:
        label("Ambassadeur") + h1("Vous êtes ambassadeur") + p(hello(name)) +
        p("Merci de porter Malaconda dans les bars, restaurants et boutiques de Suisse. Voici votre espace personnel&nbsp;: vos établissements, vos relevés mensuels et votre code à partager.") +
        box(label("Votre code") + p(code(ambCode), "margin:0 0 14px") + label("Votre lien") + p(`<a href="${esc(shareLink)}" style="color:${C.paper};word-break:break-all">${esc(shareLink)}</a>`, "margin:0")) +
        box(label("Vos accès") + p("Email&nbsp;: " + strong(email), "margin:0 0 10px") + p("Mot de passe temporaire&nbsp;: " + code(tempPassword), "margin:0 0 10px") + p("Vous devrez le changer à la première connexion.", "margin:0;font-size:14px")) +
        button("Ouvrir mon espace", url("/ambassador-space.html")) +
        p("Votre relevé de commissions est disponible chaque mois dans votre espace.", "margin-bottom:0") }),
      text: `Bienvenue parmi les ambassadeurs Malaconda.\n\n${helloText(name)}\nCode: ${ambCode}\nLien: ${shareLink}\nEmail: ${email}\nMot de passe temporaire: ${tempPassword} (à changer à la première connexion)\n${url("/ambassador-space.html")}`,
    };
  },

  /* 8. Monthly commission statement available (no prices, no order lines) */
  commissionStatement({ name, period, totalCents, number }) {
    return {
      subject: `Votre relevé de commissions (${period})`,
      html: layout({ preheader: `Relevé ${number || ""} disponible dans votre espace ambassadeur.`, body:
        label("Relevé mensuel") + h1("Votre relevé est disponible") + p(hello(name)) +
        p(`Votre relevé de commissions pour ${strong(period)} est prêt${number ? ` (n° ${esc(number)})` : ""}.`) +
        (totalCents != null ? box(label("Commission du mois") + `<p style="margin:0;font:500 28px/1.2 ${MONO};color:${C.paper}">${chf(totalCents)}</p>`) : "") +
        p("Le versement est effectué par virement bancaire sur l’IBAN enregistré dans votre espace.") +
        button("Voir mon relevé", url("/ambassador-space.html")) +
        p("Merci pour votre engagement.", "margin-bottom:0") }),
      text: `Votre relevé de commissions (${period}) est disponible dans votre espace ambassadeur: ${url("/ambassador-space.html")}`,
    };
  },

  /* 9. Referral credit earned (pro-to-pro) */
  referralCredit({ name, referredCompany, creditPct }) {
    return {
      subject: `Vous gagnez ${creditPct} % de crédit sur votre prochaine commande`,
      html: layout({ preheader: `${referredCompany} a passé sa première commande grâce à vous.`, body:
        label("Recommandation") + h1("Merci pour la recommandation") + p(hello(name)) +
        p(`${strong(referredCompany)} vient de passer sa première commande, grâce à vous.`) +
        box(label("Crédit gagné") + `<p style="margin:0 0 6px;font:400 44px/1 ${DISPLAY};color:${C.lulo}">${esc(creditPct)} %</p><p style="margin:0;font:400 15px/1.5 ${BODY};color:${C.stone}">de réduction sur vos prochaines commandes (15 % au maximum par commande, le reste est reporté). Ce crédit n’est pas remboursable en espèces.</p>`) +
        button("Voir mon crédit", url("/pro-space.html")) +
        p("Merci de faire connaître Malaconda.", "margin-bottom:0") }),
      text: `${referredCompany} a passé sa première commande grâce à vous. Vous gagnez ${creditPct} % de crédit sur vos prochaines commandes (15 % max. par commande).`,
    };
  },

  /* 10. Password reset (link valid 1 hour) */
  passwordReset({ name, resetUrl }) {
    return {
      subject: "Réinitialisez votre mot de passe Malaconda",
      html: layout({ preheader: "Ce lien est valable une heure.", footerNote: AUTH_NOTE, body:
        label("Sécurité") + h1("Nouveau mot de passe") + p(hello(name)) +
        p("Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau. Ce lien est valable une heure.") +
        button("Choisir un mot de passe", safeUrl(resetUrl)) +
        p("Le bouton ne fonctionne pas&nbsp;? Copiez ce lien dans votre navigateur&nbsp;:", "margin-bottom:6px;font-size:14px") +
        p(`<a href="${esc(resetUrl)}" style="color:${C.paper};word-break:break-all">${esc(resetUrl)}</a>`, "font-size:13px") +
        p("Si vous n’êtes pas à l’origine de cette demande, ignorez cet email&nbsp;: votre mot de passe actuel reste inchangé.", "margin-bottom:0;font-size:14px") }),
      text: `${helloText(name)}\nPour choisir un nouveau mot de passe (lien valable 1 heure): ${resetUrl}\nSi vous n’êtes pas à l’origine de cette demande, ignorez cet email.`,
    };
  },

  /* 11. Contact form acknowledgement */
  contactReceived({ name }) {
    return {
      subject: "Nous avons bien reçu votre message",
      html: layout({ preheader: "Nous vous répondons rapidement.", footerNote: "Vous recevez cet email car vous nous avez écrit depuis malaconda.com.", body:
        label("Contact") + h1("Message bien reçu") + p(hello(name)) +
        p("Merci de nous avoir écrit. Nous lisons chaque message et vous répondons dès que possible.", "margin-bottom:0") }),
      text: `${helloText(name)}\nMerci pour votre message, nous vous répondons dès que possible.`,
    };
  },
};

module.exports = { T, layout, WELCOME_PCT };
