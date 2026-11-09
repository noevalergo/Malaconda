/**
 * Minimal admin API (/api/admin/*). Sign-in with an email code, only for
 * addresses in ADMIN_EMAILS. All actions are logged with the admin's email.
 *
 *   POST /api/admin/auth/request-code | verify-code | logout
 *   GET  /api/admin/partners?status=PENDING
 *   POST /api/admin/partners/:customerId/approve | reject
 *   GET  /api/admin/orders?channel=B2B
 *   GET  /api/admin/orders/:ref
 *   POST /api/admin/orders/:ref/status          { orderStatus }
 *   POST /api/admin/orders/:ref/invoice-sent
 *   POST /api/admin/orders/:ref/payments        { kind: "DEPOSIT"|"BALANCE", amountCents? }
 *   POST /api/admin/orders/:ref/resend-confirmation
 *   GET  /api/admin/ambassadors
 *   POST /api/admin/ambassadors                 { name, email, code }
 *   POST /api/admin/ambassadors/:id/active      { active: true|false }
 *   GET  /api/admin/commissions?month=2027-01
 *   POST /api/admin/commissions/mark-paid       { month, ambassadorId }
 *   POST /api/admin/sheets/resync
 */
import { Router } from "express";
import * as v from "../lib/validate.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { requireAdmin } from "../middleware/session.js";
import { authRoutes } from "./auth.js";
import { listPartners, setPartnerApproval } from "../db/partners.js";
import { getOrder, listCommissions, listOrders, markCommissionsPaid, markInvoiceSent, recordManualPayment, setOrderStatus } from "../db/orders.js";
import { createAmbassador, listAmbassadors, setAmbassadorActive } from "../db/promotions.js";
import { PROMO_RULES } from "../config/catalog.js";
import { startOfNextZurichMonth } from "../lib/dates.js";
import * as templates from "../emails/templates.js";

