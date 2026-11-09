/* =============================================================
   MALACONDA — JavaScript (sin librerías)
   1. CONFIG            ← moneda, checkout, códigos promo, pre-order
   2. Idioma (EN / DE)
   3. Imágenes de respaldo
   4. Barra de anuncios, navegación y menú móvil
   5. Movimiento: revelados y parallax
   6. Carrito, código promo y checkout
   7. Formularios (contacto, ambassadors, pre-order, newsletter)
   8. Inicio
   ============================================================= */


/* =============================================================
   1. CONFIG
   ============================================================= */
const CONFIG = {
  currency: "CHF",
  orderEmail: "hello@malaconda.com",   // CONFIRMAR: email que recibe pedidos y formularios

  // CHECKOUT DEL CARRITO
  //   "stripe" → envía el carrito completo (productos, cantidades, código promo, idioma)
  //              a tu backend, que crea una sesión de Stripe Checkout y devuelve su URL.
  //              Contrato esperado (ver README): POST JSON → { url: "https://checkout.stripe.com/..." }
  //   "email"  → mientras no exista el backend: abre el email del cliente con el pedido.
  checkoutMode: "email",
  checkoutEndpoint: "/api/create-checkout-session",

  // CÓDIGOS DE AMBASSADOR (B2C)
  // Regla: clientes NUEVOS reciben 20% en UNA caja; el resto de cajas a precio completo.
  // El ambassador gana CHF 5 por cliente nuevo. TODO esto lo valida el BACKEND
  // (cliente nuevo por email, límite de una caja, atribución y comisión).
  // La web solo guarda el código y lo envía con el pedido; nunca descuenta por su cuenta.
  ambassadorDiscountNote: true,

  // DISPONIBILIDAD B2B (indicador en Partners)
  //   null        → neutral: "to be announced" (usar hasta que exista un dato real)
  //   "available" → verde · "limited" → naranja · "waitlist" → rojo
  // Más adelante el backend puede definirlo con: window.MALACONDA_AVAILABILITY = "limited"
  availability: null,

  // PRE-ORDER B2B (sección Partners)
  preorder: {
    pricePerBox: null,      // precio MAYORISTA por caja (12 x 200 ml). null = no se muestran importes.
                            // NO es el precio B2C (CHF 39). Pon el mismo valor en preorder.php
    discount: 0.10,         // 10% en el primer pedido
    depositRate: 0.20,      // 20% de anticipo
    // Payment Links de Stripe para el anticipo (vacío = factura por email)
    paymentLinks: { 5: "", 10: "" },
  },
};

document.documentElement.classList.add("js");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;


/* =============================================================
   2. IDIOMA (EN / DE) — inglés en index.html, alemán en js/i18n.js
   ============================================================= */
let LANG = "en";
const t = (key) => {
  const m = (typeof I18N !== "undefined" && I18N.messages[key]) || null;
  return m ? (m[LANG] || m.en) : key;
};

function setLang(lang) {
  if (typeof I18N === "undefined") return;
  LANG = lang === "de" ? "de" : "en";
  const dict = I18N.de;
  const root = document.documentElement;
  root.lang = LANG;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    if (el.dataset.en === undefined) el.dataset.en = el.innerHTML;
    const de = dict.text[el.dataset.i18n];
    el.innerHTML = LANG === "de" && de ? de : el.dataset.en;
  });

  if (!root.dataset.enTitle) {
    root.dataset.enTitle = document.title;
    root.dataset.enDesc = document.querySelector('meta[name="description"]')?.content || "";
  }
  document.title = LANG === "de" ? dict.meta.title : root.dataset.enTitle;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = LANG === "de" ? dict.meta.description : root.dataset.enDesc;

  document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === LANG)));
  document.querySelectorAll("[data-field-lang]").forEach((i) => (i.value = LANG));
  try { localStorage.setItem("malaconda-lang", LANG); } catch (e) {}
  document.dispatchEvent(new CustomEvent("langchange"));
}
document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));


/* =============================================================
   3. IMÁGENES DE RESPALDO (logo e insignia en texto si falta el archivo)
   ============================================================= */
document.querySelectorAll("img[data-fallback]").forEach((img) => {
  const fail = () => img.parentElement.classList.add("is-fallback");
  if (img.complete && img.naturalWidth === 0) fail();
  img.addEventListener("error", fail);
});


/* =============================================================
   4. BARRA DE ANUNCIOS · NAVEGACIÓN · MENÚ MÓVIL
   ============================================================= */
