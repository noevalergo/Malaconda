/* =============================================================
   MALACONDA — JavaScript
   1. CONFIG  ← edita aquí moneda, email de pedidos y WhatsApp
   2. Imágenes que aún no existen (muestra el recuadro de ayuda)
   3. Animaciones al hacer scroll
   4. Carrito
   5. Formulario de contacto y newsletter
   ============================================================= */


/* =============================================================
   1. CONFIG
   ============================================================= */
const CONFIG = {
  currency: "CHF",                    // moneda que se muestra junto al precio
  orderEmail: "hello@malaconda.com",  // email que recibe los pedidos

  // Cómo se envía el pedido al pulsar "Checkout":
  //   "email"    → abre el correo del cliente con el pedido escrito
  //   "whatsapp" → abre WhatsApp con el pedido escrito
  //   "link"     → envía al enlace de pago de abajo (Stripe, Shopify, etc.)
  checkoutMode: "email",
  whatsappNumber: "573105551230",     // sin + ni espacios
  checkoutLink: "",                   // ej: "https://buy.stripe.com/xxxx"

  // CÓDIGOS PROMOCIONALES (carrito)
  // type "percent" = % de descuento · type "fixed" = importe fijo en la moneda
  // Escribe los códigos en MAYÚSCULAS. Para códigos de ambassadors, usa uno por persona
  // (así sabes quién trajo cada venta y le pagas su 20% de comisión).
  // Si usas pago con Stripe (checkoutMode "link"), crea los mismos códigos en
  // Stripe → Product catalogue → Coupons y activa "Allow promotion codes" en el Payment Link.
  promoCodes: {
    "WELCOME10": { type: "percent", value: 10 },
    "SNAKE5":    { type: "fixed",   value: 5 },
    // "MARIA20":  { type: "percent", value: 10, ambassador: "Maria" },
  },

  // PRE-ORDER PARA PARTNERS (sección Partners)
  preorder: {
    pricePerBox: 36.00,     // precio de 1 caja (12 × 20 cl) para bares — CAMBIAR
    discount: 0.10,         // 10% de descuento en el primer pedido
    depositRate: 0.20,      // 20% de anticipo

    // Enlaces de pago de Stripe (Payment Links) para el 20% de anticipo.
    // Crea uno por opción en Stripe → Payment Links. Si los dejas vacíos,
    // el formulario solo envía el registro y tú mandas la factura por email.
    paymentLinks: {
      5:  "",   // ej: "https://buy.stripe.com/xxxx"  (anticipo 5 cajas)
      10: "",   // ej: "https://buy.stripe.com/yyyy"  (anticipo 10 cajas)
    },
  },
};


document.documentElement.classList.add("js");


/* =============================================================
   IDIOMA (EN / DE)
   Inglés: textos de index.html. Alemán: js/i18n.js
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
  document.documentElement.lang = LANG;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    if (el.dataset.en === undefined) el.dataset.en = el.innerHTML;
    const de = dict.text[el.dataset.i18n];
    el.innerHTML = LANG === "de" && de ? de : el.dataset.en;
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    if (el.dataset.enPh === undefined) el.dataset.enPh = el.placeholder;
    const de = dict.placeholders[el.dataset.i18nPh];
    el.placeholder = LANG === "de" && de ? de : el.dataset.enPh;
  });

  if (!document.documentElement.dataset.enTitle) {
    document.documentElement.dataset.enTitle = document.title;
    document.documentElement.dataset.enDesc = document.querySelector('meta[name="description"]')?.content || "";
  }
  document.title = LANG === "de" ? dict.meta.title : document.documentElement.dataset.enTitle;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = LANG === "de" ? dict.meta.description : document.documentElement.dataset.enDesc;

  document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === LANG)));
  document.querySelectorAll("[data-field-lang]").forEach((i) => (i.value = LANG));
  try { localStorage.setItem("malaconda-lang", LANG); } catch (e) {}
  document.dispatchEvent(new CustomEvent("langchange"));
}

document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));


/* =============================================================
   2. IMÁGENES QUE AÚN NO EXISTEN
   ============================================================= */
function markMissing(img) {
  const slot = img.closest(".img-slot");
  if (slot) slot.classList.add("is-empty");
  if (img.dataset.fallback) img.parentElement.classList.add("is-fallback");
}

document.querySelectorAll("img").forEach((img) => {
  if (img.complete && img.naturalWidth === 0) markMissing(img);
  img.addEventListener("error", () => markMissing(img));
});


/* =============================================================
   3. ANIMACIONES AL HACER SCROLL
   ============================================================= */
const revealEls = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

  revealEls.forEach((el) => observer.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("is-visible"));
}


