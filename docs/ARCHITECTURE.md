# MALACONDA — Simplified architecture (proposal v2)

> **Status: DRAFT FOR APPROVAL.** Replaces the MySQL proposal (v1).
> No code is written until the owner approves this document and answers §11.

Principle: **one** Express backend, **one** Firestore database, **one** Stripe
integration, **one** Google Sheets reporting integration, two separate
purchasing flows (B2C and B2B), and a minimal protected admin page.

---

## 1. Architecture diagram

```
                ┌──────────────────────────────────────────────┐
  Browser       │  Static site (existing Artifact design)      │
                │   /            B2C shop + cart (12-bottle)   │
                │   /partners    B2B partner store (24-bottle) │
                │   /admin       minimal admin page            │
                └──────────────┬───────────────────────────────┘
                               │ fetch /api/*  (same domain, HTTPS)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ Node.js 22 + Express — ONE process on Hostinger Business         │
│                                                                  │
│  routes/   b2c · b2b · auth · admin · stripe-webhook · forms     │
│  services/ pricing · promo · firestore · stripe · sheets · email │
│  config/   catalog.js (products, prices, limits, dates)          │
└───────┬─────────────────┬───────────────────┬──────────────┬─────┘
        │                 │                   │              │
        ▼                 ▼                   ▼              ▼
  ┌───────────┐    ┌─────────────┐    ┌──────────────┐  ┌────────┐
  │ Firestore │    │   Stripe    │    │ Google Sheets│  │  SMTP  │
  │  SOURCE   │    │  Checkout + │    │  REPORTING   │  │ emails │
  │  OF TRUTH │    │  webhooks ──┼──► │  (one-way    │  │        │
  └───────────┘    └─────────────┘    │   copy only) │  └────────┘
        ▲                 │           └──────────────┘
        └── webhook ──────┘          Firestore → Sheets, never the reverse
```

Data flows in **one direction only**: Firestore → Google Sheets. Sheets never
writes back and is never read for eligibility or payment decisions. If Sheets
is down, checkout keeps working (§6).

### Dependencies (backend, 7)

| Package | Purpose |
|---|---|
| `express` | Web server and API |
| `firebase-admin` | Firestore (server-side only) |
| `stripe` | Checkout sessions, webhook verification |
| `@googleapis/sheets` | Sheets API (slim package, not the full `googleapis`) |
| `nodemailer` | Emails over SMTP (provider swappable) |
| `helmet` | Security headers |
| `express-rate-limit` | Rate limiting |

The frontend has **zero** npm packages.

---

## 2. Firestore document structure

General rules:

- Money is always **integer cents** (`CHF 48.60` → `4860`).
- Timestamps are Firestore `Timestamp`.
- **Firestore Security Rules deny all access from browsers**
  (`allow read, write: if false`). Only the backend, with a service account,
  reads and writes. Customer data can never be read through a public endpoint.
- Firestore has no "unique" constraint like SQL. Uniqueness is guaranteed with
  **deterministic document IDs** + transactions (`create()` fails if the
  document already exists).
- Database location: **`europe-west6` (Zürich)**, so customer data stays in
  Switzerland (to confirm, §11 G7).

### Collections

```
customers/{customerId}
emailIndex/{emailHash}                ← uniqueness of email
verificationCodes/{emailHash}
sessions/{tokenHash}
partners/{customerId}                 ← B2B approval & company data
orders/{orderRef}
payments/{paymentId}
promoCodes/{CODE}
promoRedemptions/{CODE}__{customerId} ← one document per customer per code
stripeEvents/{stripeEventId}          ← webhook idempotency
```

**`customers/{customerId}`**: `customerId` = random, e.g. `CUS-7F3K9QX2`

```js
{
  email: "Ana.Muster@Gmail.com",          // as entered
  emailNormalized: "anamuster@gmail.com",
  emailVerifiedAt: Timestamp | null,
  fullName, phone,
  stripeCustomerId: "cus_…" | null,
  paidOrderCount: 0,                      // B2C, maintained by webhook
  firstPaidOrderAt: Timestamp | null,
  createdAt, updatedAt
}
```

**`emailIndex/{emailHash}`**: `emailHash` = SHA-256 of the normalised email

```js
{ customerId: "CUS-7F3K9QX2", createdAt }
```

