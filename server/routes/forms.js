/**
 * Website forms that only notify the team by email (decision G6).
 *   POST /api/forms/contact     { name, email, topic, message, website(honeypot) }
 *   POST /api/forms/ambassador  { first_name, last_name, email, phone, birth_date, city, handle, role, why, terms, website }
 * Field names match the existing HTML forms.
 */
import { Router } from "express";
import * as v from "../lib/validate.js";
import { rateLimits } from "../middleware/security.js";
import { unavailable } from "../lib/errors.js";
import * as templates from "../emails/templates.js";

export function formRoutes(ctx) {
  const router = Router();

  async function sendToTeam(title, rows, replyTo) {
    if (!ctx.mailer.configured || !ctx.mailer.teamAddress) {
      throw unavailable("FORMS_UNAVAILABLE", "The form is temporarily unavailable. Please write to us by email.");
    }
    await ctx.mailer.send({ to: ctx.mailer.teamAddress, replyTo, ...templates.teamNotification(title, rows) });
  }

  router.post("/contact", rateLimits.forms(), async (req, res) => {
    if (v.isHoneypotFilled(req.body)) return res.json({ ok: true }); // silently ignore bots
    const name = v.text(req.body, "name", { max: 120 });
    const email = v.email(req.body);
    const topic = v.text(req.body, "topic", { max: 40, required: false }) || "General";
    const message = v.text(req.body, "message", { max: 5000 });
    await sendToTeam(`Contact form: ${topic}`, [["Name", name], ["Email", email], ["Topic", topic], ["Message", message]], email);
    res.json({ ok: true });
  });

  router.post("/ambassador", rateLimits.forms(), async (req, res) => {
    if (v.isHoneypotFilled(req.body)) return res.json({ ok: true });
    const rows = [
      ["First name", v.text(req.body, "first_name", { max: 80 })],
      ["Last name", v.text(req.body, "last_name", { max: 80 })],
      ["Email", v.email(req.body)],
      ["Phone", v.text(req.body, "phone", { max: 40, required: false })],
      ["Date of birth", v.text(req.body, "birth_date", { max: 20 })],
      ["City & country", v.text(req.body, "city", { max: 120 })],
      ["Instagram / TikTok", v.text(req.body, "handle", { max: 120 })],
      ["Role", v.text(req.body, "role", { max: 60, required: false })],
      ["Why Malaconda", v.text(req.body, "why", { max: 3000 })],
    ];
    if (req.body.terms !== "yes" && req.body.terms !== true) {
      return res.status(400).json({ error: { code: "TERMS_REQUIRED", message: "Please accept to be contacted." } });
    }
    await sendToTeam("Ambassador application", rows, rows[2][1]);
    res.json({ ok: true });
  });

  return router;
}
