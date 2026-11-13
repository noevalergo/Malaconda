/* =============================================================
   MALACONDA PROTOTYPE — Fictional data store (browser localStorage)
   No backend. Passwords are stored in clear: demo only.
   ============================================================= */
(function () {
  const E = window.Engine;
  const KEY = "malaconda_proto_v1";
  const FLAVORS = {
    lulo: { name: "Biting Lulo", no: "02", color: "var(--lulo)" },
    guava: { name: "Sweet Guava", no: "03", color: "var(--guava)" },
  };
  const PRO_TYPES = ["Bar", "Restaurant", "Club", "Hotel", "Shop", "Distributor"];
  const STATUS_FLOW = ["placed", "invoiced", "paid", "shipped", "delivered"];
  const PAYMENT_METHODS = ["Bank transfer", "Cash", "Card in person", "Card (online)", "Other"];
  const VIA_OPTIONS = ["In person visit", "Email", "Phone", "Website", "Website request", "Other"];
  const CARRIERS = ["Swiss Post", "DHL", "UPS", "DPD", "Own delivery", "Other"];
  /* One public tracker for every carrier: the customer lands on the page of their parcel, in their language. */
  function trackingUrl(carrier, number, lang) {
    const n = encodeURIComponent(String(number || "").replace(/\s+/g, "")); if (!n) return null;
    return `https://parcelsapp.com/${["en", "fr", "de", "it", "es"].includes(lang) ? lang : "en"}/tracking/${n}`;
  }
  const DATE_FIELD = { invoiced: "invoicedAt", paid: "paidAt", shipped: "shippedAt", delivered: "deliveredAt" };
  // dates are the source of truth; status and history are rebuilt from them
  function rebuildHistory(o, flow) {
    const h = [{ status: "placed", at: o.createdAt }];
    flow.slice(1).forEach((st) => { const at = o[DATE_FIELD[st]]; if (at) h.push({ status: st, at }); });
    if (o.cancelledAt) h.push({ status: "cancelled", at: o.cancelledAt });
    o.history = h;
    const last = [...flow].reverse().find((st) => st === "placed" || o[DATE_FIELD[st]]);
    o.status = o.cancelledAt ? "cancelled" : last;
  }
  const histAt = (o, st) => { const e = (o.history || []).find((h) => h.status === st); return e ? e.at : null; };
  const isoDate = (v) => { if (!v) return null; const d = new Date(v); if (isNaN(d)) throw new Error("Invalid date."); return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? `${v}T10:00:00.000Z` : d.toISOString(); };
  const dayOf = (iso) => (iso ? iso.slice(0, 10) : "");
  const STATUS_LABEL = { placed: "Placed", invoiced: "Invoice sent", paid: "Paid", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" };

  let state = null;

  /* ---- helpers --------------------------------------------------- */
  const nowIso = () => new Date().toISOString();
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const rid = (prefix) => `${prefix}${++state.seq}`;
  const randomPassword = () => {
    const w = ["lulo", "guava", "cobra", "selva", "mala", "conda", "fruta", "bite"];
    return `${w[Math.floor(Math.random() * w.length)]}-${Math.floor(1000 + Math.random() * 9000)}`;
  };
  const slugCode = (prefix, name) => `${prefix}-${name.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8)}`;
  const iso = (d) => `${d}T10:00:00.000Z`;

  /* ---- persistence ----------------------------------------------- */
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) { state = JSON.parse(raw); ensure(); return state; } } catch (e) {}
    state = seed(); save(); return state;
  }
  // older saved data may lack newer collections or fields
  function ensure() {
    state.settings = Object.assign(JSON.parse(JSON.stringify(E.DEFAULT_SETTINGS)), state.settings || {});
    delete state.settings.proPrice;
    state.ledger = state.ledger || [];
    state.consumers = state.consumers || [];
    state.consumerOrders = state.consumerOrders || [];
    state.consumerOrders.forEach((o) => {
      o.status = o.status || "placed"; o.history = o.history || [{ status: o.status, at: o.createdAt }];
      ["paid", "shipped", "delivered"].forEach((st) => { const f = DATE_FIELD[st]; if (o[f] === undefined) o[f] = histAt(o, st); });
      o.payment = o.payment || { method: "Card (online)", reference: "" }; o.shipping = o.shipping || { carrier: "", tracking: "" }; o.note = o.note || ""; o.editLog = o.editLog || [];
    });
    state.orders.forEach((o) => {
      ["invoiced", "paid", "shipped", "delivered"].forEach((st) => { const f = DATE_FIELD[st]; if (o[f] === undefined) o[f] = histAt(o, st); });
      o.via = o.via || (o.channel === "manual" ? "Email" : "Website request"); o.reference = o.reference || ""; o.invoiceNo = o.invoiceNo || "";
      o.payment = o.payment || { method: "Bank transfer", reference: "" }; o.shipping = o.shipping || { carrier: "", tracking: "", address: "", zip: "", city: "" }; o.note = o.note || ""; o.editLog = o.editLog || [];
    });
    state.pros.forEach((p) => { p.address = p.address || ""; p.zip = p.zip || ""; p.billingAddress = p.billingAddress || ""; p.vat = p.vat || ""; p.prices = p.prices || { lulo: null, guava: null }; p.priceLog = p.priceLog || []; p.flags = p.flags || { tiers: true, extras: true }; p.priceNote = p.priceNote || ""; });
  }
  function reset() { try { localStorage.removeItem(KEY); } catch (e) {} state = seed(); save(); return state; }
  function get() { if (!state) load(); return state; }
  // pick up changes made in another tab (admin <-> pro)
  window.addEventListener("storage", (e) => { if (e.key === KEY) { try { state = JSON.parse(e.newValue); } catch (x) {} document.dispatchEvent(new CustomEvent("proto:changed")); } });

  /* ---- sessions (sessionStorage, one per role, so tabs can differ) --- */
  const sKey = (role) => `malaconda_proto_session_${role}`;
  function session(role) { try { return JSON.parse(sessionStorage.getItem(sKey(role))); } catch (e) { return null; } }
  function login(role, email, password) {
    const s = get();
    const e = String(email || "").trim().toLowerCase();
    let user = null;
    if (role === "admin") user = s.admins.find((a) => a.email === e && a.password === password);
    if (role === "pro") user = s.pros.find((a) => a.email === e && a.password === password);
    if (role === "ambassador") user = s.ambassadors.find((a) => a.email === e && a.password === password && a.active);
    if (role === "customer") user = s.consumers.find((a) => a.email === e && a.password === password);
    if (!user) return null;
    try { sessionStorage.setItem(sKey(role), JSON.stringify({ id: user.id })); } catch (x) {}
    return user;
  }
  function listFor(role) {
    const s = get();
    return role === "admin" ? s.admins : role === "pro" ? s.pros : role === "customer" ? s.consumers : s.ambassadors;
  }
  function logout(role) { try { sessionStorage.removeItem(sKey(role)); } catch (e) {} }
  function currentUser(role) {
    const ses = session(role); if (!ses) return null;
    const s = get();
    return listFor(role).find((u) => u.id === ses.id) || null;
  }
  function changePassword(role, id, newPassword) {
    const u = listFor(role).find((x) => x.id === id); if (!u) return false;
    u.password = newPassword; u.mustChange = false; save(); return true;
  }
  function resetPassword(role, id) {
    const u = listFor(role).find((x) => x.id === id); if (!u) return null;
    u.password = randomPassword(); u.mustChange = true; save(); return u.password;
  }

  /* ---- attribution ------------------------------------------------- */
  // text can be a code (AMB-… / PRO-…); returns {kind,id,text} or null
  function resolveRef(text) {
    const s = get(); const t = String(text || "").trim().toUpperCase(); if (!t) return null;
    const a = s.ambassadors.find((x) => x.code.toUpperCase() === t);
    if (a) return { kind: "ambassador", id: a.id, text: a.code };
    const p = s.pros.find((x) => x.code.toUpperCase() === t);
    if (p) return { kind: "pro", id: p.id, text: p.code };
    return null;
  }
  function refLabel(ref) {
    if (!ref) return "None";
    const s = get();
    if (ref.kind === "ambassador") { const a = s.ambassadors.find((x) => x.id === ref.id); return a ? `Ambassador · ${a.name}` : "Ambassador (deleted)"; }
    if (ref.kind === "pro") { const p = s.pros.find((x) => x.id === ref.id); return p ? `Pro · ${p.name}` : "Pro (deleted)"; }
    return "None";
  }
  function setAttribution(proId, newRef, by, now) {
    const s = get(); const p = s.pros.find((x) => x.id === proId); if (!p) return;
    if (newRef && newRef.kind === "pro") {
      if (newRef.id === proId) throw new Error("A pro cannot recommend itself.");
      let cur = s.pros.find((x) => x.id === newRef.id);
      for (let i = 0; cur && i < 50; i++) {
        if (cur.id === proId) throw new Error("This would create a loop: that pro was recommended by this one.");
        cur = cur.referredBy && cur.referredBy.kind === "pro" ? s.pros.find((x) => x.id === cur.referredBy.id) : null;
      }
    }
    const from = refLabel(p.referredBy);
    p.referredBy = newRef ? { kind: newRef.kind, id: newRef.id, text: newRef.text || "" } : null;
    p.attrHistory = p.attrHistory || [];
    p.attrHistory.push({ at: now || nowIso(), by: by || "admin", from, to: refLabel(p.referredBy) });
    save();
  }

  /* ---- pros and ambassadors ---------------------------------------- */
  function createPro({ name, type, city, contact, email, phone, referredBy, now }) {
    const s = get();
    const e = String(email).trim().toLowerCase();
    if (s.pros.some((p) => p.email === e)) throw new Error("A pro account with this email already exists.");
    const tempPassword = randomPassword();
    const pro = {
      id: rid("p"), name, type, city, contact, email: e, phone: phone || "",
      password: tempPassword, mustChange: true, createdAt: now || nowIso(),
      code: slugCode("PRO", name), referredBy: null, attrHistory: [], address: "", zip: "", billingAddress: "", vat: "",
      prices: { lulo: null, guava: null }, priceLog: [], flags: { tiers: true, extras: true }, priceNote: "",
    };
    let code = pro.code, n = 2;
    while (s.pros.some((p) => p.code === code) || s.ambassadors.some((a) => a.code === code)) code = `${pro.code}${n++}`;
    pro.code = code;
    s.pros.push(pro); save();
    if (referredBy) setAttribution(pro.id, referredBy, "account creation", now);
    return { pro, tempPassword };
  }
  function createAmbassador({ name, email, pct, months, iban, now }) {
    const s = get();
    const e = String(email).trim().toLowerCase();
    if (s.ambassadors.some((a) => a.email === e)) throw new Error("An ambassador with this email already exists.");
    let code = slugCode("AMB", name.trim().split(/\s+/)[0]), n = 2; const base = code;
    while (s.pros.some((p) => p.code === code) || s.ambassadors.some((a) => a.code === code)) code = `${base}${n++}`;
    const tempPassword = randomPassword();
    const amb = {
      id: rid("a"), name, email: e, code, pct: pct === "" || pct == null ? null : Number(pct),
      months: months === "" || months == null ? null : Number(months), iban: iban || "",
      active: true, password: tempPassword, mustChange: true, createdAt: now || nowIso(),
    };
    s.ambassadors.push(amb); save();
    return { amb, tempPassword };
  }
  function submitProRequest(data) {
    const s = get();
    s.requests.push({ id: rid("r"), kind: "pro", status: "open", createdAt: nowIso(), ...data });
    save();
  }
  function submitAmbassadorApplication(data) {
    const s = get();
    s.requests.push({ id: rid("r"), kind: "ambassador", status: "open", createdAt: nowIso(), ...data });
    save();
  }
  function submitContact(data) {
    const s = get();
    s.requests.push({ id: rid("r"), kind: "message", status: "open", createdAt: nowIso(), ...data });
    save();
  }
  function closeRequest(id, status) {
    const r = get().requests.find((x) => x.id === id); if (r) { r.status = status; save(); }
  }

  /* ---- orders ------------------------------------------------------- */
  const ordersOfPro = (proId) => get().orders.filter((o) => o.proId === proId);
  const creditOf = (proId) => { const s = get(); return E.creditSummary(proId, s.pros, s.orders, s.settings, s.ledger); };
  const proById = (id) => get().pros.find((p) => p.id === id);
  const flagsOf = (pro) => ({ tiers: !pro.flags || pro.flags.tiers !== false, extras: !pro.flags || pro.flags.extras !== false });
  // the unit prices a pro actually pays: negotiated per flavour, else the list price
  function unitPricesOf(proId) {
    const pro = proById(proId), st = get().settings, out = {};
    E.FLAVORS.forEach((k) => { out[k] = pro && pro.prices && pro.prices[k] != null ? pro.prices[k] : st.proBottlePrice; });
    return out;
  }
  const cleanLines = (lines) => (Array.isArray(lines) ? lines : [{ flavor: "lulo", boxes: Number(lines) || 0 }])
    .map((l) => ({ flavor: l.flavor, boxes: Math.max(0, Math.floor(Number(l.boxes) || 0)) })).filter((l) => l.boxes > 0);

  /* One price formatter for the site, the pro space and the admin: always the engine. */
  function previewProOrder(proId, lines) {
    const s = get(), pro = proById(proId);
    return E.priceProOrder({
      lines: cleanLines(lines), unitPrices: unitPricesOf(proId), settings: s.settings,
      isFirst: E.isFirstOrder(ordersOfPro(proId)), creditAvailablePct: creditOf(proId).available, flags: flagsOf(pro),
    });
  }
  const priceSheetOf = (proId) => E.priceSheet({ unitPrices: unitPricesOf(proId), settings: get().settings, flags: flagsOf(proById(proId)) });

  /* Everything a pro is entitled to, in one place (admin and pro space read this). */
  function conditionsOf(proId) {
    const s = get(), pro = proById(proId), unit = unitPricesOf(proId);
    const credit = creditOf(proId), isFirst = E.isFirstOrder(ordersOfPro(proId)), flags = flagsOf(pro);
    const best = {}; E.FLAVORS.forEach((k) => (best[k] = flags.tiers || flags.extras ? E.bestCaseBottle(unit[k], s.settings) : unit[k]));
    return { pro, unit, sheet: priceSheetOf(proId), flags, isFirst, credit, best,
      welcomeApplies: isFirst && flags.extras, creditApplies: !isFirst && flags.extras && credit.available > 0,
      next: isFirst ? (flags.extras ? { kind: "welcome", pct: s.settings.proWelcomePct } : null) : (flags.extras && credit.available ? { kind: "credit", pct: Math.min(credit.available, s.settings.referral.maxPerOrder) } : null),
      source: refLabel(pro.referredBy),
      negotiated: E.FLAVORS.some((k) => pro.prices && pro.prices[k] != null && pro.prices[k] !== s.settings.proBottlePrice) };
  }

  /* Founders set a negotiated price per flavour (blank = list price), with a reason; every change is logged. */
  function setProPrices(proId, { lulo, guava, tiers, extras, note }, by, now) {
    const s = get(), pro = proById(proId); if (!pro) throw new Error("Unknown pro");
    const next = {};
    for (const [k, v] of [["lulo", lulo], ["guava", guava]]) {
      const blank = v === "" || v == null;
      const err = blank ? null : E.validateNegotiated(v, s.settings);
      if (err) throw new Error(`${FLAVORS[k].name}: ${err}`);
      next[k] = blank || Number(v) === s.settings.proBottlePrice ? null : Number(v);
    }
    const before = { lulo: pro.prices.lulo, guava: pro.prices.guava, tiers: flagsOf(pro).tiers, extras: flagsOf(pro).extras };
    pro.prices = next; pro.flags = { tiers: tiers !== false, extras: extras !== false }; pro.priceNote = note || "";
    pro.priceLog.push({ at: now || nowIso(), by: by || "admin", from: before, to: { lulo: next.lulo, guava: next.guava, tiers: pro.flags.tiers, extras: pro.flags.extras }, note: note || "" });
    save(); return pro;
  }
  // Settings change check: which pros would sit outside the new floor / list price?
  function priceConflicts(settings) {
    return get().pros.filter((p) => E.FLAVORS.some((k) => p.prices && p.prices[k] != null && E.validateNegotiated(p.prices[k], settings)))
      .map((p) => p.name);
  }

  function placeProOrder({ proId, lines, channel, now, requestId, meta }) {
    const s = get(); const pro = proById(proId); if (!pro) throw new Error("Unknown pro");
    const clean = cleanLines(lines);
    const boxes = clean.reduce((n, l) => n + l.boxes, 0);
    if (!boxes) throw new Error("Add at least one box.");
    const price = previewProOrder(proId, clean);
    const created = now || nowIso();
    const order = {
      id: rid("o"), proId, channel: channel || "site", createdAt: created, lines: clean, boxes,
      unitPrices: unitPricesOf(proId), flags: flagsOf(pro),
      gross: price.gross, tierPct: price.tierPct, welcomePct: price.welcomePct, creditPct: price.creditPct,
      net: price.net, status: "placed", history: [{ status: "placed", at: created }],
      invoicedAt: null, paidAt: null, shippedAt: null, deliveredAt: null, cancelledAt: null, requestId: requestId || null,
      via: channel === "request" ? "Website request" : "Other", reference: "", invoiceNo: "", note: "", editLog: [],
      payment: { method: "Bank transfer", reference: "" },
      shipping: { carrier: "", tracking: "", address: pro.address || "", zip: pro.zip || "", city: pro.city || "" },
      ambassadorId: pro.referredBy && pro.referredBy.kind === "ambassador" ? pro.referredBy.id : null,
    };
    if (meta) {
      ["via", "reference", "invoiceNo", "note"].forEach((k) => { if (meta[k] != null) order[k] = meta[k]; });
      if (meta.payment) Object.assign(order.payment, meta.payment);
      if (meta.shipping) Object.assign(order.shipping, meta.shipping);
    }
    s.orders.push(order); save(); return order;
  }

  /* A pro pays online by card: the order is created already paid, with the card payment reference, and the referral credit is recorded
     exactly as for any paid order. (Prototype: no real charge; the real site hands this to Stripe Checkout.) */
  function payProOrder({ proId, lines, shipping, paymentRef, now }) {
    const created = now || nowIso();
    const o = placeProOrder({ proId, lines, channel: "site", now: created,
      meta: { via: "Website", payment: { method: "Card (online)", reference: paymentRef || "" }, shipping: shipping || {} } });
    o.paidAt = created; o.editLog.push({ at: created, by: "pro", changes: ["Paid online by card"] });
    rebuildHistory(o, STATUS_FLOW); recordQualification(o); save(); return o;
  }

  /* A manual order: a visit, an email, a phone call. Everything about the deal is recorded when it is created. */
  function createManualOrder(d, by) {
    if (d.shippedAt) checkShipping(d.carrier, d.tracking, d.noTracking);
    const o = placeProOrder({ proId: d.proId, lines: d.lines, channel: "manual", now: isoDate(d.createdAt) || undefined,
      meta: { via: d.via || "Other", reference: d.reference || "", invoiceNo: d.invoiceNo || "", note: d.note || "", payment: { method: d.paymentMethod || "Bank transfer", reference: d.paymentReference || "" },
        shipping: { carrier: d.carrier || "", tracking: d.noTracking ? "" : d.tracking || "", noTracking: !!d.noTracking, address: d.address, zip: d.zip, city: d.city } } });
    o.invoicedAt = isoDate(d.invoicedAt); o.paidAt = isoDate(d.paidAt); o.shippedAt = isoDate(d.shippedAt); o.deliveredAt = isoDate(d.deliveredAt);
    o.editLog.push({ at: nowIso(), by: by || "admin", changes: ["Order created"] });
    rebuildHistory(o, STATUS_FLOW);
    if (o.paidAt) recordQualification(o);
    save(); return o;
  }

  /* Correct an order after the fact. Every change is logged. Prices of the lines are recomputed with the order's own unit prices. */
  function updateOrder(id, patch, by) {
    const s = get(), o = s.orders.find((x) => x.id === id); if (!o) throw new Error("Unknown order");
    lockWeb("pro", o, patch); guardShipping(o, patch);
    const log = [];
    const L = { createdAt: "Order date", via: "Received", reference: "Reference", invoiceNo: "Invoice number", note: "Note", invoicedAt: "Invoice sent", paidAt: "Paid on", shippedAt: "Shipped on", deliveredAt: "Delivered on" };
    const dateKeys = ["createdAt", "invoicedAt", "paidAt", "shippedAt", "deliveredAt"];
    const wasPaid = !!o.paidAt;
    Object.keys(L).forEach((k) => {
      if (!(k in patch)) return;
      const next = dateKeys.includes(k) ? isoDate(patch[k]) : String(patch[k] || "").trim();
      if (k === "createdAt" && !next) throw new Error("The order needs a date.");
      const cur = o[k] || (dateKeys.includes(k) ? null : "");
      if ((dateKeys.includes(k) ? dayOf(next) !== dayOf(cur) : next !== cur)) { log.push(`${L[k]}: ${dateKeys.includes(k) ? dayOf(cur) || "none" : cur || "none"} → ${dateKeys.includes(k) ? dayOf(next) || "none" : next || "none"}`); o[k] = next; }
    });
    const sub = (grp, keys, labels) => keys.forEach((k) => { const key = `${grp}.${k}`; if (!(key in patch)) return; const next = String(patch[key] || "").trim(); if (next !== (o[grp][k] || "")) { log.push(`${labels[k]}: ${o[grp][k] || "none"} → ${next || "none"}`); o[grp][k] = next; } });
    sub("payment", ["method", "reference"], { method: "Payment method", reference: "Payment reference" });
    sub("shipping", ["carrier", "tracking", "address", "zip", "city"], { carrier: "Carrier", tracking: "Tracking number", address: "Delivery address", zip: "Postcode", city: "City" });
    if ("shipping.noTracking" in patch) { const nv = !!patch["shipping.noTracking"]; if (nv !== !!o.shipping.noTracking) { log.push(`No tracking number: ${o.shipping.noTracking ? "yes" : "no"} → ${nv ? "yes" : "no"}`); o.shipping.noTracking = nv; } }
    if (patch.lines) {
      const clean = cleanLines(patch.lines); if (!clean.length) throw new Error("Add at least one box.");
      const before = JSON.stringify(o.lines);
      if (JSON.stringify(clean) !== before) {
        const p = E.priceProOrder({ lines: clean, unitPrices: o.unitPrices, settings: s.settings, isFirst: o.welcomePct > 0, creditAvailablePct: o.creditPct, flags: o.flags });
        log.push(`Items: ${o.lines.map((l) => `${l.boxes} ${l.flavor}`).join(", ")} → ${clean.map((l) => `${l.boxes} ${l.flavor}`).join(", ")}, net ${o.net.toFixed(2)} → ${p.net.toFixed(2)}`);
        o.lines = clean; o.boxes = p.boxes; o.gross = p.gross; o.tierPct = p.tierPct; o.net = p.net;
      }
    }
    if ("cancelled" in patch) {
      if (patch.cancelled && !o.cancelledAt) { o.cancelledAt = nowIso(); log.push("Order cancelled"); }
      if (!patch.cancelled && o.cancelledAt) { o.cancelledAt = null; log.push("Order reopened"); }
    }
    rebuildHistory(o, STATUS_FLOW);
    if (o.paidAt && !wasPaid) recordQualification(o);
    if (!o.paidAt || o.cancelledAt) s.ledger.forEach((e) => { if (e.orderId === o.id && !e.revokedAt) e.revokedAt = nowIso(); });
    if (log.length) o.editLog.push({ at: nowIso(), by: by || "admin", changes: log });
    save(); return o;
  }

  /* Order requests: a logged-in pro asks, founders create the order. The request keeps the quote. */
  function submitOrderRequest({ proId, lines, now }) {
    const s = get(), clean = cleanLines(lines);
    if (!clean.length) throw new Error("Add at least one box.");
    const q = previewProOrder(proId, clean);
    s.requests.push({ id: rid("r"), kind: "order", status: "open", createdAt: now || nowIso(), proId, lines: clean,
      quote: { unitPrices: unitPricesOf(proId), boxes: q.boxes, net: q.net, tierPct: q.tierPct, welcomePct: q.welcomePct, creditPct: q.creditPct } });
    save();
  }
  // difference between what the pro was quoted and what the same order would cost now
  function requestDiff(reqId) {
    const r = get().requests.find((x) => x.id === reqId); if (!r) return null;
    const now = previewProOrder(r.proId, r.lines);
    return { quote: r.quote, now: { net: now.net, tierPct: now.tierPct, welcomePct: now.welcomePct, creditPct: now.creditPct, unitPrices: unitPricesOf(r.proId) }, changed: Math.abs(now.net - r.quote.net) > 0.004 };
  }
  function createOrderFromRequest(reqId, now) {
    const r = get().requests.find((x) => x.id === reqId); if (!r || r.status !== "open") throw new Error("Request already handled.");
    const order = placeProOrder({ proId: r.proId, lines: r.lines, channel: "request", now, requestId: r.id });
    r.status = "approved"; r.orderId = order.id; save(); return order;
  }

  /* Referral ledger: the credit is recorded, with its percentage, when the referred pro's first paid order qualifies. */
  function recordQualification(order) {
    const s = get(), pro = proById(order.proId);
    if (!pro || !pro.referredBy || pro.referredBy.kind !== "pro") return;
    const first = E.firstPaidOrder(ordersOfPro(order.proId));
    if (!first || first.id !== order.id || order.boxes < s.settings.referral.minBoxes) return;
    if (s.ledger.some((e) => e.referredId === order.proId)) return;
    s.ledger.push({ id: rid("l"), referrerId: pro.referredBy.id, referredId: order.proId, orderId: order.id, pct: s.settings.referral.pctPer, at: order.paidAt });
  }
  function nextStatus(order) {
    if (order.status === "cancelled") return null;
    const i = STATUS_FLOW.indexOf(order.status);
    return STATUS_FLOW[i + 1] || null;
  }
  function advanceOrder(orderId, now) {
    const o = get().orders.find((x) => x.id === orderId); if (!o) return;
    const next = nextStatus(o); if (!next) return;
    o[DATE_FIELD[next]] = now || nowIso();
    rebuildHistory(o, STATUS_FLOW);
    if (next === "paid") recordQualification(o);
    save();
  }
  function cancelOrder(orderId, now) {
    const o = get().orders.find((x) => x.id === orderId); if (!o || o.status === "cancelled") return;
    const at = now || nowIso();
    o.cancelledAt = at; rebuildHistory(o, STATUS_FLOW);
    get().ledger.forEach((e) => { if (e.orderId === o.id && !e.revokedAt) e.revokedAt = at; }); // credit this order earned is revoked
    save();
  }


  /* Shipping rules, enforced here so no screen can skip them: a parcel that left needs a carrier and a tracking number
     (own deliveries need no number), and dates cannot be in the future or go back before the previous step. */
  const TRACKING_RE = /^[A-Za-z0-9][A-Za-z0-9 .\-]{4,39}$/;
  const isOwn = (c) => /^own delivery$/i.test(String(c || "").trim());
  function checkShipping(carrier, tracking, noTracking) {
    const c = String(carrier || "").trim(), t = String(tracking || "").trim();
    if (!c) throw new Error("Enter the carrier.");
    if (noTracking || isOwn(c)) return { carrier: c, tracking: "", noTracking: true };
    if (!t) throw new Error("Enter the tracking number, or tick \"No tracking number\" if this parcel has none.");
    if (!TRACKING_RE.test(t)) throw new Error("This tracking number looks wrong. Use 5 to 40 letters, digits, dots or dashes.");
    return { carrier: c, tracking: t, noTracking: false };
  }
  function guardShipping(o, patch) {
    const shipped = "shippedAt" in patch ? patch.shippedAt : o.shippedAt;
    if (!shipped || o.cancelledAt && !("cancelled" in patch)) return;
    const sh = o.shipping || {}, pick = (k) => ("shipping." + k) in patch ? patch["shipping." + k] : sh[k];
    checkShipping(pick("carrier"), pick("tracking"), pick("noTracking"));
  }
  /* An order placed on the website is what the customer paid: items, amounts, dates and payment cannot be rewritten.
     Only the delivery address (until it ships), the parcel details and the note can be corrected. */
  const isWebOrder = (kind, o) => (kind === "pro" ? o.channel === "site" && (o.payment || {}).method === "Card (online)" : o.channel !== "manual");
  function lockWeb(kind, o, patch) {
    if (!isWebOrder(kind, o)) return;
    const bad = (what) => { throw new Error(`This order was placed on the website: ${what} cannot be changed, it is what the customer paid.`); };
    const txt = (v) => String(v || "").trim();
    [["createdAt", "the order date"], ["paidAt", "the payment date"], ["invoicedAt", "the invoice date"]].forEach(([k, w]) => { if (k in patch && dayOf(isoDate(patch[k])) !== dayOf(o[k])) bad(w); });
    [["via", "how it was received"], ["reference", "the reference"], ["invoiceNo", "the invoice number"]].forEach(([k, w]) => { if (k in patch && txt(patch[k]) !== txt(o[k])) bad(w); });
    [["method", "the payment method"], ["reference", "the payment reference"]].forEach(([k, w]) => { if (("payment." + k) in patch && txt(patch["payment." + k]) !== txt((o.payment || {})[k])) bad(w); });
    if (patch.lines && JSON.stringify(cleanLines(patch.lines)) !== JSON.stringify(o.lines)) bad("the items and amounts");
    const grp = kind === "pro" ? "shipping" : "shipTo";
    if (o.shippedAt) ["address", "zip", "city"].forEach((k) => { if ((grp + "." + k) in patch && txt(patch[grp + "." + k]) !== txt((o[grp] || {})[k])) bad("the delivery address once the parcel has shipped"); });
    if ("cancelled" in patch && !!patch.cancelled !== !!o.cancelledAt && (o.paidAt || o.cancelledAt)) throw new Error("A paid website order can only be cancelled with a card refund, which is not available yet.");
  }
  const todayDay = () => new Date().toISOString().slice(0, 10);
  function checkDay(day, notBefore, what, before) {
    if (!day) throw new Error(`Enter the ${what} date.`);
    if (day > todayDay()) throw new Error(`The ${what} date cannot be in the future.`);
    if (notBefore && day < notBefore) throw new Error(`The ${what} date cannot be before ${before} (${notBefore}).`);
  }
  /* One guarded step forward for a pro or shop order: invoiced, paid, shipped or delivered. */
  function progress(kind, id, step, d, by) {
    d = d || {};
    const s = get(), pro = kind === "pro", o = (pro ? s.orders : s.consumerOrders).find((x) => x.id === id); if (!o) throw new Error("Unknown order.");
    const flow = pro ? STATUS_FLOW : CONSUMER_FLOW, next = pro ? nextStatus(o) : nextConsumerStatus(o);
    if (o.status === "cancelled") throw new Error("This order is cancelled.");
    if (next !== step) throw new Error(`This order is ${o.status}: the next step is ${next || "none"}.`);
    if (step === "paid" && isWebOrder(kind, o)) throw new Error("A website order is marked paid by the card payment itself, not by hand.");
    const day = String(d.at || "").slice(0, 10), log = [];
    if (step === "invoiced") {
      const no = String(d.invoiceNo || "").trim(); if (!no) throw new Error("Enter the invoice number.");
      checkDay(day, dayOf(o.createdAt), "invoice", "the order date");
      o.invoiceNo = no; log.push(`Invoice ${no} sent on ${day}`);
    } else if (step === "paid") {
      const m = String(d.method || "").trim(); if (!m) throw new Error("Choose how it was paid.");
      checkDay(day, dayOf(o.createdAt), "payment", "the order date");
      o.payment = { method: m, reference: String(d.reference || "").trim() }; log.push(`Paid on ${day} by ${m}${o.payment.reference ? " (" + o.payment.reference + ")" : ""}`);
    } else if (step === "shipped") {
      const sh = checkShipping(d.carrier, d.tracking, d.noTracking);
      checkDay(day, dayOf(o.paidAt), "shipping", "the payment date");
      o.shipping = { ...(o.shipping || {}), carrier: sh.carrier, tracking: sh.tracking, noTracking: sh.noTracking };
      log.push(`Shipped on ${day} with ${sh.carrier}${sh.tracking ? " " + sh.tracking : " (no tracking number)"}${d.email ? "; shipping email to " + d.email : ""}`);
    } else if (step === "delivered") {
      checkDay(day, dayOf(o.shippedAt), "delivery", "the shipping date");
      log.push(`Delivered on ${day}`);
    } else throw new Error("Unknown step.");
    o[DATE_FIELD[step]] = isoDate(day);
    rebuildHistory(o, flow);
    if (pro && step === "paid") recordQualification(o);
    (o.editLog = o.editLog || []).push({ at: nowIso(), by: by || "admin", changes: log });
    save(); return o;
  }

  /* ---- consumers: accounts and shop orders ---------------------------- */
  const CONSUMER_FLOW = ["placed", "paid", "shipped", "delivered"];
  const CONSUMER_LABEL = { placed: "Placed", paid: "Paid", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" };
  function registerConsumer({ name, email, password }) {
    const s = get(); const e = String(email || "").trim().toLowerCase();
    if (!name || !e) throw new Error("Enter your name and email.");
    if (String(password || "").length < 8) throw new Error("Password: at least 8 characters.");
    if (s.consumers.some((c) => c.email === e)) throw new Error("An account with this email already exists.");
    const c = { id: rid("u"), name: name.trim(), email: e, password, mustChange: false, phone: "", address: "", zip: "", city: "", createdAt: nowIso() };
    s.consumers.push(c);
    s.consumerOrders.forEach((o) => { if (o.email === e && !o.accountId) o.accountId = c.id; }); // earlier guest orders join the account
    save(); return c;
  }
  const PROFILE_FIELDS = { customer: ["name", "phone", "address", "zip", "city"], pro: ["contact", "phone", "address", "zip", "city", "billingAddress", "vat"], ambassador: ["name", "phone", "iban"] };
  function updateProfile(role, id, patch) {
    const u = listFor(role).find((x) => x.id === id); if (!u) return false;
    (PROFILE_FIELDS[role] || []).forEach((f) => { if (patch[f] != null) u[f] = String(patch[f]).trim(); });
    save(); return true;
  }
  function consumerIsFirst(email, accountId) {
    const s = get(); const e = String(email || "").trim().toLowerCase();
    return !s.consumerOrders.some((o) => o.status !== "cancelled" && ((accountId && o.accountId === accountId) || (e && o.email === e)));
  }
  // the first-order offer is a reward for creating an account: a guest checkout pays the full price
  function consumerPreview(email, boxes, accountId) {
    return E.priceConsumerOrder({ boxes, settings: get().settings, isFirst: !!accountId && consumerIsFirst(email, accountId) });
  }
  function consumerCheckout({ email, name, lines, accountId, address, zip, city, phone, now, paid, paymentRef }) {
    const s = get();
    const clean = lines.map((l) => ({ flavor: l.flavor, boxes: Math.max(0, Math.floor(Number(l.boxes) || 0)) })).filter((l) => l.boxes > 0);
    const boxes = clean.reduce((n, l) => n + l.boxes, 0);
    if (!boxes) throw new Error("Add at least one box.");
    const e = String(email).trim().toLowerCase();
    const p = consumerPreview(e, boxes, accountId);
    const at = now || nowIso();
    const o = { id: rid("c"), email: e, name, accountId: accountId || null, lines: clean, boxes, gross: p.gross, welcomePct: p.welcomePct, net: p.net,
      shipTo: { address: address || "", zip: zip || "", city: city || "", phone: phone || "" }, status: paid ? "paid" : "placed", history: paid ? [{ status: "placed", at }, { status: "paid", at }] : [{ status: "placed", at }], createdAt: at,
      paidAt: paid ? at : null, shippedAt: null, deliveredAt: null, cancelledAt: null, payment: { method: "Card (online)", reference: paymentRef || "" }, shipping: { carrier: "", tracking: "" }, note: "", editLog: [] };
    s.consumerOrders.push(o); save(); return o;
  }
  const consumerOrdersOf = (accountId) => get().consumerOrders.filter((o) => o.accountId === accountId);
  function nextConsumerStatus(o) { if (o.status === "cancelled") return null; return CONSUMER_FLOW[CONSUMER_FLOW.indexOf(o.status) + 1] || null; }
  function advanceConsumerOrder(id, now) {
    const o = get().consumerOrders.find((x) => x.id === id); if (!o) return;
    const next = nextConsumerStatus(o); if (!next) return;
    o[DATE_FIELD[next]] = now || nowIso(); rebuildHistory(o, CONSUMER_FLOW); save();
  }
  function cancelConsumerOrder(id, now) {
    const o = get().consumerOrders.find((x) => x.id === id); if (!o || o.status === "cancelled") return;
    o.cancelledAt = now || nowIso(); rebuildHistory(o, CONSUMER_FLOW); save();
  }
  function updateConsumerOrder(id, patch, by) {
    const s = get(), o = s.consumerOrders.find((x) => x.id === id); if (!o) throw new Error("Unknown order");
    lockWeb("shop", o, patch); guardShipping(o, patch);
    const log = [], dates = { paidAt: "Paid on", shippedAt: "Shipped on", deliveredAt: "Delivered on", createdAt: "Order date" };
    Object.keys(dates).forEach((k) => { if (!(k in patch)) return; const next = isoDate(patch[k]); if (k === "createdAt" && !next) throw new Error("The order needs a date."); if (dayOf(next) !== dayOf(o[k])) { log.push(`${dates[k]}: ${dayOf(o[k]) || "none"} → ${dayOf(next) || "none"}`); o[k] = next; } });
    const sub = (grp, keys, labels) => keys.forEach((k) => { const key = `${grp}.${k}`; if (!(key in patch)) return; const next = String(patch[key] || "").trim(); if (next !== (o[grp][k] || "")) { log.push(`${labels[k]}: ${o[grp][k] || "none"} → ${next || "none"}`); o[grp][k] = next; } });
    sub("payment", ["method", "reference"], { method: "Payment method", reference: "Payment reference" });
    sub("shipping", ["carrier", "tracking"], { carrier: "Carrier", tracking: "Tracking number" });
    if ("shipping.noTracking" in patch) { const nv = !!patch["shipping.noTracking"]; if (nv !== !!o.shipping.noTracking) { log.push(`No tracking number: ${o.shipping.noTracking ? "yes" : "no"} → ${nv ? "yes" : "no"}`); o.shipping.noTracking = nv; } }
    sub("shipTo", ["address", "zip", "city"], { address: "Delivery address", zip: "Postcode", city: "City" });
    if ("note" in patch && String(patch.note || "").trim() !== o.note) { log.push("Note updated"); o.note = String(patch.note || "").trim(); }
    if (patch.lines) {
      const clean = cleanLines(patch.lines); if (!clean.length) throw new Error("Add at least one box.");
      if (JSON.stringify(clean) !== JSON.stringify(o.lines)) {
        const boxes = clean.reduce((n, l) => n + l.boxes, 0), gross = E.round2(boxes * s.settings.retailPrice), net = E.round2(gross * (1 - o.welcomePct / 100));
        log.push(`Items: ${o.boxes} → ${boxes} boxes, total ${o.net.toFixed(2)} → ${net.toFixed(2)}`); o.lines = clean; o.boxes = boxes; o.gross = gross; o.net = net;
      }
    }
    if ("cancelled" in patch) {
      if (patch.cancelled && !o.cancelledAt) { o.cancelledAt = nowIso(); log.push("Order cancelled"); }
      if (!patch.cancelled && o.cancelledAt) { o.cancelledAt = null; log.push("Order reopened"); }
    }
    rebuildHistory(o, CONSUMER_FLOW);
    if (log.length) o.editLog.push({ at: nowIso(), by: by || "admin", changes: log });
    save(); return o;
  }

  /* ---- founders overview ------------------------------------------------ */
  function stats() {
    const s = get();
    const proPaid = s.orders.filter((o) => o.paidAt && o.status !== "cancelled");
    const shopPaid = s.consumerOrders.filter((o) => ["paid", "shipped", "delivered"].includes(o.status));
    const sum = (arr) => E.round2(arr.reduce((n, o) => n + o.net, 0));
    const owed = s.ambassadors.reduce((n, a) => { const v = ambassadorView(a.id); return n + (v.totalEarned - v.totalPaid); }, 0);
    const open = { pro: s.orders.filter((o) => ["placed", "invoiced"].includes(o.status)).length, shop: s.consumerOrders.filter((o) => o.status === "placed").length };
    return { proRevenue: sum(proPaid), shopRevenue: sum(shopPaid), proBoxes: proPaid.reduce((n, o) => n + o.boxes, 0), shopBoxes: shopPaid.reduce((n, o) => n + o.boxes, 0),
      commissionsOwed: E.round2(owed), openRequests: s.requests.filter((r) => r.status === "open").length, openOrders: open,
      pros: s.pros.length, customers: s.consumers.length, ambassadors: s.ambassadors.filter((a) => a.active).length };
  }

  /* ---- ambassadors: views ------------------------------------------- */
  function ledger(ambId) {
    const s = get(); const amb = s.ambassadors.find((a) => a.id === ambId);
    return E.commissionLines(amb, s.orders, s.settings.commission);
  }
  function payoutKey(ambId, month) { return `${ambId}:${month}`; }
  function isPaidOut(ambId, month) { return !!get().payouts[payoutKey(ambId, month)]; }
  function markPaidOut(ambId, month, now) { get().payouts[payoutKey(ambId, month)] = now || nowIso(); save(); }
  function unmarkPaidOut(ambId, month) { delete get().payouts[payoutKey(ambId, month)]; save(); }

  /* What an ambassador is allowed to see: venues and commissionable totals. No prices, discounts or lines. */
  function ambassadorView(ambId) {
    const s = get(); const amb = s.ambassadors.find((a) => a.id === ambId);
    const led = ledger(ambId);
    const venueIds = [...new Set([
      ...s.orders.filter((o) => o.ambassadorId === ambId).map((o) => o.proId),
      ...s.pros.filter((p) => p.referredBy && p.referredBy.kind === "ambassador" && p.referredBy.id === ambId).map((p) => p.id),
    ])];
    const venues = venueIds.map((pid) => {
      const p = s.pros.find((x) => x.id === pid);
      const vOrders = s.orders.filter((o) => o.proId === pid && o.ambassadorId === ambId);
      const win = E.venueWindow(vOrders, led.months);
      const lines = led.lines.filter((l) => l.proId === pid);
      const revenue = E.round2(lines.reduce((n, l) => n + l.base, 0));
      const commission = E.round2(lines.reduce((n, l) => n + l.amount, 0));
      let status = "Account created";
      if (win) status = new Date(win.end) < new Date() ? "Commission period ended" : "Active";
      return { id: pid, name: p.name, city: p.city, type: p.type, status, since: win ? win.start : null, endsAt: win ? win.end : null, revenue, commission, lines };
    });
    const months = [...new Set(led.lines.map((l) => l.month))].sort().reverse();
    const statements = months.map((m) => {
      const ls = led.lines.filter((l) => l.month === m);
      return {
        month: m, paidOut: isPaidOut(ambId, m),
        total: E.round2(ls.reduce((n, l) => n + l.amount, 0)),
        base: E.round2(ls.reduce((n, l) => n + l.base, 0)),
        venues: venues.map((v) => {
          const vl = ls.filter((l) => l.proId === v.id);
          return { name: v.name, base: E.round2(vl.reduce((n, l) => n + l.base, 0)), amount: E.round2(vl.reduce((n, l) => n + l.amount, 0)) };
        }).filter((v) => v.base !== 0 || v.amount !== 0),
      };
    });
    return { amb, pct: led.pct, months: led.months, venues, statements,
      totalEarned: E.round2(led.lines.reduce((n, l) => n + l.amount, 0)),
      totalPaid: E.round2(statements.filter((x) => x.paidOut).reduce((n, x) => n + x.total, 0)) };
  }

  /* ---- settings ------------------------------------------------------- */
  function updateSettings(patch) { Object.assign(get().settings, patch); save(); }

  /* ---- seed data ------------------------------------------------------- */
  function seed() {
    state = {
      seq: 100, version: 1,
      settings: clone(E.DEFAULT_SETTINGS),
      admins: [{ id: "adm1", name: "Founders", email: "founders@malaconda.demo", password: "demo", mustChange: false }],
      ambassadors: [], pros: [], orders: [], requests: [], consumers: [], consumerOrders: [], payouts: {}, ledger: [],
    };
    const camila = createAmbassador({ name: "Camila Restrepo", email: "camila@ambassador.demo", iban: "CH93 0076 2011 6238 5295 7", now: iso("2026-07-20") }).amb;
    const luca = createAmbassador({ name: "Luca Meier", email: "luca@ambassador.demo", pct: 5, months: 12, iban: "CH56 0483 5012 3456 7800 9", now: iso("2026-08-15") }).amb;
    camila.password = "demo"; camila.mustChange = false;
    luca.password = "demo"; luca.mustChange = false;

    const mk = (o) => { const r = createPro(o); return r.pro; };
    const cobra = mk({ name: "Bar Cobra", type: "Bar", city: "Zurich", contact: "Nora Keller", email: "bar@cobra.demo", referredBy: { kind: "ambassador", id: camila.id }, now: iso("2026-08-02") });
    const selva = mk({ name: "Hotel Selva", type: "Hotel", city: "Geneva", contact: "Julien Roy", email: "hotel@selva.demo", referredBy: { kind: "ambassador", id: camila.id }, now: iso("2026-08-28") });
    const anaconda = mk({ name: "Club Anaconda", type: "Club", city: "Basel", contact: "Marc Frei", email: "club@anaconda.demo", referredBy: { kind: "pro", id: cobra.id }, now: iso("2026-09-30") });
    const norte = mk({ name: "Bodega Norte", type: "Restaurant", city: "Lucerne", contact: "Ana Vega", email: "bodega@norte.demo", referredBy: { kind: "pro", id: cobra.id }, now: iso("2026-10-01") });
    const vinyl = mk({ name: "Vinyl Room", type: "Club", city: "Zurich", contact: "Leo Baum", email: "vinyl@room.demo", referredBy: { kind: "pro", id: cobra.id }, now: iso("2026-11-01") });
    const lulo = mk({ name: "Cafe Lulo", type: "Restaurant", city: "Lausanne", contact: "Eric Blanc", email: "cafe@lulo.demo", referredBy: { kind: "pro", id: cobra.id }, now: iso("2026-10-12") });
    const terraza = mk({ name: "Terraza 7", type: "Bar", city: "Bern", contact: "Sofia Lenz", email: "terraza@seven.demo", referredBy: { kind: "ambassador", id: luca.id }, now: iso("2026-11-08") });
    [cobra, selva, anaconda, norte, vinyl, lulo, terraza].forEach((p) => { p.password = "demo"; p.mustChange = false; });
    // Hotel Selva: negotiated price (2.10 per bottle instead of 2.20), tiers apply, welcome and credit do not
    setProPrices(selva.id, { lulo: 2.1, guava: 2.1, tiers: true, extras: false, note: "Negotiated at the Geneva tasting" }, "Founders", iso("2026-08-28"));

    const order = (pro, d, boxesL, boxesG, steps) => {
      const o = placeProOrder({ proId: pro.id, lines: [{ flavor: "lulo", boxes: boxesL }, { flavor: "guava", boxes: boxesG }], channel: steps.channel || "request", now: iso(d) });
      steps.dates.forEach((dd) => advanceOrder(o.id, iso(dd)));
      return o;
    };
    // chronological, so every order is priced with the conditions that applied at the time
    order(cobra, "2026-08-05", 6, 6, { dates: ["2026-08-06", "2026-08-12", "2026-08-14", "2026-08-20"] });          // first order: welcome 10%
    order(selva, "2026-09-02", 15, 15, { dates: ["2026-09-03", "2026-09-10", "2026-09-12"] });                       // negotiated, no welcome
    order(cobra, "2026-09-18", 12, 12, { channel: "manual", dates: ["2026-09-19", "2026-09-25", "2026-09-27"] });   // no credit yet
    order(anaconda, "2026-10-03", 5, 5, { dates: ["2026-10-04", "2026-10-10", "2026-10-12"] });                      // qualifies Bar Cobra
    order(norte, "2026-10-06", 5, 5, { dates: ["2026-10-07", "2026-10-15", "2026-10-17"] });                         // qualifies Bar Cobra
    order(lulo, "2026-10-14", 2, 2, { dates: ["2026-10-15", "2026-10-20", "2026-10-22"] });                          // 4 boxes: below the threshold
    order(selva, "2026-10-28", 8, 7, { channel: "manual", dates: ["2026-10-29", "2026-11-04"] });
    order(vinyl, "2026-11-03", 6, 6, { dates: ["2026-11-04", "2026-11-07"] });                                       // qualifies Bar Cobra
    submitOrderRequest({ proId: anaconda.id, lines: [{ flavor: "lulo", boxes: 6 }, { flavor: "guava", boxes: 6 }], now: iso("2026-11-09") });

    // order details: how it came in, payment, invoice numbers, parcels (Selva's second order came by email, Cobra's second at a visit, paid in cash)
    const addr = { [cobra.id]: ["Langstrasse 41", "8004"], [selva.id]: ["Quai du Mont-Blanc 3", "1201"], [anaconda.id]: ["Steinenvorstadt 12", "4051"], [norte.id]: ["Pilatusstrasse 8", "6003"], [vinyl.id]: ["Langstrasse 120", "8004"], [lulo.id]: ["Rue de Bourg 5", "1003"], [terraza.id]: ["Aarbergergasse 21", "3011"] };
    s_pros_addr(addr);
    let inv = 0, parcel = 0;
    state.orders.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)).forEach((o) => {
      const pro = state.pros.find((x) => x.id === o.proId);
      if (o.invoicedAt) o.invoiceNo = `INV-${o.invoicedAt.slice(0, 4)}-${String(++inv).padStart(4, "0")}`;
      if (o.channel === "manual") { o.via = pro.name === "Bar Cobra" ? "In person visit" : "Email"; o.payment.method = pro.name === "Bar Cobra" ? "Cash" : "Bank transfer"; if (pro.name === "Bar Cobra") o.note = "Ordered at the bar after a tasting, paid in cash on delivery."; }
      else { o.via = "Website request"; o.payment.method = "Bank transfer"; }
      o.shipping = { carrier: "Swiss Post", tracking: "", address: pro.address, zip: pro.zip, city: pro.city };
      if (o.shippedAt) o.shipping.tracking = `99.60.${String(310000 + ++parcel * 137).padStart(6, "0")}.${String(40210000 + parcel * 911)}`;
      else o.shipping.carrier = "";
    });
    // pro company details
    cobra.vat = "CHE-123.456.789 MWST"; selva.vat = "CHE-234.567.890 MWST";

    // consumers: one account with orders, one guest order
    const anna = registerConsumer({ name: "Anna Keller", email: "anna@customer.demo", password: "demo-password" });
    anna.password = "demo";
    updateProfile("customer", anna.id, { phone: "+41 79 000 00 01", address: "Seestrasse 12", zip: "8002", city: "Zurich" });
    const co = (d, boxes, steps, extra) => { const o = consumerCheckout({ ...extra, lines: [{ flavor: "lulo", boxes: boxes[0] }, { flavor: "guava", boxes: boxes[1] }], now: iso(d) }); steps.forEach((dd) => advanceConsumerOrder(o.id, iso(dd))); return o; };
    const base = { email: anna.email, name: anna.name, accountId: anna.id, address: anna.address, zip: anna.zip, city: anna.city, phone: anna.phone };
    co("2026-10-09", [1, 1], ["2026-10-09", "2026-10-12", "2026-10-16"], base);
    co("2026-11-05", [2, 0], ["2026-11-05"], base);
    co("2026-10-21", [0, 3], ["2026-10-22", "2026-10-26"], { email: "guest@customer.demo", name: "Marco Bernasconi", address: "Via Nassa 5", zip: "6900", city: "Lugano" });
    let cp = 0; state.consumerOrders.forEach((o) => { if (o.shippedAt) o.shipping = { carrier: "Swiss Post", tracking: `98.12.${String(550000 + ++cp * 211)}.${String(10770000 + cp * 523)}` }; });

    s_addRequest({ kind: "pro", business: "Rooftop 54", type: "Bar", city: "Zurich", contact: "Dana Roth", email: "dana@rooftop54.demo", phone: "+41 44 000 00 00", recommendedBy: "AMB-LUCA", notes: "Opening a second venue in spring.", createdAt: iso("2026-11-07") });
    s_addRequest({ kind: "pro", business: "Hotel Alba", type: "Hotel", city: "Lugano", contact: "Paolo Riva", email: "paolo@alba.demo", phone: "", recommendedBy: "Nora from Bar Cobra", notes: "", createdAt: iso("2026-11-09") });
    s_addRequest({ kind: "ambassador", name: "Tomas Ferreira", email: "tomas@ambassador.demo", network: "Bartender in Basel, 12k Instagram followers", handle: "@tomas.pours", createdAt: iso("2026-11-06") });
    return state;
  }
  function s_pros_addr(map) { state.pros.forEach((p) => { if (map[p.id]) { p.address = map[p.id][0]; p.zip = map[p.id][1]; } }); }
  function s_addRequest(data) { state.requests.push({ id: rid("r"), status: "open", ...data }); }

  /* ---- demo mode: "View as" switcher instead of login (login comes later) ---- */
  const DEMO_MODE = true;
  const DEMO_VIEWS = [
    { value: "visitor", label: "Unlogged visitor", href: "index.html" },
    { value: "customer", label: "Logged visitor", role: "customer", email: "anna@customer.demo", href: "account.html" },
    { value: "pro-new", label: "New pro", role: "pro", email: "terraza@seven.demo", href: "pro-space.html" },
    { value: "pro-stacked", label: "Pro with referral stacked", role: "pro", email: "bar@cobra.demo", href: "pro-space.html" },
    { value: "pro-negotiated", label: "Pro with negotiated prices", role: "pro", email: "hotel@selva.demo", href: "pro-space.html" },
    { value: "amb-camila", label: "Ambassador", role: "ambassador", email: "camila@ambassador.demo", href: "ambassador-space.html" },
    { value: "admin", label: "Admin", role: "admin", email: "founders@malaconda.demo", href: "admin.html" },
  ];
  const ROLES = ["admin", "pro", "ambassador", "customer"];
  function demoLogin(role, email) {
    const u = listFor(role).find((x) => x.email === email) || listFor(role)[0];
    if (!u) return null;
    u.mustChange = false;
    try { sessionStorage.setItem(sKey(role), JSON.stringify({ id: u.id })); } catch (e) {}
    save(); return u;
  }
  function switchView(value) {
    const v = DEMO_VIEWS.find((x) => x.value === value) || DEMO_VIEWS[0];
    ROLES.forEach(logout);
    if (v.role) demoLogin(v.role, v.email);
    return v.href;
  }
  function currentView() {
    for (const v of DEMO_VIEWS) {
      if (!v.role) continue;
      const u = currentUser(v.role);
      if (u && u.email === v.email) return v.value;
    }
    for (const r of ROLES) { const u = currentUser(r); if (u) { const v = DEMO_VIEWS.find((x) => x.role === r); if (v) return v.value; } }
    return "visitor";
  }

  window.Store = {
    DEMO_MODE, DEMO_VIEWS, demoLogin, switchView, currentView, submitContact,
    FLAVORS, PRO_TYPES, STATUS_FLOW, STATUS_LABEL,
    load, get, save, reset, session, login, logout, currentUser, changePassword, resetPassword,
    resolveRef, refLabel, setAttribution, createPro, createAmbassador, submitProRequest, submitAmbassadorApplication, closeRequest,
    FLAVORS_ALL: FLAVORS, unitPricesOf, priceSheetOf, conditionsOf, setProPrices, priceConflicts, submitOrderRequest, requestDiff, createOrderFromRequest,
    PAYMENT_METHODS, VIA_OPTIONS, CARRIERS, trackingUrl, checkShipping, isWebOrder, progress, createManualOrder, updateOrder, updateConsumerOrder,
    ordersOfPro, creditOf, previewProOrder, placeProOrder, payProOrder, nextStatus, advanceOrder, cancelOrder,
    CONSUMER_FLOW, CONSUMER_LABEL, registerConsumer, updateProfile, consumerIsFirst, consumerOrdersOf, nextConsumerStatus, advanceConsumerOrder, cancelConsumerOrder, stats,
    consumerPreview, consumerCheckout, ledger, ambassadorView, isPaidOut, markPaidOut, unmarkPaidOut, updateSettings,
  };
})();