Created with `create()` inside a transaction → **one email = one customer**,
even if two requests arrive at the same moment. A hash is used as the ID so the
email isn't written in the document ID.

**`verificationCodes/{emailHash}`**

```js
{
  codeHash: "sha256(code + secret)",   // the 6-digit code is never stored
  expiresAt,                           // now + 15 min
  attempts: 0,                         // max 5, then invalid
  lastSentAt                           // resend allowed after 60 s
}
```

**`sessions/{tokenHash}`**

```js
{ customerId, role: "customer" | "partner" | "admin", expiresAt, createdAt }
```

The browser holds the random token in a cookie (`HttpOnly`, `Secure`,
`SameSite=Lax`; admin: `SameSite=Strict`, 8 h). Only its hash is stored.

**`partners/{customerId}`**: B2B account, same ID as the customer

```js
{
  companyName, businessAddress, vatNumber,
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED",
  approvedAt, approvedBy,
  createdAt, updatedAt
}
```

**`orders/{orderRef}`**: `orderRef` = e.g. `MLC-B2C-24A7K2` / `MLC-B2B-9QX3MD`

```js
{
  channel: "B2C" | "B2B",
  customerId,
  orderStatus:   "…",          // see §3 / §4. Kept separate from paymentStatus
  paymentStatus: "…",
  paymentWorkflow: "STRIPE" | "INVOICE",   // B2B only
  items: [{ sku, name, unitPriceCents, quantity, lineTotalCents }],  // price snapshot
  subtotalCents, discountCents, totalCents,
  depositCents, balanceCents,              // B2B
  amountPaidCents,
  promoCode: "WELCOME20" | null,
  stripe: { checkoutSessionId, paymentIntentId, customerId },
  shippingAddress: { … } | null,           // from Stripe Checkout (B2C)
  flags: [],                               // e.g. "WELCOME20_POSSIBLE_DUPLICATE"
  confirmationEmailSentAt: null,
  sheetsSyncedAt: null,
  createdAt, updatedAt
}
```

**`payments/{paymentId}`**: Stripe payments use the Stripe Payment Intent ID
as document ID (`pi_…`) so the same payment can never be recorded twice.
Manual bank payments get a generated ID.

```js
{ orderRef, kind: "FULL" | "DEPOSIT" | "BALANCE",
  provider: "STRIPE" | "BANK_TRANSFER",
  amountCents, currency: "CHF", status: "SUCCEEDED" | "FAILED" | "REFUNDED",
  stripeReference, recordedBy /* admin email, manual only */, createdAt }
```

**`promoCodes/{CODE}`**

```js
{
  type: "PERCENT", value: 20,
  channel: "B2C",
  appliesToSkus: ["B2C_LULO_12", "B2C_GUAVA_12"],
  active: true, startsAt, endsAt,
  requiresVerifiedEmail: true,
  firstPurchaseOnly: true,
  maxRedemptionsPerCustomer: 1,
  stripeCouponId: "…"
}
```

**`promoRedemptions/{CODE}__{customerId}`**: e.g. `WELCOME20__CUS-7F3K9QX2`

```js
{
  status: "RESERVED" | "PROCESSING" | "CONFIRMED" | "RELEASED",
  orderRef, checkoutSessionId,
  reservedUntil,               // Stripe session expiry + 5 min
  confirmedAt, releasedAt,
  history: [ { status, at, orderRef } ]   // audit trail
}
```

Because the document ID is **code + customer**, a customer can only ever have
**one** redemption document per code. Concurrency is resolved on that single
document (§5).

**`stripeEvents/{eventId}`**: `{ type, receivedAt }`. Created with `create()`
in the same transaction that updates the order → a repeated webhook delivery
fails the `create()` and is skipped.

---

## 3. B2C purchasing flow (individual customers, `/`)

Product (decided, §11): **case of 12 bottles (12 × 20 cl), CHF 39.00 incl. VAT**,
one product per flavour:

| SKU | Product | Price |
|---|---|---|
| `B2C_LULO_12` | Biting Lulo, case of 12 | 3900 |
| `B2C_GUAVA_12` | Pink Guava, case of 12 | 3900 |

No single bottles and no 24-bottle cases in the B2C store; the server rejects
any other SKU.

