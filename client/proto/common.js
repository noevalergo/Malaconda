/* MALACONDA PROTOTYPE - shared UI helpers (nav, footer, cart, theme toggle, formatting, toast) */
(function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const chf = (n) => `CHF ${Number(n).toLocaleString("en-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pct = (n) => `${Number(n)}%`;
  const date = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-");
  const monthLabel = (m) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const monthHtml = (m) => { const d = new Date(`${m}-01T12:00:00Z`); return `${d.toLocaleDateString("en-GB", { month: "long" })}<span class="year">${d.getUTCFullYear()}</span>`; };
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function toast(msg, link) {
    const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status");
    t.innerHTML = `<span>${esc(msg)}</span>${link ? `<a href="${esc(link.href)}">${esc(link.label)}</a>` : ""}`;
    document.body.appendChild(t); setTimeout(() => t.remove(), 4200);
  }

  /* ---- cart (consumer shop) ---- */
  const CART_KEY = "malaconda_proto_cart";
  const Cart = {
    get() { try { const c = JSON.parse(localStorage.getItem(CART_KEY)); return { lulo: +c.lulo || 0, guava: +c.guava || 0 }; } catch (e) { return { lulo: 0, guava: 0 }; } },
    save(c) { try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch (e) {} document.dispatchEvent(new CustomEvent("cart:changed")); },
    set(k, n) { const c = this.get(); c[k] = Math.max(0, Math.floor(n) || 0); this.save(c); },
    add(k, n) { const c = this.get(); c[k] = Math.max(0, c[k] + Math.floor(n)); this.save(c); },
    clear() { this.save({ lulo: 0, guava: 0 }); },
    count() { const c = this.get(); return c.lulo + c.guava; },
  };
  function paintCart() { $$("[data-cart-count]").forEach((el) => (el.textContent = Cart.count())); }
  document.addEventListener("cart:changed", paintCart);
  window.addEventListener("storage", (e) => { if (e.key === CART_KEY) paintCart(); });

  /* ---- theme toggle ---- */
  const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>';
  const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.8 6.8 0 0 0 9.7 9.7z"/></svg>';
  // the icon shows the mode you will switch to: sun at night, moon by day
  function paintTheme() {
    const dark = window.Theme.get() === "dark";
    $$("[data-theme-toggle]").forEach((b) => { b.className = "theme-btn"; b.innerHTML = dark ? SUN : MOON; b.setAttribute("aria-label", dark ? "Switch to day mode" : "Switch to night mode"); });
    $$("[data-theme-menu]").forEach((b) => { b.innerHTML = `<span class="sw" aria-hidden="true">${SUN}${MOON}<i class="sw__knob"></i></span>`; b.setAttribute("role", "switch"); b.setAttribute("aria-checked", dark ? "true" : "false"); b.setAttribute("aria-label", "Night mode"); });
  }
  document.addEventListener("theme:changed", paintTheme);

  const PUBLIC_LINKS = [
    ["Flavors", "index.html#flavors"], ["Story", "index.html#story"], ["Pros", "for-pros.html"],
    ["Ambassadors", "ambassadors.html"], ["Contact", "index.html#contact"],
  ];
  const LOGO = `<img class="logo-inv" src="../images/logo-wordmark.svg" alt="MALACONDA" width="126" height="26">`;

  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  function mountViewSwitch() {
    if (document.querySelector(".vfab")) return;
    const cur = Store.currentView();
    const fab = document.createElement("button"); fab.className = "vfab"; fab.type = "button"; fab.setAttribute("aria-label", "View as"); fab.setAttribute("aria-expanded", "false"); fab.innerHTML = EYE;
    const panel = document.createElement("div"); panel.className = "vpanel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Choose a view");
    panel.innerHTML = `<h2>View the site as</h2>${Store.DEMO_VIEWS.map((v) => `<button type="button" data-view="${v.value}" ${v.value === cur ? 'aria-current="true"' : ""}>${esc(v.label)}</button>`).join("")}`;
    document.body.append(panel, fab);
    const close = () => { panel.classList.remove("is-open"); fab.setAttribute("aria-expanded", "false"); };
    fab.addEventListener("click", () => { const o = panel.classList.toggle("is-open"); fab.setAttribute("aria-expanded", o); });
    // the page stays where it is and simply reloads with the new identity; only the private spaces (which belong to one role) move on
    const SPACES = ["account.html", "pro-space.html", "ambassador-space.html", "admin.html", "statement.html"];
    panel.addEventListener("click", (e) => {
      const b = e.target.closest("[data-view]"); if (!b) return;
      const href = Store.switchView(b.dataset.view);
      const page = location.pathname.split("/").pop() || "index.html";
      if (SPACES.includes(page)) location.href = href; else location.reload();
    });
    document.addEventListener("click", (e) => { if (!panel.contains(e.target) && !fab.contains(e.target)) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  }

  function reveal() {
    const els = $$(".reveal"); if (!els.length) return;
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("is-in")); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } }), { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
  }

  /* Parallax: sets --p (-1 below the viewport .. 1 above it) and --pa (|p|) on [data-parallax] elements.
     Plain scroll + rAF so it works in every browser (no scroll-timeline support needed). */
  function parallax() {
    const els = $$("[data-parallax]");
    if (!els.length || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    let queued = false;
    const run = () => {
      queued = false; const vh = innerHeight;
      els.forEach((el) => {
        const host = el.closest("[data-parallax-host]") || el;
        const r = host.getBoundingClientRect();
        if (r.bottom < -vh || r.top > 2 * vh) return;
        const p = Math.max(-1, Math.min(1, ((r.top + r.height / 2) - vh / 2) / ((vh + r.height) / 2)));
        el.style.setProperty("--p", p.toFixed(4)); el.style.setProperty("--pa", Math.abs(p).toFixed(4)); el.style.setProperty("--pz", (p > 0 ? 1 - p : 1).toFixed(4));
      });
    };
    const kick = () => { if (!queued) { queued = true; requestAnimationFrame(run); } };
    addEventListener("scroll", kick, { passive: true }); addEventListener("resize", kick); run();
  }

  /* ---- header account link: where "Log in" / "My account" leads, depending on who is viewing ---- */
  function accountLink() {
    const v = Store.currentView();
    const map = { customer: ["My account", "account.html"], "pro-new": ["My prices", "pro-space.html"], "pro-stacked": ["My prices", "pro-space.html"], "pro-negotiated": ["My prices", "pro-space.html"], "amb-camila": ["My space", "ambassador-space.html"], admin: ["Admin", "admin.html"] };
    return map[v] || ["Log in", "account.html"];
  }

  /* ---- cart: totals, and the side drawer that opens from the header ---- */
  const IMG = { lulo: "../images/lulo-bottle.jpg", guava: "../images/guava-bottle.jpg" };
  function cartSummary() {
    const c = Cart.get(), user = Store.currentUser("customer"), F = Store.FLAVORS;
    const lines = Object.keys(F).filter((k) => c[k] > 0).map((k) => ({ flavor: k, name: F[k].name, boxes: c[k] }));
    const boxes = lines.reduce((n, l) => n + l.boxes, 0);
    const p = Store.consumerPreview(user ? user.email : "", boxes, user && user.id);
    return { lines, boxes, user, price: p, unit: Store.get().settings.retailPrice, welcomePct: Store.get().settings.consumerWelcomePct, isFirst: !!user && Store.consumerIsFirst(user.email, user.id) };
  }
  // the invitation to create an account is only shown to someone who would still get the offer
  function welcomeNote(sum) {
    if (!sum.boxes) return "";
    if (sum.user) return sum.price.welcomePct ? `<p class="small cdrawer__note">${pct(sum.price.welcomePct)} off your first order is applied.</p>` : "";
    return `<p class="small cdrawer__note"><a class="link-quiet" href="account.html?signup=1&next=checkout.html">Create an account</a> and get ${pct(sum.welcomePct)} on your first order.</p>`;
  }
  function mountCartDrawer() {
    if (document.querySelector(".cdrawer")) return;
    const wrap = document.createElement("div"); wrap.className = "cdrawer-wrap";
    wrap.innerHTML = `<div class="cdrawer__veil" data-cart-close></div>
      <aside class="cdrawer" role="dialog" aria-modal="true" aria-label="Your cart" aria-hidden="true" tabindex="-1">
        <div class="cdrawer__head"><h2 class="display">Your cart</h2><button class="cdrawer__x" type="button" data-cart-close aria-label="Close cart">×</button></div>
        <div class="cdrawer__body" data-cart-body></div>
        <div class="cdrawer__foot" data-cart-foot></div>
      </aside>`;
    document.body.appendChild(wrap);
    const drawer = $(".cdrawer", wrap);
    let last = null;
    function paint() {
      const sum = cartSummary(), body = $("[data-cart-body]", wrap), foot = $("[data-cart-foot]", wrap);
      if (!sum.boxes) {
        body.innerHTML = `<p class="cdrawer__empty">Your cart is empty.</p>`;
        foot.innerHTML = `<a class="btn" href="index.html#flavors" data-cart-close>Pick a flavour</a>`;
        return;
      }
      body.innerHTML = sum.lines.map((l) => `<div class="cline" data-flavor="${l.flavor}"><img src="${IMG[l.flavor]}" alt="" width="56" height="70">
        <div class="cline__txt"><h3 class="flavor-name flavor-name--sm">${esc(l.name)}</h3><p class="small">${chf(sum.unit)} per box of 12</p></div>
        <div class="qty qty--sm"><button type="button" data-cart-step="-1" data-k="${l.flavor}" aria-label="Fewer ${esc(l.name)}">−</button><span aria-live="polite">${l.boxes}</span><button type="button" data-cart-step="1" data-k="${l.flavor}" aria-label="More ${esc(l.name)}">+</button></div></div>`).join("");
      const p = sum.price;
      foot.innerHTML = `${welcomeNote(sum)}<table class="breakdown"><tr><td>${sum.boxes} box${sum.boxes > 1 ? "es" : ""}</td><td>${chf(p.gross)}</td></tr>${p.welcomePct ? `<tr class="neg"><td>First order −${pct(p.welcomePct)}</td><td>−${chf(p.discount)}</td></tr>` : ""}<tr class="total"><td>Total (VAT incl.)</td><td>${chf(p.net)}</td></tr></table>
        <div class="cdrawer__cta"><a class="btn btn--ghost" href="shop.html">View cart</a><a class="btn" href="checkout.html">Checkout</a></div>`;
    }
    function open() { last = document.activeElement; paint(); wrap.classList.add("is-open"); drawer.setAttribute("aria-hidden", "false"); document.documentElement.classList.add("is-locked"); drawer.focus(); }
    function close() { wrap.classList.remove("is-open"); drawer.setAttribute("aria-hidden", "true"); document.documentElement.classList.remove("is-locked"); if (last && last.focus) last.focus(); }
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-cart-open]")) { e.preventDefault(); open(); return; }
      if (e.target.closest("[data-cart-close]")) { close(); return; }
      const st = e.target.closest("[data-cart-step]");
      if (st && wrap.contains(st)) Cart.add(st.dataset.k, Number(st.dataset.cartStep));
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && wrap.classList.contains("is-open")) close(); });
    document.addEventListener("cart:changed", () => { if (wrap.classList.contains("is-open")) paint(); });
    document.addEventListener("proto:changed", () => { if (wrap.classList.contains("is-open")) paint(); });
    window.addEventListener("storage", (e) => { if (e.key === CART_KEY && wrap.classList.contains("is-open")) paint(); });
    Common_open = open;
  }
  let Common_open = () => {};

  function mount(opts) {
    opts = opts || {};
    const active = opts.active || "";
    document.body.classList.toggle("is-home", active === "index.html");
    const [accLabel, accHref] = accountLink();
    const links = PUBLIC_LINKS.map(([l, h]) => `<a href="${h}" ${h === active ? 'aria-current="page"' : ""}>${l}</a>`).join("") + `<a class="only-sm" href="${accHref}">${accLabel}</a><button class="only-sm menu-theme" type="button" data-theme-menu></button>`;
    const nav = `<header class="nav"><div class="nav__in">
      <a class="nav__logo" href="index.html" aria-label="Malaconda home">${LOGO}</a>
      <nav class="nav__links" id="navlinks" aria-label="Main">${links}</nav>
      <div class="nav__cta">${window.I18n ? I18n.selectHtml() : ""}<button class="theme-btn" type="button" data-theme-toggle aria-label="Switch day or night mode"></button>
        ${(() => { const [al, ah] = accountLink(); return `<a class="link-quiet nav__account hide-sm" href="${ah}">${al}</a>`; })()}
        ${Store.currentUser("pro") ? "" : '<button class="link-quiet nav__cart" type="button" data-cart-open aria-haspopup="dialog">Cart <span data-cart-count>0</span></button>'}
        <a class="btn btn--sm hide-sm nav__shop" href="index.html#flavors">Shop now</a>
        <button class="burger" type="button" aria-expanded="false" aria-controls="navlinks">Menu</button></div></div></header>`;
    const footer = `<footer class="footer"><div class="block footer__in">
      <div class="footer__top">
        <div class="footer__brand"><a href="index.html" aria-label="Malaconda home">${LOGO}</a><img class="footer__badge logo-inv" src="../images/badge.svg" alt="" width="76" height="78" aria-hidden="true"></div>
        <form class="footer__news" data-newsletter><label class="label" for="nl-email">Newsletter</label>
          <div class="footer__news-row"><input class="input" id="nl-email" type="email" placeholder="email@" required autocomplete="email"><button class="btn btn--sm btn--ghost" type="submit">Join</button></div></form>
      </div>
      <div class="footer__bottom">
        <nav class="footer__links" aria-label="Footer"><a href="index.html#flavors">Shop</a><a href="for-pros.html">Pros</a><a href="ambassadors.html">Ambassadors</a><a href="index.html#contact">Contact</a><a href="https://www.instagram.com/drinkmalaconda/" target="_blank" rel="noopener">Instagram ↗</a></nav>
        <div class="footer__legal">${window.I18n ? I18n.buttonsHtml() : ""}<p class="label muted">© 2026 Malaconda. All rights reserved.</p><button type="button" data-theme-toggle></button></div>
      </div></div></footer>`;
    const n = document.getElementById("site-nav"); if (n) n.innerHTML = nav;
    const f = document.getElementById("site-footer"); if (f) f.innerHTML = footer;
    const b = $(".burger");
    if (b) {
      const veil = document.createElement("div"); veil.className = "nav-veil"; document.body.appendChild(veil);
      const setMenu = (o) => { $("#navlinks").classList.toggle("is-open", o); veil.classList.toggle("is-on", o); b.setAttribute("aria-expanded", o); document.documentElement.classList.toggle("is-locked", o); };
      b.addEventListener("click", () => setMenu(!$("#navlinks").classList.contains("is-open")));
      veil.addEventListener("click", () => setMenu(false));
      $("#navlinks").addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
      addEventListener("resize", () => { if (innerWidth > 1000) setMenu(false); });
    }
    wire(); mountCartDrawer(); reveal(); parallax();
    const nl = $("[data-newsletter]"); if (nl) nl.addEventListener("submit", (e) => { e.preventDefault(); nl.reset(); toast("You're on the list."); });
  }

  // minimal app header for the logged-in spaces
  function appHeader(title, userLabel, onLogout) {
    const el = document.getElementById("site-nav");
    el.innerHTML = `<header class="nav"><div class="nav__in" style="grid-template-columns:1fr auto"><a class="nav__logo" href="index.html">${LOGO}</a>
      <div class="nav__cta"><span class="label hide-sm">${esc(title)}${userLabel ? " · " + esc(userLabel) : ""}</span>${window.I18n ? I18n.selectHtml() : ""}<button class="theme-btn" type="button" data-theme-toggle aria-label="Switch day or night mode"></button>${onLogout && !Store.DEMO_MODE ? '<button class="btn btn--sm btn--ghost" id="logout" type="button">Log out</button>' : ""}</div></div></header>`;
    if (onLogout && $("#logout")) $("#logout").addEventListener("click", onLogout);
    wire();
  }

  function wire() {
    mountViewSwitch();
    $$("[data-theme-toggle], [data-theme-menu]").forEach((b) => b.addEventListener("click", () => window.Theme.toggle()));
    paintTheme(); paintCart();
  }

  window.Common = { esc, chf, pct, date, monthLabel, monthHtml, $, $$, toast, mount, appHeader, Cart, reveal, cartSummary, openCart: () => Common_open(), IMG };
})();
