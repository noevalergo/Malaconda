# Frontend audit — imported Claude Artifact

Source: owner's export `MALACONDA___Sparkling_soda_from_the_Amazon.zip`,
imported unchanged into `client/` (baseline commit on `feature/import-artifact`).

## 1. Integrity of the import

| Check | Result |
|---|---|
| Files in export | 15 (1 HTML, 1 CSS, 2 JS, 11 images) |
| Compared with published Artifact `F2m4WHYEEitt1mX7XLsXqd` (v. 1794182039-d5ec) | **Byte-identical** (SHA-256 of all 15 files) |
| Modified during import | **None** |

## 2. What the frontend is

A **static website**: plain HTML + CSS + JavaScript. No framework (not React),
no build step, no npm packages.

| File | Lines | Content |
|---|---|---|
| `index.html` | 726 | Whole one-page site, with Spanish `EDITAR` comments for editing |
| `css/styles.css` | 1461 | All styling. Design tokens (colours, fonts, sizes) at the top as CSS variables |
| `js/main.js` | 511 | Settings, EN/DE switch, scroll animations, cart, promo codes, forms |
| `js/i18n.js` | 204 | German translations (English is in the HTML) |
| `images/` | 11 files | Photos (JPG) and logo/badge/snake (SVG), ~2.4 MB total |

Sections: navigation → hero → photo collage → shop (2 flavours) → qualities →
Google reviews → partners pre-order (benefits, timeline, form) → ambassadors
(apply form) → contact form → footer (newsletter) → cart drawer.

Design tokens (`css/styles.css` §1):

- Colours: `--ink #131313`, `--surface #1B1B1B`, `--paper #E9E9E1`,
  flavours `--lulo #FFD900`, `--guava #FF7E6E`, `--berry #95F6EE` (unused third flavour)
- Fonts: **Andreas** (headlines), **Chivo** (body), **DM Mono** (labels),
  fallback **Big Shoulders Display** for headlines

## 3. Test outside the Artifact environment

Served as plain static files and opened in Chromium at desktop (1440 px),
tablet (820 px) and phone (390 px):

| Check | Result |
|---|---|
| Page renders | ✅ all three widths |
| JavaScript errors | ✅ none |
| Horizontal scrolling on phone/tablet | ✅ none |
| Cart (add product, total) | ✅ works (local only) |
| Pre-order summary (5 boxes) | ✅ CHF 180.00 − 18.00 → downpayment 32.40, balance 129.60 |
| EN/DE translations | ✅ all 120 translated texts have a German version |
| Missing files (404) | ❌ `fonts/Andreas-Regular.woff2/.woff/.otf`, `images/review-1/2/3.jpg`, `images/favicon.png` |

Consequence: headlines currently render in the fallback font
(Big Shoulders Display), not in Andreas. Review photos fall back to initials.

## 4. Reusable without changes

- `css/styles.css` (the whole visual identity)
- All images
- `js/i18n.js` (only a few new message keys will be added)
- HTML structure of every section
- Animations, language switch, cart drawer, quantity controls, form layouts

## 5. Must change to work as a real shop (minimal, functional only)

| Where | Today | Problem | Needed change |
|---|---|---|---|
| `main.js` CONFIG `promoCodes` | Codes listed in browser code | Anyone can read them, so codes stop being secret | Check codes on the server |
| `main.js` prices, `data-price` | Prices set in browser | Browser values can be changed | Server is the price authority, page only displays |
| Cart "Checkout" | Opens email / WhatsApp | No payment | Call backend → Stripe Checkout |
| Pre-order form | Posts to `preorder.php` (doesn't exist) + Stripe Payment Links | Broken; amounts from browser | Post to backend, which calculates amounts and creates Stripe session |
| Contact form | Posts to `contact.php` (doesn't exist) | **Broken today** | Post to backend endpoint |
| Ambassador form | Posts to `apply.php` (doesn't exist) | **Broken today** | Post to backend endpoint |
| Newsletter | Only shows "Joined ✓" | Stores nothing | Owner decision: connect or remove |
| Timeline dates | Written in HTML and `i18n.js` | Not central | Owner decision: central config or keep in HTML |
| Return from Stripe | `#preorder-paid` only | No individual success/cancel | Add success / cancel handling using existing styles |

## 6. Leftover / unused code (no action without approval)

- `images/snake.svg` and its animation code: not used by any element in the page.
- `--berry` colour: a third flavour that isn't sold.
- 24 German translation keys for texts no longer in the page.
- `[data-topic]` handler: no element uses it.

These are harmless. Removing them is optional cleanup.

## 7. Content that must be real before launch

- Google reviews: sample texts and "Customer name" (must be real, with permission)
- Google score `–.–` and review link `YOUR-GOOGLE-ID`
- Phone `+57 310 555 12 30` (looks like a placeholder)
- Andreas font files (+ web licence), favicon, review photos
- Example promo codes `WELCOME10`, `SNAKE5`

## 8. Recommended integration approach (for approval)

**Keep the frontend as static HTML/CSS/JS and let one small Express server
serve it and provide the API.** No React, no Vite, no build step.

Why, given the project goals (basic shop, few products, simple code,
small attack surface, easy debugging, Hostinger Business Node.js):

- **Zero redesign risk**: the files that make the design stay as they are.
- **Fewer dependencies = fewer security issues**: the frontend has 0 npm packages.
- **Easier debugging**: what's in the file is what runs in the browser; no
  compiled bundle, no source maps.
- **Simplest deployment on Hostinger**: no build step; `npm start` runs one
  Node process that serves pages and API from the same domain (no CORS issues).
- **Editable in VS Code**: open `index.html` and change the text.

Changes to `client/` would be limited to `js/main.js` (connecting to the API),
form `action` attributes in `index.html`, a few message keys in `js/i18n.js`,
and possibly two small return pages using the existing CSS. Each change is a
separate, reviewable diff against the baseline commit.
