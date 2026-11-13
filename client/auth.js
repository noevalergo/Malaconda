/* MALACONDA PROTOTYPE - login, sign-up, forced password change, and shared profile / password panels */
(function () {
  const { $, esc } = Common;

  // after logging in or signing up, a visitor coming from the cart or the checkout goes back there
  const NEXT = ["checkout.html", "shop.html"];
  function goNext() { const n = new URLSearchParams(location.search).get("next"); if (NEXT.includes(n)) { location.href = n; return true; } return false; }

  /* ---------- login ---------- */
  function loginView(role, title, intro, opts) {
    const signup = opts.signup ? `<p class="small">New here? <button class="link-quiet" type="button" id="to-signup">Create an account</button></p>` : "";
    const other = opts.otherSpaces ? `<p class="small muted">Venue or ambassador? <a class="link-quiet" href="pro-space.html">Pro login</a> <a class="link-quiet" href="ambassador-space.html">Ambassador login</a></p>` : "";
    document.getElementById("app").innerHTML = `<div class="block login"><form class="card stack narrow" id="loginform">
      <h1 class="card__title">${esc(title)}</h1>${intro ? `<p>${intro}</p>` : ""}
      <div class="field"><label class="label" for="l-email">Email</label><input class="input" id="l-email" autocomplete="username" required></div>
      <div class="field"><label class="label" for="l-pw">Password</label><input class="input" id="l-pw" type="password" autocomplete="current-password" required></div>
      <button class="btn" type="submit">Log in</button><div id="lerr"></div>${signup}${other}
      <p class="hint demo-only">Prototype: see <a class="link-quiet" href="demo.html">demo accounts</a>.</p></form></div>`;
    $("#loginform").addEventListener("submit", (e) => {
      e.preventDefault();
      const u = Store.login(role, $("#l-email").value, $("#l-pw").value);
      if (!u) { $("#lerr").innerHTML = '<div class="alert alert--bad">Wrong email or password.</div>'; return; }
      // a pro also signs in on the server (same password) so the card payment can be priced there; no error if the venue is not on the server
      if (role === "pro") fetch("/api/pro/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: $("#l-email").value, password: $("#l-pw").value }) }).catch(() => {});
      if (goNext()) return;
      boot(role, title, intro, opts);
    });
    const s = $("#to-signup"); if (s) s.addEventListener("click", () => signupView(role, title, intro, opts));
  }

  function signupView(role, title, intro, opts) {
    document.getElementById("app").innerHTML = `<div class="block login"><form class="card stack narrow" id="signform">
      <h1 class="card__title">Create your account</h1>
      <div class="field"><label class="label" for="s-name">Name</label><input class="input" id="s-name" autocomplete="name" required></div>
      <div class="field"><label class="label" for="s-email">Email</label><input class="input" id="s-email" type="email" autocomplete="email" required></div>
      <div class="field"><label class="label" for="s-pw">Password</label><input class="input" id="s-pw" type="password" minlength="8" autocomplete="new-password" required><span class="hint">At least 8 characters.</span></div>
      <button class="btn" type="submit">Create account</button><div id="serr"></div>
      <p class="small">Already registered? <button class="link-quiet" type="button" id="to-login">Log in</button></p></form></div>`;
    $("#to-login").addEventListener("click", () => loginView(role, title, intro, opts));
    $("#signform").addEventListener("submit", (e) => {
      e.preventDefault();
      try { const c = Store.registerConsumer({ name: $("#s-name").value, email: $("#s-email").value, password: $("#s-pw").value }); Store.login("customer", c.email, $("#s-pw").value); if (goNext()) return; boot(role, title, intro, opts); }
      catch (err) { $("#serr").innerHTML = `<div class="alert alert--bad">${esc(err.message)}</div>`; }
    });
  }

  function changeView(role, user, done) {
    document.getElementById("app").innerHTML = `<div class="block login"><form class="card stack narrow" id="pwform">
      <h1 class="card__title">Choose your password</h1>
      <p>Your temporary password must be replaced before you continue.</p>
      <div class="field"><label class="label" for="n-pw">New password</label><input class="input" id="n-pw" type="password" minlength="8" autocomplete="new-password" required></div>
      <div class="field"><label class="label" for="n-pw2">Repeat</label><input class="input" id="n-pw2" type="password" minlength="8" autocomplete="new-password" required></div>
      <button class="btn" type="submit">Save password</button><div id="perr"></div></form></div>`;
    $("#pwform").addEventListener("submit", (e) => {
      e.preventDefault();
      const a = $("#n-pw").value, b = $("#n-pw2").value;
      if (a.length < 8) { $("#perr").innerHTML = '<div class="alert alert--bad">At least 8 characters.</div>'; return; }
      if (a !== b) { $("#perr").innerHTML = '<div class="alert alert--bad">Passwords do not match.</div>'; return; }
      if (a === user.password) { $("#perr").innerHTML = '<div class="alert alert--bad">Choose a different password.</div>'; return; }
      Store.changePassword(role, user.id, a); done();
    });
  }

  /* gate(role, title, intro, onReady(user), opts{signup, otherSpaces}) */
  const ready = {};
  function boot(role, title, intro, opts) {
    let user = Store.currentUser(role);
    const logout = () => { if (Store.DEMO_MODE) { location.href = Store.switchView("visitor"); } else { Store.logout(role); location.reload(); } };
    if (!user) { Common.appHeader(title, "", null); return new URLSearchParams(location.search).get("signup") && opts.signup ? signupView(role, title, intro, opts) : loginView(role, title, intro, opts); }
    Common.appHeader(title, user.name || user.contact, logout);
    if (user.mustChange) return changeView(role, user, () => boot(role, title, intro, opts));
    ready[role](user);
  }
  function gate(role, title, intro, onReady, opts) { ready[role] = onReady; boot(role, title, intro, opts || {}); }

  /* ---------- shared panels: profile form + password form ---------- */
  // fields: [{name,label,type,full,placeholder}]
  function profileForm(user, fields, title) {
    return `<form class="card stack" data-profile><p class="label">${esc(title || "Details")}</p><div class="form-grid">
      ${fields.map((f) => `<div class="field ${f.full ? "full" : ""}"><label class="label" for="pf-${f.name}">${esc(f.label)}</label><input class="input" id="pf-${f.name}" name="${f.name}" type="${f.type || "text"}" value="${esc(user[f.name] || "")}" ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ""}></div>`).join("")}
      </div><div class="row"><button class="btn btn--sm" type="submit">Save details</button></div><div data-profile-msg></div></form>`;
  }
  function passwordForm() {
    return `<form class="card stack" data-password><p class="label">Change password</p><div class="form-grid">
      <div class="field full"><label class="label" for="pw-old">Current password</label><input class="input" id="pw-old" type="password" autocomplete="current-password" required></div>
      <div class="field"><label class="label" for="pw-new">New password</label><input class="input" id="pw-new" type="password" minlength="8" autocomplete="new-password" required></div>
      <div class="field"><label class="label" for="pw-new2">Repeat</label><input class="input" id="pw-new2" type="password" minlength="8" autocomplete="new-password" required></div>
      </div><div class="row"><button class="btn btn--sm" type="submit">Update password</button></div><div data-password-msg></div></form>`;
  }
  function bindPanels(role, user, fields, afterSave) {
    const pf = $("[data-profile]");
    if (pf) pf.addEventListener("submit", (e) => {
      e.preventDefault(); const patch = {};
      fields.forEach((f) => (patch[f.name] = pf.elements[f.name].value));
      Store.updateProfile(role, user.id, patch);
      $("[data-profile-msg]").innerHTML = '<div class="alert alert--ok">Details saved.</div>';
      if (afterSave) afterSave();
    });
    const pw = $("[data-password]");
    if (pw) pw.addEventListener("submit", (e) => {
      e.preventDefault(); const msg = $("[data-password-msg]");
      const fresh = Store.currentUser(role);
      if ($("#pw-old").value !== fresh.password) { msg.innerHTML = '<div class="alert alert--bad">Current password is wrong.</div>'; return; }
      const a = $("#pw-new").value, b = $("#pw-new2").value;
      if (a.length < 8) { msg.innerHTML = '<div class="alert alert--bad">At least 8 characters.</div>'; return; }
      if (a !== b) { msg.innerHTML = '<div class="alert alert--bad">Passwords do not match.</div>'; return; }
      Store.changePassword(role, user.id, a); pw.reset();
      msg.innerHTML = '<div class="alert alert--ok">Password updated.</div>';
    });
  }

  window.Auth = { gate, profileForm, passwordForm, bindPanels };
})();