/* =============================================================
   4. CARRITO
   Los productos se leen del HTML (data-id, data-name, data-price).
   El carrito se guarda en el navegador del visitante.
   ============================================================= */
const money = (n) => `${CONFIG.currency} ${Number(n).toFixed(2)}`;

// Mostrar precios con moneda en las tarjetas
document.querySelectorAll(".product").forEach((p) => {
  const el = p.querySelector("[data-price-display]");
  if (el) el.textContent = money(p.dataset.price);
});

const STORAGE_KEY = "malaconda-cart";
let cart = [];
try { cart = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { cart = []; }

const $cart     = document.querySelector("[data-cart]");
const $overlay  = document.querySelector("[data-cart-overlay]");
const $items    = document.querySelector("[data-cart-items]");
const $empty    = document.querySelector("[data-cart-empty]");
const $total    = document.querySelector("[data-cart-total]");
const $note     = document.querySelector("[data-checkout-note]");
const $counts   = document.querySelectorAll("[data-cart-count]");

function saveCart() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch (e) { /* sin almacenamiento */ }
}

function cartSubtotal() {
  return cart.reduce((sum, i) => sum + i.price * i.qty, 0);
}

// ---------- Código promocional ----------
let promo = null;
try { promo = localStorage.getItem("malaconda-promo"); } catch (e) {}
if (promo && !CONFIG.promoCodes[promo]) promo = null;

function promoDiscount() {
  if (!promo || !cart.length) return 0;
  const p = CONFIG.promoCodes[promo];
  const sub = cartSubtotal();
  const d = p.type === "fixed" ? p.value : sub * (p.value / 100);
  return Math.min(d, sub);
}

function cartTotal() {
  return cartSubtotal() - promoDiscount();
}

function renderCart() {
  const count = cart.reduce((n, i) => n + i.qty, 0);
  $counts.forEach((c) => (c.textContent = count));
  $empty.hidden = cart.length > 0;
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

  saveCart();
}

function openCart() {
  $cart.classList.add("is-open");
  $cart.setAttribute("aria-hidden", "false");
  $overlay.hidden = false;
  document.body.classList.add("cart-locked");
}
function closeCart() {
  $cart.classList.remove("is-open");
  $cart.setAttribute("aria-hidden", "true");
  $overlay.hidden = true;
  document.body.classList.remove("cart-locked");
}

function addToCart(product, qty) {
  const existing = cart.find((i) => i.id === product.id);
  if (existing) existing.qty += qty;
  else cart.push({ ...product, qty });
  renderCart();
  openCart();
}

// Cantidad en cada tarjeta
document.querySelectorAll("[data-qty]").forEach((q) => {
  const input = q.querySelector("[data-qty-input]");
  const clamp = (v) => Math.max(1, Math.min(99, parseInt(v, 10) || 1));
  q.querySelector("[data-qty-minus]").addEventListener("click", () => (input.value = clamp(+input.value - 1)));
  q.querySelector("[data-qty-plus]").addEventListener("click", () => (input.value = clamp(+input.value + 1)));
  input.addEventListener("change", () => (input.value = clamp(input.value)));
});

// Botones "Add to cart"
document.querySelectorAll("[data-add-to-cart]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const p = btn.closest(".product");
    const qty = parseInt(p.querySelector("[data-qty-input]").value, 10) || 1;
    addToCart({ id: p.dataset.id, name: p.dataset.name, price: parseFloat(p.dataset.price) }, qty);
  });
});

// Controles dentro del carrito
$items.addEventListener("click", (e) => {
  const li = e.target.closest(".cart__item");
  if (!li) return;
  const item = cart.find((i) => i.id === li.dataset.id);
  if (!item) return;
  if (e.target.matches("[data-cart-inc]")) item.qty += 1;
  if (e.target.matches("[data-cart-dec]")) item.qty -= 1;
  if (e.target.matches("[data-cart-remove]") || item.qty < 1) cart = cart.filter((i) => i !== item);
  renderCart();
});

document.querySelectorAll("[data-cart-open]").forEach((b) => b.addEventListener("click", openCart));
document.querySelector("[data-cart-close]").addEventListener("click", closeCart);
$overlay.addEventListener("click", closeCart);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCart(); });

