/* =============================================================
   MALACONDA — Pantalla "Choose your poison"
   · Se abre con cualquier enlace o botón con data-shop-open, o con #choose en la URL.
   · Se cierra con ✕, Esc o el botón "atrás" del navegador.
   · Selector de sabor (sección Shop y esta pantalla, cada [data-picker]): los botones
     .choose__tab (data-pick) muestran la botella (data-flavor-img) y la ficha (.product data-flavor).
   Sin JavaScript, los botones Shop siguen llevando a la sección #shop.
   ============================================================= */
(function () {
  const panel = document.querySelector("[data-choose]");
  if (!panel) return;
  const root = document.documentElement;
  const nav = document.querySelector("[data-nav]");
  const page = [...document.body.children].filter((el) => el !== panel && !el.matches("script, .cart, .cart-overlay, [data-nav], [data-menu]"));
  const T = 600;
  let pushed = false;   // la apertura añadió una entrada al historial
  let opener = null;

  function open({ push = true } = {}) {
    if (panel.classList.contains("is-open")) return;
    opener = document.activeElement;
    panel.hidden = false;
    panel.scrollTop = 0;
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add("is-open")));
    panel.setAttribute("aria-hidden", "false");
    root.classList.add("choose-open");
    if (nav) nav.classList.remove("is-hidden");
    page.forEach((el) => (el.inert = true));
    if (push) { history.pushState({ choose: true }, "", "#choose"); pushed = true; }
    setTimeout(() => panel.querySelector("#choose-title")?.focus({ preventScroll: true }), 150);
  }

  function close({ fromHistory = false } = {}) {
    if (!panel.classList.contains("is-open")) return;
    if (!fromHistory && pushed) { history.back(); return; }   // popstate vuelve a llamar a close()
    pushed = false;
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    root.classList.remove("choose-open");
    page.forEach((el) => (el.inert = false));
    if (!fromHistory && location.hash === "#choose") history.replaceState(null, "", location.pathname + location.search);
    setTimeout(() => { if (!panel.classList.contains("is-open")) panel.hidden = true; }, T);
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  }

  // Abrir: botones y enlaces Shop
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-shop-open]");
    if (!trigger || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    open();
  });

  // Otros enlaces internos (menú, logo…) con la pantalla abierta: se cierra y se sigue el enlace
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]:not([data-shop-open])');
    if (!a || !panel.classList.contains("is-open") || panel.contains(a)) return;
    pushed = false;
    close({ fromHistory: true });
  });

  // Cerrar
  panel.querySelector("[data-choose-close]").addEventListener("click", () => close());
  // (fase de captura: se comprueba antes de que main.js cierre el carrito con la misma tecla)
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !panel.classList.contains("is-open")) return;
    if (document.body.classList.contains("is-locked")) return;   // el carrito o el menú se cierran primero
    close();
  }, true);
  window.addEventListener("popstate", () => {
    if (location.hash === "#choose") open({ push: false });
    else close({ fromHistory: true });
  });

  // Selector de sabor (sirve para la sección Shop y para esta pantalla: cada [data-picker])
  document.querySelectorAll("[data-picker]").forEach((box) => {
    const tabs = [...box.querySelectorAll("[data-pick]")];
    const pick = (flavor, focus) => {
      tabs.forEach((tab) => {
        const on = tab.dataset.pick === flavor;
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
        if (on && focus) tab.focus();
      });
      box.querySelectorAll("[data-flavor-img]").forEach((f) => f.classList.toggle("is-selected", f.dataset.flavorImg === flavor));
      box.querySelectorAll(".choose__panels .product").forEach((p) => {
        const on = p.dataset.flavor === flavor;
        p.classList.toggle("is-selected", on);
        p.inert = !on;
      });
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => pick(tab.dataset.pick));
      tab.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        pick(tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length].dataset.pick, true);
      });
    });
    if (tabs.length) pick(tabs[0].dataset.pick);
  });

  // Enlace directo: …/#choose
  if (location.hash === "#choose") { history.replaceState(null, "", location.pathname + location.search); open(); }

  window.MalacondaChoose = { open, close };
})();