const announce = document.querySelector("[data-announce]");
if (announce) {
  // Se recuerda el cierre por mensaje: si cambias el texto, vuelve a aparecer.
  const key = "malaconda-announce:" + announce.textContent.trim().slice(0, 60);
  try { if (localStorage.getItem(key)) announce.hidden = true; } catch (e) {}
  announce.querySelector("[data-announce-close]").addEventListener("click", () => {
    announce.hidden = true;
    try { localStorage.setItem(key, "1"); } catch (e) {}
  });
}

// La barra de navegación se esconde al bajar y aparece al subir
const nav = document.querySelector("[data-nav]");
let lastY = window.scrollY;
window.addEventListener("scroll", () => {
  const y = window.scrollY;
  nav.classList.toggle("is-scrolled", y > 10);
  const menuOpen = document.body.classList.contains("is-locked");
  if (!menuOpen) nav.classList.toggle("is-hidden", y > 400 && y > lastY + 4);
  if (y < lastY - 4) nav.classList.remove("is-hidden");
  lastY = y;
}, { passive: true });

// Botones de sección: desplazamiento suave hasta cada parte, descontando la barra fija.
// (Funciona también cuando la web se ve dentro de un visor que no sigue los enlaces #)
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.hasAttribute("data-shop-open") || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
  const id = a.getAttribute("href").slice(1);
  const target = id && document.getElementById(id);
  if (!target || target.closest("[data-choose], [data-cart]")) return;
  e.preventDefault();
  const navH = nav ? nav.getBoundingClientRect().height : 0;
  const y = target.getBoundingClientRect().top + window.scrollY - navH - 8;
  window.scrollTo({ top: Math.max(0, y), behavior: reduceMotion ? "auto" : "smooth" });
  try { history.replaceState(null, "", "#" + id); } catch (err) {}
});

// Enlace activo en el menú según la sección visible
const navLinks = [...document.querySelectorAll(".nav__links a")];
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + e.target.id));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  ["shop", "partners", "ambassadors", "reviews", "contact"].forEach((id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}

// Menú móvil
const menu = document.querySelector("[data-menu]");
const burger = document.querySelector("[data-menu-open]");
function setMenu(open) {
  burger.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("is-locked", open);
  if (open) {
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add("is-open"));
  } else {
    menu.classList.remove("is-open");
    setTimeout(() => { if (!menu.classList.contains("is-open")) menu.hidden = true; }, 350);
  }
}
burger.addEventListener("click", () => setMenu(burger.getAttribute("aria-expanded") !== "true"));
menu.querySelectorAll("[data-menu-link]").forEach((a) => a.addEventListener("click", () => setMenu(false)));


// Indicador de disponibilidad B2B
const statusEl = document.querySelector("[data-status]");
function renderStatus() {
  if (!statusEl) return;
  const state = window.MALACONDA_AVAILABILITY || CONFIG.availability;
  const valid = ["available", "limited", "waitlist"].includes(state) ? state : "unset";
  statusEl.dataset.state = valid;
  statusEl.querySelector("[data-status-text]").textContent = t("status-" + valid);
}
document.addEventListener("langchange", renderStatus);
renderStatus();


/* =============================================================
   5. MOVIMIENTO
   ============================================================= */
// Revelado al entrar en pantalla
const revealEls = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window && !reduceMotion) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("is-visible"));
}

// Parallax suave en imágenes con data-parallax="0.05" (solo escritorio)
const parallaxEls = [...document.querySelectorAll("[data-parallax]")];
if (parallaxEls.length && !reduceMotion) {
  let ticking = false;
  const update = () => {
    const vh = window.innerHeight;
    const active = window.innerWidth > 720;
    parallaxEls.forEach((el) => {
      if (!active) { el.style.transform = ""; return; }
      const box = el.parentElement.getBoundingClientRect();
      if (box.bottom < 0 || box.top > vh) return;
      const progress = (box.top + box.height / 2 - vh / 2) / vh;      // -1 … 1
      const speed = parseFloat(el.dataset.parallax) || 0.05;
      const base = el.closest(".frame--hero") ? " scale(1.12)" : " scale(1.08)";
      el.style.transform = `translate3d(0, ${(-progress * speed * 100).toFixed(2)}%, 0)${base}`;
    });
    ticking = false;
  };
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener("resize", update);
  update();
}