```
1. Shop: choose flavour + quantity of cases → "Add to cart" (existing cart)
2. Cart (optional): enter WELCOME20
      └─ not verified? → enter email → receive 6-digit code → enter code
         (inline in the cart, no separate account page, no password)
3. "Checkout" → POST /api/b2c/checkout { items, promoCode? }
      server:
        a. validate SKUs (B2C only), quantities (whole cases, 1–max)
        b. compute prices from config/catalog.js (browser values ignored)
        c. if WELCOME20: eligibility + reservation in a Firestore transaction (§5)
        d. create order: orderStatus NEW, paymentStatus PENDING
        e. create Stripe Checkout Session (30 min expiry, coupon if eligible,
           shipping address collection)
4. Redirect to Stripe → customer pays
5. Webhook checkout.session.completed (verified):
      paymentStatus PAID · payment recorded · redemption CONFIRMED ·
      customer.paidOrderCount +1 · confirmation email · Sheets update
6. /success page   (or cancel → webhook expired → paymentStatus EXPIRED,
                    redemption RELEASED)
```

B2C statuses (separate):

| `orderStatus` | `paymentStatus` |
|---|---|
| `NEW` → `SHIPPED` → `DELIVERED`, or `CANCELLED` | `PENDING` → `PAID`, or `FAILED` / `EXPIRED` / `REFUNDED` |

Shipping status is set by the admin.

---

## 4. B2B purchasing flow (partners, `/partners`)

| Rule | Value (server-enforced) |
|---|---|
| Products | `B2B_LULO_24`, `B2B_GUAVA_24`: case of **24 bottles, one flavour per case** (no mixed cases) |
| Base price | CHF 54.00 (`5400`) per case, VAT included |
| Partner discount | 10%, automatic for **approved** partners |
| Partner price | CHF 48.60 (`4860`) per case |
| Quantity | **Exactly 5 or 10 cases**, all of **one flavour** per order. Allowed orders: 5 Lulo · 10 Lulo · 5 Guava · 10 Guava. Anything else is rejected by the server. |
| Deposit | 20% of the discounted total |

| Cases | Base | −10% | Total | 20% deposit | 80% balance |
|---|---|---|---|---|---|
| 5 | 270.00 | −27.00 | **243.00** | 48.60 | 194.40 |
| 10 | 540.00 | −54.00 | **486.00** | 97.20 | 388.80 |

### 4.1 Partner approval (because "discount once approved")

```
1. /partners (public): benefits, timeline, "Apply as partner" form
   (full name, company, business address, VAT/UID, email, phone)
2. Email verified with 6-digit code → partners/{id}.approvalStatus = PENDING
   → email to Malaconda team
3. Admin approves in /admin → partner gets "You're approved" email
4. Partner signs in at /partners with email code → sees prices + B2B cart
```

B2B prices are returned only by `/api/b2b/catalog` **to an approved partner
session**. They are not in the public HTML or JavaScript.

### 4.2 Pre-order and payment

```
5. B2B cart: flavour (Lulo or Guava) + 5 or 10 cases → summary (quantity, base price, 10% discount,
   total, deposit today, balance on delivery)
6. Choose payment:
   A) STRIPE  → POST /api/b2b/preorder { qty, workflow: "STRIPE" }
               server recomputes everything → order → Stripe session for the
               DEPOSIT only (or 100% if that rule is approved, §11 B2)
               → webhook → paymentStatus DEPOSIT_PAID → confirmation email
   B) INVOICE → POST /api/b2b/preorder { qty, workflow: "INVOICE" }
               → order with paymentStatus AWAITING_DEPOSIT → email to partner
                 ("pre-order received") + team ("send invoice")
               → admin records bank payment in /admin → DEPOSIT_PAID → email
7. The 80% balance is NEVER charged automatically. Admin records it when paid.
```

B2B statuses (separate, as requested):

| `orderStatus` | `paymentStatus` |
|---|---|
| `PENDING_CONFIRMATION` → `CONFIRMED_PREORDER` → `DELIVERED`, or `CANCELLED` | `AWAITING_DEPOSIT` → `DEPOSIT_PAID` → `FULLY_PAID`, or `REFUNDED` |

When an order becomes `CONFIRMED_PREORDER` is a business decision (§11 B1).

---

## 5. WELCOME20: validation and redemption logic

