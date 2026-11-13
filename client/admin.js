/* MALACONDA PROTOTYPE — Founders admin */
Auth.gate("admin", "Founders admin", "", function (admin) {
  const { esc, chf, pct, date, monthLabel, $, $$ } = Common;
  const F = Store.FLAVORS, E = window.Engine;
  let tab = "overview", proId = null, custId = null, month = null, reqFilter = "all", ordTab = "shop", ordF = "todo", ordQ = "";
  const TABS = [["overview", "Overview"], ["requests", "Inbox"], ["customers", "Customers"], ["pros", "Pro accounts"], ["orders", "Orders"], ["ambassadors", "Ambassadors"], ["commissions", "Commissions"], ["settings", "Settings"]];

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
  const rowsBox = (items) => `<div class="orows">${items.join("")}</div>`;
  const dot = (...a) => a.filter(Boolean).join(" · ");
  const orow = ({ main, sub, meta, metaSub, more, act }) => `<div class="orow"><div class="orow__main">${main}${sub ? `<span class="small muted">${sub}</span>` : ""}</div><div class="orow__meta">${meta || ""}${metaSub ? `<span class="small muted">${metaSub}</span>` : ""}</div><div class="orow__act">${act || ""}</div>${more ? `<div class="orow__more small muted">${more}</div>` : ""}</div>`;
  const parseRef = (v) => { if (!v) return null; const [kind, id] = v.split(":"); return { kind, id, text: "" }; };

  function shell(inner) {
    const open = s().requests.filter((r) => r.status === "open").length;
    document.getElementById("app").innerHTML = `<div class="block app"><nav class="side" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${k === tab}">${l}${k === "requests" && open ? `<span class="count">${open}</span>` : ""}</button>`).join("")}</nav><div class="stack" id="panel">${inner}</div></div>`;
    $$("[data-tab]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; proId = null; custId = null; render(); }));
  }

  /* ---------- requests ---------- */
  function requestsTab() {
    const FILTERS = [["all", "All"], ["pro", "Pro access"], ["ambassador", "Ambassadors"], ["message", "Messages"]];
    const inFilter = (r) => reqFilter === "all" || r.kind === reqFilter;
    const open = s().requests.filter((r) => r.status === "open" && inFilter(r));
    const done = s().requests.filter((r) => r.status !== "open" && inFilter(r));
    const countOf = (k) => s().requests.filter((r) => r.status === "open" && (k === "all" || r.kind === k)).length;
    const card = (r) => {
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
    shell(`<div><p class="label">Inbox</p><h1 class="display h2">Applications and messages</h1><p class="small muted">Forms filled in by visitors: pro access requests, ambassador applications and contact messages. Pros order and pay on the site themselves.</p></div>
      <div class="row">${FILTERS.map(([k, l]) => `<button class="btn btn--sm ${reqFilter === k ? "" : "btn--ghost"}" data-filter="${k}" type="button">${l}${countOf(k) ? " · " + countOf(k) : ""}</button>`).join("")}</div>${open.length ? open.map(card).join("") : '<div class="card">Nothing to review.</div>'}
      ${done.length ? `<p class="label">Closed</p>${rowsBox(done.map((r) => orow({ main: `<span class="orow__id"><b>${esc(r.business || r.name || proName(r.proId))}</b><span class="badge ${r.status === "approved" || r.status === "handled" ? "badge--ok" : "badge--bad"}">${r.status}</span></span>`, sub: r.kind === "pro" ? "Pro access" : r.kind === "ambassador" ? "Ambassador application" : "Message" })))}` : ""}`);
    $$("[data-filter]").forEach((b) => b.addEventListener("click", () => { reqFilter = b.dataset.filter; render(); }));
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
      ${rowsBox(s().pros.map((p) => { const c = Store.conditionsOf(p.id);
        return orow({ main: `<span class="orow__id"><b>${esc(p.name)}</b><span class="badge ${c.negotiated ? "badge--warn" : ""}">${c.negotiated ? "Negotiated prices" : "List prices"}</span>${p.mustChange ? '<span class="badge badge--warn">temp password</span>' : ""}</span>`, sub: dot(esc(p.type), esc(p.city), esc(p.email), "introduced by " + esc(Store.refLabel(p.referredBy))),
          meta: `<b>${chf(c.sheet.flavors[0].boxPrice)}</b> per box`, metaSub: dot(`${Store.ordersOfPro(p.id).length} orders`, `credit ${pct(Store.creditOf(p.id).available)}`), act: `<button class="btn btn--sm" data-open="${p.id}">Open</button>` }); }))}`);
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
        <tr><td>Box of ${S.proBottlesPerBox}</td><td>${cond.sheet.flavors.map((f) => `${F[f.flavor].name} ${chf(f.boxPrice)}`).join(" · ")}</td></tr>
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
      ${c.refs.length ? rowsBox(c.refs.map((r) => orow({ main: `<span class="orow__id"><b>${esc(r.pro.name)}</b><span class="badge ${r.status === "qualified" ? "badge--ok" : r.status === "below" ? "badge--warn" : ""}">${r.status}</span></span>`, meta: r.boxes ? `<b>${r.boxes}</b> boxes` : "No paid order yet", metaSub: "first paid order" }))) : ""}
      ${Auth.profileForm(p, PRO_FIELDS, "Company details")}<p class="label">Orders</p>${orders.length ? orderTable(orders, false) : '<div class="card">No orders.</div>'}
      <div class="row"><button class="btn btn--sm btn--ghost" id="reset-pw">Reset password</button><button class="btn btn--sm" id="neworder">New manual order</button></div>`);
    $("#back").addEventListener("click", () => { proId = null; render(); });
    $("#saveattr").addEventListener("click", () => { try { Store.setAttribution(p.id, parseRef($("#attr").value), admin.name); Common.toast("Attribution saved."); } catch (err) { Common.toast(err.message); } render(); });
    const drawBox = () => {
      const val = (id) => { const v = $("#" + id).value.trim(); return v === "" ? S.proBottlePrice : Number(v); };
      const l = val("pp-lulo"), g = val("pp-guava");
      $("#pp-box").textContent = `Box of ${S.proBottlesPerBox}: ${F.lulo.name} ${chf(l * S.proBottlesPerBox)} · ${F.guava.name} ${chf(g * S.proBottlesPerBox)}` + (l < S.proBottlePrice || g < S.proBottlePrice ? ` · saving ${(100 * (1 - Math.min(l, g) / S.proBottlePrice)).toFixed(1)}% on the list price` : "");
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
  const carrierInput = (id, val) => `<input class="input" id="${id}" list="${id}-list" value="${esc(val || "")}" placeholder="Type it: Swiss Post, DHL..." autocomplete="off"><datalist id="${id}-list">${Store.CARRIERS.map((c) => `<option value="${esc(c)}">`).join("")}</datalist>`;
  const noTrkBox = (id, on) => `<label class="row small"><input type="checkbox" id="${id}" ${on ? "checked" : ""}> No tracking number (standard post, nothing to follow)</label>`;
  function wireTracking(d, carId, trkId, boxId) {
    const car = $("#" + carId, d), trk = $("#" + trkId, d), box = $("#" + boxId, d);
    const sync = () => { if (/^own delivery$/i.test(car.value.trim())) box.checked = true; trk.disabled = box.checked; if (box.checked) trk.value = ""; };
    car.addEventListener("input", sync); box.addEventListener("change", sync); sync();
  }
  const trackTxt = (o) => { const sh = o.shipping || {}; if (!sh.tracking && !sh.carrier) return "No parcel yet"; return `${esc(sh.carrier || "Parcel")} ${sh.tracking ? `<a class="link-quiet" href="${esc(Store.trackingUrl(sh.carrier, sh.tracking, "en"))}" target="_blank" rel="noopener">${esc(sh.tracking)}</a>` : sh.noTracking ? "(no tracking number)" : "(no number yet)"}`; };
  const payTxt = (o) => `${esc((o.payment || {}).method || "Payment")} · ${o.paidAt ? "paid " + date(o.paidAt) : "not paid yet"}`;
  const STEP = { invoiced: "Mark invoice sent", paid: "Mark as paid", shipped: "Mark as shipped", delivered: "Mark as delivered" };
  // a website order is marked paid by the card payment itself: no hand button, only a note
  const stepBtn = (kind, o, nx, attr) => (!nx ? "" : nx === "paid" && Store.isWebOrder(kind, o) ? '<span class="small muted">Waiting for the card payment</span>' : `<button class="btn btn--sm" ${attr}="${o.id}">${kind === "shop" && o.delivery === "pickup" && nx === "delivered" ? "Mark as collected" : STEP[nx]}</button>`);
  const proLink = (id) => `<button class="link-quiet" data-gopro="${id}" type="button">${esc(proName(id))}</button>`;
  function orderTable(list, withPro) {
    return rowsBox(list.map((o) => { const nx = Store.nextStatus(o);
      return orow({ main: `<span class="orow__id"><b>${esc(o.id)}</b>${statusBadge(o)}</span>${withPro ? `<span>${proLink(o.proId)}</span>` : ""}`, sub: dot(date(o.createdAt), esc(o.invoiceNo || ""), esc(o.via || ""), esc(o.reference || "")),
        meta: `<b>${chf(o.net)}</b> excl. VAT`, metaSub: dot(`${o.boxes} boxes`, o.tierPct ? `volume −${o.tierPct}%` : "", o.welcomePct ? `welcome −${o.welcomePct}%` : "", o.creditPct ? `credit −${o.creditPct}%` : ""),
        more: dot(payTxt(o), trackTxt(o), o.ambassadorId ? "ambassador " + esc(ambName(o.ambassadorId)) : ""),
        act: `${stepBtn("pro", o, nx, "data-adv")}<button class="btn btn--sm btn--ghost" data-edit="${o.id}">${Store.isWebOrder("pro", o) ? "Details" : "Edit"}</button>` }); }));
  }
  /* ---------- one step forward on an order: asks for what the step needs, then confirms ---------- */
  const todayDay = () => new Date().toISOString().slice(0, 10);
  function stepDialog(kind, id) {
    const pro = kind === "pro", o = (pro ? s().orders : s().consumerOrders).find((x) => x.id === id); if (!o) return;
    const step = pro ? Store.nextStatus(o) : Store.nextConsumerStatus(o); if (!step) return;
    const owner = pro ? s().pros.find((p) => p.id === o.proId) || {} : null;
    const email = pro ? owner.email || "" : o.email, who = pro ? proName(o.proId) : o.name;
    const a = pro ? o.shipping || {} : o.shipTo || {};
    const addr = dot(a.address, ((a.zip || "") + " " + (a.city || "")).trim());
    const contents = o.lines.map((l) => `${l.boxes} × ${F[l.flavor].name}`).join(", ");
    const money = pro ? `${chf(o.net)} excl. VAT, ${chf(o.net * (1 + s().settings.vatPct / 100))} with ${s().settings.vatPct}% VAT` : `${chf(o.net)} incl. VAT`;
    const head = (title, intro) => `<h2 class="card__title">${esc(title)}</h2><p class="small">${esc(o.id)} · ${esc(who)} · ${o.boxes} boxes</p>${intro ? `<p>${intro}</p>` : ""}`;
    const dateField = (idp, label, val) => `<div class="field"><label class="label" for="${idp}">${label}</label><input class="input" type="date" id="${idp}" value="${val || todayDay()}" max="${todayDay()}"></div>`;
    const d = modal('<div class="stack" id="stepbox"></div>'); d.classList.add("wide"); const box = $("#stepbox", d);
    const fail = (e) => { $("#sterr", d).innerHTML = `<div class="alert alert--bad">${esc(e.message)}</div>`; };
    const done = (msg) => { closeModal(d); render(); Common.toast(msg); };
    const v = (x) => $("#" + x, d).value.trim();
    const buttons = (go, label) => `<div id="sterr"></div><div class="row"><button class="btn btn--sm" type="button" id="${go}">${label}</button><button class="btn btn--sm btn--ghost" type="button" id="stx">Cancel</button></div>`;
    const cancel = () => $("#stx", d).addEventListener("click", () => closeModal(d));

    if (step === "invoiced") {
      box.innerHTML = head("Invoice sent", `Record that the invoice for this order went to ${esc(email || "the pro")}. Nothing is emailed from here.`) +
        `<div class="form-grid"><div class="field"><label class="label" for="st-inv">Invoice number</label><input class="input" id="st-inv" value="${esc(o.invoiceNo || "")}" placeholder="INV-2026-0000"></div>${dateField("st-at", "Sent on")}</div>
         <p class="hint">Amount invoiced: ${money}.</p>` + buttons("stgo", "Confirm invoice sent");
      cancel(); $("#stgo", d).addEventListener("click", () => { try { Store.progress(kind, id, "invoiced", { invoiceNo: v("st-inv"), at: v("st-at") }, admin.name); done(`Invoice recorded for ${o.id}.`); } catch (e) { fail(e); } });
    } else if (step === "paid") {
      box.innerHTML = head("Mark as paid", pro ? `Use this when the money has reached the bank account. Check the amount received: <b class="paper">${money}</b>.` : "Card payments are marked paid by Stripe on their own. Use this only if the money arrived another way.") +
        `<div class="form-grid"><div class="field"><label class="label" for="st-m">Paid by</label><select class="input select" id="st-m">${optList(Store.PAYMENT_METHODS, pro ? "Bank transfer" : (o.payment || {}).method)}</select></div>${dateField("st-at", "Money received on")}
         <div class="field full"><label class="label" for="st-ref">Payment reference (optional)</label><input class="input" id="st-ref" placeholder="Transfer reference, receipt number"></div></div>` + buttons("stgo", "Confirm payment received");
      cancel(); $("#stgo", d).addEventListener("click", () => { try { Store.progress(kind, id, "paid", { method: v("st-m"), reference: v("st-ref"), at: v("st-at") }, admin.name); done(`${o.id} marked as paid.`); } catch (e) { fail(e); } });
    } else if (step === "shipped") {
      const form = (val) => {
        box.innerHTML = head("Ship this order", `The customer receives an email with the carrier and a link to follow the parcel. You check everything on the next screen before it goes.`) +
          `<div class="form-grid"><div class="field"><label class="label" for="st-car">Carrier</label>${carrierInput("st-car", val.carrier)}</div>
           <div class="field"><label class="label" for="st-trk">Tracking number</label><input class="input" id="st-trk" value="${esc(val.tracking)}" autocomplete="off" placeholder="From the parcel label"></div>${dateField("st-at", "Shipped on", val.at)}</div>
           ${noTrkBox("st-no", val.noTracking)}
           <p class="small muted">Delivering to ${esc(addr || "no address on file")}</p><p class="hint">Copy the number exactly from the label: the customer follows the parcel with it and it cannot be fixed once the email is sent.</p>` + buttons("stgo", "Review the email");
        wireTracking(d, "st-car", "st-trk", "st-no"); cancel();
        $("#stgo", d).addEventListener("click", () => { try { const c = Store.checkShipping(v("st-car"), v("st-trk"), $("#st-no", d).checked); review({ ...c, at: v("st-at") }); } catch (e) { fail(e); } });
      };
      const review = (x) => {
        const url = Store.trackingUrl(x.carrier, x.tracking, "fr");
        box.innerHTML = head("Check before sending", "Is everything right? The customer will read this.") +
          `<table class="breakdown review"><tr><td>Email to</td><td>${esc(email)}</td></tr><tr><td>Subject</td><td>Votre commande ${esc(o.id)} est en route</td></tr><tr><td>Carrier</td><td>${esc(x.carrier)}</td></tr>
           <tr><td>Tracking number</td><td>${x.tracking ? `<b class="paper" style="font-size:18px">${esc(x.tracking)}</b>` : "None: the email shows the carrier only"}</td></tr>
           <tr><td>Tracking link</td><td>${url ? `<a class="link-quiet" href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a><br><span class="small muted">Open it to check it finds the parcel.</span>` : "None"}</td></tr>
           <tr><td>Delivering to</td><td>${esc(addr)}</td></tr><tr><td>Contents</td><td>${esc(contents)}</td></tr><tr><td>Shipped on</td><td>${esc(x.at)}</td></tr></table>
           <p class="hint">Prototype: orders live in this browser, so the email is shown here but not sent yet. It goes out for real once orders are stored in the database.</p>
           <div id="sterr"></div><div class="row"><button class="btn btn--sm" type="button" id="stgo">Confirm and email ${esc(email)}</button><button class="btn btn--sm btn--ghost" type="button" id="stback">Back and edit</button></div>`;
        $("#stback", d).addEventListener("click", () => form(x));
        $("#stgo", d).addEventListener("click", () => { try { Store.progress(kind, id, "shipped", { ...x, email }, admin.name); done(`${o.id} marked as shipped.`); } catch (e) { fail(e); } });
      };
      form({ carrier: (o.shipping || {}).carrier || "", tracking: (o.shipping || {}).tracking || "", noTracking: !!(o.shipping || {}).noTracking, at: todayDay() });
    } else if (kind === "shop" && o.delivery === "pickup") {
      box.innerHTML = head("Mark as collected", "Confirm only when the customer has collected the order. This closes the order.") +
        `<table class="breakdown review"><tr><td>Paid on</td><td>${esc(dayVal(o.paidAt))}</td></tr><tr><td>Contents</td><td>${esc(contents)}</td></tr></table>
         <div class="form-grid">${dateField("st-at", "Collected on")}</div><p class="hint">Free pickup: nothing is shipped and no email is sent for this step.</p>` + buttons("stgo", "Confirm collected");
      cancel(); $("#stgo", d).addEventListener("click", () => { try { Store.progress(kind, id, "delivered", { at: v("st-at") }, admin.name); done(`${o.id} marked as collected.`); } catch (e) { fail(e); } });
    } else {
      const sh = o.shipping || {}, url = Store.trackingUrl(sh.carrier, sh.tracking, "en");
      box.innerHTML = head("Mark as delivered", "Confirm only when the customer has the parcel. This closes the order.") +
        `<table class="breakdown review"><tr><td>Parcel</td><td>${esc(sh.carrier || "")} ${url ? `<a class="link-quiet" href="${esc(url)}" target="_blank" rel="noopener">${esc(sh.tracking)}</a>` : "(no tracking number)"}</td></tr><tr><td>Shipped on</td><td>${esc(dayVal(o.shippedAt))}</td></tr><tr><td>Delivered to</td><td>${esc(addr)}</td></tr></table>
         <div class="form-grid">${dateField("st-at", "Received on")}</div><p class="hint">No email is sent for this step.</p>` + buttons("stgo", "Confirm delivered");
      cancel(); $("#stgo", d).addEventListener("click", () => { try { Store.progress(kind, id, "delivered", { at: v("st-at") }, admin.name); done(`${o.id} marked as delivered.`); } catch (e) { fail(e); } });
    }
  }

  function bindOrderButtons() {
    $$("[data-adv]").forEach((b) => b.addEventListener("click", () => stepDialog("pro", b.dataset.adv)));
    $$("[data-edit]").forEach((b) => b.addEventListener("click", () => (Store.isWebOrder("pro", s().orders.find((x) => x.id === b.dataset.edit)) ? webOrderDialog("pro", b.dataset.edit) : orderDialog(null, b.dataset.edit))));
    $$("[data-gopro]").forEach((b) => b.addEventListener("click", () => { tab = "pros"; proId = b.dataset.gopro; render(); }));
  }
  function shopOrderTable(list, hideWho) {
    return rowsBox(list.map((o) => { const nx = Store.nextConsumerStatus(o); const st = o.shipTo || {};
      return orow({ main: `<span class="orow__id"><b>${esc(o.id)}</b>${statusBadge(o)}</span>${hideWho ? "" : `<span>${o.accountId ? `<button class="link-quiet" data-gocust="${o.accountId}" type="button">${esc(o.name)}</button>` : esc(o.name)}</span>`}`, sub: hideWho ? date(o.createdAt) : dot(date(o.createdAt), esc(o.email), o.accountId ? "" : "guest"),
        meta: `<b>${chf(Store.consumerTotal(o))}</b> incl. VAT`, metaSub: dot(`${o.boxes} boxes`, o.welcomePct ? `first order −${o.welcomePct}%` : "", o.delivery === "pickup" ? "free pickup" : o.shippingFee ? `delivery ${chf(o.shippingFee)}` : ""),
        more: dot(payTxt(o), o.delivery === "pickup" ? "Pickup: to be collected" : trackTxt(o), o.delivery === "pickup" ? "" : "deliver to " + esc(dot(st.address, ((st.zip || "") + " " + (st.city || "")).trim()))),
        act: `${stepBtn("shop", o, nx, "data-cadv")}<button class="btn btn--sm btn--ghost" data-cedit="${o.id}">Details</button>` }); }));
  }
  function bindShopButtons() {
    $$("[data-cadv]").forEach((b) => b.addEventListener("click", () => stepDialog("shop", b.dataset.cadv)));
    $$("[data-cedit]").forEach((b) => b.addEventListener("click", () => webOrderDialog("shop", b.dataset.cedit)));
    $$("[data-gocust]").forEach((b) => b.addEventListener("click", () => { tab = "customers"; custId = b.dataset.gocust; render(); }));
  }
  function ordersTab() {
    const byDate = (a, b) => b.createdAt.localeCompare(a.createdAt);
    const sources = { shop: s().consumerOrders.slice().sort(byDate), pro: s().orders.slice().sort(byDate) };
    const todo = (o) => { const nx = ordTab === "pro" ? Store.nextStatus(o) : Store.nextConsumerStatus(o); return o.status !== "cancelled" && !!nx && !(nx === "paid" && Store.isWebOrder(ordTab, o)); };
    const who = (o) => (ordTab === "pro" ? proName(o.proId) : o.name + " " + o.email);
    const visible = () => sources[ordTab].filter((o) => (ordF === "all" || todo(o)) && (!ordQ || (o.id + " " + who(o)).toLowerCase().includes(ordQ.toLowerCase())));
    const inner = () => { const v = visible(); return v.length ? (ordTab === "pro" ? orderTable(v, true) : shopOrderTable(v)) : `<div class="card">${ordF === "todo" && !ordQ ? "Nothing to do on these orders." : "No order matches."}</div>`; };
    const n = (k) => sources[k].length;
    shell(`<div class="row" style="justify-content:space-between"><div><p class="label">Orders</p><h1 class="display h2">${ordTab === "pro" ? "Pro orders" : "Shop orders"}</h1></div><div class="row"><button class="btn btn--sm btn--ghost" id="exp-orders">Export CSV</button>${ordTab === "pro" ? '<button class="btn btn--sm" id="neworder">New manual order</button>' : ""}</div></div>
      <div class="row"><button class="btn btn--sm ${ordTab === "shop" ? "" : "btn--ghost"}" data-ot="shop" type="button">Shop · ${n("shop")}</button><button class="btn btn--sm ${ordTab === "pro" ? "" : "btn--ghost"}" data-ot="pro" type="button">Pros · ${n("pro")}</button>
        <span class="orow__gap"></span><button class="btn btn--sm ${ordF === "todo" ? "" : "btn--ghost"}" data-of="todo" type="button">To do</button><button class="btn btn--sm ${ordF === "all" ? "" : "btn--ghost"}" data-of="all" type="button">All</button>
        <input class="input" id="oq" type="search" placeholder="Search name, email, order" value="${esc(ordQ)}" style="max-width:260px;margin-left:auto"></div>
      <div class="stack" id="olist">${inner()}</div>`);
    const nb = $("#neworder"); if (nb) nb.addEventListener("click", () => orderDialog(null));
    $("#exp-orders").addEventListener("click", exportOrders);
    $$("[data-ot]").forEach((b) => b.addEventListener("click", () => { ordTab = b.dataset.ot; render(); }));
    $$("[data-of]").forEach((b) => b.addEventListener("click", () => { ordF = b.dataset.of; render(); }));
    $("#oq").addEventListener("input", (e) => { ordQ = e.target.value; $("#olist").innerHTML = inner(); bindOrderButtons(); bindShopButtons(); });
    bindOrderButtons(); bindShopButtons();
  }
  function download(name, rows) {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  }
  function exportOrders() {
    const rows = [["type", "order", "invoice", "date", "customer", "received_via", "boxes", "net_chf", "payment_method", "paid_on", "carrier", "tracking", "shipped_on", "delivered_on", "status", "ambassador", "delivery", "delivery_fee_chf"]];
    s().orders.forEach((o) => rows.push(["pro", o.id, o.invoiceNo, o.createdAt.slice(0, 10), proName(o.proId), o.via, o.boxes, o.net.toFixed(2), (o.payment || {}).method, (o.paidAt || "").slice(0, 10), (o.shipping || {}).carrier, (o.shipping || {}).tracking, (o.shippedAt || "").slice(0, 10), (o.deliveredAt || "").slice(0, 10), o.status, ambName(o.ambassadorId), "ship", "0.00"]));
    s().consumerOrders.forEach((o) => rows.push(["shop", o.id, "", o.createdAt.slice(0, 10), o.email, "Website", o.boxes, o.net.toFixed(2), (o.payment || {}).method, (o.paidAt || "").slice(0, 10), (o.shipping || {}).carrier, (o.shipping || {}).tracking, (o.shippedAt || "").slice(0, 10), (o.deliveredAt || "").slice(0, 10), o.status, "", o.delivery || "ship", (o.shippingFee || 0).toFixed(2)]));
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
      [s().requests.filter((r) => r.status === "open").length, "applications and messages in the inbox", "requests"],
      [s().orders.filter((o) => o.status === "placed").length, "pro orders waiting for an invoice", "orders"],
      [s().orders.filter((o) => o.status === "invoiced").length, "invoices waiting for payment", "orders"],
      [s().consumerOrders.filter((o) => o.status === "placed").length, "shop orders waiting for payment", "orders"],
      [s().orders.filter((o) => o.status === "paid").length, "pro orders to ship", "orders"],
      [s().consumerOrders.filter((o) => o.status === "paid" && o.delivery !== "pickup").length, "shop orders to ship", "orders"],
      [s().consumerOrders.filter((o) => o.status === "paid" && o.delivery === "pickup").length, "shop pickups waiting to be collected", "orders"],
    ].filter((t) => t[0] > 0);
    shell(`<div><h1 class="display h2">Overview</h1></div>
      <div class="kpis"><div class="kpi"><span class="label">Pro revenue paid</span><b>${chf(st.proRevenue)}</b></div><div class="kpi"><span class="label">Shop revenue paid</span><b>${chf(st.shopRevenue)}</b></div>
        <div class="kpi"><span class="label">Boxes sold</span><b>${st.proBoxes + st.shopBoxes}</b></div><div class="kpi"><span class="label">Commissions to pay</span><b>${chf(st.commissionsOwed)}</b></div></div>
      <div class="kpis"><div class="kpi"><span class="label">Venues</span><b>${st.pros}</b></div><div class="kpi"><span class="label">Customers</span><b>${st.customers}</b></div><div class="kpi"><span class="label">Active ambassadors</span><b>${st.ambassadors}</b></div></div>
      <div class="card stack"><p class="label">To do</p>${todo.length ? todo.map((t) => `<p><button class="link-quiet" data-go="${t[2]}" type="button">${t[0]} ${t[1]}</button></p>`).join("") : "<p>Nothing waiting.</p>"}</div>
      <p class="label">Latest orders</p>${rowsBox(recent.map((o) => orow({ main: `<span class="orow__id"><b>${esc(o.id)}</b><span class="badge">${esc(o.status)}</span></span><span>${esc(o.who)}</span>`, sub: dot(o.kind + " order", date(o.at)), meta: `<b>${chf(o.net)}</b>`, metaSub: `${o.boxes} boxes` })))}`);
    $$("[data-go]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.go; render(); }));
  }

  /* ---------- customers (individual accounts) ---------- */
  function customersTab() {
    if (custId) return customerDetail();
    const list = s().consumers;
    shell(`<div class="row" style="justify-content:space-between"><div><p class="label">Customers</p><h1 class="display h2">Accounts</h1></div><button class="btn btn--sm btn--ghost" id="exp-cust">Export CSV</button></div>
      ${list.length ? rowsBox(list.map((c) => { const os = Store.consumerOrdersOf(c.id).filter((o) => o.status !== "cancelled"); return orow({ main: `<span class="orow__id"><b>${esc(c.name)}</b></span>`, sub: dot(esc(c.email), esc(c.city || ""), "joined " + date(c.createdAt)), meta: `<b>${chf(os.reduce((n, o) => n + o.net, 0))}</b> spent`, metaSub: `${os.length} order${os.length === 1 ? "" : "s"}`, act: `<button class="btn btn--sm" data-opencust="${c.id}">Open</button>` }); })) : '<div class="card">No customer accounts yet.</div>'}`);
    $("#exp-cust").addEventListener("click", () => download("customers.csv", [["name", "email", "phone", "address", "zip", "city", "joined"], ...list.map((c) => [c.name, c.email, c.phone, c.address, c.zip, c.city, c.createdAt.slice(0, 10)])]));
    $$("[data-opencust]").forEach((b) => b.addEventListener("click", () => { custId = b.dataset.opencust; render(); }));
  }
  function customerDetail() {
    const c = s().consumers.find((x) => x.id === custId); const os = Store.consumerOrdersOf(c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    shell(`<div><button class="link-quiet" id="back" type="button">← All customers</button><h1 class="display h2" style="margin-top:12px">${esc(c.name)}</h1><p>${esc(c.email)} · ${esc(c.phone || "no phone")}</p><p class="small">${esc(c.address || "")} ${esc(c.zip || "")} ${esc(c.city || "")}</p></div>
      <div class="kpis"><div class="kpi"><span class="label">Orders</span><b>${os.filter((o) => o.status !== "cancelled").length}</b></div><div class="kpi"><span class="label">Spent</span><b>${chf(os.filter((o) => o.status !== "cancelled").reduce((n, o) => n + o.net, 0))}</b></div><div class="kpi"><span class="label">Customer since</span><b>${date(c.createdAt)}</b></div></div>
      <p class="label">Orders</p>${os.length ? shopOrderTable(os, true) : '<div class="card">No orders.</div>'}
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
        <div class="field"><label class="label" for="o-car">Carrier</label>${carrierInput("o-car", sh.carrier)}</div>
        <div class="field"><label class="label" for="o-trk">Tracking number</label><input class="input" id="o-trk" value="${esc(sh.tracking || "")}"></div>
        <div class="field full">${noTrkBox("o-no", sh.noTracking)}</div>
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
    wireTracking(d, "o-car", "o-trk", "o-no");
    const linesNow = () => Object.keys(F).map((k) => ({ flavor: k, boxes: parseInt(val("o-" + k)) || 0 })).filter((l) => l.boxes > 0);
    const draw = () => {
      const pid = val("o-pro"), lines = linesNow(), pro = s().pros.find((x) => x.id === pid);
      const p = ex ? window.Engine.priceProOrder({ lines, unitPrices: ex.unitPrices, settings: s().settings, isFirst: ex.welcomePct > 0, creditAvailablePct: ex.creditPct, flags: ex.flags }) : Store.previewProOrder(pid, lines);
      $("#obd", d).innerHTML = p.boxes ? p.lines.map((r) => `<tr><td>${r.boxes} × ${F[r.flavor].name} at ${chf(r.boxPrice)} per box (CHF ${r.unit.toFixed(2)} per bottle)</td><td>${chf(r.amount)}</td></tr>`).join("") +
        (p.tierPct ? `<tr class="neg"><td>Volume −${pct(p.tierPct)}</td><td>−${chf(p.tierAmount)}</td></tr>` : "") +
        (p.welcomePct ? `<tr class="neg"><td>Welcome −${pct(p.welcomePct)}</td><td>−${chf(p.extraAmount)}</td></tr>` : "") +
        (p.creditPct ? `<tr class="neg"><td>Referral credit −${pct(p.creditPct)}</td><td>−${chf(p.extraAmount)}</td></tr>` : "") +
        `<tr class="total"><td>Net excl. VAT</td><td>${chf(p.net)}</td></tr><tr><td class="small">Source</td><td class="small">${esc(Store.refLabel(pro.referredBy))}</td></tr>` : '<tr><td class="muted">Enter boxes</td><td></td></tr>';
      const moq = p.boxes ? window.Engine.proMoqMessage(p.boxes, s().settings) : null;
      $("#o-status", d).textContent = (moq ? moq + " Allowed here, for a deal agreed directly. " : "") + "Status will be: " + statusOf({ invoiced: val("o-invd"), paid: val("o-paid"), shipped: val("o-ship"), delivered: val("o-deliv") }) + (val("o-paid") ? ". The commission month follows the paid date." : ".");
    };
    $$("input,select,textarea", d).forEach((i) => i.addEventListener("input", draw)); draw();
    if (!ex) $("#o-pro", d).addEventListener("change", () => { const pr = s().pros.find((x) => x.id === val("o-pro")); $("#o-addr", d).value = pr.address || ""; $("#o-zip", d).value = pr.zip || ""; $("#o-city", d).value = pr.city || ""; });
    $("#ocancel", d).addEventListener("click", () => closeModal(d));
    $("#oform", d).addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        if (ex) {
          Store.updateOrder(ex.id, { createdAt: val("o-date"), via: val("o-via"), reference: val("o-ref"), invoiceNo: val("o-inv"), invoicedAt: val("o-invd"), paidAt: val("o-paid"), shippedAt: val("o-ship"), deliveredAt: val("o-deliv"), note: val("o-note"),
            "payment.method": val("o-pm"), "payment.reference": val("o-payref"), "shipping.carrier": val("o-car"), "shipping.tracking": val("o-trk"), "shipping.noTracking": $("#o-no", d).checked, "shipping.address": val("o-addr"), "shipping.zip": val("o-zip"), "shipping.city": val("o-city"),
            lines: linesNow(), cancelled: $("#o-cancelled", d).checked }, admin.name);
          closeModal(d); render(); Common.toast(`Order ${ex.id} updated.`);
        } else {
          const o = Store.createManualOrder({ proId: val("o-pro"), lines: linesNow(), createdAt: val("o-date"), via: val("o-via"), reference: val("o-ref"), invoiceNo: val("o-inv"), invoicedAt: val("o-invd"), paymentMethod: val("o-pm"), paymentReference: val("o-payref"), paidAt: val("o-paid"),
            carrier: val("o-car"), tracking: val("o-trk"), noTracking: $("#o-no", d).checked, address: val("o-addr"), zip: val("o-zip"), city: val("o-city"), shippedAt: val("o-ship"), deliveredAt: val("o-deliv"), note: val("o-note") }, admin.name);
          closeModal(d); render(); Common.toast(`Order ${o.id} created.`);
        }
      } catch (err) { $("#oerr", d).innerHTML = `<div class="alert alert--bad">${esc(err.message)}</div>`; }
    });
  }

  /* An order placed on the website is what the customer paid: items, amounts, dates and payment are locked.
     Only the delivery address (until it ships), the parcel details and the note can change. */
  function webOrderDialog(kind, id) {
    const pro = kind === "pro", o = (pro ? s().orders : s().consumerOrders).find((x) => x.id === id); if (!o) return;
    const email = pro ? (s().pros.find((p) => p.id === o.proId) || {}).email || "" : o.email, who = pro ? proName(o.proId) : o.name;
    const grp = pro ? "shipping" : "shipTo", a = o[grp] || {}, sh = o.shipping || {}, shipped = !!o.shippedAt, pay = o.payment || {};
    const addrF = (idp, label, val, full) => `<div class="field ${full ? "full" : ""}"><label class="label" for="${idp}">${label}</label><input class="input" id="${idp}" value="${esc(val || "")}" ${shipped ? "disabled" : ""}></div>`;
    const dateF = (idp, label, iso) => `<div class="field"><label class="label" for="${idp}">${label}</label><input class="input" type="date" id="${idp}" value="${dayVal(iso)}" max="${todayDay()}"></div>`;
    const d = modal(`<form class="stack" id="wform"><h2 class="card__title">Order ${esc(o.id)}</h2>
      <p class="small">${esc(who)} · ${esc(email)}</p>
      <table class="breakdown review"><tr><td>Status</td><td>${statusBadge(o)}</td></tr><tr><td>Placed on</td><td>${date(o.createdAt)}, on the website</td></tr>
        <tr><td>Items</td><td>${esc(o.lines.map((l) => `${l.boxes} × ${F[l.flavor].name}`).join(", "))}</td></tr>
        <tr><td>Amount</td><td>${chf(pro ? o.net : Store.consumerTotal(o))} ${pro ? "excl. VAT" : "incl. VAT"}${o.welcomePct ? ` (welcome −${o.welcomePct}%)` : ""}${o.tierPct ? ` (volume −${o.tierPct}%)` : ""}</td></tr>
        ${pro ? "" : `<tr><td>Delivery</td><td>${o.delivery === "pickup" ? "Free pickup" : o.shippingFee ? "Delivery, " + chf(o.shippingFee) : "Delivery, free"}</td></tr>`}
        <tr><td>Payment</td><td>${esc(pay.method || "")}${pay.reference ? " · " + esc(pay.reference) : ""} · ${o.paidAt ? "paid " + date(o.paidAt) : "not paid yet"}</td></tr></table>
      <p class="hint">Items, amounts and payment cannot be changed: this is exactly what the customer paid.</p>
      ${!pro && o.delivery === "pickup" ? '<p class="hint">Free pickup: there is no delivery address.</p>' : `<p class="label">Delivery address</p>
      <div class="form-grid">${addrF("w-addr", "Street and number", a.address, true)}${addrF("w-zip", "Postcode", a.zip)}${addrF("w-city", "City", a.city)}</div>
      <p class="hint">${shipped ? "Already shipped: the address is locked." : "Correct a typo or a change the customer asked for. It is logged."}</p>`}
      ${shipped ? `<p class="label">Parcel</p><div class="form-grid"><div class="field"><label class="label" for="w-car">Carrier</label>${carrierInput("w-car", sh.carrier)}</div>
        <div class="field"><label class="label" for="w-trk">Tracking number</label><input class="input" id="w-trk" value="${esc(sh.tracking || "")}" autocomplete="off"></div>
        <div class="field full">${noTrkBox("w-no", sh.noTracking)}</div>${dateF("w-ship", "Shipped on", o.shippedAt)}${o.deliveredAt ? dateF("w-deliv", "Delivered on", o.deliveredAt) : ""}</div>
        <p class="hint">Correct a mistake only. The customer is not emailed again.</p>` : ""}
      <div class="field"><label class="label" for="w-note">Internal note</label><textarea class="input" id="w-note" rows="2">${esc(o.note || "")}</textarea></div>
      ${o.cancelledAt ? "" : o.paidAt ? '<p class="hint">Cancelling a paid card order needs a card refund, which is not available yet.</p>' : '<label class="row small"><input type="checkbox" id="w-cancel"> Cancel this order (the payment was never completed)</label>'}
      <div id="werr"></div><div class="row"><button class="btn btn--sm" type="submit">Save changes</button><button class="btn btn--sm btn--ghost" type="button" id="wclose">Close</button></div>${changeLog(o)}</form>`);
    d.classList.add("wide");
    const val = (x) => $("#" + x, d).value.trim();
    if (shipped) wireTracking(d, "w-car", "w-trk", "w-no");
    $("#wclose", d).addEventListener("click", () => closeModal(d));
    $("#wform", d).addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        const patch = { note: $("#w-note", d).value };
        if (!shipped && $("#w-addr", d)) { patch[grp + ".address"] = val("w-addr"); patch[grp + ".zip"] = val("w-zip"); patch[grp + ".city"] = val("w-city"); }
        else {
          if (!val("w-ship")) throw new Error("Enter the shipping date.");
          if (val("w-ship") > todayDay() || (o.deliveredAt && val("w-deliv") > todayDay())) throw new Error("A date cannot be in the future.");
          if (o.deliveredAt && val("w-deliv") < val("w-ship")) throw new Error("The delivery date cannot be before the shipping date.");
          patch["shipping.carrier"] = val("w-car"); patch["shipping.tracking"] = $("#w-no", d).checked ? "" : val("w-trk"); patch["shipping.noTracking"] = $("#w-no", d).checked; patch.shippedAt = val("w-ship");
          if (o.deliveredAt) patch.deliveredAt = val("w-deliv");
        }
        if ($("#w-cancel", d)) patch.cancelled = $("#w-cancel", d).checked;
        (pro ? Store.updateOrder : Store.updateConsumerOrder)(o.id, patch, admin.name);
        closeModal(d); render(); Common.toast(`Order ${o.id} updated.`);
      } catch (err) { $("#werr", d).innerHTML = `<div class="alert alert--bad">${esc(err.message)}</div>`; }
    });
  }

  /* ---------- ambassadors ---------- */
  function ambassadorsTab() {
    const S = s().settings;
    shell(`<div class="row" style="justify-content:space-between"><div><p class="label">Ambassadors</p><h1 class="display h2">Introducers</h1></div><button class="btn btn--sm" id="newamb">New ambassador</button></div>
      ${rowsBox(s().ambassadors.map((a) => { const v = Store.ambassadorView(a.id); return orow({ main: `<span class="orow__id"><b>${esc(a.name)}</b><span class="badge ${a.active ? "badge--ok" : "badge--bad"}">${a.active ? "Active" : "Inactive"}</span>${a.mustChange ? '<span class="badge badge--warn">temp password</span>' : ""}</span>`, sub: dot(esc(a.email), a.iban ? esc(a.iban) : "no IBAN"),
        meta: `<b>${pct(a.pct == null ? S.commission.pct : a.pct)}</b> for ${a.months == null ? S.commission.months : a.months} months`, metaSub: dot(`code ${esc(a.code)}`, `${v.venues.length} venues`),
        act: `<button class="btn btn--sm btn--ghost" data-toggle="${a.id}">${a.active ? "Deactivate" : "Activate"}</button><button class="btn btn--sm btn--ghost" data-editamb="${a.id}">Edit</button><button class="btn btn--sm btn--ghost" data-resetamb="${a.id}">Reset password</button>` }); }))}`);
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
      <form class="stack" id="sform"><div class="card stack"><p class="label">Prices</p><div class="form-grid">${n("s-retail", "Retail price per box (VAT incl.)", S.retailPrice, 0.05)}${n("s-pro", "Pro list price per bottle (excl. VAT)", S.proBottlePrice.toFixed(2), 0.01)}${n("s-floor", "Price floor per bottle (negotiated base)", S.minBottlePrice.toFixed(2), 0.01)}${n("s-vat", "VAT %", S.vatPct, 0.1)}${n("s-pbox", "Bottles in a pro box", S.proBottlesPerBox)}${n("s-moq", "Pro minimum order (boxes)", S.proMinBoxes)}</div><p class="hint">Shop box: ${S.bottlesPerBox} bottles, ${chf(S.retailPrice / S.bottlesPerBox)} per bottle. Pro list price per box: ${chf(S.proBottlePrice * S.proBottlesPerBox)} (${S.proBottlesPerBox} bottles).</p></div>
      <div class="card stack"><p class="label">Shop delivery</p><div class="form-grid">${n("s-ship", "Delivery fee (VAT incl.)", S.shippingFee.toFixed(2), 0.05)}</div><label class="row small"><input type="checkbox" id="s-pickup" ${S.pickupEnabled ? "checked" : ""}> Offer free pickup at checkout</label><p class="hint">The founders have not confirmed the delivery fee yet: change it here once it is set.</p></div>
      <div class="card stack"><p class="label">Welcome offers (first order)</p><div class="form-grid">${n("s-cw", "Consumer %", S.consumerWelcomePct)}${n("s-pw", "Pro %", S.proWelcomePct)}</div></div>
      <div class="card stack"><p class="label">Pro volume tiers (per order, whole order)</p><div class="form-grid">${n("s-t1m", "Tier 1 from (boxes)", S.tiers[0].min)}${n("s-t1p", "Tier 1 discount %", S.tiers[0].pct)}${n("s-t2m", "Tier 2 from (boxes)", S.tiers[1].min)}${n("s-t2p", "Tier 2 discount %", S.tiers[1].pct)}</div></div>
      <div class="card stack"><p class="label">Pro referral</p><div class="form-grid">${n("s-rp", "Credit per referral %", S.referral.pctPer)}${n("s-rm", "Max used per order %", S.referral.maxPerOrder)}${n("s-rb", "Min boxes on referred pro's first order", S.referral.minBoxes)}</div></div>
      <div class="card stack"><p class="label">Ambassador commission (defaults)</p><div class="form-grid">${n("s-cp", "Rate %", S.commission.pct, 0.1)}${n("s-cm", "Duration (months)", S.commission.months)}</div></div>
      <div class="row"><button class="btn" type="submit">Save settings</button></div><div id="serr"></div></form>`);
    $("#sform").addEventListener("submit", (e) => {
      e.preventDefault(); const v = (id) => Number($("#" + id).value);
      if (v("s-t1m") <= v("s-moq")) { $("#serr").innerHTML = '<div class="alert alert--bad">Tier 1 must start above the pro minimum order.</div>'; return; }
      if (v("s-t2m") <= v("s-t1m")) { $("#serr").innerHTML = '<div class="alert alert--bad">Tier 2 must start above tier 1.</div>'; return; }
      const next = { ...S, retailPrice: v("s-retail"), proBottlePrice: v("s-pro"), minBottlePrice: v("s-floor"), vatPct: v("s-vat"), proBottlesPerBox: v("s-pbox"), proMinBoxes: v("s-moq"), shippingFee: v("s-ship"), pickupEnabled: $("#s-pickup").checked, consumerWelcomePct: v("s-cw"), proWelcomePct: v("s-pw"),
        tiers: [{ min: v("s-t1m"), pct: v("s-t1p") }, { min: v("s-t2m"), pct: v("s-t2p") }],
        referral: { pctPer: v("s-rp"), maxPerOrder: v("s-rm"), minBoxes: v("s-rb") }, commission: { pct: v("s-cp"), months: v("s-cm") } };
      if (next.minBottlePrice > next.proBottlePrice) { $("#serr").innerHTML = '<div class="alert alert--bad">The floor cannot be above the list price.</div>'; return; }
      const inv = window.Engine.checkPriceInvariant(next);
      if (!inv.ok) { $("#serr").innerHTML = `<div class="alert alert--bad">The pro list price per bottle (CHF ${inv.bottle.toFixed(2)}) must stay below the consumer first-order price per bottle excl. VAT (CHF ${inv.limit.toFixed(2)}).</div>`; return; }
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