// Checkout
document.querySelector("[data-checkout]").addEventListener("click", () => {
  if (!cart.length) { $note.textContent = t("cart-empty-checkout"); return; }

  const lines = cart.map((i) => `${i.qty} × ${i.name} — ${money(i.price * i.qty)}`);
  if (promo) lines.push(`${t("promo-label")}: ${promo} — − ${money(promoDiscount())}`);
  const text = `${t("order-intro")}\n\n${lines.join("\n")}\n\nTotal: ${money(cartTotal())}`;

  if (CONFIG.checkoutMode === "whatsapp") {
    window.open(`https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(text)}`, "_blank");
  } else if (CONFIG.checkoutMode === "link" && CONFIG.checkoutLink) {
    window.location.href = CONFIG.checkoutLink;
  } else {
    window.location.href = `mailto:${CONFIG.orderEmail}?subject=${encodeURIComponent(t("order-subject"))}&body=${encodeURIComponent(text)}`;
  }
  $note.textContent = t("cart-confirm");
});

// Interfaz del código promocional
const $promo = {
  toggle: document.querySelector("[data-promo-toggle]"),
  form: document.querySelector("[data-promo-form]"),
  input: document.querySelector("[data-promo-input]"),
  applied: document.querySelector("[data-promo-applied]"),
  code: document.querySelector("[data-promo-code]"),
  msg: document.querySelector("[data-promo-msg]"),
  line: document.querySelector("[data-promo-line]"),
  lineLabel: document.querySelector("[data-promo-line-label]"),
  discount: document.querySelector("[data-promo-discount]"),
};

function renderPromo() {
  if (!$promo.toggle) return;
  const has = !!promo;
  $promo.applied.hidden = !has;
  $promo.toggle.hidden = has;
  if (has) $promo.form.hidden = true;
  $promo.code.textContent = has ? promo : "";
  $promo.line.hidden = !(has && cart.length);
  $promo.lineLabel.textContent = has ? `${t("promo-discount")} (${promo})` : "";
  $promo.discount.textContent = "− " + money(promoDiscount());
}

if ($promo.toggle) {
  $promo.toggle.addEventListener("click", () => {
    $promo.form.hidden = !$promo.form.hidden;
    $promo.toggle.setAttribute("aria-expanded", String(!$promo.form.hidden));
    if (!$promo.form.hidden) $promo.input.focus();
  });
  $promo.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = $promo.input.value.trim().toUpperCase();
    if (!code) return;
    if (CONFIG.promoCodes[code]) {
      promo = code;
      try { localStorage.setItem("malaconda-promo", code); } catch (e) {}
      $promo.input.value = "";
      $promo.msg.textContent = t("promo-ok");
      renderCart();
    } else {
      $promo.msg.textContent = t("promo-invalid");
    }
  });
  document.querySelector("[data-promo-remove]").addEventListener("click", () => {
    promo = null;
    try { localStorage.removeItem("malaconda-promo"); } catch (e) {}
    $promo.msg.textContent = "";
    renderCart();
  });
}

document.addEventListener("langchange", () => { if ($promo.msg) $promo.msg.textContent = ""; renderCart(); });
renderCart();


/* =============================================================
   5. FORMULARIO DE CONTACTO Y NEWSLETTER
   ============================================================= */
// Envío por fetch a un archivo PHP (contact.php o apply.php)
function wireForm(form, okMessage) {
  if (!form) return;
  const status = form.querySelector("[data-form-status]");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      status.textContent = t("form-required");
      form.reportValidity();
      return;
    }
    status.textContent = t("sending");
    try {
      const res = await fetch(form.action, { method: "POST", body: new FormData(form) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        form.reset();
        status.textContent = t(okMessage);
      } else {
        status.textContent = data.error || t("send-error") + " " + CONFIG.orderEmail;
      }
    } catch (err) {
      status.textContent = t("send-error") + " " + CONFIG.orderEmail;
    }
  });
}

wireForm(document.querySelector("[data-contact-form]"), "contact-ok");
wireForm(document.querySelector("[data-apply-form]"), "apply-ok");