/* =============================================================
   6. CARRITO
   Productos: atributos data-id, data-name, data-price en index.html
   ============================================================= */
const money = (n) => `${CONFIG.currency} ${Number(n).toFixed(2)}`;
document.querySelectorAll(".product").forEach((p) => {
  const el = p.querySelector("[data-price-display]");
  if (el) el.textContent = money(p.dataset.price);
});

let cart = [];
try { cart = JSON.parse(localStorage.getItem("malaconda-cart")) || []; } catch (e) {}
// Solo productos que siguen existiendo en la página
const productIds = new Set([...document.querySelectorAll(".product")].map((p) => p.dataset.id));
cart = cart.filter((i) => productIds.has(i.id));

const $ = (s) => document.querySelector(s);
const $cart = $("[data-cart]"), $overlay = $("[data-cart-overlay]"), $items = $("[data-cart-items]");
const $empty = $("[data-cart-empty]"), $subtotal = $("[data-cart-subtotal]"), $total = $("[data-cart-total]");
const $note = $("[data-checkout-note]"), $counts = document.querySelectorAll("[data-cart-count]");

let promo = null;
try { promo = localStorage.getItem("malaconda-promo"); } catch (e) {}
const stripeMode = () => CONFIG.checkoutMode === "stripe";

// El descuento del código ambassador lo calcula y valida el backend en el checkout.
const cartSubtotal = () => cart.reduce((s, i) => s + i.price * i.qty, 0);
const promoDiscount = () => 0;
const cartTotal = () => cartSubtotal();

function renderCart() {
  const count = cart.reduce((n, i) => n + i.qty, 0);
  $counts.forEach((c) => (c.textContent = count));
  $empty.hidden = cart.length > 0;
  $subtotal.textContent = money(cartSubtotal());
  $total.textContent = money(cartTotal());
  renderPromo();
  $items.innerHTML = cart.map((i) => `
    <li class="cart__item" data-id="${i.id}">
      <span class="cart__item-name">${i.name}</span>
      <span class="cart__item-price">${money(i.price * i.qty)}</span>
      <div class="cart__item-controls">
        <button type="button" data-cart-dec aria-label="Less">−</button>
        <span class="label">${i.qty}</span>
        <button type="button" data-cart-inc aria-label="More">+</button>
        <button type="button" class="cart__item-remove" data-cart-remove>${t("cart-remove")}</button>
      </div>
    </li>`).join("");
  try { localStorage.setItem("malaconda-cart", JSON.stringify(cart)); } catch (e) {}
}

// Modo "revisión del pre-order" dentro del mismo panel lateral (B2B, separado del carrito)
function setReview(on) {
  $cart.classList.toggle("is-review", on);
  const box = $("[data-pre-review]");
  if (box) box.hidden = !on;
  const title = $("[data-cart-title]");
  if (title) title.textContent = t(on ? "review-label" : "cart-title");
}
function openCart() {
  $overlay.hidden = false;
  requestAnimationFrame(() => $overlay.classList.add("is-visible"));
  $cart.classList.add("is-open");
  $cart.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-locked");
}
function closeCart() {
  setTimeout(() => { if (!$cart.classList.contains("is-open")) setReview(false); }, 400);
  $overlay.classList.remove("is-visible");
  $cart.classList.remove("is-open");
  $cart.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is-locked");
  setTimeout(() => { if (!$cart.classList.contains("is-open")) $overlay.hidden = true; }, 400);
}

document.querySelectorAll("[data-qty]").forEach((q) => {
  const input = q.querySelector("[data-qty-input]");
  const clamp = (v) => Math.max(1, Math.min(99, parseInt(v, 10) || 1));
  q.querySelector("[data-qty-minus]").addEventListener("click", () => (input.value = clamp(+input.value - 1)));
  q.querySelector("[data-qty-plus]").addEventListener("click", () => (input.value = clamp(+input.value + 1)));
  input.addEventListener("change", () => (input.value = clamp(input.value)));
});

document.querySelectorAll("[data-add-to-cart]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const p = btn.closest(".product");
    const qty = parseInt(p.querySelector("[data-qty-input]").value, 10) || 1;
    const existing = cart.find((i) => i.id === p.dataset.id);
    if (existing) existing.qty += qty;
    else cart.push({ id: p.dataset.id, name: p.dataset.name, price: parseFloat(p.dataset.price), qty });
    renderCart();
    btn.classList.add("is-added"); setTimeout(() => btn.classList.remove("is-added"), 1400);
    $counts.forEach((c) => { c.classList.add("is-bump"); setTimeout(() => c.classList.remove("is-bump"), 300); });
    openCart();
  });
});

