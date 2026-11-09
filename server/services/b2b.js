/**
 * B2B partner store: application, catalogue for approved partners, pre-orders.
 *
 * Pre-order = 5 or 10 cases of ONE flavour, 10% partner discount, 20% deposit.
 *   STRIPE:  partner pays the deposit on Stripe → webhook confirms the pre-order.
 *   INVOICE: order is recorded as AWAITING_DEPOSIT, the team sends an invoice,
 *            the admin records the bank payment → pre-order confirmed.
 * The remaining 80% is NEVER charged automatically.
 */
import { B2B_PRODUCTS, B2B_RULES, CURRENCY } from "../config/catalog.js";
import { createOrder, listOrdersOfCustomer, updateOrder } from "../db/orders.js";
import { getPartner, savePartnerApplication } from "../db/partners.js";
import { updateCustomer } from "../db/customers.js";
import { badRequest } from "../lib/errors.js";
import { toDate } from "../lib/dates.js";
import { randomRef } from "../lib/ids.js";
import { formatChf } from "../lib/money.js";
import { priceB2bPreorder } from "./pricing.js";
import * as templates from "../emails/templates.js";

const DUPLICATE_WINDOW_MINUTES = 10;

export function createB2bService(ctx) {
  const { db, stripe, config, mailer, reporting, log } = ctx;

  async function notifyTeam(title, rows) {
    if (!mailer.teamAddress) return;
    await mailer.send({ to: mailer.teamAddress, ...templates.teamNotification(title, rows) });
  }

  async function apply(customer, details) {
    const result = await savePartnerApplication(db, customer.id, { ...details, email: customer.email });
    await updateCustomer(db, customer.id, { fullName: details.fullName, phone: details.phone });
    if (result.status === "PENDING") {
      const partner = { ...details, email: customer.email };
      await mailer.send({ to: customer.email, ...templates.partnerApplicationReceived(partner) });
      await notifyTeam(`New partner application: ${details.companyName}`, [
        ["Company", details.companyName],
        ["Contact", details.fullName],
        ["Email", customer.email],
        ["Phone", details.phone],
        ["Address", details.businessAddress],
      ]);
    }
    reporting.syncPartner(customer.id);
    return { approvalStatus: result.status };
  }

  async function status(customerId) {
    const partner = await getPartner(db, customerId);
    return { approvalStatus: partner?.approvalStatus || "NONE" };
  }

  function catalog() {
    return {
      currency: CURRENCY,
      products: Object.values(B2B_PRODUCTS).map((p) => {
        const priced = priceB2bPreorder(p.sku, B2B_RULES.allowedQuantities[0]);
        return {
          sku: p.sku,
          flavour: p.flavour,
          name: p.name,
          bottlesPerCase: p.bottles,
          basePriceCents: p.priceCents,
          partnerPriceCents: priced.lines[0].unitPartnerPriceCents,
        };
      }),
      allowedQuantities: B2B_RULES.allowedQuantities,
      partnerDiscountPct: B2B_RULES.partnerDiscountPct,
      depositPct: B2B_RULES.depositPct,
      paymentWorkflows: config.partnerPaymentModes,
    };
  }

  /**
   * Avoids duplicate pre-orders from double clicks: a recent identical
   * pre-order that is still waiting for its deposit is reused.
   */
  async function findRecentDuplicate(customerId, sku, quantity, workflow) {
    const since = Date.now() - DUPLICATE_WINDOW_MINUTES * 60_000;
    return (await listOrdersOfCustomer(db, customerId)).find(
        (o) =>
          o.channel === "B2B" &&
          o.paymentStatus === "AWAITING_DEPOSIT" &&
          o.paymentWorkflow === workflow &&
          o.items[0].sku === sku &&
          o.items[0].quantity === quantity &&
          toDate(o.createdAt).getTime() >= since,
      );
  }

  async function preorder({ partner, customer, sku, quantity, workflow, lang }) {
    if (!config.partnerPaymentModes.includes(workflow)) {
      throw badRequest("WORKFLOW_NOT_AVAILABLE", "This payment option is not available.");
    }
    const priced = priceB2bPreorder(sku, quantity);

    const duplicate = await findRecentDuplicate(customer.id, sku, quantity, workflow);
    if (duplicate) {
      if (workflow === "INVOICE") return { orderRef: duplicate.ref, workflow };
      const url = duplicate.stripe?.checkoutSessionId ? await stripe.getSessionUrlIfOpen(duplicate.stripe.checkoutSessionId) : null;
      if (url) return { orderRef: duplicate.ref, workflow, url };
    }

    const now = new Date();
    const orderRef = randomRef("MLC-B2B");
    const order = {
      channel: "B2B",
      customerId: customer.id,
      email: customer.email,
      partner: { companyName: partner.companyName, fullName: partner.fullName, businessAddress: partner.businessAddress, phone: partner.phone },
      orderStatus: "PENDING_CONFIRMATION",
      paymentStatus: "AWAITING_DEPOSIT",
      paymentWorkflow: workflow,
      items: priced.lines,
      currency: CURRENCY,
      subtotalCents: priced.subtotalCents,
      discountCents: priced.discountCents,
      shippingCents: 0,
      totalCents: priced.totalCents,
      depositCents: priced.depositCents,
      balanceCents: priced.balanceCents,
      amountPaidCents: 0,
      promo: null,
      ambassador: null,
      stripe: { checkoutSessionId: null, paymentIntentId: null, customerId: null },
      invoiceSentAt: null,
      flags: [],
      lang: lang === "de" ? "de" : "en",
      confirmationEmailSentAt: null,
      sheetsSyncedAt: null,
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await createOrder(db, orderRef, order);
    const fullOrder = { ...order, ref: orderRef };

    if (workflow === "INVOICE") {
      await mailer.send({ to: customer.email, ...templates.b2bInvoiceRequested(fullOrder) });
      await notifyTeam(`Pre-order ${orderRef}: send 20% deposit invoice`, [
        ["Company", partner.companyName],
        ["Order", `${quantity} × ${priced.lines[0].name}`],
        ["Total", formatChf(priced.totalCents)],
        ["Deposit to invoice", formatChf(priced.depositCents)],
        ["Email", customer.email],
      ]);
      reporting.syncOrder(orderRef);
      log.info("preorder.invoice", { orderRef });
      return { orderRef, workflow };
    }

    let session;
    try {
      let stripeCustomerId = customer.stripeCustomerId;
      if (!stripeCustomerId) {
        stripeCustomerId = await stripe.createCustomer({ email: customer.email, name: partner.companyName, customerId: customer.id });
        await updateCustomer(db, customer.id, { stripeCustomerId });
      }
      session = await stripe.createCheckoutSession({
        channel: "B2B",
        orderRef,
        lineItems: [
          {
            name: `Pre-order deposit ${B2B_RULES.depositPct}%: ${quantity} × ${priced.lines[0].name} (${orderRef})`,
            unitAmountCents: priced.depositCents,
            quantity: 1,
          },
        ],
        shippingCents: null,
        stripeCustomerId,
        lang,
      });
    } catch (err) {
      await updateOrder(db, orderRef, { paymentStatus: "FAILED", flags: ["STRIPE_SESSION_NOT_CREATED"] });
      throw err;
    }
    await updateOrder(db, orderRef, { "stripe.checkoutSessionId": session.id });
    reporting.syncOrder(orderRef);
    log.info("preorder.stripe", { orderRef });
    return { orderRef, workflow, url: session.url };
  }

  return { apply, status, catalog, preorder, notifyTeam };
}