### 5.1 Eligibility (checked by the server before every Stripe session)

1. Valid customer session, and `emailVerifiedAt` is set.
2. `promoCodes/WELCOME20`: exists, `active`, within `startsAt`/`endsAt`,
   channel `B2C`, all cart SKUs in `appliesToSkus`.
3. First purchase: `customers.paidOrderCount == 0` (rule to confirm, §11 C3).
4. Redemption document `WELCOME20__{customerId}`:
   - missing or `RELEASED` → eligible
   - `CONFIRMED` → **never** eligible again
   - `PROCESSING` → not eligible (payment being confirmed)
   - `RESERVED` and not expired → a checkout is already open (§5.3)
   - `RESERVED` but past `reservedUntil` → treated as released

### 5.2 Reserve → confirm → release

All in **one Firestore transaction**. The server SDK locks the documents it
reads in a transaction, so two simultaneous checkouts of the same customer
cannot both pass:

```
transaction:
  read customers/{id}, promoCodes/WELCOME20, promoRedemptions/WELCOME20__{id}
  re-check all eligibility rules (5.1)
  write promoRedemptions/WELCOME20__{id} = RESERVED (orderRef, reservedUntil)
  write orders/{orderRef} = NEW / PENDING
commit
then: create Stripe session with the WELCOME20 coupon, save its ID on order
      and redemption. If Stripe fails → redemption RELEASED immediately.
```

| Stripe event (verified webhook) | Redemption |
|---|---|
| `checkout.session.completed`, `payment_status = paid` | `CONFIRMED`, permanent |
| `checkout.session.completed`, `payment_status = unpaid` (delayed method) | `PROCESSING`, no expiry until final result |
| `checkout.session.async_payment_succeeded` | `CONFIRMED` |
| `checkout.session.async_payment_failed` | `RELEASED` |
| `checkout.session.expired` | `RELEASED` |

The code is **never** consumed just by typing it.

### 5.3 Several tabs / browsers / checkouts

A customer with an open `RESERVED` checkout who starts another one:

1. Server asks Stripe to **expire the old session** (`checkout.sessions.expire`).
2. If Stripe confirms it expired → release the old reservation and reserve
   for the new checkout (same transaction as 5.2).
3. If Stripe answers that the old session was **already paid** → no new
   discount. The webhook will confirm the old redemption.

So at any moment there is at most **one** payable Stripe session carrying
WELCOME20 for a customer.

### 5.4 Automatic expiry and cleanup

- Stripe sessions expire after 30 minutes (Stripe minimum), and Stripe sends
  `checkout.session.expired`, which releases the reservation.
- If that webhook were lost, `reservedUntil` (session expiry + 5 min) makes the
  reservation count as released at the next check. A Stripe session can't be
  paid after it expires, so this is safe.
- No cron job and no paid Firestore TTL feature needed.

### 5.5 Why clearing cookies / changing browser doesn't help

Eligibility is stored in Firestore against the **customer ID linked to the
verified email**, not in the browser. A new browser, incognito window or
cleared storage just means signing in again with the same email, which leads
back to the same customer and the same redemption document. The Stripe session
is bound to that customer's Stripe customer ID and email.

### 5.6 Limitations of email-based identity (documented honestly)

- **One person, several email addresses.** Verification proves control of an
  email, not who the person is. Anyone with a second address can get a second
  WELCOME20.
- **Normalisation is only a partial help**, so it is not relied on alone:
  `name+tag@…` → `name@…`, and Gmail dots are ignored. It doesn't catch other
  aliases, disposable addresses or a partner's email.
- **Additional signals, recorded after payment** (not blocking, since they
  are only known once Stripe has the card/address):
  - the Stripe card **fingerprint** (identifies the same card without
    storing card data),
  - a hash of the normalised **shipping address**.
  If WELCOME20 was already confirmed with the same card or address, the new
  order gets the flag `WELCOME20_POSSIBLE_DUPLICATE`, visible in /admin and
  Sheets. The business decides what to do.
- Stronger identity (phone verification, ID checks) costs money and adds
  friction; not recommended for a 20% soft-drink discount.

---

## 5b. Ambassador codes (in the MVP, rules to confirm in §11 A1–A7)

Each ambassador has one personal code. A customer using it gets a discount;
the ambassador earns a commission on the paid order.