$items.addEventListener("click", (e) => {
  const li = e.target.closest(".cart__item");
  const item = li && cart.find((i) => i.id === li.dataset.id);
  if (!item) return;
  if (e.target.matches("[data-cart-inc]")) item.qty += 1;
  if (e.target.matches("[data-cart-dec]")) item.qty -= 1;
  if (e.target.matches("[data-cart-remove]") || item.qty < 1) cart = cart.filter((i) => i !== item);
  renderCart();
});

document.querySelectorAll("[data-cart-open]").forEach((b) => b.addEventListener("click", openCart));
$("[data-cart-close]").addEventListener("click", closeCart);
$overlay.addEventListener("click", closeCart);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  closeCart();
  if (burger.getAttribute("aria-expanded") === "true") setMenu(false);
});

// ---------- Código promocional ----------
const $promo = {
  toggle: $("[data-promo-toggle]"), form: $("[data-promo-form]"), input: $("[data-promo-input]"),
  applied: $("[data-promo-applied]"), code: $("[data-promo-code]"), msg: $("[data-promo-msg]"),
  line: $("[data-promo-line]"), lineLabel: $("[data-promo-line-label]"), discount: $("[data-promo-discount]"),
};
function renderPromo() {
  const has = !!promo;
  $promo.applied.hidden = !has;
  $promo.toggle.hidden = has;
  if (has) $promo.form.hidden = true;
  $promo.code.textContent = has ? promo : "";
  $promo.line.hidden = !(has && cart.length);
  $promo.lineLabel.textContent = `${t("promo-discount")} (${promo || ""})`;
  $promo.discount.textContent = t("promo-pending");
}
$promo.toggle.addEventListener("click", () => {
  $promo.form.hidden = !$promo.form.hidden;
  $promo.toggle.setAttribute("aria-expanded", String(!$promo.form.hidden));
  if (!$promo.form.hidden) $promo.input.focus();
});
$promo.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const code = $promo.input.value.trim().toUpperCase();
  if (!code) return;
  if (/^[A-Z0-9-]{3,30}$/.test(code)) {
    promo = code;
    try { localStorage.setItem("malaconda-promo", code); } catch (e) {}
    $promo.input.value = "";
    $promo.msg.textContent = t("promo-at-checkout");
    renderCart();
  } else {
    $promo.msg.textContent = t("promo-invalid");
  }
});
$("[data-promo-remove]").addEventListener("click", () => {
  promo = null;
  try { localStorage.removeItem("malaconda-promo"); } catch (e) {}
  $promo.msg.textContent = "";
  renderCart();
});

// ---------- Checkout ----------
$("[data-checkout]").addEventListener("click", async () => {
  if (!cart.length) { $note.textContent = t("cart-empty-checkout"); return; }

  if (stripeMode()) {
    // El backend recibe SOLO ids y cantidades: los precios los pone el servidor, nunca el navegador.
    $note.textContent = t("checkout-loading");
    try {
      const res = await fetch(CONFIG.checkoutEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart.map((i) => ({ id: i.id, quantity: i.qty })), promoCode: promo, locale: LANG, currency: CONFIG.currency }),
      });
      const data = await res.json();
      if (res.ok && data.url) { window.location.href = data.url; return; }
      throw new Error();
    } catch (e) {
      $note.textContent = t("checkout-error") + " " + CONFIG.orderEmail;
    }
    return;
  }

  // Modo email (provisional, sin pago online)
  const lines = cart.map((i) => `${i.qty} × ${i.name} — ${money(i.price * i.qty)}`);
  if (promo) lines.push(`${t("promo-label")}: ${promo} (${t("promo-pending")})`);
  const text = `${t("order-intro")}\n\n${lines.join("\n")}\n\n${t("cart-total-label")}: ${money(cartTotal())}\n${t("order-shipping")}`;
  window.location.href = `mailto:${CONFIG.orderEmail}?subject=${encodeURIComponent(t("order-subject"))}&body=${encodeURIComponent(text)}`;
  $note.textContent = t("cart-confirm");
});

// Vuelta desde Stripe Checkout: success_url = https://tudominio.com/#order-paid
if (location.hash === "#order-paid") {
  cart = []; promo = null;
  try { localStorage.removeItem("malaconda-cart"); localStorage.removeItem("malaconda-promo"); } catch (e) {}
}


