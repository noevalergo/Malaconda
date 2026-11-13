/* MALACONDA PROTOTYPE - day/night theme. Loaded in <head> so the page never flashes. */
(function () {
  var KEY = "malaconda_theme";
  function read() { try { return localStorage.getItem(KEY) === "light" ? "light" : "dark"; } catch (e) { return "dark"; } }
  function apply(t) { document.documentElement.setAttribute("data-theme", t); }
  apply(read());
  if (/[?&]embed=1/.test(location.search)) document.documentElement.classList.add("embed");
  if ("IntersectionObserver" in window) document.documentElement.classList.add("js");
  window.Theme = {
    get: read,
    set: function (t) { try { localStorage.setItem(KEY, t); } catch (e) {} apply(t); document.dispatchEvent(new CustomEvent("theme:changed", { detail: t })); },
    toggle: function () { this.set(read() === "dark" ? "light" : "dark"); },
  };
})();
