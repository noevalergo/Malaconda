# MALACONDA Commercial model and site spec (short version)

Status: draft for the founders' presentation. All numbers are **starting values**, editable in the admin settings.
The site in `client/` implements every rule below with fictional data.
The full price, discount, credit and rights model, with the example profiles, is in [ACCOUNT_MODEL.md](ACCOUNT_MODEL.md). This page is the summary.

---

## 1. Audiences and pages

| Audience | Sees | Can do |
|---|---|---|
| Visitor | Retail prices, story, flavours | Buy as a guest at the full retail price, or create an account for 10% off the first order |
| Customer (individual account) | Own orders and delivery details | Order, track orders, edit details and password |
| Pro (bar, restaurant, club, hotel, shop, distributor) | Retail prices, "wholesale prices after login" | Request access |
| Logged-in pro | **Own prices in real time on the site** (list or negotiated), live total for any quantity | Order and pay online by card (VAT added at the end), see prices and tiers, track orders, recommend other pros, see referral credit |
| Ambassador | Own venues and commissions | Share code and link, read statements |
| Founders (admin) | Everything | Create accounts, enter orders, manage attribution and commissions, edit settings |

Pages: Home (hero, flavour picker with add to cart for visitors and customers, price sheet and "Pay and order" (card payment at the pro's prices) for logged-in pros, story, pros, ambassadors, contact) · Cart and checkout · Pros · Ambassadors · Customer account · Pro space · Ambassador space · Admin.
Public site never shows pro prices, discount rules or commission rates.

## 2. Accounts

- Consumers: optional individual account (name, email, password, delivery details). Guest checkout stays possible; guest orders join the account when the same email registers. The 10% first-order offer is for accounts only: a guest checkout pays the full price, and the offer is used once per account.
- Pros and ambassadors: accounts created by the founders (from the admin, also on the spot after a tasting) or after approving an access request.
- Credentials: email + random temporary password, forced change at first login.
- Founders: admin login, same email + password mechanism.

## 3. Prices and discounts

Prices are stored **per bottle** in cents. A box is 12 bottles of 20 cl. Screens show box prices and totals first. Pro prices and pro totals are excluding VAT (8.1% in Settings).

| Item | Starting value |
|---|---|
| Retail price | CHF 39.00 per box, VAT included (existing site) |
| Pro list price | CHF 2.20 per bottle = CHF 26.40 per box (placeholder, founders to confirm) |
| Negotiated price | Optional, per pro and per flavour, to the cent, set in the admin. Floor CHF 1.80, never above the list price |
| Consumer welcome offer | 10% off the first order of an account, no quantity cap |
| Pro welcome offer | 10% off the first order |
| Volume tiers (per order) | 1-9 boxes: 0% · 10-20 boxes: -5% · 21+ boxes: -10% |

**Calculation order** (sequential, not additive):
1. `base = Σ boxes × 12 × the pro's price for that flavour` (negotiated or list)
2. `afterTier = base × (1 − tier%)`, tier on the total boxes of the order
3. `net = afterTier × (1 − extra%)` where `extra%` is the welcome offer (first order) **or** the referral credit used, never both.

Per-pro switches: "volume tiers apply" and "welcome and credit apply" (both on by default; Hotel Selva has the second one off).
The order stores the unit prices and percentages it was priced with.
Invariant checked in Settings: the list box price excl. VAT stays below the consumer first-order price excl. VAT (CHF 32.47).
"First order" = the pro's first order that is not cancelled. Shipping is outside the discount base. Delivery: "within 4 weeks".

## 4. Pro-to-pro referral

- A pro recommends another pro (link `?ref=` or code, or named in the access request).
- Referred pro: 10% welcome discount on the first order.
- Referrer earns **5%** of credit when the referred pro's first paid order has **at least 10 boxes**.
- Credits stack. At most **15% per order** is used; the rest carries over to the following orders (15% max each).
- Credit is a discount on the referrer's next orders, never cash.
- Referrer's credit is used from the second order onwards (the first order takes the welcome offer).

Examples (5% per referral, 15% cap):

| Referred pros qualified | Credit earned | Order A | Order B |
|---|---|---|---|
| 1 | 5% | 5% | – |
| 3 | 15% | 15% | – |
| 4 | 20% | 15% | 5% |

## 5. Ambassadors

**Status.** Business introducers (apporteurs d'affaires): they introduce, they do not negotiate prices or conclude sales. Contract wording, AVS and VAT status to be validated by a lawyer or fiduciary.

**Attribution.** A pro account has at most one source: an ambassador, a referring pro, or none.
- The new pro states who recommended them: field "Recommended by" (code or name) in the access request, prefilled when they arrive through a `?ref=` link.
- When founders create an account on the spot, they fill "Introduced by".
- Ambassadors cannot declare prospects.
- Admin can change the attribution at any time; every change is logged (date, who, from → to).
- An order records the ambassador in force at the time it is created; later changes only affect later orders.

**Commission.**

| Rule | Starting value |
|---|---|
| Rate | 5% of net invoiced revenue, excluding VAT, after discounts, excluding shipping |
| Duration | 12 months from the venue's first paid order |
| Trigger | The order is marked **paid** |
| Cancelled or refunded paid order | Deducted in the month of the cancellation |
| Signing bonus | None for now |
| Rate and duration | Stored per ambassador (default from settings) |

**What each role sees.**

| Role | Sees | Never sees |
|---|---|---|
| Ambassador | Own code and link · own venues (name, city, status, commission end date) · per venue and per month: commissionable revenue and commission · monthly statement · payout status | Unit prices, discounts, order lines, margins, other ambassadors' venues |
| Referring pro | Recommended pros and their status (waiting, qualified, below minimum) · credit available | Volumes of the recommended pro |
| Pro | A clause in the pro terms informing that an introducer may be remunerated on their purchases | Commission amounts |

**Statements.** Monthly statement per ambassador, payout marked by the founders (bank transfer to the IBAN on file). Admin exports CSV.

## 6. Orders outside the site

Pros may order by email and pay by bank transfer. The founders enter every such order in the admin as a **manual order** on the pro's account, send the invoice, and mark it paid. Discounts, credit and commission are then computed by the same engine as online orders. There is one source of truth.

Order statuses: placed, invoice sent, paid, shipped, delivered, cancelled. **The dates are the source of truth**: status and history are rebuilt from them, so a corrected date corrects everything (commission month, referral credit, tracking).

**What an order records** (manual or from a request): order date, how it was received (in person visit, email, phone, website request, other), the customer's own reference, items and the price breakdown, payment method (bank transfer, cash, card in person, online card, other) and paid date, invoice number and date, delivery address, carrier, tracking number, shipped and delivered dates, internal note.
**Editing**: founders can correct any of the above after the fact, including the items (repriced with the order's own unit prices) and cancel or reopen an order. Every change is logged (who, when, old to new).
**What the customer sees**: pros in "My orders", logged-in visitors in "Orders": payment method and paid date, parcel carrier with the tracking number (linked when the carrier has a public tracking page), status.

**Commission statement**: a document per ambassador and month (number, period, ambassador, IBAN, venues with commissionable revenue, rate, commission, adjustments, totals, payout status), printable as PDF, with a CSV. It never shows unit prices, discounts or order lines.

## 7. Admin

| Area | Features |
|---|---|
| Overview | Revenue, boxes sold, commissions to pay, counts, to-do list, latest orders |
| Customers | Individual accounts, their orders, password reset, CSV export |
| Inbox | Forms filled in by visitors, with filters Pro access, Ambassadors, Messages. Approving an access request or an application creates the account |
| Pro accounts | Create, temporary password, reset, company details, **negotiated prices per flavour with reason and change log**, conditions summary, attribution with history, referral credit |
| Orders | Pro orders (manual order with live price breakdown, invoice and payment steps, cancel) and consumer orders (paid, shipped, delivered, cancel), CSV export |
| Ambassadors | Create, edit rate, duration and IBAN, activate/deactivate, temporary password |
| Commissions | Month view per ambassador and venue, mark paid, CSV export |
| Settings | List price per bottle, floor, VAT, retail price, tiers, welcome offers, referral, commission. Saving checks the price invariant and refuses a change that puts a negotiated price out of range |

## 8. Market and languages

- Switzerland first. Languages: EN, DE, FR, ES.
- Prices in CHF.

## 9. Temporary story (to be replaced by the founders)

- "The fruit nobody was meant to touch."
- Lulo grows where a snake keeps watch: she does not chase, she waits.
- *Mala* means bad in Spanish. *Conda* is the snake. Together they bite.
- Three friends from Medellín; flavours developed by the Swiss Bartender of the Year.
- Guava is the bait: soft, sweet, and you were warned.
- Not everyone gets bitten.

## 10. Spaces

| Space | Tabs |
|---|---|
| Customer | Orders (status steps) · Details (delivery address, password) |
| Pro | My prices (own prices, tier table, what applies to the next order) · My orders (tracking) · Recommend a pro (code, link, credit ledger) · Account (company details, password). Ordering and card payment happen on the site |
| Ambassador | Venues · Statements · Code and link · Account (IBAN, password) |
| Founders | Overview · Inbox · Customers · Pro accounts · Orders (shop and pros apart) · Ambassadors · Commissions · Settings |

**Demo accounts (staging only).** An eye in the corner lets the founders and testers switch between Visitor, Customer, Pro, Ambassador and Founders admin to see each experience. It is not shown on the live site, and every demo account and test order is deleted before launch.

## 11. Design notes (prototype)

- Open layout on the grey Surface page, sticky nav, rotating snake badge kept, day and night mode (the bottle photography stays on Ink in both).
- Flavour colours (yellow Lulo, coral Guava) flood the interface on purpose: hero words, the flavour picker (selected card, title, notes, button and giant outline word follow the flavour), the full yellow story block. This goes beyond the agency draft (about 3%) and is a deliberate evolution.
- Flavour picker: one screen tall, bottle cut out so the giant outline word (LULO, GUAVA) sits behind it and drops into place as the section scrolls in; the bottle reflection is the bottom edge of the section; swipe, tabs or keyboard switch flavour; quantity and Add to cart sit next to the bottle; the cart count shows in the header.
- Numbers (prices, totals) are set in DM Mono; Andreas is not used for digits.
- Flavour names: Andreas Regular only, uppercase, line height 1.15, no synthetic weight (agency rule).
- Temporary ingredient list per flavour (placeholder, founders to confirm).
- Sections are only as tall as their content. Only the flavour picker is forced to one screen. Sections never exceed the viewport and land right under the header from the menu.
- Story block takes the colour of the flavour selected in the picker (yellow Lulo, coral Guava).
- Pros and Ambassadors pages: photo hero with centred text and one action, three big benefits, then an open (borderless) form. No hat repeating the page name; form heading is a sentence, button is the action.
- Contact (home): labelled email and Instagram, form with General, Order, Partner and Press topics. Messages arrive in the admin Inbox.
- Footer: logo with the turning snake, newsletter, links. Photos: pool table bottles (Pros), coasters (Ambassadors), from the original site and the Instagram account.
- Hero photo shown in landscape, full width, with a slow zoom on scroll. The Pros section uses the pool table photo.
- Section hats are kept only for Pros, Ambassadors and Contact.

## 12. Run it

```bash
python3 tools/devserve.py 8000 client        # then open http://localhost:8000
node --test tests/*.test.js                  # pricing, referral and commission rules
```

Without the API, fictional data lives in the browser (localStorage). In production, pro prices are served by the backend only to authenticated pros.

## 13. Not decided / still to do

- Exact pro price, VAT handling on invoices, minimum order for pros.
- Payment-link for pro invoices (Stripe or bank transfer only).
- Real email delivery of temporary passwords; real password security (the browser demo stores demo passwords).
- Statement PDF, payout threshold, referral credit ledger with stored percentages (the browser demo recomputes credit from current settings).
- DE, IT, ES translations reviewed by native speakers (the site is available in EN, DE, FR, IT, ES; the admin stays in English).
- Ingredient list and legal labelling copy, to be supplied by the founders.