/* =============================================================
   7. FORMULARIOS
   Solo se muestra "enviado" si el servidor responde { ok: true }.
   ============================================================= */
function wireForm(form, okKey, onOk) {
  if (!form) return;
  const status = form.querySelector("[data-form-status]");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { status.textContent = t("form-required"); form.reportValidity(); return; }
    status.textContent = t("sending");
    try {
      const res = await fetch(form.action, { method: "POST", body: new FormData(form) });
      const data = await res.json().catch(() => ({}));
      if (!(res.ok && data.ok)) throw new Error(data.error || "");
      if (onOk && onOk(data) === false) return;
      form.reset();
      document.querySelectorAll("[data-field-lang]").forEach((i) => (i.value = LANG));
      status.textContent = t(okKey);
    } catch (err) {
      status.textContent = (err.message ? err.message + " " : "") + t("send-error") + " " + CONFIG.orderEmail;
    }
  });
}

wireForm($("[data-contact-form]"), "contact-ok");
wireForm($("[data-apply-form]"), "apply-ok");

// "Apply now" abre el formulario de ambassadors
const applyPanel = $("[data-apply]"), applyBtn = $("[data-apply-open]");
applyBtn.addEventListener("click", () => {
  applyPanel.hidden = false;
  applyBtn.setAttribute("aria-expanded", "true");
  applyPanel.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  setTimeout(() => applyPanel.querySelector("input")?.focus({ preventScroll: true }), 600);
});
applyPanel.querySelector("[data-apply-close]").addEventListener("click", () => {
  applyPanel.hidden = true;
  applyBtn.setAttribute("aria-expanded", "false");
});

