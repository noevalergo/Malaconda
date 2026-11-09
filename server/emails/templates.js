/**
 * Email templates. Each function returns { subject, text, html }.
 * English only for now (the site is EN/DE; German emails can be added later).
 * All dynamic values are HTML-escaped.
 */
import { EMAIL_CONTENT as C } from "./content.js";
import { formatChf } from "../lib/money.js";

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

/** Builds text + simple HTML from a list of paragraphs / [label, value] rows. */
function build(subject, blocks) {
  const text = blocks
    .map((b) => (Array.isArray(b) ? b.map(([k, v]) => `${k}: ${v}`).join("\n") : b))
    .join("\n\n");
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#131313;line-height:1.5">${blocks
    .map((b) =>
      Array.isArray(b)
        ? `<table cellpadding="4" style="border-collapse:collapse">${b.map(([k, v]) => `<tr><td style="color:#4F4F4D">${esc(k)}</td><td><strong>${esc(v)}</strong></td></tr>`).join("")}</table>`
        : `<p>${esc(b).replace(/\n/g, "<br>")}</p>`,
    )
    .join("")}</body></html>`;
  return { subject, text, html };
}

const itemRows = (order) => order.items.map((i) => [`${i.quantity} × ${i.name}`, formatChf(i.lineTotalCents)]);

export function verificationCode(code) {
  return build(`${C.brandName}: your verification code ${code}`, [
    `Your verification code is: ${code}`,
    "It is valid for 15 minutes. If you didn't ask for it, you can ignore this email.",
    C.signature,
  ]);
}

export function b2cConfirmation(order) {
  const rows = [
    ["Order", order.ref],
    ...itemRows(order),
    ...(order.discountCents ? [[`Discount (${order.promo?.code})`, formatChf(-order.discountCents)]] : []),
    ["Shipping", formatChf(order.shippingCents)],
    ["Total paid (VAT incl.)", formatChf(order.amountPaidCents)],
  ];
  return build(`${C.brandName}: order ${order.ref} confirmed`, [
    "Thank you, your payment was received and your order is confirmed.",
    rows,
    `Product information: ${C.b2cConfirmation.productInfo}`,
    `Storage: ${C.b2cConfirmation.storage}`,
    `Delivery: ${C.b2cConfirmation.delivery}`,
    C.signature,
  ]);
}

function b2bRows(order) {
  const line = order.items[0];
  return [
    ["Pre-order", order.ref],
    ["Company", order.partner?.companyName],
    [`${line.quantity} × ${line.name}`, formatChf(order.subtotalCents)],
    ["Partner discount (10%)", formatChf(-order.discountCents)],
    ["Total (VAT incl.)", formatChf(order.totalCents)],
    ["Deposit (20%)", formatChf(order.depositCents)],
    ["Balance on delivery (80%)", formatChf(order.balanceCents)],
  ];
}

export function b2bDepositConfirmation(order) {
  return build(`${C.brandName}: pre-order ${order.ref} confirmed`, [
    "Thank you, your 20% deposit was received. Your pre-order is confirmed.",
    b2bRows(order),
    C.b2bConfirmation.nextSteps,
    `Partner kit: ${C.b2bConfirmation.partnerKit}`,
    C.signature,
  ]);
}

export function b2bInvoiceRequested(order) {
  return build(`${C.brandName}: pre-order ${order.ref} received`, [
    "Thank you, we received your pre-order. This is not a payment confirmation: we will send you an invoice for the 20% deposit.",
    b2bRows(order),
    C.invoiceInstructions,
    C.signature,
  ]);
}

export function partnerApplicationReceived(partner) {
  return build(`${C.brandName}: partner application received`, [
    `Thank you, ${partner.fullName}. We received the partner application for ${partner.companyName} and will review it shortly.`,
    C.signature,
  ]);
}

export function partnerApproved(partner, partnersUrl) {
  return build(`${C.brandName}: you're approved as a partner`, [
    `Welcome to the pack, ${partner.fullName}. ${partner.companyName} is now an approved MALACONDA partner.`,
    `Sign in with this email address to place your pre-order: ${partnersUrl}`,
    C.signature,
  ]);
}

// ---------- Team notifications ----------

export function teamNotification(title, rows) {
  return build(`[${C.brandName}] ${title}`, [rows]);
}
