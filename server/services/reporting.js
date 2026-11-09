/**
 * Copies Firestore data to Google Sheets (one direction only).
 *
 * Called AFTER a Firestore write has committed and never awaited by the
 * checkout or webhook flow: if Google Sheets is down, purchases keep working.
 * Failures are logged; "Resync Google Sheets" in /admin rebuilds every tab.
 */
import { COL, getDocData, listAll, markOrderSynced, paymentsOfOrder } from "../db/export.js";
import { toDate } from "../lib/dates.js";

const money = (cents) => (Number.isSafeInteger(cents) ? (cents / 100).toFixed(2) : "");
const date = (v) => (toDate(v) ? toDate(v).toISOString() : "");

export const TABS = {
  Customers: {
    headers: ["Customer ID", "Email", "Name", "Phone", "Email verified", "Paid B2C orders", "First paid order", "Created"],
    row: (id, c) => [id, c.email, c.fullName || "", c.phone || "", date(c.emailVerifiedAt), c.paidOrderCount || 0, date(c.firstPaidOrderAt), date(c.createdAt)],
  },
  Orders: {
    headers: [
      "Order ref", "Created", "Channel", "Customer ID", "Email", "Items", "Cases", "Subtotal", "Discount", "Promo code",
      "Shipping", "Total", "Deposit", "Balance", "Paid", "Outstanding", "Order status", "Payment status", "Workflow",
      "Ambassador ID", "Commission", "Commission status", "Commission month", "Stripe session", "Stripe payment", "Flags", "Paid at",
    ],
    row: (ref, o) => [
      ref, date(o.createdAt), o.channel, o.customerId || "", o.email || "",
      o.items.map((i) => `${i.quantity} × ${i.sku}`).join(", "), o.items.reduce((n, i) => n + i.quantity, 0),
      money(o.subtotalCents), money(o.discountCents), o.promo?.code || "", money(o.shippingCents ?? 0), money(o.totalCents),
      money(o.depositCents ?? 0), money(o.balanceCents ?? 0), money(o.amountPaidCents), money(o.totalCents - o.amountPaidCents),
      o.orderStatus, o.paymentStatus, o.paymentWorkflow || "STRIPE",
      o.ambassador?.ambassadorId || "", o.ambassador ? money(o.ambassador.commissionCents) : "", o.ambassador?.status || "", o.ambassador?.month || "",
      o.stripe?.checkoutSessionId || "", o.stripe?.paymentIntentId || "", (o.flags || []).join(", "), date(o.paidAt),
    ],
  },
  Partners: {
    headers: ["Customer ID", "Company", "Contact", "Email", "Phone", "Business address", "Approval", "Approved at", "Applied"],
    row: (id, p) => [id, p.companyName, p.fullName, p.email, p.phone, p.businessAddress, p.approvalStatus, date(p.approvedAt), date(p.createdAt)],
  },
  "Discount redemptions": {
    headers: ["Redemption ID", "Code", "Kind", "Customer ID", "Status", "Order ref", "Ambassador ID", "Confirmed at", "Updated"],
    row: (id, r) => [id, r.code, r.kind, r.customerId, r.status, r.orderRef, r.ambassadorId || "", date(r.confirmedAt), date(r.updatedAt)],
  },
  Payments: {
    headers: ["Payment ID", "Order ref", "Kind", "Provider", "Amount", "Currency", "Status", "Stripe reference", "Recorded by", "Date"],
    row: (id, p) => [id, p.orderRef, p.kind, p.provider, money(p.amountCents), p.currency, p.status, p.stripeReference || "", p.recordedBy || "", date(p.createdAt)],
  },
  Ambassadors: {
    headers: ["Ambassador ID", "Name", "Email", "Code", "Commission per order", "Active", "Created"],
    row: (id, a) => [id, a.name, a.email, a.code, money(a.commissionCents), a.active ? "yes" : "no", date(a.createdAt)],
  },
};

const SOURCES = {
  Customers: COL.customers,
  Orders: COL.orders,
  Partners: COL.partners,
  "Discount redemptions": COL.promoRedemptions,
  Payments: COL.payments,
  Ambassadors: COL.ambassadors,
};

export function createReporting({ db, sheets, log, background }) {
  async function upsertDoc(tab, collection, id) {
    const doc = await getDocData(db, collection, id);
    if (doc) await sheets.upsert(tab, TABS[tab].headers, TABS[tab].row(doc.id, doc.data));
  }

  async function syncOrderNow(ref) {
    const order = (await getDocData(db, COL.orders, ref))?.data;
    if (!order) return;
    await upsertDoc("Orders", COL.orders, ref);
    if (order.customerId) await upsertDoc("Customers", COL.customers, order.customerId);
    if (order.channel === "B2B" && order.customerId) await upsertDoc("Partners", COL.partners, order.customerId);
    if (order.promo?.redemptionId) await upsertDoc("Discount redemptions", COL.promoRedemptions, order.promo.redemptionId);
    for (const p of await paymentsOfOrder(db, ref)) await sheets.upsert("Payments", TABS.Payments.headers, TABS.Payments.row(p.id, p.data));
    await markOrderSynced(db, ref);
  }

  const safely = (label, fn) => {
    if (!sheets.enabled) return;
    background(
      fn().catch((err) => log.error("sheets.sync_failed", { label, error: err.message })),
    );
  };

  return {
    syncOrder: (ref) => safely(`order ${ref}`, () => syncOrderNow(ref)),
    syncPartner: (customerId) => safely(`partner ${customerId}`, () => upsertDoc("Partners", COL.partners, customerId)),
    syncAmbassador: (id) => safely(`ambassador ${id}`, () => upsertDoc("Ambassadors", COL.ambassadors, id)),

    /** Rebuilds all tabs from Firestore. Awaited (admin action). */
    async resyncAll() {
      if (!sheets.enabled) return { enabled: false };
      const counts = {};
      for (const [tab, collection] of Object.entries(SOURCES)) {
        const rows = (await listAll(db, collection)).map((d) => TABS[tab].row(d.id, d.data));
        await sheets.rewrite(tab, TABS[tab].headers, rows);
        counts[tab] = rows.length;
      }
      return { enabled: true, counts };
    },
  };
}
