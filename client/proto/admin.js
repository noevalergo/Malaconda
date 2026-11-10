/* MALACONDA PROTOTYPE — Founders admin */
Auth.gate("admin", "Founders admin", "", function (admin) {
  const { esc, chf, pct, date, monthLabel, $, $$ } = Common;
  const F = Store.FLAVORS, E = window.Engine;
  let tab = "overview", proId = null, custId = null, month = null, reqFilter = "all";
  const TABS = [["overview", "Overview"], ["requests", "Requests"], ["customers", "Customers"], ["pros", "Pro accounts"], ["orders", "Orders"], ["ambassadors", "Ambassadors"], ["commissions", "Commissions"], ["settings", "Settings"]];

  /* ---------- helpers ---------- */
  function modal(html) {
    const d = document.createElement("dialog"); d.innerHTML = html; document.body.appendChild(d);
    d.addEventListener("close", () => d.remove()); d.showModal(); return d;
  }
  function closeModal(d) { if (d.open) d.close(); d.remove(); }
  function credModal(title, email, pw) {
    const d = modal(`<div class="stack"><h2 class="card__title">${esc(title)}</h2><p>Give these credentials to the user. The password must be changed at first login.</p>
      <p class="label">Email</p><div class="credbox">${esc(email)}</div><p class="label">Temporary password</p><div class="credbox">${esc(pw)}</div>
      <div><button class="btn btn--sm" value="close" type="button" id="cclose">Done</button></div></div>`);
    $("#cclose", d).addEventListener("click", () => closeModal(d));
  }
  const s = () => Store.get();
  const proName = (id) => { const p = s().pros.find((x) => x.id === id); return p ? p.name : "?"; };
  const ambName = (id) => { const a = s().ambassadors.find((x) => x.id === id); return a ? a.name : "—"; };
  function refOptions(selected) {
    const key = selected ? `${selected.kind}:${selected.id}` : "";
    return `<option value="">None</option>` +
      `<optgroup label="Ambassadors">${s().ambassadors.map((a) => `<option value="ambassador:${a.id}" ${key === `ambassador:${a.id}` ? "selected" : ""}>${esc(a.name)} (${esc(a.code)})</option>`).join("")}</optgroup>` +
      `<optgroup label="Pros">${s().pros.map((p) => `<option value="pro:${p.id}" ${key === `pro:${p.id}` ? "selected" : ""}>${esc(p.name)} (${esc(p.code)})</option>`).join("")}</optgroup>`;
  }
  const parseRef = (v) => { if (!v) return null; const [kind, id] = v.split(":"); return { kind, id, text: "" }; };

  function shell(inner) {
    const open = s().requests.filter((r) => r.status === "open").length;
    document.getElementById("app").innerHTML = `<div class="block app"><nav class="side" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${k === tab}">${l}${k === "requests" && open ? `<span class="count">${open}</span>` : ""}</button>`).join("")}</nav><div class="stack" id="panel">${inner}</div></div>`;
    $$("[data-tab]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; proId = null; custId = null; render(); }));
  }

  /* ---------- requests ---------- */
  function requestsTab() {
    const FILTERS = [["all", "All"], ["pro", "Access"], ["ambassador", "Ambassadors"], ["order", "Orders"], ["message", "Messages"]];
    const inFilter = (r) => reqFilter === "all" || r.kind === reqFilter;
    const open = s().requests.filter((r) => r.status === "open" && inFilter(r));
    const done = s().requests.filter((r) => r.status !== "open" && inFilter(r));
    const countOf = (k) => s().requests.filter((r) => r.status === "open" && (k === "all" || r.kind === k)).length;
    const card = (r) => {
      if (r.kind === "order") {
        const diff = Store.requestDiff(r.id), q = r.quote;
        return `<div class="card stack"><div class="row" style="justify-content:space-between"><h2 class="card__title">${esc(proName(r.proId))}</h2><span class="badge">Order request</span></div>
          <p>${r.lines.map((l) => `${l.boxes} ${F[l.flavor].name}`).join(", ")} · ${q.boxes} boxes · date ${date(r.createdAt)}</p>
          <p>Quoted to the pro: <span class="paper">${chf(q.net)}</span> excl. VAT (volume −${q.tierPct}%${q.welcomePct ? `, welcome −${q.welcomePct}%` : ""}${q.creditPct ? `, credit −${q.creditPct}%` : ""})</p>
          ${diff.changed ? `<div class="alert alert--warn">Prices changed since the quote: the same order now costs ${chf(diff.now.net)}. Creating it uses today's prices.</div>` : `<p class="small muted">Same price today as quoted.</p>`}
          <div class="row"><button class="btn btn--sm" data-create-order="${r.id}">Create order${diff.changed ? " at today's price" : ""}</button><button class="btn btn--sm btn--danger" data-reject="${r.id}">Reject</button></div></div>`;
      }
      if (r.kind === "message") {
        return `<div class="card stack"><div class="row" style="justify-content:space-between"><h2 class="card__title">${esc(r.name)}</h2><span class="badge">Message · ${esc(r.topic)}</span></div>
          <p><a class="link-quiet" href="mailto:${esc(r.email)}">${esc(r.email)}</a> · ${date(r.createdAt)}</p><p>${esc(r.message)}</p>
          <div class="row"><button class="btn btn--sm" data-handled="${r.id}">Mark handled</button></div></div>`;
      }
      if (r.kind === "pro") {
        const m = Store.resolveRef(r.recommendedBy);
        return `<div class="card stack"><div class="row" style="justify-content:space-between"><h2 class="card__title">${esc(r.business)}</h2><span class="badge">Pro access</span></div>
          <p>${esc(r.type)} · ${esc(r.city)} · ${esc(r.contact)} · ${esc(r.email)} ${r.phone ? "· " + esc(r.phone) : ""}</p>
          <p>Recommended by: <span class="paper">${esc(r.recommendedBy || "—")}</span> ${m ? `<span class="badge badge--ok">Matched: ${esc(Store.refLabel(m))}</span>` : r.recommendedBy ? '<span class="badge badge--warn">No code match: choose manually</span>' : ""}</p>
          ${r.notes ? `<p class="small">${esc(r.notes)}</p>` : ""}
          <div class="row"><button class="btn btn--sm" data-approve-pro="${r.id}">Approve and create account</button><button class="btn btn--sm btn--danger" data-reject="${r.id}">Reject</button></div></div>`;
      }
      return `<div class="card stack"><div class="row" style="justify-content:space-between"><h2 class="card__title">${esc(r.name)}</h2><span class="badge">Ambassador application</span></div>
        <p>${esc(r.email)} ${r.handle ? "· " + esc(r.handle) : ""}</p><p class="small">${esc(r.network)}</p>
        <div class="row"><button class="btn btn--sm" data-approve-amb="${r.id}">Approve and create account</button><button class="btn btn--sm btn--danger" data-reject="${r.id}">Reject</button></div></div>`;
    };
    shell(`<div><p class="label">Requests</p><h1 class="display h2">To review</h1></div>
      <div class="row">${FILTERS.map(([k, l]) => `<button class="btn btn--sm ${reqFilter === k ? "" : "btn--ghost"}" data-filter="${k}" type="button">${l}${countOf(k) ? " · " + countOf(k) : ""}</button>`).join("")}</div>${open.length ? open.map(card).join("") : '<div class="card">Nothing to review.</div>'}
      ${done.length ? `<p class="label">Closed</p><div class="tablewrap"><table class="tbl"><tbody>${done.map((r) => `<tr><td>${esc(r.business || r.name || proName(r.proId))}</td><td>${r.kind}</td><td><span class="badge ${r.status === "approved" ? "badge--ok" : "badge--bad"}">${r.status}</span></td></tr>`).join("")}</tbody></table></div>` : ""}`);
    $$("[data-filter]").forEach((b) => b.addEventListener("click", () => { reqFilter = b.dataset.filter; render(); }));
    $$("[data-create-order]").forEach((b) => b.addEventListener("click", () => { try { const o = Store.createOrderFromRequest(b.dataset.createOrder); Common.toast(`Order ${o.id} created.`); } catch (err) { Common.toast(err.message); } render(); }));
    $$("[data-handled]").forEach((b) => b.addEventListener("click", () => { Store.closeRequest(b.dataset.handled, "handled"); render(); }));
    $$("[data-reject]").forEach((b) => b.addEventListener("click", () => { Store.closeRequest(b.dataset.reject, "rejected"); render(); }));
    $$("[data-approve-pro]").forEach((b) => b.addEventListener("click", () => proDialog(s().requests.find((r) => r.id === b.dataset.approvePro))));
    $$("[data-approve-amb]").forEach((b) => b.addEventListener("click", () => ambDialog(s().requests.find((r) => r.id === b.dataset.approveAmb))));
  }

  function proDialog(req) {
    const m = req ? Store.resolveRef(req.recommendedBy) : null;
    const d = modal(`<form class="stack" id="pform"><h2 class="card__title">${req ? "Approve pro access" : "New pro account"}</h2>
      <div class="form-grid">
        <div class="field"><label class="label" for="p-name">Business</label><input class="input" id="p-name" required value="${esc(req ? req.business : "")}"></div>
        <div class="field"><label class="label" for="p-type">Type</label><select class="input select" id="p-type">${Store.PRO_TYPES.map((t) => `<option ${req && req.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        <div class="field"><label class="label" for="p-city">City</label><input class="input" id="p-city" required value="${esc(req ? req.city : "")}"></div>
        <div class="field"><label class="label" for="p-contact">Contact</label><input class="input" id="p-contact" required value="${esc(req ? req.contact : "")}"></div>
        <div class="field full"><label class="label" for="p-email">Email (username)</label><input class="input" id="p-email" type="email" required value="${esc(req ? req.email : "")}"></div>
        <div class="field full"><label class="label" for="p-ref">Introduced by</label><select class="input select" id="p-ref">${refOptions(m)}</select></div>
      </div><div id="perr"></div><div class="row"><button class="btn btn--sm" type="submit">Create account</button><button class="btn btn--sm btn--ghost" type="button" id="pcancel">Cancel</button></div></form>`);
    $("#pcancel", d).addEventListener("click", () => closeModal(d));
    $("#pform", d).addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        const r = Store.createPro({ name: $("#p-name", d).value.trim(), type: $("#p-type", d).value, city: $("#p-city", d).value.trim(), contact: $("#p-contact", d).value.trim(), email: $("#p-email", d).value, phone: req ? req.phone : "", referredBy: parseRef($("#p-ref", d).value) });
        if (req) Store.closeRequest(req.id, "approved");
        closeModal(d); render(); credModal(`Account created: ${r.pro.name}`, r.pro.email, r.tempPassword);
      } catch (err) { $("#perr", d).innerHTML = `<div class="alert alert--bad">${esc(err.message)}</div>`; }
    });
  }

  function editAmbDialog(a) {
    const S = s().settings;
    const d = modal(`<form class="stack" id="eform"><h2 class="card__title">${esc(a.name)}</h2><p class="small">Code ${esc(a.code)} · ${esc(a.email)}</p>
      <div class="form-grid">
        <div class="field"><label class="label" for="e-pct">Commission % (blank = ${S.commission.pct}%)</label><input class="input" id="e-pct" type="number" step="0.1" min="0" value="${a.pct == null ? "" : a.pct}"></div>
        <div class="field"><label class="label" for="e-months">Months (blank = ${S.commission.months})</label><input class="input" id="e-months" type="number" min="1" value="${a.months == null ? "" : a.months}"></div>
        <div class="field full"><label class="label" for="e-iban">IBAN</label><input class="input" id="e-iban" value="${esc(a.iban || "")}"></div>
      </div><p class="hint">A new rate applies to commissions computed from now on, for every month shown in statements.</p>
      <div class="row"><button class="btn btn--sm" type="submit">Save</button><button class="btn btn--sm btn--ghost" type="button" id="ecancel">Cancel</button></div></form>`);
    $("#ecancel", d).addEventListener("click", () => closeModal(d));
    $("#eform", d).addEventListener("submit", (e) => {
      e.preventDefault();
      const v = (id) => $("#" + id, d).value;
      a.pct = v("e-pct") === "" ? null : Number(v("e-pct")); a.months = v("e-months") === "" ? null : Number(v("e-months")); a.iban = v("e-iban").trim();
      Store.save(); closeModal(d); render(); Common.toast("Ambassador updated.");
    });
  }
  function ambDialog(req) {
    const S = s().settings;
    const d = modal(`<form class="stack" id="aform"><h2 class="card__title">${req ? "Approve ambassador" : "New ambassador"}</h2>
      <div class="form-grid">
        <div class="field"><label class="label" for="am-name">Name</label><input class="input" id="am-name" required value="${esc(req ? req.name : "")}"></div>
        <div class="field"><label class="label" for="am-email">Email (username)</label><input class="input" id="am-email" type="email" required value="${esc(req ? req.email : "")}"></div>
        <div class="field"><label class="label" for="am-pct">Commission % (blank = ${S.commission.pct}%)</label><input class="input" id="am-pct" type="number" step="0.1" min="0"></div>
        <div class="field"><label class="label" for="am-months">Months (blank = ${S.commission.months})</label><input class="input" id="am-months" type="number" min="1"></div>
        <div class="field full"><label class="label" for="am-iban">IBAN</label><input class="input" id="am-iban"></div>
      </div><div id="aerr"></div><div class="row"><button class="btn btn--sm" type="submit">Create account</button><button class="btn btn--sm btn--ghost" type="button" id="acancel">Cancel</button></div></form>`);
    $("#acancel", d).addEventListener("click", () => closeModal(d));
    $("#aform", d).addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        const r = Store.createAmbassador({ name: $("#am-name", d).value.trim(), email: $("#am-email", d).value, pct: $("#am-pct", d).value, months: $("#am-months", d).value, iban: $("#am-iban", d).value.trim() });
        if (req) Store.closeRequest(req.id, "approved");
        closeModal(d); render(); credModal(`Ambassador created: ${r.amb.name} (${r.amb.code})`, r.amb.email, r.tempPassword);
      } catch (err) { $("#aerr", d).innerHTML = `<div class="alert alert--bad">${esc(err.message)}</div>`; }
    });
  }

  /* ---------- pros ---------- */
  function prosTab() {
    if (proId) return proDetail();
    shell(`<div class="row" style="justify-content:space-between"><div><p class="label">Pro accounts</p><h1 class="display h2">Venues</h1></div><button class="btn btn--sm" id="newpro">New pro account</button></div>
      <div class="tablewrap"><table class="tbl"><thead><tr><th>Venue</th><th>City</th><th>Introduced by</th><th>Prices</th><th class="num">Orders</th><th class="num">Credit</th><th></th></tr></thead><tbody>
      ${s().pros.map((p) => `<tr><td>${esc(p.name)}<br><span class="small muted">${esc(p.type)} · ${esc(p.email)}</span> ${p.mustChange ? '<span class="badge badge--warn">temp password</span>' : ""}</td><td>${esc(p.city)}</td><td>${esc(Store.refLabel(p.referredBy))}</td><td>${(() => { const c = Store.conditionsOf(p.id); return c.negotiated ? `<span class="badge badge--warn">Negotiated</span><br><span class="small muted">${chf(c.sheet.flavors[0].boxPrice)} per box</span>` : `<span class="badge">List</span><br><span class="small muted">${chf(c.sheet.flavors[0].boxPrice)} per box</span>`; })()}</td><td class="num">${Store.ordersOfPro(p.id).length}</td><td class="num">${pct(Store.creditOf(p.id).available)}</td><td><button class="btn btn--sm btn--ghost" data-open="${p.id}">Open</button></td></tr>`).join("")}
      </tbody></table></div>`);
    $("#newpro").addEventListener("click", () => proDialog(null));
    $$("[data-open]").forEach((b) => b.addEventListener("click", () => { proId = b.dataset.open; render(); }));
  }

  const PRO_FIELDS = [{ name: "contact", label: "Contact name" }, { name: "phone", label: "Phone", type: "tel" }, { name: "address", label: "Delivery street and number", full: true }, { name: "zip", label: "Postcode" }, { name: "city", label: "City" }, { name: "billingAddress", label: "Billing address", full: true }, { name: "vat", label: "VAT number", full: true }];
  function proDetail() {
    const p = s().pros.find((x) => x.id === proId); const c = Store.creditOf(p.id);
    const orders = Store.ordersOfPro(p.id);
    const key = p.referredBy ? `${p.referredBy.kind}:${p.referredBy.id}` : "";
    const cond = Store.conditionsOf(p.id), S = s().settings;
    const bottle = (v) => `CHF ${v.toFixed(2)}`;
    const nextTxt = cond.next ? (cond.next.kind === "welcome" ? `Welcome offer −${cond.next.pct}% on the first confirmed order` : `Referral credit −${cond.next.pct}% on the next order`) : (cond.flags.extras ? "No welcome offer or credit pending" : "Welcome and credit switched off for this pro");
    shell(`<div><button class="link-quiet" id="back" type="button">← All pros</button><h1 class="display h2" style="margin-top:12px">${esc(p.name)}</h1><p>${esc(p.type)} · ${esc(p.city)} · ${esc(p.contact)} · ${esc(p.email)} · code <span class="paper">${esc(p.code)}</span></p></div>
      <div class="card stack"><p class="label">What this pro gets</p><table class="breakdown">
        <tr><td>Prices</td><td>${cond.negotiated ? "Negotiated" : "List"}: Lulo ${bottle(cond.unit.lulo)}, Guava ${bottle(cond.unit.guava)} per bottle</td></tr>
        <tr><td>Box of 12</td><td>${cond.sheet.flavors.map((f) => `${F[f.flavor].name} ${chf(f.boxPrice)}`).join(" · ")}</td></tr>
        <tr><td>Volume tiers</td><td>${cond.flags.tiers ? cond.sheet.tiers.map((t) => `${t.from}${t.to ? "-" + t.to : "+"} boxes: ${t.pct ? "−" + t.pct + "%" : "full price"}`).join(" · ") : "Do not apply"}</td></tr>
        <tr><td>Next order</td><td>${esc(nextTxt)}</td></tr>
        <tr><td>Referral credit</td><td>Earned ${pct(cond.credit.earned)} · used ${pct(cond.credit.used)} · available ${pct(cond.credit.available)} (max ${pct(S.referral.maxPerOrder)} per order)</td></tr>
        <tr><td>Best case per bottle</td><td>About CHF ${(cond.best.lulo).toFixed(3)} (base, top tier, full credit)</td></tr>
        <tr><td>Source</td><td>${esc(cond.source)}</td></tr></table></div>
      <form class="card stack" id="priceform"><p class="label">Prices for this pro (CHF per bottle, excl. VAT)</p>
        <div class="form-grid">
          <div class="field"><label class="label" for="pp-lulo">${F.lulo.name}</label><input class="input" id="pp-lulo" inputmode="decimal" placeholder="List ${S.proBottlePrice.toFixed(2)}" value="${p.prices.lulo == null ? "" : p.prices.lulo.toFixed(2)}"></div>
          <div class="field"><label class="label" for="pp-guava">${F.guava.name}</label><input class="input" id="pp-guava" inputmode="decimal" placeholder="List ${S.proBottlePrice.toFixed(2)}" value="${p.prices.guava == null ? "" : p.prices.guava.toFixed(2)}"></div>
          <div class="field full"><label class="label" for="pp-note">Reason</label><input class="input" id="pp-note" value="${esc(p.priceNote || "")}" placeholder="Why this price"></div>
        </div>
        <p class="hint" id="pp-box"></p>
        <label class="row small"><input type="checkbox" id="pp-tiers" ${cond.flags.tiers ? "checked" : ""}> Volume tiers apply</label>
        <label class="row small"><input type="checkbox" id="pp-extras" ${cond.flags.extras ? "checked" : ""}> Welcome offer and referral credit apply</label>
        <p class="hint">Leave a price blank for the list price. Floor CHF ${S.minBottlePrice.toFixed(2)}, ceiling CHF ${S.proBottlePrice.toFixed(2)}. A price change never changes existing orders.</p>
        <div class="row"><button class="btn btn--sm" type="submit">Save prices</button></div><div id="pp-msg"></div>
        ${(p.priceLog || []).length ? `<ul class="hist">${p.priceLog.slice().reverse().map((h) => `<li>${date(h.at)} · ${esc(h.by)} · Lulo ${h.from.lulo == null ? "list" : bottle(h.from.lulo)} → ${h.to.lulo == null ? "list" : bottle(h.to.lulo)}, Guava ${h.from.guava == null ? "list" : bottle(h.from.guava)} → ${h.to.guava == null ? "list" : bottle(h.to.guava)}${h.note ? " · " + esc(h.note) : ""}</li>`).join("")}</ul>` : ""}</form>
      <div class="card stack"><p class="label">Introduced by</p>
        <div class="row"><select class="input select" id="attr" style="max-width:360px">${refOptions(p.referredBy)}</select><button class="btn btn--sm" id="saveattr" type="button">Save</button></div>
        <p class="hint">Orders keep the source in force when they were created.</p>
        ${(p.attrHistory || []).length ? `<ul class="hist">${p.attrHistory.slice().reverse().map((h) => `<li>${date(h.at)} · ${esc(h.by)} · ${esc(h.from)} → ${esc(h.to)}</li>`).join("")}</ul>` : ""}</div>
      <div class="kpis"><div class="kpi"><span class="label">Credit earned</span><b>${pct(c.earned)}</b></div><div class="kpi"><span class="label">Used</span><b>${pct(c.used)}</b></div><div class="kpi"><span class="label">Available</span><b>${pct(c.available)}</b></div></div>
      ${c.refs.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Recommended pro</th><th>Status</th><th class="num">First paid order (boxes)</th></tr></thead><tbody>${c.refs.map((r) => `<tr><td>${esc(r.pro.name)}</td><td><span class="badge ${r.status === "qualified" ? "badge--ok" : r.status === "below" ? "badge--warn" : ""}">${r.status}</span></td><td class="num">${r.boxes || "—"}</td></tr>`).join("")}</tbody></table></div>` : ""}
      ${Auth.profileForm(p, PRO_FIELDS, "Company details")}<p class="label">Orders</p>${orders.length ? orderTable(orders, false) : '<div class="card">No orders.</div>'}
      <div class="row"><button class="btn btn--sm btn--ghost" id="reset-pw">Reset password</button><button class="btn btn--sm" id="neworder">New manual order</button></div>`);
    $("#back").addEventListener("click", () => { proId = null; render(); });
    $("#saveattr").addEventListener("click", () => { try { Store.setAttribution(p.id, parseRef($("#attr").value), admin.name); Common.toast("Attribution saved."); } catch (err) { Common.toast(err.message); } render(); });
    const drawBox = () => {
      const val = (id) => { const v = $("#" + id).value.trim(); return v === "" ? S.proBottlePrice : Number(v); };
      const l = val("pp-lulo"), g = val("pp-guava");
      $("#pp-box").textContent = `Box of 12: ${F.lulo.name} ${chf(l * S.bottlesPerBox)} · ${F.guava.name} ${chf(g * S.bottlesPerBox)}` + (l < S.proBottlePrice || g < S.proBottlePrice ? ` · saving ${(100 * (1 - Math.min(l, g) / S.proBottlePrice)).toFixed(1)}% on the list price` : "");
    };
    $$("#pp-lulo,#pp-guava").forEach((i) => i.addEventListener("input", drawBox)); drawBox();
    $("#priceform").addEventListener("submit", (e) => {
      e.preventDefault();
      try { Store.setProPrices(p.id, { lulo: $("#pp-lulo").value.trim(), guava: $("#pp-guava").value.trim(), tiers: $("#pp-tiers").checked, extras: $("#pp-extras").checked, note: $("#pp-note").value.trim() }, admin.name); Common.toast("Prices saved."); render(); }
      catch (err) { $("#pp-msg").innerHTML = `<div class="alert alert--bad">${esc(err.message)}</div>`; }
    });
    $("#reset-pw").addEventListener("click", () => { const pw = Store.resetPassword("pro", p.id); credModal(`Password reset: ${p.name}`, p.email, pw); });
    $("#neworder").addEventListener("click", () => orderDialog(p.id));
    Auth.bindPanels("pro", p, PRO_FIELDS);
    bindOrderButtons();
  }

  /* ---------- orders ---------- */
  function statusBadge(o) { return `<span class="badge ${o.status === "cancelled" ? "badge--bad" : o.status === "paid" || o.status === "delivered" ? "badge--ok" : ""}">${Store.STATUS_LABEL[o.status] || Store.CONSUMER_LABEL[o.status]}</span>`; }
  // carrier and tracking number, linked when the carrier has a public tracking page
  function trackCell(o) {
    const sh = o.shipping || {}; if (!sh.tracking && !sh.carrier) return '<span class="muted">-</span>';
    const url = Store.trackingUrl(sh.carrier, sh.tracking);
    return `${esc(sh.carrier || "")}<br><span class="small">${url ? `<a class="link-quiet" href="${esc(url)}" target="_blank" rel="noopener">${esc(sh.tracking)}</a>` : esc(sh.tracking || "no number yet")}</span>`;
  }
  const payCell = (o) => `${esc((o.payment || {}).method || "")}<br><span class="small muted">${o.paidAt ? "paid " + date(o.paidAt) : "not paid yet"}</span>`;
  function orderTable(list, withPro) {
    return `<div class="tablewrap"><table class="tbl"><thead><tr><th>Order</th><th>Date</th>${withPro ? "<th>Pro</th>" : ""}<th>Received</th><th>Boxes</th><th class="num">Net excl. VAT</th><th>Payment</th><th>Parcel</th><th>Ambassador</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map((o) => { const nx = Store.nextStatus(o); return `<tr><td>${esc(o.id)}${o.invoiceNo ? `<br><span class="small muted">${esc(o.invoiceNo)}</span>` : ""}</td><td>${date(o.createdAt)}</td>${withPro ? `<td>${esc(proName(o.proId))}</td>` : ""}<td>${esc(o.via || "")}${o.reference ? `<br><span class="small muted">${esc(o.reference)}</span>` : ""}</td><td>${o.boxes}</td><td class="num">${chf(o.net)}<br><span class="small muted">${o.tierPct ? `vol −${o.tierPct}% ` : ""}${o.welcomePct ? `welcome −${o.welcomePct}% ` : ""}${o.creditPct ? `credit −${o.creditPct}%` : ""}</span></td>
        <td>${payCell(o)}</td><td>${trackCell(o)}</td><td>${esc(ambName(o.ambassadorId))}</td><td>${statusBadge(o)}</td>
        <td class="row" style="gap:6px;flex-wrap:nowrap">${nx ? `<button class="btn btn--sm" data-adv="${o.id}">${nx === "invoiced" ? "Invoice sent" : nx === "paid" ? "Mark paid" : nx === "shipped" ? "Shipped" : "Delivered"}</button>` : ""}<button class="btn btn--sm btn--ghost" data-edit="${o.id}">Edit</button></td></tr>`; }).join("")}
      </tbody></table></div>`;
  }
  function bindOrderButtons() {
    $$("[data-adv]").forEach((b) => b.addEventListener("click", () => { Store.advanceOrder(b.dataset.adv); render(); }));
    $$("[data-edit]").forEach((b) => b.addEventListener("click", () => orderDialog(null, b.dataset.edit)));
  }
  function shopOrderTable(list) {
    return `<div class="tablewrap"><table class="tbl"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Deliver to</th><th>Boxes</th><th class="num">Total incl. VAT</th><th>Payment</th><th>Parcel</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map((o) => { const nx = Store.nextConsumerStatus(o); const st = o.shipTo || {}; return `<tr><td>${esc(o.id)}</td><td>${date(o.createdAt)}</td><td>${esc(o.name)}<br><span class="small muted">${esc(o.email)}${o.accountId ? "" : " · guest"}</span></td>
        <td class="small">${esc(st.address || "")}<br>${esc((st.zip || "") + " " + (st.city || ""))}</td><td>${o.boxes}</td><td class="num">${chf(o.net)}<br><span class="small muted">${o.welcomePct ? `first −${o.welcomePct}%` : ""}</span></td>
        <td>${payCell(o)}</td><td>${trackCell(o)}</td><td>${statusBadge(o)}</td>
        <td class="row" style="gap:6px;flex-wrap:nowrap">${nx ? `<button class="btn btn--sm" data-cadv="${o.id}">${nx === "paid" ? "Mark paid" : nx === "shipped" ? "Shipped" : "Delivered"}</button>` : ""}<button class="btn btn--sm btn--ghost" data-cedit="${o.id}">Edit</button></td></tr>`; }).join("")}
      </tbody></table></div>`;
  }
  function bindShopButtons() {
    $$("[data-cadv]").forEach((b) => b.addEventListener("click", () => { Store.advanceConsumerOrder(b.dataset.cadv); render(); }));
    $$("[data-cedit]").forEach((b) => b.addEventListener("click", () => shopOrderDialog(b.dataset.cedit)));
  }
  function ordersTab() {
    const list = s().orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const co = s().consumerOrders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    shell(`<div class="row" style="justify-content:space-between"><div><p class="label">Orders</p><h1 class="display h2">Pro orders</h1></div><div class="row"><button class="btn btn--sm btn--ghost" id="exp-orders">Export CSV</button><button class="btn btn--sm" id="neworder">New manual order</button></div></div>
      ${orderTable(list, true)}
      <div><p class="label">Shop</p><h2 class="display h2" style="font-size:40px">Consumer orders</h2></div>${co.length ? shopOrderTable(co) : '<div class="card">No shop orders yet.</div>'}`);
    $("#neworder").addEventListener("click", () => orderDialog(null));
    $("#exp-orders").addEventListener("click", exportOrders);
    bindOrderButtons(); bindShopButtons();
  }
  function download(name, rows) {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  }
  function exportOrders() {
    const rows = [["type", "order", "invoice", "date", "customer", "received_via", "boxes", "net_chf", "payment_method", "paid_on", "carrier", "tracking", "shipped_on", "delivered_on", "status", "ambassador"]];
    s().orders.forEach((o) => rows.push(["pro", o.id, o.invoiceNo, o.createdAt.slice(0, 10), proName(o.proId), o.via, o.boxes, o.net.toFixed(2), (o.payment || {}).method, (o.paidAt || "").slice(0, 10), (o.shipping || {}).carrier, (o.shipping || {}).tracking, (o.shippedAt || "").slice(0, 10), (o.deliveredAt || "").slice(0, 10), o.status, ambName(o.ambassadorId)]));
    s().consumerOrders.forEach((o) => rows.push(["shop", o.id, "", o.createdAt.slice(0, 10), o.email, "Website", o.boxes, o.net.toFixed(2), (o.payment || {}).method, (o.paidAt || "").slice(0, 10), (o.shipping || {}).carrier, (o.shipping || {}).tracking, (o.shippedAt || "").slice(0, 10), (o.deliveredAt || "").slice(0, 10), o.status, ""]));
    download("orders.csv", rows);
  }

  /* ---------- overview ---------- */
  function overviewTab() {
    const st = Store.stats();
    const recent = [
      ...s().orders.map((o) => ({ id: o.id, at: o.createdAt, who: proName(o.proId), kind: "Pro", boxes: o.boxes, net: o.net, status: Store.STATUS_LABEL[o.status] })),
      ...s().consumerOrders.map((o) => ({ id: o.id, at: o.createdAt, who: o.name, kind: "Shop", boxes: o.boxes, net: o.net, status: Store.CONSUMER_LABEL[o.status] })),
    ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
    const todo = [
      [st.openRequests, "access requests and applications to review", "requests"],
      [s().orders.filter((o) => o.status === "placed").length, "pro orders waiting for an invoice", "orders"],
      [s().orders.filter((o) => o.status === "invoiced").length, "invoices waiting for payment", "orders"],
      [s().consumerOrders.filter((o) => o.status === "placed").length, "shop orders waiting for payment", "orders"],
      [s().consumerOrders.filter((o) => o.status === "paid").length, "shop orders to ship", "orders"],
    ].filter((t) => t[0] > 0);
    shell(`<div><h1 class="display h2">Overview</h1></div>
      <div class="kpis"><div class="kpi"><span class="label">Pro revenue paid</span><b>${chf(st.proRevenue)}</b></div><div class="kpi"><span class="label">Shop revenue paid</span><b>${chf(st.shopRevenue)}</b></div>
        <div class="kpi"><span class="label">Boxes sold</span><b>${st.proBoxes + st.shopBoxes}</b></div><div class="kpi"><span class="label">Commissions to pay</span><b>${chf(st.commissionsOwed)}</b></div></div>
      <div class="kpis"><div class="kpi"><span class="label">Venues</span><b>${st.pros}</b></div><div class="kpi"><span class="label">Customers</span><b>${st.customers}</b></div><div class="kpi"><span class="label">Active ambassadors</span><b>${st.ambassadors}</b></div></div>
      <div class="card stack"><p class="label">To do</p>${todo.length ? todo.map((t) => `<p><button class="link-quiet" data-go="${t[2]}" type="button">${t[0]} ${t[1]}</button></p>`).join("") : "<p>Nothing waiting.</p>"}</div>
      <p class="label">Latest orders</p><div class="tablewrap"><table class="tbl"><thead><tr><th>Order</th><th>Date</th><th>Type</th><th>Customer</th><th>Boxes</th><th class="num">Net</th><th>Status</th></tr></thead><tbody>
      ${recent.map((o) => `<tr><td>${esc(o.id)}</td><td>${date(o.at)}</td><td>${o.kind}</td><td>${esc(o.who)}</td><td>${o.boxes}</td><td class="num">${chf(o.net)}</td><td>${esc(o.status)}</td></tr>`).join("")}</tbody></table></div>`);
    $$("[data-go]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.go; render(); }));
  }

  /* ---------- customers (individual accounts) ---------- */
  function customersTab() {
    if (custId) return customerDetail();
    const list = s().consumers;
    shell(`<div class="row" style="justify-content:space-between"><div><p class="label">Customers</p><h1 class="display h2">Accounts</h1></div><button class="btn btn--sm btn--ghost" id="exp-cust">Export CSV</button></div>
      ${list.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>City</th><th class="num">Orders</th><th class="num">Spent</th><th>Joined</th><th></th></tr></thead><tbody>
      ${list.map((c) => { const os = Store.consumerOrdersOf(c.id).filter((o) => o.status !== "cancelled"); return `<tr><td>${esc(c.name)}</td><td>${esc(c.email)}</td><td>${esc(c.city || "")}</td><td class="num">${os.length}</td><td class="num">${chf(os.reduce((n, o) => n + o.net, 0))}</td><td>${date(c.createdAt)}</td><td><button class="btn btn--sm btn--ghost" data-opencust="${c.id}">Open</button></td></tr>`; }).join("")}</tbody></table></div>` : '<div class="card">No customer accounts yet.</div>'}`);
    $("#exp-cust").addEventListener("click", () => download("customers.csv", [["name", "email", "phone", "address", "zip", "city", "joined"], ...list.map((c) => [c.name, c.email, c.phone, c.address, c.zip, c.city, c.createdAt.slice(0, 10)])]));
    $$("[data-opencust]").forEach((b) => b.addEventListener("click", () => { custId = b.dataset.opencust; render(); }));
  }
  function customerDetail() {
    const c = s().consumers.find((x) => x.id === custId); const os = Store.consumerOrdersOf(c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    shell(`<div><button class="link-quiet" id="back" type="button">← All customers</button><h1 class="display h2" style="margin-top:12px">${esc(c.name)}</h1><p>${esc(c.email)} · ${esc(c.phone || "no phone")}</p><p class="small">${esc(c.address || "")} ${esc(c.zip || "")} ${esc(c.city || "")}</p></div>
      ${os.length ? shopOrderTable(os) : '<div class="card">No orders.</div>'}
      <div class="row"><button class="btn btn--sm btn--ghost" id="reset-cust" type="button">Reset password</button></div>`);
    $("#back").addEventListener("click", () => { custId = null; render(); });
    $("#reset-cust").addEventListener("click", () => { const pw = Store.resetPassword("customer", c.id); credModal(`Password reset: ${c.name}`, c.email, pw); });
    bindShopButtons();
  }

  const dayVal = (iso) => (iso ? iso.slice(0, 10) : "");
  const optList = (list, cur) => list.map((x) => `<option ${x === cur ? "selected" : ""}>${esc(x)}</option>`).join("");
  const statusOf = (v) => (v.delivered ? "Delivered" : v.shipped ? "Shipped" : v.paid ? "Paid" : v.invoiced ? "Invoice sent" : "Placed");
  function changeLog(o) {
    return (o.editLog || []).length ? `<div class="stack"><p class="label">Change log</p><ul class="hist">${o.editLog.slice().reverse().map((e) => `<li>${date(e.at)} · ${esc(e.by)} · ${e.changes.map(esc).join("; ")}</li>`).join("")}</ul></div>` : "";
  }
  /* New manual order (visit, email, phone) and edit of an existing order share one form. */
  function orderDialog(preId, orderId) {
    const ex = orderId ? s().orders.find((o) => o.id === orderId) : null;
    const today = new Date().toISOString().slice(0, 10);
    const pro0 = ex ? s().pros.find((p) => p.id === ex.proId) : (s().pros.find((p) => p.id === preId) || s().pros[0]);
    const qtyOf = (k) => (ex ? (ex.lines.find((l) => l.flavor === k) || { boxes: 0 }).boxes : 0);
    const sh = ex ? ex.shipping : { carrier: "", tracking: "", address: pro0.address, zip: pro0.zip, city: pro0.city };
    const pay = ex ? ex.payment : { method: "Bank transfer", reference: "" };
    const d = modal(`<form class="stack" id="oform"><h2 class="card__title">${ex ? "Edit order " + esc(ex.id) : "New manual order"}</h2>
      <p class="small">${ex ? "Fix a mistake or complete the file. Every change is logged." : "A visit, an email, a phone call. Record everything about the deal."}</p>
      <p class="label">Customer and order</p>
      <div class="form-grid">
        <div class="field full"><label class="label" for="o-pro">Pro</label><select class="input select" id="o-pro" ${ex ? "disabled" : ""}>${s().pros.map((p) => `<option value="${p.id}" ${p.id === pro0.id ? "selected" : ""}>${esc(p.name)} · ${esc(p.city)}</option>`).join("")}</select></div>
        <div class="field"><label class="label" for="o-date">Order date</label><input class="input" type="date" id="o-date" value="${dayVal(ex ? ex.createdAt : today)}" required></div>
        <div class="field"><label class="label" for="o-via">Received</label><select class="input select" id="o-via">${optList(Store.VIA_OPTIONS, ex ? ex.via : "In person visit")}</select></div>
        <div class="field full"><label class="label" for="o-ref">Their reference (optional)</label><input class="input" id="o-ref" value="${esc(ex ? ex.reference : "")}" placeholder="Purchase order number, name of the person"></div>
      </div>
      <p class="label">Items</p>
      <div class="form-grid">${Object.keys(F).map((k) => `<div class="field"><label class="label" for="o-${k}">${F[k].name} (boxes)</label><input class="input" id="o-${k}" type="number" min="0" value="${qtyOf(k)}"></div>`).join("")}</div>
      <table class="breakdown" id="obd"></table>
      <p class="label">Payment and invoice</p>
      <div class="form-grid">
        <div class="field"><label class="label" for="o-pm">Payment method</label><select class="input select" id="o-pm">${optList(Store.PAYMENT_METHODS, pay.method)}</select></div>
        <div class="field"><label class="label" for="o-paid">Paid on (blank = not paid yet)</label><input class="input" type="date" id="o-paid" value="${dayVal(ex ? ex.paidAt : "")}"></div>
        <div class="field"><label class="label" for="o-inv">Invoice number</label><input class="input" id="o-inv" value="${esc(ex ? ex.invoiceNo : "")}" placeholder="INV-2026-0000"></div>
        <div class="field"><label class="label" for="o-invd">Invoice sent on</label><input class="input" type="date" id="o-invd" value="${dayVal(ex ? ex.invoicedAt : "")}"></div>
        <div class="field full"><label class="label" for="o-payref">Payment reference (optional)</label><input class="input" id="o-payref" value="${esc(pay.reference || "")}" placeholder="Transfer reference, receipt number"></div>
      </div>
      <p class="label">Delivery</p>
      <div class="form-grid">
        <div class="field full"><label class="label" for="o-addr">Street and number</label><input class="input" id="o-addr" value="${esc(sh.address || "")}"></div>
        <div class="field"><label class="label" for="o-zip">Postcode</label><input class="input" id="o-zip" value="${esc(sh.zip || "")}"></div>
        <div class="field"><label class="label" for="o-city">City</label><input class="input" id="o-city" value="${esc(sh.city || "")}"></div>
        <div class="field"><label class="label" for="o-car">Carrier</label><select class="input select" id="o-car"><option value="">None yet</option>${optList(Store.CARRIERS, sh.carrier)}</select></div>
        <div class="field"><label class="label" for="o-trk">Tracking number</label><input class="input" id="o-trk" value="${esc(sh.tracking || "")}"></div>
        <div class="field"><label class="label" for="o-ship">Shipped on</label><input class="input" type="date" id="o-ship" value="${dayVal(ex ? ex.shippedAt : "")}"></div>
        <div class="field"><label class="label" for="o-deliv">Delivered on</label><input class="input" type="date" id="o-deliv" value="${dayVal(ex ? ex.deliveredAt : "")}"></div>
      </div>
      <div class="field"><label class="label" for="o-note">Internal note</label><textarea class="input" id="o-note" rows="2">${esc(ex ? ex.note : "")}</textarea></div>
      ${ex ? `<label class="row small"><input type="checkbox" id="o-cancelled" ${ex.cancelledAt ? "checked" : ""}> This order is cancelled</label>` : ""}
      <p class="hint" id="o-status"></p><div id="oerr"></div>
      <div class="row"><button class="btn btn--sm" type="submit">${ex ? "Save changes" : "Create order"}</button><button class="btn btn--sm btn--ghost" type="button" id="ocancel">Close</button></div>
      ${ex ? changeLog(ex) : ""}</form>`);
    d.classList.add("wide");
    const val = (id) => $("#" + id, d).value;
    const linesNow = () => Object.keys(F).map((k) => ({ flavor: k, boxes: parseInt(val("o-" + k)) || 0 })).filter((l) => l.boxes > 0);
    const draw = () => {
      const pid = val("o-pro"), lines = linesNow(), pro = s().pros.find((x) => x.id === pid);
      const p = ex ? window.Engine.priceProOrder({ lines, unitPrices: ex.unitPrices, settings: s().settings, isFirst: ex.welcomePct > 0, creditAvailablePct: ex.creditPct, flags: ex.flags }) : Store.previewProOrder(pid, lines);
      $("#obd", d).innerHTML = p.boxes ? p.lines.map((r) => `<tr><td>${r.boxes} × ${F[r.flavor].name} at ${chf(r.boxPrice)} per box (CHF ${r.unit.toFixed(2)} per bottle)</td><td>${chf(r.amount)}</td></tr>`).join("") +
        (p.tierPct ? `<tr class="neg"><td>Volume −${pct(p.tierPct)}</td><td>−${chf(p.tierAmount)}</td></tr>` : "") +
        (p.welcomePct ? `<tr class="neg"><td>Welcome −${pct(p.welcomePct)}</td><td>−${chf(p.extraAmount)}</td></tr>` : "") +
        (p.creditPct ? `<tr class="neg"><td>Referral credit −${pct(p.creditPct)}</td><td>−${chf(p.extraAmount)}</td></tr>` : "") +
        `<tr class="total"><td>Net excl. VAT</td><td>${chf(p.net)}</td></tr><tr><td class="small">Source</td><td class="small">${esc(Store.refLabel(pro.referredBy))}</td></tr>` : '<tr><td class="muted">Enter boxes</td><td></td></tr>';
      $("#o-status", d).textContent = "Status will be: " + statusOf({ invoiced: val("o-invd"), paid: val("o-paid"), shipped: val("o-ship"), delivered: val("o-deliv") }) + (val("o-paid") ? ". The commission month follows the paid date." : ".");
    };
    $$("input,select,textarea", d).forEach((i) => i.addEventListener("input", draw)); draw();
    if (!ex) $("#o-pro", d).addEventListener("change", () => { const pr = s().pros.find((x) => x.id === val("o-pro")); $("#o-addr", d).value = pr.address || ""; $("#o-zip", d).value = pr.zip || ""; $("#o-city", d).value = pr.city || ""; });
    $("#ocancel", d).addEventListener("click", () => closeModal(d));
    $("#oform", d).addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        if (ex) {
          Store.updateOrder(ex.id, { createdAt: val("o-date"), via: val("o-via"), reference: val("o-ref"), invoiceNo: val("o-inv"), invoicedAt: val("o-invd"), paidAt: val("o-paid"), shippedAt: val("o-ship"), deliveredAt: val("o-deliv"), note: val("o-note"),
            "payment.method": val("o-pm"), "payment.reference": val("o-payref"), "shipping.carrier": val("o-car"), "shipping.tracking": val("o-trk"), "shipping.address": val("o-addr"), "shipping.zip": val("o-zip"), "shipping.city": val("o-city"),
            lines: linesNow(), cancelled: $("#o-cancelled", d).checked }, admin.name);
          closeModal(d); render(); Common.toast(`Order ${ex.id} updated.`);
        } else {
          const o = Store.createManualOrder({ proId: val("o-pro"), lines: linesNow(), createdAt: val("o-date"), via: val("o-via"), reference: val("o-ref"), invoiceNo: val("o-inv"), invoicedAt: val("o-invd"), paymentMethod: val("o-pm"), paymentReference: val("o-payref"), paidAt: val("o-paid"),
            carrier: val("o-car"), tracking: val("o-trk"), address: val("o-addr"), zip: val("o-zip"), city: val("o-city"), shippedAt: val("o-ship"), deliveredAt: val("o-deliv"), note: val("o-note") }, admin.name);
          closeModal(d); render(); Common.toast(`Order ${o.id} created.`);
        }
      } catch (err) { $("#oerr", d).innerHTML = `<div class="alert alert--bad">${esc(err.message)}</div>`; }
    });
  }

  /* Edit a shop (consumer) order: payment, parcel, address, dates. */
  function shopOrderDialog(id) {
    const o = s().consumerOrders.find((x) => x.id === id), st = o.shipTo || {};
    const qtyOf = (k) => (o.lines.find((l) => l.flavor === k) || { boxes: 0 }).boxes;
    const d = modal(`<form class="stack" id="sform2"><h2 class="card__title">Edit order ${esc(o.id)}</h2><p class="small">${esc(o.name)} · ${esc(o.email)}${o.accountId ? "" : " · guest"}. Every change is logged.</p>
      <div class="form-grid">
        <div class="field"><label class="label" for="c-date">Order date</label><input class="input" type="date" id="c-date" value="${dayVal(o.createdAt)}" required></div>
        <div class="field"><label class="label" for="c-pm">Payment method</label><select class="input select" id="c-pm">${optList(Store.PAYMENT_METHODS, o.payment.method)}</select></div>
        ${Object.keys(F).map((k) => `<div class="field"><label class="label" for="c-${k}">${F[k].name} (boxes)</label><input class="input" id="c-${k}" type="number" min="0" value="${qtyOf(k)}"></div>`).join("")}
        <div class="field"><label class="label" for="c-paid">Paid on</label><input class="input" type="date" id="c-paid" value="${dayVal(o.paidAt)}"></div>
        <div class="field"><label class="label" for="c-payref">Payment reference</label><input class="input" id="c-payref" value="${esc(o.payment.reference || "")}"></div>
        <div class="field full"><label class="label" for="c-addr">Street and number</label><input class="input" id="c-addr" value="${esc(st.address || "")}"></div>
        <div class="field"><label class="label" for="c-zip">Postcode</label><input class="input" id="c-zip" value="${esc(st.zip || "")}"></div>
        <div class="field"><label class="label" for="c-city">City</label><input class="input" id="c-city" value="${esc(st.city || "")}"></div>
        <div class="field"><label class="label" for="c-car">Carrier</label><select class="input select" id="c-car"><option value="">None yet</option>${optList(Store.CARRIERS, o.shipping.carrier)}</select></div>
        <div class="field"><label class="label" for="c-trk">Tracking number</label><input class="input" id="c-trk" value="${esc(o.shipping.tracking || "")}"></div>
        <div class="field"><label class="label" for="c-ship">Shipped on</label><input class="input" type="date" id="c-ship" value="${dayVal(o.shippedAt)}"></div>
        <div class="field"><label class="label" for="c-deliv">Delivered on</label><input class="input" type="date" id="c-deliv" value="${dayVal(o.deliveredAt)}"></div>
        <div class="field full"><label class="label" for="c-note">Internal note</label><textarea class="input" id="c-note" rows="2">${esc(o.note || "")}</textarea></div>
      </div>
      <label class="row small"><input type="checkbox" id="c-cancelled" ${o.cancelledAt ? "checked" : ""}> This order is cancelled</label><div id="cerr"></div>
      <div class="row"><button class="btn btn--sm" type="submit">Save changes</button><button class="btn btn--sm btn--ghost" type="button" id="cclose">Close</button></div>${changeLog(o)}</form>`);
    d.classList.add("wide");
    const val = (x) => $("#" + x, d).value;
    $("#cclose", d).addEventListener("click", () => closeModal(d));
    $("#sform2", d).addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        Store.updateConsumerOrder(o.id, { createdAt: val("c-date"), paidAt: val("c-paid"), shippedAt: val("c-ship"), deliveredAt: val("c-deliv"), note: val("c-note"), "payment.method": val("c-pm"), "payment.reference": val("c-payref"),
          "shipping.carrier": val("c-car"), "shipping.tracking": val("c-trk"), "shipTo.address": val("c-addr"), "shipTo.zip": val("c-zip"), "shipTo.city": val("c-city"),
          lines: Object.keys(F).map((k) => ({ flavor: k, boxes: parseInt(val("c-" + k)) || 0 })), cancelled: $("#c-cancelled", d).checked }, admin.name);
        closeModal(d); render(); Common.toast(`Order ${o.id} updated.`);
      } catch (err) { $("#cerr", d).innerHTML = `<div class="alert alert--bad">${esc(err.message)}</div>`; }
    });
  }

  /* ---------- ambassadors ---------- */
  function ambassadorsTab() {
    const S = s().settings;
    shell(`<div class="row" style="justify-content:space-between"><div><p class="label">Ambassadors</p><h1 class="display h2">Introducers</h1></div><button class="btn btn--sm" id="newamb">New ambassador</button></div>
      <div class="tablewrap"><table class="tbl"><thead><tr><th>Name</th><th>Code</th><th>Rate</th><th>Duration</th><th class="num">Venues</th><th>Status</th><th></th></tr></thead><tbody>
      ${s().ambassadors.map((a) => { const v = Store.ambassadorView(a.id); return `<tr><td>${esc(a.name)}<br><span class="small muted">${esc(a.email)}${a.iban ? " · " + esc(a.iban) : ""}</span> ${a.mustChange ? '<span class="badge badge--warn">temp password</span>' : ""}</td><td>${esc(a.code)}</td><td>${pct(a.pct == null ? S.commission.pct : a.pct)}${a.pct == null ? ' <span class="small muted">default</span>' : ""}</td><td>${a.months == null ? S.commission.months : a.months} months</td><td class="num">${v.venues.length}</td><td><span class="badge ${a.active ? "badge--ok" : "badge--bad"}">${a.active ? "Active" : "Inactive"}</span></td>
        <td class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn btn--sm btn--ghost" data-toggle="${a.id}">${a.active ? "Deactivate" : "Activate"}</button><button class="btn btn--sm btn--ghost" data-editamb="${a.id}">Edit</button><button class="btn btn--sm btn--ghost" data-resetamb="${a.id}">Reset password</button></td></tr>`; }).join("")}
      </tbody></table></div>`);
    $("#newamb").addEventListener("click", () => ambDialog(null));
    $$("[data-toggle]").forEach((b) => b.addEventListener("click", () => { const a = s().ambassadors.find((x) => x.id === b.dataset.toggle); a.active = !a.active; Store.save(); render(); }));
    $$("[data-editamb]").forEach((b) => b.addEventListener("click", () => editAmbDialog(s().ambassadors.find((x) => x.id === b.dataset.editamb))));
    $$("[data-resetamb]").forEach((b) => b.addEventListener("click", () => { const a = s().ambassadors.find((x) => x.id === b.dataset.resetamb); credModal(`Password reset: ${a.name}`, a.email, Store.resetPassword("ambassador", a.id)); }));
  }

  /* ---------- commissions ---------- */
  function monthData(m) {
    return s().ambassadors.map((a) => {
      const v = Store.ambassadorView(a.id), st = v.statements.find((x) => x.month === m);
      return { a, st };
    }).filter((x) => x.st);
  }
  function commissionsTab() {
    const all = [...new Set(s().ambassadors.flatMap((a) => Store.ledger(a.id).lines.map((l) => l.month)))].sort().reverse();
    if (!month || !all.includes(month)) month = all[0] || null;
    const rows = month ? monthData(month) : [];
    shell(`<div class="row" style="justify-content:space-between"><div><p class="label">Commissions</p><h1 class="display h2">${month ? Common.monthHtml(month) : "No commission yet"}</h1></div>
      <div class="row">${all.length ? `<select class="input select" id="month">${all.map((m) => `<option value="${m}" ${m === month ? "selected" : ""}>${monthLabel(m)}</option>`).join("")}</select><button class="btn btn--sm btn--ghost" id="csv">Export CSV</button>` : ""}</div></div>
      ${rows.length ? rows.map(({ a, st }) => `<div class="card stack"><div class="row" style="justify-content:space-between"><h2 class="card__title">${esc(a.name)}</h2><div class="row"><span class="badge ${st.paidOut ? "badge--ok" : "badge--warn"}">${st.paidOut ? "Paid out" : "To pay"}</span>
        <a class="btn btn--sm btn--ghost" href="statement.html?amb=${a.id}&month=${month}">Statement</a><button class="btn btn--sm ${st.paidOut ? "btn--ghost" : ""}" data-pay="${a.id}" data-paid="${st.paidOut ? 1 : 0}">${st.paidOut ? "Undo" : "Mark paid"}</button></div></div>
        <p class="small">${esc(a.iban || "No IBAN on file")}</p>
        <table class="tbl" style="min-width:0"><thead><tr><th>Venue</th><th class="num">Commissionable revenue</th><th class="num">Commission</th></tr></thead><tbody>${st.venues.map((v) => `<tr><td>${esc(v.name)}</td><td class="num">${chf(v.base)}</td><td class="num">${chf(v.amount)}</td></tr>`).join("")}<tr class="sub"><td>Total</td><td class="num">${chf(st.base)}</td><td class="num">${chf(st.total)}</td></tr></tbody></table></div>`).join("") : '<div class="card">No lines for this month.</div>'}`);
    if (all.length) {
      $("#month").addEventListener("change", (e) => { month = e.target.value; render(); });
      $("#csv").addEventListener("click", () => exportCsv(month));
    }
    $$("[data-pay]").forEach((b) => b.addEventListener("click", () => { b.dataset.paid === "1" ? Store.unmarkPaidOut(b.dataset.pay, month) : Store.markPaidOut(b.dataset.pay, month); render(); }));
  }
  function exportCsv(m) {
    const lines = [["month", "ambassador", "code", "venue", "commissionable_revenue_chf", "commission_chf", "status"]];
    monthData(m).forEach(({ a, st }) => st.venues.forEach((v) => lines.push([m, a.name, a.code, v.name, v.base.toFixed(2), v.amount.toFixed(2), st.paidOut ? "paid" : "to pay"])));
    const csv = lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `commissions-${m}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  /* ---------- settings ---------- */
  function settingsTab() {
    const S = s().settings, n = (id, label, v, step) => `<div class="field"><label class="label" for="${id}">${label}</label><input class="input" id="${id}" type="number" step="${step || 1}" min="0" value="${v}"></div>`;
    shell(`<div><p class="label">Settings</p><h1 class="display h2">Numbers</h1></div>
      <form class="stack" id="sform"><div class="card stack"><p class="label">Prices</p><div class="form-grid">${n("s-retail", "Retail price per box (VAT incl.)", S.retailPrice, 0.05)}${n("s-pro", "Pro list price per bottle (excl. VAT)", S.proBottlePrice.toFixed(2), 0.01)}${n("s-floor", "Price floor per bottle (negotiated base)", S.minBottlePrice.toFixed(2), 0.01)}${n("s-vat", "VAT %", S.vatPct, 0.1)}</div><p class="hint">Pro list price per box: ${chf(S.proBottlePrice * S.bottlesPerBox)} (12 bottles).</p></div>
      <div class="card stack"><p class="label">Welcome offers (first order)</p><div class="form-grid">${n("s-cw", "Consumer %", S.consumerWelcomePct)}${n("s-pw", "Pro %", S.proWelcomePct)}</div></div>
      <div class="card stack"><p class="label">Pro volume tiers (per order, whole order)</p><div class="form-grid">${n("s-t1m", "Tier 1 from (boxes)", S.tiers[0].min)}${n("s-t1p", "Tier 1 discount %", S.tiers[0].pct)}${n("s-t2m", "Tier 2 from (boxes)", S.tiers[1].min)}${n("s-t2p", "Tier 2 discount %", S.tiers[1].pct)}</div></div>
      <div class="card stack"><p class="label">Pro referral</p><div class="form-grid">${n("s-rp", "Credit per referral %", S.referral.pctPer)}${n("s-rm", "Max used per order %", S.referral.maxPerOrder)}${n("s-rb", "Min boxes on referred pro's first order", S.referral.minBoxes)}</div></div>
      <div class="card stack"><p class="label">Ambassador commission (defaults)</p><div class="form-grid">${n("s-cp", "Rate %", S.commission.pct, 0.1)}${n("s-cm", "Duration (months)", S.commission.months)}</div></div>
      <div class="row"><button class="btn" type="submit">Save settings</button></div><div id="serr"></div></form>`);
    $("#sform").addEventListener("submit", (e) => {
      e.preventDefault(); const v = (id) => Number($("#" + id).value);
      if (v("s-t2m") <= v("s-t1m")) { $("#serr").innerHTML = '<div class="alert alert--bad">Tier 2 must start above tier 1.</div>'; return; }
      const next = { ...S, retailPrice: v("s-retail"), proBottlePrice: v("s-pro"), minBottlePrice: v("s-floor"), vatPct: v("s-vat"), consumerWelcomePct: v("s-cw"), proWelcomePct: v("s-pw"),
        tiers: [{ min: v("s-t1m"), pct: v("s-t1p") }, { min: v("s-t2m"), pct: v("s-t2p") }],
        referral: { pctPer: v("s-rp"), maxPerOrder: v("s-rm"), minBoxes: v("s-rb") }, commission: { pct: v("s-cp"), months: v("s-cm") } };
      if (next.minBottlePrice > next.proBottlePrice) { $("#serr").innerHTML = '<div class="alert alert--bad">The floor cannot be above the list price.</div>'; return; }
      const inv = window.Engine.checkPriceInvariant(next);
      if (!inv.ok) { $("#serr").innerHTML = `<div class="alert alert--bad">The pro list box price (${chf(inv.box)}) must stay below the consumer first-order price excl. VAT (${chf(inv.limit)}).</div>`; return; }
      const conflicts = Store.priceConflicts(next);
      if (conflicts.length) { $("#serr").innerHTML = `<div class="alert alert--bad">These pros have a negotiated price outside the new floor or list price: ${esc(conflicts.join(", "))}. Fix their prices first.</div>`; return; }
      Store.updateSettings(next);
      Common.toast("Settings saved."); render();
    });
  }

  function render() { ({ overview: overviewTab, customers: customersTab, requests: requestsTab, pros: prosTab, orders: ordersTab, ambassadors: ambassadorsTab, commissions: commissionsTab, settings: settingsTab })[tab](); }
  document.addEventListener("proto:changed", () => { if (!document.querySelector("dialog")) render(); });
  render();
});
