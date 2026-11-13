/* MALACONDA PROTOTYPE - card payment with Stripe's Payment Element, dressed with the site's own colours and type.
   The server prices the order and creates the payment (api/app.js); this file only shows the form and confirms it. */
(function () {
  const FONTS = [{ cssSrc: "https://fonts.googleapis.com/css2?family=Chivo:wght@400;500&family=DM+Mono:wght@400;500&display=swap" }];

  function api(path, body) {
    return fetch("/api" + path, { method: body ? "POST" : "GET", headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Something went wrong."); return j; });
  }

  let stripePromise = null;
  function loadStripe() {
    if (!stripePromise) {
      stripePromise = api("/config").then((cfg) => {
        if (!cfg.stripePublishableKey) throw new Error("Payments are not configured yet.");
        if (window.Stripe) return window.Stripe(cfg.stripePublishableKey);
        return new Promise((resolve, reject) => {
          const s = document.createElement("script"); s.src = "https://js.stripe.com/v3/";
          s.onload = () => resolve(window.Stripe(cfg.stripePublishableKey));
          s.onerror = () => reject(new Error("The payment form could not be loaded. Check your connection."));
          document.head.appendChild(s);
        });
      }).catch((e) => { stripePromise = null; throw e; });
    }
    return stripePromise;
  }

  // Colours are read from the page at the moment of the call, so day and night both match the site.
  function appearance() {
    const v = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const paper = v("--paper"), ink = v("--ink"), surface = v("--surface"), line = v("--charcoal"), stone = v("--stone"), muted = v("--graphite"), bad = v("--bad");
    const mono = '"DM Mono", ui-monospace, monospace';
    return {
      theme: window.Theme && Theme.get() === "dark" ? "night" : "stripe",
      labels: "above",
      variables: { fontFamily: 'Chivo, system-ui, sans-serif', fontSizeBase: "16px", spacingUnit: "4px", borderRadius: "6px", colorPrimary: paper, colorBackground: surface, colorText: paper, colorTextSecondary: stone, colorTextPlaceholder: muted, colorDanger: bad, focusBoxShadow: "none", focusOutline: "none" },
      rules: {
        ".Label": { fontFamily: mono, fontSize: "12px", fontWeight: "500", letterSpacing: "0.08em", textTransform: "uppercase", color: stone },
        ".Input": { backgroundColor: surface, border: "1px solid " + line, boxShadow: "none", padding: "14px 16px", color: paper },
        ".Input:focus": { border: "1px solid " + stone, boxShadow: "none", outline: "none" },
        ".Input--invalid": { border: "1px solid " + bad, boxShadow: "none", color: paper },
        ".Error": { fontSize: "13px", color: bad },
        ".Tab": { border: "1px solid " + line, boxShadow: "none", backgroundColor: surface, color: stone, fontFamily: mono, fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase" },
        ".Tab:hover": { color: paper, border: "1px solid " + stone, boxShadow: "none" },
        ".Tab--selected, .Tab--selected:hover": { backgroundColor: paper, border: "1px solid " + paper, color: ink, boxShadow: "none" },
        ".TabIcon--selected, .TabIcon--selected:hover": { fill: ink },
        ".TabLabel--selected, .TabLabel--selected:hover": { color: ink },
        ".Block": { backgroundColor: surface, border: "1px solid " + line, boxShadow: "none" },
        ".AccordionItem": { backgroundColor: surface, border: "1px solid " + line, boxShadow: "none", color: paper },
        ".AccordionItem--selected": { border: "1px solid " + paper },
        ".RedirectText": { color: stone },
      },
    };
  }

  /* Mounts the Payment Element in `container`. The amount may change later (login, cart edits): call setAmount.
     Name and email are collected by the checkout form, so the element does not ask for them again. */
  async function mount(container, amountCents) {
    const stripe = await loadStripe();
    const elements = stripe.elements({ mode: "payment", amount: amountCents, currency: "chf", paymentMethodTypes: ["card", "twint"], appearance: appearance(), fonts: FONTS, locale: window.I18n ? I18n.get() : "auto" });
    const el = elements.create("payment", { layout: "tabs", fields: { billingDetails: { name: "never", email: "never" } }, defaultValues: { billingDetails: { address: { country: "CH" } } } });
    el.mount(container);
    document.addEventListener("theme:changed", () => elements.update({ appearance: appearance() }));
    return {
      stripe, elements, element: el,
      setAmount: (cents) => elements.update({ amount: cents }),
      onReady: (fn) => el.on("ready", fn),
      // validates the form, then pays: `clientSecret` comes from the server after elements.submit() has passed
      async pay(getClientSecret, { name, email, returnUrl }) {
        const sub = await elements.submit();
        if (sub.error) return { error: sub.error };
        const clientSecret = await getClientSecret();
        const r = await stripe.confirmPayment({ elements, clientSecret, redirect: "if_required", confirmParams: { return_url: returnUrl, payment_method_data: { billing_details: { name, email } } } });
        return r.error ? { error: r.error } : { clientSecret };
      },
    };
  }

  window.Pay = { api, loadStripe, mount };
})();
