/* Layout audit, run in the browser console (or through a browser tool) on any page of the site.
   It reports what breaks when the text or the screen changes: sideways overflow, boxes that run off the screen,
   clipped text, and English words left in a translated page. Usage: paste it, then read the JSON it returns.
   Language: I18n.set("de"). Width: the browser's own responsive size. */
(function () {
  var vw = document.documentElement.clientWidth, out = { page: location.pathname.split("/").pop() || "index.html", lang: window.I18n ? I18n.get() : "en", width: vw, issues: [] };
  function name(el) {
    var s = el.tagName.toLowerCase(); if (el.id) s += "#" + el.id;
    var c = (el.className && typeof el.className === "string") ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""; if (c) s += "." + c;
    var t = (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40); return s + (t ? ' "' + t + '"' : "");
  }
  function inScroller(el) { for (var p = el.parentElement; p; p = p.parentElement) { var o = getComputedStyle(p).overflowX; if ((o === "auto" || o === "scroll") && p.scrollWidth > p.clientWidth) return true; } return false; }
  function visible(el) { var r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0"; }

  if (document.documentElement.scrollWidth > vw + 1) out.issues.push({ type: "page scrolls sideways", detail: document.documentElement.scrollWidth + "px wide in a " + vw + "px screen" });

  var seen = 0;
  document.querySelectorAll("body *").forEach(function (el) {
    if (seen > 25 || !visible(el)) return;
    var cs = getComputedStyle(el); if (cs.position === "fixed" && el.getAttribute("aria-hidden") === "true") return;
    var r = el.getBoundingClientRect();
    if ((r.right > vw + 1 || r.left < -1) && !inScroller(el) && !el.closest("[aria-hidden=true],.snake,.picker__words,.photo__frame,.band-photo,.pagehero") && el.children.length < 6) { out.issues.push({ type: "runs off the screen", el: name(el), left: Math.round(r.left), right: Math.round(r.right) }); seen++; }
    if ((cs.overflow === "hidden" || cs.overflowX === "hidden" || cs.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 2 && el.children.length === 0 && (el.innerText || "").trim()) { out.issues.push({ type: "text is cut off", el: name(el), needs: el.scrollWidth, has: el.clientWidth }); seen++; }
    if (cs.overflow === "hidden" && el.scrollHeight > el.clientHeight + 3 && (el.innerText || "").trim() && el.children.length < 4 && !/IMG|PICTURE/.test(el.tagName)) { out.issues.push({ type: "text is cut off at the bottom", el: name(el), needs: el.scrollHeight, has: el.clientHeight }); seen++; }
    if (el.children.length === 0 && (el.innerText || "").trim() && cs.display !== "inline" && cs.display !== "contents" && el.scrollWidth > el.clientWidth + 2 && !/INPUT|TEXTAREA|SELECT|svg/i.test(el.tagName) && cs.overflow !== "hidden") { out.issues.push({ type: "text wider than its box", el: name(el), needs: el.scrollWidth, has: el.clientWidth }); seen++; }
    if ((el.tagName === "BUTTON" || el.tagName === "A") && el.classList.contains("btn") && el.getBoundingClientRect().height > 90) { out.issues.push({ type: "button wraps into a tall block", el: name(el), height: Math.round(r.height) }); seen++; }
  });

  // English left in a page that is not English
  if (out.lang !== "en") {
    var EN = /\b(the|and|your|you|with|for|of|to|is|are|from|within|per|box|boxes|order|orders|delivery|free)\b/i, left = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      var n = w.currentNode, p = n.parentElement, t = n.nodeValue.replace(/\s+/g, " ").trim();
      if (!p || !t || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.tagName) || !visible(p) || t.length < 6) continue;
      var words = t.split(" "); var hits = words.filter(function (x) { return EN.test(x); }).length;
      if (hits >= 2 || (words.length >= 3 && hits >= 1 && EN.test(words[0]))) left.push(t.slice(0, 70));
    }
    if (left.length) out.issues.push({ type: "English text left untranslated", examples: left.slice(0, 8) });
  }
  return JSON.stringify(out);
})();