// ---------- PRE-ORDER (Partners) ----------
const preForm = document.querySelector("[data-preorder-form]");
if (preForm) {
  const P = CONFIG.preorder;
  const status = preForm.querySelector("[data-form-status]");
  const submitBtn = preForm.querySelector("[data-preorder-submit]");
  const $ = (sel) => preForm.querySelector(sel);

  function preorderAmounts() {
    const boxes = parseInt(preForm.querySelector("input[name=boxes]:checked").value, 10);
    const total = boxes * P.pricePerBox;
    const discount = total * P.discount;
    const net = total - discount;
    const deposit = net * P.depositRate;
    return { boxes, total, discount, net, deposit, balance: net - deposit };
  }

  function updateSummary() {
    const a = preorderAmounts();
    $("[data-sum-total]").textContent = money(a.total);
    $("[data-sum-discount]").textContent = "− " + money(a.discount);
    $("[data-sum-deposit]").textContent = money(a.deposit);
    $("[data-sum-balance]").textContent = money(a.balance);
    $("[data-field-total]").value = a.net.toFixed(2);
    $("[data-field-deposit]").value = a.deposit.toFixed(2);
    const hasLink = !!P.paymentLinks[a.boxes];
    submitBtn.innerHTML = t(hasLink ? "preorder-pay" : "preorder-submit") + ' <span aria-hidden="true">→</span>';
  }
  preForm.querySelectorAll("input[name=boxes]").forEach((r) => r.addEventListener("change", updateSummary));
  document.addEventListener("langchange", updateSummary);
  updateSummary();

  preForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!preForm.checkValidity()) {
      status.textContent = t("preorder-fields");
      preForm.reportValidity();
      return;
    }
    const a = preorderAmounts();
    const link = P.paymentLinks[a.boxes];
    status.textContent = t("sending");
    try {
      const res = await fetch(preForm.action, { method: "POST", body: new FormData(preForm) });
      const data = await res.json().catch(() => ({}));
      if (!(res.ok && data.ok)) throw new Error(data.error || "error");

      if (link) {
        // Va a Stripe con el email ya rellenado; Stripe envía el recibo.
        const email = encodeURIComponent(preForm.email.value);
        const ref = encodeURIComponent(data.ref || "");
        status.textContent = t("preorder-redirect");
        window.location.href = `${link}?prefilled_email=${email}&client_reference_id=${ref}`;
      } else {
        preForm.reset(); updateSummary();
        status.textContent = t("preorder-invoice");
      }
    } catch (err) {
      status.textContent = (err.message && err.message !== "error" ? err.message + " " : "") + t("send-error") + " " + CONFIG.orderEmail;
    }
  });
}

// Vuelta desde Stripe: en el Payment Link pon como redirección
// https://tudominio.com/#preorder-paid
if (location.hash === "#preorder-paid") {
  const done = document.querySelector("[data-preorder-done]");
  if (done) { done.hidden = false; document.querySelector("#preorder").scrollIntoView(); }
}

// ---------- SERPIENTE ANIMADA (Partners) ----------
// Carga images/snake.svg dentro de la página para poder animarla.
document.querySelectorAll("[data-snake]").forEach(async (box) => {
  try {
    const res = await fetch(box.dataset.snake);
    if (!res.ok) return;
    box.innerHTML = await res.text();
    const path = box.querySelector(".snake__path");
    if (path) box.style.setProperty("--len", Math.ceil(path.getTotalLength()));
    const start = () => box.classList.add("is-drawn");
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) { start(); io.disconnect(); }
      }, { threshold: 0.4 });
      io.observe(box);
    } else start();
  } catch (e) { /* si no se puede cargar, queda la imagen fija */ }
});

// "Apply now": abre el formulario de registro de ambassadors
const applyPanel = document.querySelector("[data-apply]");
const applyBtn = document.querySelector("[data-apply-open]");
if (applyPanel && applyBtn) {
  applyBtn.addEventListener("click", () => {
    applyPanel.hidden = false;
    applyBtn.setAttribute("aria-expanded", "true");
    applyPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => applyPanel.querySelector("input")?.focus({ preventScroll: true }), 500);
  });
  applyPanel.querySelector("[data-apply-close]").addEventListener("click", () => {
    applyPanel.hidden = true;
    applyBtn.setAttribute("aria-expanded", "false");
    applyBtn.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

// Botones "Become a partner" / "Apply now": eligen el tema del formulario
document.querySelectorAll("[data-topic]").forEach((link) => {
  link.addEventListener("click", () => {
    const select = document.querySelector("#f-topic");
    if (select) select.value = link.dataset.topic;
  });
});

// Newsletter: por ahora solo muestra confirmación.
// Conéctalo a tu servicio (Hostinger Reach, Mailchimp, Brevo...) cambiando este bloque.
const newsletter = document.querySelector("[data-newsletter]");
if (newsletter) {
  newsletter.addEventListener("submit", (e) => {
    e.preventDefault();
    const btn = newsletter.querySelector("button");
    btn.textContent = t("newsletter-ok");
    newsletter.reset();
  });
}

// Año automático en el footer
document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));


// Idioma inicial: el elegido antes, o alemán si el navegador está en alemán
(() => {
  let saved = null;
  try { saved = localStorage.getItem("malaconda-lang"); } catch (e) {}
  const lang = saved || ((navigator.language || "").toLowerCase().startsWith("de") ? "de" : "en");
  if (lang === "de") setLang("de");
  else document.querySelectorAll("[data-field-lang]").forEach((i) => (i.value = "en"));
})();
