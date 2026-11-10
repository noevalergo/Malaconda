/* Static checks on the prototype site: broken files, copy rules, brand rules.
   Run: node --test tests/*.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const DIR = path.join(__dirname, "..", "client", "proto");
const pages = fs.readdirSync(DIR).filter((f) => f.endsWith(".html"));
const read = (f) => fs.readFileSync(path.join(DIR, f), "utf8");
const visible = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<!--[\s\S]*?-->/g, "");
const textOf = (html) => visible(html).replace(/<[^>]+>/g, " ");
const PUBLIC = ["index.html", "for-pros.html", "ambassadors.html", "shop.html"];

test("every local src / href in every page points to an existing file", () => {
  for (const f of pages) {
    const html = read(f);
    for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const ref = m[1].split("#")[0].split("?")[0];
      if (!ref || ref.includes("${") || ref.includes("+") || /^(https?:|mailto:|data:|tel:)/.test(ref)) continue;
      assert.ok(fs.existsSync(path.join(DIR, ref)), `${f} references missing file ${ref}`);
    }
  }
});

test("local files referenced from scripts and css exist (images, fonts)", () => {
  const sources = ["common.js", "store.js", "proto.css"].map(read).join("\n");
  for (const m of sources.matchAll(/\.\.\/(images|fonts)\/[A-Za-z0-9._-]+/g)) {
    assert.ok(fs.existsSync(path.join(DIR, m[0])), `missing ${m[0]}`);
  }
});

test("ids are unique inside each page", () => {
  for (const f of pages) {
    const ids = [...read(f).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    assert.deepEqual(dup, [], `${f} has duplicate ids ${dup}`);
  }
});

test("every img has an alt attribute", () => {
  for (const f of pages) {
    for (const m of read(f).matchAll(/<img\b[^>]*>/g)) assert.match(m[0], /\balt=/, `${f}: ${m[0].slice(0, 80)}`);
  }
});

test("no em dash or en dash in public copy", () => {
  for (const f of PUBLIC) assert.ok(!/[—–]/.test(visible(read(f))), `${f} contains an em dash or en dash`);
});

test("the misspelt label 'Gurva' is nowhere in code, and the AI photo that carries it is not used", () => {
  for (const f of fs.readdirSync(DIR)) {
    if (!/\.(html|js|css)$/.test(f)) continue;
    const t = read(f);
    assert.ok(!/gurva/i.test(t), `${f} contains Gurva`);
    assert.ok(!t.includes("ambassadors-2.jpg"), `${f} uses ambassadors-2.jpg`);
  }
});

test("public pages never show the wholesale price or commission rates", () => {
  for (const f of PUBLIC) {
    const t = textOf(read(f));
    assert.ok(!/CHF\s?26/.test(t), `${f} shows the pro price`);
    assert.ok(!/commission|5\s?%/i.test(t), `${f} mentions commission or a percentage`);
  }
});

test("Pros and Ambassadors pages do not repeat their own name as a section hat", () => {
  for (const f of ["for-pros.html", "ambassadors.html"]) assert.ok(!/class="eyebrow"/.test(read(f)), `${f} has an eyebrow hat`);
});

test("form titles do not duplicate their button label", () => {
  for (const f of ["for-pros.html", "ambassadors.html"]) {
    const t = visible(read(f));
    const buttons = [...t.matchAll(/<button class="btn"[^>]*type="submit">([^<]+)</g)].map((m) => m[1].replace(/[→↓\s]+$/g, "").trim().toLowerCase());
    const heads = [...t.matchAll(/<h2[^>]*>([^<]+)</g)].map((m) => m[1].trim().toLowerCase());
    buttons.forEach((b) => assert.ok(!heads.includes(b), `${f}: heading repeats button "${b}"`));
  }
});

test("the contact form has the four topics", () => {
  const t = read("index.html");
  for (const topic of ["General", "Order", "Partner", "Press"]) assert.ok(t.includes(`data-v="${topic}"`), `missing topic ${topic}`);
});

test("home sections: only the flavour picker is forced to a full screen", () => {
  const css = read("proto.css");
  assert.ok(/#flavors\s*\{[^}]*height:calc\(100svh/.test(css), "picker should be one screen tall");
  assert.ok(!/\.band-flower\s*\{[^}]*min-height/.test(css), "story block must size to its content");
  assert.ok(!/\.band-photo\s*\{[^}]*100svh/.test(css), "ambassador band must size to its content");
  assert.ok(!/id="pros"[^>]*class="[^"]*screen/.test(read("index.html")), "pros section must size to its content");
});

test("story block colour follows the selected flavour (no random colour)", () => {
  const js = read("index.html");
  assert.ok(js.includes('$("#story").dataset.flavor=F[i].k'), "story should follow the picker");
  assert.ok(!/Math\.random\(\)/.test(js), "no random colour logic");
});

test("css braces are balanced and every script parses", () => {
  const css = read("proto.css");
  assert.equal(css.split("{").length, css.split("}").length);
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".js"))) new vm.Script(read(f), { filename: f });
});

test("fonts follow the brand guide: no other font family is declared", () => {
  const css = read("proto.css");
  const families = [...css.matchAll(/font-family:([^;}]+)/g)].map((m) => m[1]);
  families.forEach((f) => assert.ok(/Andreas|Chivo|DM Mono|var\(--font/.test(f), `unexpected font-family ${f}`));
  assert.ok(!/text-stroke:\s*1\.4px var\(--ink\)/.test(css), "no stroke hack to fake a lighter Andreas");
});

test("Pros page copy follows the founders' wording", () => {
  const t = read("for-pros.html");
  assert.ok(t.includes("The best bars, restaurants, clubs, hotels and distributors serve Malaconda to their clients."));
  assert.ok(t.includes("The more you buy, the cheaper it gets."));
  assert.ok(!t.includes("Order tracking"), "order tracking benefit was removed");
  assert.ok(!t.includes("Pour it at your bar"), "pros are not only bars");
  assert.ok(/object-position:50% 100%/.test(t), "hero photo is centred at the bottom so the hands are not cut");
});

test("day/night switch is a sun or moon icon, not a word", () => {
  const js = read("common.js");
  assert.ok(js.includes("const SUN") && js.includes("const MOON"));
  assert.ok(!/data-theme-toggle[^>]*>(Day|Night)</.test(js) || /className = "theme-btn"/.test(js));
});

test("hero accent words use the same colour tokens in day and night", () => {
  const css = read("proto.css");
  assert.ok(/data-theme="light"\] \.sticker \{ color:var\(--accent\)/.test(css), "light mode must use the night accent colour");
  const html = read("index.html");
  assert.ok(html.includes("nobody</span>") && html.includes("sticker\">nobody"));
});

test("the picker follows the theme (no forced dark band) and the hero photo never zooms out", () => {
  assert.ok(!/id="flavors"[^>]*class="[^"]*force-dark|class="[^"]*force-dark[^"]*" id="flavors"/.test(read("index.html")));
  assert.ok(/scale\(calc\(1\.02 \+ var\(--pz,0\)/.test(read("proto.css")), "zoom is driven by --pz which only grows");
});


test("statement page is a real document and never shows prices or discounts", () => {
  const html = read("statement.html");
  assert.ok(html.includes("Commission statement") && html.includes("window.print()"));
  assert.ok(!/unitPrices|boxPrice|welcomePct|creditPct|tierPct/.test(html), "no price or discount field on the statement");
  assert.ok(/@media print/.test(read("proto.css")), "print styles exist");
});

test("order forms record payment, delivery and tracking", () => {
  const js = read("admin.js");
  for (const id of ["o-pm", "o-paid", "o-inv", "o-car", "o-trk", "o-ship", "o-deliv", "o-via", "o-note"]) assert.ok(js.includes(`id="${id}"`), `admin order form has ${id}`);
  assert.ok(js.includes("Store.updateOrder") && js.includes("Store.createManualOrder"));
});

test("pro and customer spaces show payment and parcel tracking", () => {
  for (const f of ["pro-space.html", "account.html"]) {
    const t = read(f);
    assert.ok(t.includes("Parcel") && t.includes("Payment") && t.includes("Store.trackingUrl"), `${f} shows payment and parcel`);
  }
});

test("snake illustrations: the story svgs are used (contact reuses the top one, mirrored), nothing refers to removed pieces", () => {
  const css = read("proto.css"), html = read("index.html");
  for (const f of ["snake-story-top.svg", "snake-story-bottom.svg"]) {
    assert.ok(css.includes(f), `${f} is used`);
    assert.ok(fs.existsSync(path.join(__dirname, "..", "client", "images", f)), `${f} exists`);
  }
  assert.ok(!html.includes("story__end"), "the story block no longer repeats the closing line");
  assert.ok(!/snake-(tail|body|hero)\.svg/.test(css), "old snake pieces are gone");
});

test("every prototype page is noindex (it is shown to the founders on a temporary url)", () => {
  for (const f of pages) assert.ok(/<meta name="robots" content="noindex, nofollow">/.test(read(f)), `${f} lacks noindex`);
});

test("shop funnel: cart page, checkout page and header cart drawer exist and link to each other", () => {
  assert.ok(pages.includes("shop.html") && pages.includes("checkout.html"));
  assert.ok(read("shop.html").includes('href="checkout.html"'), "cart leads to checkout");
  const js = read("common.js");
  assert.ok(js.includes("data-cart-open") && js.includes("View cart") && js.includes("Checkout"), "header cart opens a drawer with View cart and Checkout");
  assert.ok(/Create an account<\/button>|Create an account<\/a>/.test(read("checkout.html")) && read("checkout.html").includes("on your first order"), "checkout invites guests to create an account");
  assert.ok(/class="link-quiet nav__account/.test(js), "header has a login / account link");
});

test("view-as stays on the page (only private spaces move)", () => {
  const js = read("common.js");
  assert.ok(js.includes("location.reload()") && /SPACES\.includes\(page\)/.test(js));
});
