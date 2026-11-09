/**
 * Order confirmation emails (one per confirmed payment).
 * Used by the Stripe webhook, by the admin "record deposit" action and by
 * the admin "resend email" button.
 */
import { getOrder, updateOrder } from "../db/orders.js";
import * as templates from "../emails/templates.js";
import { formatChf } from "../lib/money.js";

export function createNotifications({ db, mailer, log }) {
  async function sendOrderConfirmation(ref) {
    const order = await getOrder(db, ref);
    if (!order?.email) {
      log.warn("email.confirmation_no_address", { orderRef: ref });
      return { sent: false };
    }
    const content = order.channel === "B2C" ? templates.b2cConfirmation(order) : templates.b2bDepositConfirmation(order);
    try {
      const result = await mailer.send({ to: order.email, ...content });
      await updateOrder(db, ref, result.sent ? { confirmationEmailSentAt: new Date(), confirmationEmailError: null } : { confirmationEmailError: "EMAIL_NOT_CONFIGURED" });
      return result;
    } catch (err) {
      log.error("email.confirmation_failed", { orderRef: ref, error: err.message });
      await updateOrder(db, ref, { confirmationEmailError: err.message.slice(0, 200) });
      return { sent: false };
    }
  }

  async function notifyTeamOfPayment(order) {
    if (!mailer.teamAddress) return;
    const title = order.channel === "B2C" ? `New order ${order.ref}` : `Pre-order ${order.ref} deposit paid`;
    const rows = [
      ["Order", order.ref],
      ["Channel", order.channel],
      ["Customer", order.email || ""],
      ...(order.partner ? [["Company", order.partner.companyName]] : []),
      ["Items", order.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")],
      ["Paid", formatChf(order.amountPaidCents)],
      ...(order.promo ? [["Code", order.promo.code]] : []),
    ];
    try {
      await mailer.send({ to: mailer.teamAddress, ...templates.teamNotification(title, rows) });
    } catch (err) {
      log.error("email.team_failed", { orderRef: order.ref, error: err.message });
    }
  }

  return { sendOrderConfirmation, notifyTeamOfPayment };
}