// Pre-order B2B
const preForm = $("[data-preorder-form]");
if (preForm) {
  const P = CONFIG.preorder;
  const q = (s) => preForm.closest(".preorder").querySelector(s);
  const submitBtn = preForm.querySelector("[data-preorder-submit]");
  const amounts = () => {
    const boxes = parseInt(preForm.querySelector("input[name=boxes]:checked").value, 10);
    const total = boxes * (P.pricePerBox || 0), discount = total * P.discount, net = total - discount, deposit = net * P.depositRate;
    return { boxes, total, discount, net, deposit, balance: net - deposit };
  };
  const hasPrice = typeof P.pricePerBox === "number" && P.pricePerBox > 0;
  const update = () => {
    const a = amounts();
    q("[data-sum-bottles]").textContent = `${a.boxes * 12} × 200 ml`;
    q(".summary").querySelectorAll("[data-sum-row]").forEach((r) => (r.hidden = !hasPrice));
    q("[data-sum-norate]").hidden = hasPrice;
    q("[data-field-total]").value = hasPrice ? a.net.toFixed(2) : "";
    q("[data-field-deposit]").value = hasPrice ? a.deposit.toFixed(2) : "";
    submitBtn.innerHTML = t("preorder-review") + ' <span class="btn__arrow" aria-hidden="true">→</span>';
    if (!hasPrice) return;
    q("[data-sum-total]").textContent = money(a.total);
    q("[data-sum-discount]").textContent = "− " + money(a.discount);
    q("[data-sum-deposit]").textContent = money(a.deposit);
    q("[data-sum-balance]").textContent = money(a.balance);
  };
  preForm.querySelectorAll("input[name=boxes]").forEach((r) => r.addEventListener("change", update));
  document.addEventListener("langchange", update);
  update();

  // Paso 1: "Review your pre-order" → muestra el pedido en el panel lateral.
  // Paso 2: "Confirm & pay" → envía a preorder.php y, si hay Payment Link, va a Stripe.
  let reviewed = false;
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const optText = (sel) => sel.options[sel.selectedIndex]?.textContent.trim() || "";
  function fillReview() {
    const a = amounts();
    const rows = [
      [t("review-allocation"), `${preForm.querySelector("input[name=boxes]:checked").closest("label").querySelector("b").textContent} · ${a.boxes * 12} × 200 ml`],
      [t("review-flavors"), optText(preForm.flavour_mix)],
      [t("review-business"), `${preForm.business.value} · ${optText(preForm.business_type)}`],
      [t("review-contact"), `${preForm.contact.value}<br>${preForm.email.value}<br>${preForm.phone.value}`],
      [t("review-address"), preForm.address.value],
    ];
    $("[data-pre-review-list]").innerHTML = rows.map(([k, v], i) =>
      `<div><dt class="label label--muted">${esc(k)}</dt><dd>${i === 3 ? v.split("<br>").map(esc).join("<br>") : esc(v)}</dd></div>`).join("");
    $("[data-pre-review-amounts]").innerHTML = hasPrice
      ? `<div><dt class="label label--muted">${t("sum-total")}</dt><dd>${money(a.net)}</dd></div>
         <div class="cart__total"><dt class="label">${t("sum-deposit")}</dt><dd>${money(a.deposit)}</dd></div>
         <div><dt class="label label--muted">${t("sum-balance")}</dt><dd>${money(a.balance)}</dd></div>`
      : `<div><dt class="label label--muted">${t("sum-price")}</dt><dd class="label">${t("sum-price-note")}</dd></div>`;
    const link = P.paymentLinks[a.boxes];
    $("[data-pre-confirm]").innerHTML = t(link ? "preorder-pay" : "preorder-submit") + ' <span class="btn__arrow" aria-hidden="true">→</span>';
    $("[data-pre-review-note]").textContent = t(link ? "review-note-stripe" : "review-note-invoice");
  }
  preForm.addEventListener("submit", (e) => {
    if (reviewed) { reviewed = false; return; }          // segundo paso: lo gestiona wireForm
    e.preventDefault();
    e.stopImmediatePropagation();
    const status = preForm.querySelector("[data-form-status]");
    if (!preForm.checkValidity()) { status.textContent = t("form-required"); preForm.reportValidity(); return; }
    status.textContent = "";
    fillReview();
    setReview(true);
    openCart();
  });
  $("[data-pre-confirm]").addEventListener("click", () => {
    reviewed = true;
    closeCart();
    preForm.requestSubmit();
  });
  $("[data-pre-edit]").addEventListener("click", () => {
    closeCart();
    setTimeout(() => preForm.querySelector("input:not([type=radio]):not([type=hidden])")?.focus(), 420);
  });

  wireForm(preForm, "preorder-invoice", (data) => {
    const link = P.paymentLinks[amounts().boxes];
    if (!link) return true;
    preForm.querySelector("[data-form-status]").textContent = t("preorder-redirect");
    window.location.href = `${link}?prefilled_email=${encodeURIComponent(preForm.email.value)}&client_reference_id=${encodeURIComponent(data.ref || "")}`;
    return false;
  });
  preForm.addEventListener("reset", () => setTimeout(update));
}
// Botones "Pay 20% downpayment": enlazan a CONFIG.preorder.paymentLinks
(function () {
  const links = document.querySelectorAll("[data-deposit-link]");
  let missing = false;
  links.forEach((a) => {
    const url = CONFIG.preorder.paymentLinks[a.dataset.depositLink];
    if (url) {
      a.href = url;
      a.rel = "noopener";
    } else {
      missing = true;
      a.removeAttribute("href");
      a.setAttribute("aria-disabled", "true");
      a.classList.add("is-disabled");
    }
  });
  const note = $("[data-deposit-pending]");
  if (note) note.hidden = !missing;
})();

if (location.hash === "#preorder-paid") {
  const done = $("[data-preorder-done]");
  if (done) { done.hidden = false; $("#preorder").scrollIntoView(); }
}

// Newsletter: se envía a contact.php (te llega por email). Solo confirma si el servidor responde.
const newsletter = $("[data-newsletter]");
if (newsletter) {
  newsletter.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = newsletter.querySelector("button");
    const fd = new FormData();
    fd.append("name", "Newsletter");
    fd.append("email", newsletter.querySelector("input").value);
    fd.append("topic", "Newsletter");
    fd.append("message", "Newsletter signup (" + LANG + ")");
    try {
      const res = await fetch("contact.php", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok) throw new Error();
      btn.textContent = t("newsletter-ok");
      newsletter.reset();
    } catch (err) {
      btn.textContent = t("newsletter-error");
    }
  });
}

document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));


/* =============================================================
   8. INICIO
   ============================================================= */
document.addEventListener("langchange", () => { $promo.msg.textContent = ""; renderCart(); });
renderCart();

(() => {
  let saved = null;
  try { saved = localStorage.getItem("malaconda-lang"); } catch (e) {}
  const lang = saved || ((navigator.language || "").toLowerCase().startsWith("de") ? "de" : "en");
  if (lang === "de") setLang("de");
  else document.querySelectorAll("[data-field-lang]").forEach((i) => (i.value = "en"));
})();