export function adminRoutes(ctx) {
  const router = Router();
  router.use("/auth", authRoutes(ctx, "admin"));
  router.use(requireAdmin(ctx));

  const fail = (result) => {
    if (result.code === "NOT_FOUND") throw notFound();
    throw conflict(result.code, `Action not possible (${result.code}).`);
  };

  // ---------- Partners ----------
  router.get("/partners", async (req, res) => {
    const status = ["PENDING", "APPROVED", "REJECTED"].includes(req.query.status) ? req.query.status : undefined;
    res.json({ partners: await listPartners(ctx.db, { status }) });
  });

  router.post("/partners/:customerId/:decision", async (req, res) => {
    const decision = { approve: "APPROVED", reject: "REJECTED" }[req.params.decision];
    if (!decision) throw notFound();
    const partner = await setPartnerApproval(ctx.db, req.params.customerId, decision, req.admin.email);
    if (!partner) throw notFound();
    if (decision === "APPROVED") {
      await ctx.mailer.send({ to: partner.email, ...templates.partnerApproved(partner, `${ctx.config.publicBaseUrl}/partners`) });
    }
    ctx.reporting.syncPartner(req.params.customerId);
    res.json({ ok: true, approvalStatus: decision });
  });

  // ---------- Orders ----------
  router.get("/orders", async (req, res) => {
    const channel = ["B2C", "B2B"].includes(req.query.channel) ? req.query.channel : undefined;
    res.json({ orders: await listOrders(ctx.db, { channel }) });
  });

  router.get("/orders/:ref", async (req, res) => {
    const order = await getOrder(ctx.db, req.params.ref);
    if (!order) throw notFound();
    res.json({ order });
  });

  router.post("/orders/:ref/status", async (req, res) => {
    const orderStatus = v.text(req.body, "orderStatus", { max: 40 });
    const result = await setOrderStatus(ctx.db, { ref: req.params.ref, orderStatus, adminEmail: req.admin.email });
    if (!result.ok) fail(result);
    ctx.reporting.syncOrder(req.params.ref);
    res.json({ ok: true });
  });

  router.post("/orders/:ref/invoice-sent", async (req, res) => {
    const result = await markInvoiceSent(ctx.db, { ref: req.params.ref, adminEmail: req.admin.email });
    if (!result.ok) fail(result);
    ctx.reporting.syncOrder(req.params.ref);
    res.json({ ok: true });
  });

  router.post("/orders/:ref/payments", async (req, res) => {
    const kind = v.oneOf(req.body, "kind", ["DEPOSIT", "BALANCE"]);
    const amountCents = req.body.amountCents === undefined ? undefined : v.integer(req.body, "amountCents");
    const result = await recordManualPayment(ctx.db, { ref: req.params.ref, kind, amountCents, adminEmail: req.admin.email });
    if (!result.ok) fail(result);
    if (kind === "DEPOSIT") await ctx.notifications.sendOrderConfirmation(req.params.ref);
    ctx.reporting.syncOrder(req.params.ref);
    res.json({ ok: true, paymentStatus: result.order.paymentStatus });
  });

  router.post("/orders/:ref/resend-confirmation", async (req, res) => {
    const order = await getOrder(ctx.db, req.params.ref);
    if (!order) throw notFound();
    const paid = order.channel === "B2C" ? order.paymentStatus === "PAID" : ["DEPOSIT_PAID", "FULLY_PAID"].includes(order.paymentStatus);
    if (!paid) throw conflict("NOT_PAID", "Only paid orders get a confirmation email.");
    res.json(await ctx.notifications.sendOrderConfirmation(req.params.ref));
  });

  // ---------- Ambassadors ----------
  router.get("/ambassadors", async (_req, res) => {
    res.json({ ambassadors: await listAmbassadors(ctx.db) });
  });

  router.post("/ambassadors", async (req, res) => {
    const name = v.text(req.body, "name", { max: 120 });
    const email = v.email(req.body);
    const code = v.text(req.body, "code", { max: 40 }).toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw badRequest("INVALID_CODE", "Codes use letters, digits, - or _ (3–40 characters).");
    if (code === PROMO_RULES.welcome.code) throw conflict("CODE_EXISTS", "This code already exists.");
    try {
      const created = await createAmbassador(ctx.db, { name, email, code, commissionCents: PROMO_RULES.ambassador.commissionCents });
      ctx.reporting.syncAmbassador(created.ambassadorId);
      res.status(201).json(created);
    } catch (err) {
      if (err.code === "CODE_EXISTS") throw conflict("CODE_EXISTS", "This code already exists.");
      throw err;
    }
  });

  router.post("/ambassadors/:id/active", async (req, res) => {
    if (typeof req.body.active !== "boolean") throw badRequest("INVALID_INPUT", 'Field "active" must be true or false.');
    try {
      await setAmbassadorActive(ctx.db, req.params.id, req.body.active);
    } catch (err) {
      if (err.code === "NOT_FOUND") throw notFound();
      throw err;
    }
    ctx.reporting.syncAmbassador(req.params.id);
    res.json({ ok: true });
  });

  // ---------- Commissions (CHF 5 per paid first order, paid at month end) ----------
  router.get("/commissions", async (req, res) => {
    const month = monthParam(req.query.month);
    const orders = await listCommissions(ctx.db, month);
    const byAmbassador = {};
    for (const o of orders) {
      const a = (byAmbassador[o.ambassador.ambassadorId] ||= { ambassadorId: o.ambassador.ambassadorId, code: o.ambassador.code, pendingCents: 0, paidCents: 0, cancelledCents: 0, orders: [] });
      const key = { PENDING: "pendingCents", PAID: "paidCents", CANCELLED: "cancelledCents" }[o.ambassador.status];
      if (key) a[key] += o.ambassador.commissionCents;
      a.orders.push({ ref: o.ref, status: o.ambassador.status, paymentStatus: o.paymentStatus, paidAt: o.paidAt });
    }
    res.json({ month, payableFrom: startOfNextZurichMonth(month), ambassadors: Object.values(byAmbassador) });
  });

  router.post("/commissions/mark-paid", async (req, res) => {
    const month = monthParam(req.body.month);
    const ambassadorId = v.text(req.body, "ambassadorId", { max: 40 });
    if (new Date() < startOfNextZurichMonth(month)) {
      throw conflict("MONTH_NOT_ENDED", "Commissions are paid at the end of the month.");
    }
    res.json(await markCommissionsPaid(ctx.db, { month, ambassadorId, adminEmail: req.admin.email }));
  });

  // ---------- Google Sheets ----------
  router.post("/sheets/resync", async (_req, res) => {
    res.json(await ctx.reporting.resyncAll());
  });

  return router;
}

function monthParam(value) {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw badRequest("INVALID_MONTH", 'Month must look like "2027-01".');
  }
  return value;
}