**`ambassadors/{ambassadorId}`**

```js
{ name, email, code: "MARIA", commissionCents: 500, active: true, createdAt }  // CHF 5 fixed
```

**`promoCodes/{CODE}`**: same collection as WELCOME20, with
`ambassadorId` set, `firstPurchaseOnly: false`,
`requiresVerifiedEmail` (see A5), 20% discount, valid on the customer's **first order only**
(same first-purchase rule as WELCOME20), not combinable with WELCOME20.

**On the order**: `ambassadorId`, `commissionBaseCents`, `commissionCents`,
`commissionStatus: "PENDING" | "PAYABLE" | "PAID" | "CANCELLED"`.
Commission: **CHF 5 fixed** (per order or per case: A2b). Commissions of a
calendar month become `PAYABLE` at month end (orders not refunded) and are
paid manually by Malaconda.
Commission is calculated by the server **only when Stripe confirms payment**,
stored on the order (so later rate changes don't alter history), and set to
`PAID` by the admin after paying the ambassador.

Validation: code exists, active, valid dates, channel B2C, ambassador active.
No reservation is needed for multi-use codes; one-per-customer limits (if
chosen, A3) reuse the same deterministic-ID mechanism as WELCOME20.

## 6. Google Sheets: how it receives data

One spreadsheet, six tabs: **Customers · Orders · Partners · Discount
redemptions · Payments · Ambassadors**. Columns are listed in §6.2.

### 6.1 Mechanism

```
event (webhook / form / admin action)
  → Firestore transaction commits   ← checkout result is final here
  → respond to Stripe / the browser
  → THEN Sheets sync (background, not awaited)
        upsert row by key (order ref / customer ID / …):
          key found → update that row; not found → append
        success → orders.sheetsSyncedAt = now
        failure → error logged, sheetsSyncedAt stays null
```

- Sheets runs **after** the Firestore write, outside the checkout path. A
  Sheets outage can never block or break a purchase or a webhook.
- **Upsert by key** instead of blind append → a retried event updates the
  row instead of duplicating it.
- **Repair:** `/admin` has a "Resync Sheets" button that rewrites the five
  tabs from Firestore. Sheets can always be rebuilt from the source of truth.
- Manual edits in the sheet are overwritten on the next sync of that row, and
  never flow back into Firestore. Notes can go in an extra column the sync
  doesn't touch.

### 6.2 Tabs

| Tab | Key | Main columns |
|---|---|---|
| Customers | Customer ID | email, name, phone, verified, first paid order, paid orders, WELCOME20 used |
| Orders | Order ref | date, channel, customer ID, items, subtotal, discount, total, promo code, order status, payment status, Stripe session, flags |
| Partners | Customer ID | company, address, VAT, contact, approval status, pre-orders, cases |
| Discount redemptions | Code + customer | code, customer ID, status, order ref, reserved/confirmed date |
| Payments | Payment ID | order ref, kind, provider, amount, status, Stripe reference, date |
| Ambassadors | Ambassador ID | name, code, orders attributed, sales, commission %, commission earned / paid / pending |

B2B outstanding balance = total − paid, shown per order. Totals and reports are
spreadsheet formulas in an extra "Reports" tab (not written by the server).

---

## 7. Minimal admin interface (`/admin`)

- Login: the same 6-digit email code, accepted **only** for addresses listed
  in the `ADMIN_EMAILS` environment variable. Session 8 h, `SameSite=Strict`.
- All admin API calls check the admin session **and** the `Origin` header
  (CSRF protection).
- Functions (nothing more in the MVP):
  1. Approve or reject partner applications
  2. B2B orders: mark invoice sent, record deposit / balance payment
     (amount, date), confirm pre-order, mark delivered, cancel
  3. B2C orders: mark shipped / delivered
  4. Resend a confirmation email
  5. Add / deactivate ambassadors and their codes; mark commissions paid
  6. Resync Google Sheets
- Every admin change is stored with who and when.

---

## 8. Hostinger compatibility

| Requirement | Assessment |
|---|---|
| Node.js 22 + Express | Supported on Business Web Hosting (Node 18/20/22/24) |
| `firebase-admin` | Pure JavaScript (no native compilation) ✅. Talks to Google over outbound HTTPS. Use `preferRest: true` (HTTP/1.1 REST instead of gRPC: lighter, works behind restrictive proxies). |
| Stripe, Sheets, SMTP | Outbound HTTPS / SMTP from the app |
| Credentials | Service account JSON stored as an environment variable (Base64) in hPanel, never in Git |
| HTTPS | Hostinger SSL (needed for secure cookies and Stripe webhooks) |
| Port / proxy | `process.env.PORT`, `app.set("trust proxy", 1)` |
| Persistent disk | Not needed: all state in Firestore |
| Cron / background workers | Not needed |
| Auto-deploy | Stays **off** until owner approves |

**Not verifiable from documentation alone:** that Hostinger's shared Node
environment allows outbound connections to `firestore.googleapis.com`, and
that the env-var size limit accepts the service account key. **Step 1 of
implementation is a tiny compatibility test**: a `/health` endpoint that
reads and writes one Firestore document and calls Stripe in test mode,
deployed to Hostinger before anything else is built. If it fails, we know on
day 1, not at launch.

---

## 8b. Database alternatives compatible with Hostinger

| Option | Type | Hostinger | Zürich region | Cost at MVP volume | Fit for this project |
|---|---|---|---|---|---|
| **Firestore** (recommended) | NoSQL, managed by Google | Via outbound HTTPS (to verify in step 1) | Yes (`europe-west6`) | Free quota; never paused | Transactions + deterministic IDs cover one-time codes simply; no server to manage |
| Supabase | PostgreSQL (SQL), managed | Listed in Hostinger's database connect wizard | Yes (`eu-central-2`) | Free plan pauses inactive projects; paid plan ~USD 25/month | Strong, but it's an SQL database (rejected direction) and the free plan's pausing is risky for a shop |
| MongoDB Atlas | NoSQL, managed | Listed in Hostinger's database connect wizard | To be checked for the free tier | Free tier 512 MB | Works, but transactions are more involved than Firestore's for this use case |
| Hostinger MySQL | SQL, on the hosting | Native (`localhost`) | Hostinger's data-centre region | Included | Owner asked to avoid a traditional SQL database |

## 9. Estimated recurring costs

| Service | Expected monthly cost | Notes |
|---|---|---|
| Hostinger Business | Already paid (existing plan) | No extra cost for the Node app |
| Firestore | **CHF 0** at expected volume | Free quota: 50,000 reads + 20,000 writes per day, 1 GiB storage. A shop with hundreds of orders/month uses a small fraction. |
| Google Sheets API | CHF 0 | Free, within quotas |
| Email (SMTP) | CHF 0 to start | Hostinger mailbox; a transactional provider later if deliverability requires it |
| Stripe | **No monthly fee**, per transaction only | Swiss cards: 2.9% + CHF 0.30. International cards cost more. |

Stripe fee examples (Swiss card):

| Payment | Amount | Approx. fee |
|---|---|---|
| B2C 1 case | CHF 39.00 | CHF 1.43 |
| B2C 1 case with WELCOME20 | CHF 31.20 | CHF 1.20 |
| B2B deposit 5 cases | CHF 48.60 | CHF 1.71 |
| B2B deposit 10 cases | CHF 97.20 | CHF 3.12 |

Firebase plan recommendation: **Blaze (pay-as-you-go) with a budget alert of
e.g. USD 5**. On the free Spark plan, exceeding a daily quota stops the
database until the next day, which would stop checkout. On Blaze the same free
quota applies and you only pay above it. Requires a card on the Google account.
Shipping, VAT and packaging costs aren't included above.

---

## 10. Security summary

- Stripe secret key, Firebase service account, SMTP password: **backend
  environment variables only**.
- Stripe webhook signature verified on the raw body; idempotency through
  `stripeEvents/{eventId}` + transactions.
- Duplicate redemption prevented by deterministic document IDs + transactions.
- All prices, quantities and discounts computed on the server from
  `config/catalog.js`; browser values ignored.
- Integer cents everywhere.
- Secure sessions: random token, hashed in Firestore, `HttpOnly` + `Secure`
  cookie, HTTPS only.
- Rate limits on code requests, code checks, checkout and forms.
- Admin routes: allow-listed emails, short sessions, Origin check.
- Firestore rules deny all browser access; no endpoint returns other
  customers' data. Logs contain order refs, not personal data.

---

## 11. Decisions

### Decided by the owner

| # | Decision |
|---|---|
| C1 | B2C price **CHF 39.00 per case of 12, VAT included** (both flavours). The current design shows CHF 36; the page will display the server price. |
| C2 | B2C: maximum **10 cases** per order. |
| C3 | **No.** WELCOME20 only for customers with **zero** paid orders. |
| C4 | Guest checkout allowed. Email verification required for WELCOME20. |
| B1 | Pre-order becomes `CONFIRMED_PREORDER` **when the 20% deposit is paid** (Stripe: automatically by webhook; invoice: when the admin records the payment). |
| B2 | **Deposit 20% only.** No 100% upfront payment. |
| B3 | B2B cases contain **one flavour only**. An order is **5 or 10 cases of one flavour**: 5 Lulo, 10 Lulo, 5 Guava or 10 Guava. |
| B4 | **Approved:** partner approval; pre-order prices and form move from the home page to `/partners`. |
| B7 | B2B CHF 54 per case **VAT included**. |
| G3 | All payments through **Stripe Checkout**. Payment methods are switched on in the Stripe Dashboard (no code change). |
| G4 | Email addresses: postponed until after architecture approval. |
| G5 | **Ambassador codes and commissions are in the MVP** (§5b). |
| G6 | Contact and ambassador application forms send an email to the team. |
| A1 | Ambassador code gives the customer **20%**, on the **first order only** (scope "first box": A1b). |
| A2 | Ambassador commission: **CHF 5 fixed** (not 20%). The site text "Earn 20% commission" must be updated (design text change). |
| A3 | Follows from A1: an ambassador code can be used **once per customer** (first order). |
| A4 | **Not combinable** with WELCOME20. One code per order. |
| A6 | Commissions paid **at the end of each month** (orders of that month, not refunded). |
| A7 | B2C orders only. |

### Still open

B2C
- **C5. Refund of a WELCOME20 order:** does the customer get the code back?
  (Proposed: no.)

B2B
- **B5. VAT/UID number required** for partner applications?
- **B6. Close pre-orders automatically after Jan 31, 2027?**

Ambassadors
- **A1b. Scope of the 20%:** whole first order, or only the first case of it?
  (e.g. 3 cases × CHF 39 = 117: 20% of all = −23.40; 20% of one case = −7.80)
- **A2b. CHF 5 per order or per case?**
- **A5. Email verification for ambassador codes:** the owner answered "no",
  but "first order only" can't be enforced before payment without a verified
  email (anyone could type a new email). Options: (a) require verification,
  like WELCOME20 (recommended); (b) no verification: repeat use is only
  detected after payment and flagged in /admin.

General
- **G1. VAT registration:** is Malaconda VAT-registered, and at what rate
  (for showing VAT on confirmation emails)?
- **G2. Shipping (B2C):** which countries (CH only? CH + LI? EU?), cost per
  order or per case, free-shipping threshold?
- **G3b. Which methods to enable in Stripe:** card, Apple Pay / Google Pay,
  TWINT? (Recommended: all three.)
- **G7. Database provider and location:** Firestore in Zürich
  (`europe-west6`), or an alternative (see §8b).
- **G8. Legal pages:** privacy policy, terms, imprint needed before live
  payments (we store customer data).

### Design changes (approval needed, made in Phase 3)
- Cart: small email + code fields to verify for WELCOME20 (existing styles).
- Home page partner section: becomes a teaser (benefits, timeline) with a
  link to `/partners`. The pre-order form and prices move to `/partners`.
- New pages using the existing styles: `/partners`, `/admin`, `/success`, `/cancel`.

---

## 12. Implementation order (after approval)

Each step = one feature branch + Pull Request into `develop`.

1. **Compatibility test on Hostinger** (`/health`: Firestore + Stripe test).
2. Express skeleton, security middleware, catalog config, Firestore setup + rules.
3. Email verification + sessions.
4. B2C checkout + WELCOME20 reservation + Stripe webhook.
5. B2B partner application, approval, pre-order (Stripe + invoice).
6. Confirmation emails.
7. Google Sheets sync + resync.
8. Admin page.
9. Frontend wiring on the existing design.
10. Tests in Stripe test mode, including concurrent WELCOME20 checkouts and
    repeated webhook deliveries.
