# MALACONDA — Architecture & business logic (proposal)

> **Status: DRAFT FOR APPROVAL.** No code is written until the owner approves
> this document and answers the open questions in §8.

Goal: a secure, reliable, maintainable MVP with two separate purchasing
experiences — **B2B partners** and **B2C individual customers** — that can
grow later without a rebuild.

---

## 1. System overview

```
Browser (static HTML + CSS + vanilla JS, existing Artifact design)
   │  fetch /api/*  (same domain, no CORS needed)
   ▼
Node.js + Express  (one process on Hostinger Business Node.js Web App)
   ├── serves client/ (static files)
   ├── /api/*  REST endpoints: validation, prices, discounts, eligibility
   ├── /api/stripe/webhook  (signature-verified)
   ├── MySQL  (Hostinger, localhost) ← SOURCE OF TRUTH
   ├── Stripe  (Checkout + webhooks)
   └── SMTP   (confirmation & verification emails)
```

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Existing static HTML/CSS/vanilla JS | Preserves design, zero npm packages in the browser |
| Backend | Node.js 22 LTS + Express | Supported on Hostinger Business |
| Database | **MySQL** (included in Hostinger Business) | Transactions, row locks and unique constraints, needed for one-time discounts. Hostinger currently offers MySQL only. |
| DB driver | `mysql2` | Pure JavaScript, no native compilation on shared hosting |
| Payments | Stripe Checkout (hosted) + webhooks | No card data on our server |
| Email | `nodemailer` over SMTP | Provider replaceable via environment variables |

Not used: React, Next.js, ORM (Prisma), Docker, Redis. SQL is written in
small, readable query modules.

**Why not SQLite or Google Sheets as the database:** SQLite is a file on disk
(risk of loss on redeploy, native module compilation on shared hosting).
Google Sheets has no transactions or locks, so it cannot safely prevent two
simultaneous checkouts from using the same one-time discount. If wanted,
Sheets can later receive a **read-only reporting copy** from the database.

### Dependencies (backend, total 6)

`express`, `mysql2`, `stripe`, `nodemailer`, `helmet`, `express-rate-limit`.

---

## 2. Database structure

All money is stored as **integer cents** (CHF 48.60 → `4860`) to avoid
rounding errors. All tables have `created_at` / `updated_at`.

### 2.1 Customers and verification

**`customers`**: one row per person or business, identified by email.

| Column | Notes |
|---|---|
| `id` | Internal number |
| `public_id` | Unique customer ID shown in emails/Stripe, e.g. `CUS-7F3K9Q` |
| `email` | As entered (for display) |
| `email_normalized` | **UNIQUE.** Lower-case, trimmed, `+tag` removed (see §4.3) |
| `customer_type` | `B2C` or `B2B` |
| `email_verified_at` | NULL until verified |
| `full_name`, `phone` | |
| `company_name`, `business_address`, `vat_number` | B2B only |
| `stripe_customer_id` | UNIQUE, created on first checkout |

**`email_verifications`**: one-time codes for passwordless verification.

| Column | Notes |
|---|---|
| `email_normalized` | |
| `code_hash` | SHA-256 of the 6-digit code. The code itself is never stored. |
| `expires_at` | 15 minutes |
| `attempts` | Max 5 wrong attempts, then the code is dead |
| `consumed_at` | Set when used: one use only |

**`sessions`**: logged-in state after verification.

| Column | Notes |
|---|---|
| `token_hash` | SHA-256 of a random token kept in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie |
| `customer_id` | |
| `expires_at` | e.g. 30 days |

### 2.2 Products

Products and pricing rules live in a **versioned config file**
(`server/config/catalog.js`), not in the database. Prices rarely change, and
every change is then reviewed through a Pull Request. Each order line stores a
**snapshot** of the price used, so history never changes when the price does.

```js
// illustration of the structure, values from the owner's B2B requirements
B2B_CASE_24: { channel: "B2B", unit: "case", bottlesPerCase: 24,
               priceCents: 5400, partnerDiscountPct: 10,
               minQty: 5, maxQty: 10, depositPct: 20 }
B2C_…:       { channel: "B2C", … }   // ← B2C product(s) still to be defined (§8)
```

### 2.3 Orders and payments

**`orders`**

| Column | Notes |
|---|---|
| `reference` | UNIQUE, e.g. `MLC-B2C-24A7K2`, `MLC-B2B-9QX3MD` |
| `customer_id` | |
| `channel` | `B2C` / `B2B` (from server-side product config, never from browser) |
| `status` | See §5 (B2C) and §6 (B2B) |
| `payment_workflow` | `STRIPE` or `INVOICE` (B2B only) |
| `currency` | `CHF` |
| `subtotal_cents`, `discount_cents`, `total_cents` | Calculated by server |
| `deposit_cents`, `balance_cents` | B2B pre-orders |
| `promo_code_id` | NULL if none |
| `stripe_checkout_session_id` | UNIQUE: duplicate-order protection |
| `stripe_payment_intent_id` | |

**`order_items`**: `order_id`, `sku`, `name`, `unit_price_cents`,
`quantity`, `line_total_cents` (snapshot).

**`payments`**: every money movement, Stripe or manual.

| Column | Notes |
|---|---|
| `order_id` | |
| `kind` | `FULL`, `DEPOSIT`, `BALANCE` |
| `provider` | `STRIPE` or `BANK_TRANSFER` (manual invoice) |
| `amount_cents`, `currency` | |
| `stripe_reference` | Payment intent / charge ID |
| `status` | `PENDING`, `SUCCEEDED`, `FAILED`, `REFUNDED` |

### 2.4 Promotions

**`promo_codes`**

| Column | Notes |
|---|---|
| `code` | UNIQUE, upper-case, e.g. `WELCOME20` |
| `discount_type`, `discount_value` | `PERCENT` 20 |
| `channel` | `B2C`, `B2B` or `ALL` |
| `applies_to_skus` | NULL = all products of the channel |
| `is_active` | On/off switch |
| `starts_at`, `ends_at` | Validity window |
| `requires_verified_email` | true for WELCOME20 |
| `first_purchase_only` | true for WELCOME20 |
| `max_uses_per_customer` | 1 for WELCOME20 |
| `max_uses_total` | NULL = unlimited |
| `stripe_coupon_id` | Matching Stripe coupon (see §7) |
| `ambassador_id` | NULL, or the ambassador it belongs to (if kept in scope) |

**`promo_redemptions`**: the heart of one-time-use protection.

| Column | Notes |
|---|---|
| `promo_code_id`, `customer_id` | |
| `order_id`, `stripe_checkout_session_id` | |
| `status` | `RESERVED` → `CONFIRMED` or `RELEASED` |
| `reserved_until` | Same as Stripe session expiry |
| `active_key` | Generated column: equals `customer_id` while `RESERVED` or `CONFIRMED`, NULL when `RELEASED` |
| | **UNIQUE (`promo_code_id`, `active_key`)**: the database itself refuses a second active redemption |

### 2.5 Technical tables

- **`stripe_events`**: `event_id` PRIMARY KEY. Every webhook is recorded
  once; a repeated delivery is detected and skipped.
- **`emails_sent`**: UNIQUE (`order_id`, `kind`). A confirmation email can
  never be sent twice for the same payment.

### 2.6 Relations

```
customers 1─n orders 1─n order_items
                 │ 1─n payments
promo_codes 1─n promo_redemptions n─1 customers
                     └─ 0..1 orders
customers 1─n sessions
```

---

## 3. Separation of B2B and B2C

| | B2C | B2B |
|---|---|---|
| Page | Existing shop on `/` | **Separate page** `/partners` (dedicated cart, own styling within the brand) |
| Products | B2C catalogue only | `B2B_CASE_24` only |
| API | `/api/b2c/*` | `/api/b2b/*` |
| Discount | Promo codes (WELCOME20) | Automatic 10% partner discount, no promo codes |
| Quantity | Defined per B2C product | Whole cases, 5–10 |
| Customer record | `customer_type = B2C` | `customer_type = B2B` + company details |

Enforcement on the server, not only in the browser:

1. Every product has a fixed `channel` in the config. `/api/b2c/checkout`
   rejects any B2B SKU and vice versa (`400`).
2. B2B quantity is re-validated: integer, `5 ≤ qty ≤ 10`. Anything else → `400`.
3. Prices and discounts are always computed on the server from the config;
   values sent by the browser are ignored.
4. Promo codes have a `channel`; a B2C code is rejected on a B2B order.
5. B2B prices are not present anywhere in the B2C page's HTML or JavaScript.
   The partner page fetches them from `/api/b2b/catalog`.

> Note: if the `/partners` page is public, anyone who opens it can see partner
> prices. Truly hiding them requires partner access control. See §8 question B5.

---

## 4. B2C: email verification and first-purchase eligibility

### 4.1 "Account" = verified email (passwordless)

The simplest secure approach is **no passwords**. Customers prove they own
their email with a one-time code:

1. Customer enters email → `POST /api/auth/request-code`.
2. Server creates a 6-digit code, stores only its hash, emails it
   (valid 15 min, max 5 attempts, rate-limited per IP and per email).
3. Customer enters code → `POST /api/auth/verify-code`.
4. Server finds or creates the `customers` row (unique customer ID),
   sets `email_verified_at`, creates a session (`HttpOnly` cookie).

No passwords to store, leak or reset. Logging in again later = new code.

### 4.2 Eligibility check for WELCOME20 (server-side, every time)

At checkout, the server checks **in the database**:

1. Session is valid → customer is known and `email_verified_at` is set.
2. Code exists, `is_active`, inside `starts_at`/`ends_at`, `channel = B2C`,
   applies to the selected products, global limit not reached.
3. Customer has **no paid order** (first-purchase rule; see question C3).
4. Customer has **no `CONFIRMED` redemption** of this code.
5. Customer has **no active `RESERVED` redemption** (see §5 for how a new
   checkout replaces an old one).

Why the browser cannot bypass it: the check uses the **database record tied
to the verified email**. Another browser, incognito, cleared cookies or a new
checkout all lead back to the same email, the same customer row and the same
redemption history. Re-entering the code changes nothing.

The Stripe Checkout is created for the **verified customer's Stripe customer
ID**, so the email cannot be changed on the Stripe payment page.

### 4.3 Honest limitation

An email-based rule stops the same email from using the code twice. It
cannot stop a person from using a **different email address**. Mitigations:

- Normalisation: `Name+test@x.com` → `name@x.com`; for Gmail, dots are
  ignored (`n.a.m.e@gmail.com` = `name@gmail.com`).
- Optional, later: block known disposable-email domains; flag (not block)
  repeated use of the same card or shipping address via Stripe data.

---

## 5. B2C checkout flow

```
Shop (/) → add to cart → enter promo code (optional)
   └─ if WELCOME20: verify email (code by email) inline in the cart
→ "Checkout" → POST /api/b2c/checkout
     server: validate cart (SKUs, quantities) → compute prices
             if promo: eligibility (§4.2) + RESERVE inside a DB transaction
             create order (status PENDING_PAYMENT)
             create Stripe Checkout Session (expires in 30 min)
→ redirect to Stripe
→ Stripe → webhook checkout.session.completed (paid)
     server: order PAID, payment SUCCEEDED, redemption CONFIRMED,
             one confirmation email
→ /success page
   or cancel / expire → webhook checkout.session.expired
     server: order EXPIRED, redemption RELEASED
```

B2C order statuses: `PENDING_PAYMENT` → `PAID` | `EXPIRED` | `FAILED`
(later: `REFUNDED`).

Guest checkout without a code: allowed or not, see question C2.

### 5.1 Reservation and concurrency protection

Inside **one database transaction**:

1. `SELECT … FROM customers WHERE id = ? FOR UPDATE`: locks this customer,
   so two checkouts of the same customer run one after the other, never at
   the same time.
2. Re-run the eligibility checks (§4.2).
3. If an older `RESERVED` redemption exists for this code: expire its Stripe
   session through the Stripe API, then mark it `RELEASED`. Only the newest
   checkout keeps the discount.
4. `INSERT` the new redemption as `RESERVED` with `reserved_until` = Stripe
   session expiry.
5. Commit.

Second safety net: the **unique key (`promo_code_id`, `active_key`)** makes
the database itself reject a second `RESERVED`/`CONFIRMED` redemption,
even if application code had a bug.

### 5.2 Confirmation and release

| Event | Effect on redemption |
|---|---|
| `checkout.session.completed` with `payment_status = paid` | `CONFIRMED`: never usable again |
| `checkout.session.async_payment_succeeded` | `CONFIRMED` |
| `checkout.session.async_payment_failed` | `RELEASED` |
| `checkout.session.expired` (customer left / cancelled) | `RELEASED` |
| Reservation past `reserved_until` without any event | Ignored by the eligibility check, and set to `RELEASED` in step 3 of the next checkout (no cron needed) |

---

## 6. B2B pre-order flow

Pricing (from the owner's rules, computed on the server):

| Cases | Base (CHF 54) | −10% | Total | 20% deposit | 80% balance |
|---|---|---|---|---|---|
| 5 | 270.00 | −27.00 | **243.00** | 48.60 | 194.40 |
| 10 | 540.00 | −54.00 | **486.00** | 97.20 | 388.80 |

Each value 5–10 is allowed; the table shows the limits.

### 6.1 Proposed status flow (to confirm, question B1)

```
STRIPE workflow:
  form submitted → AWAITING_DEPOSIT (Stripe session created)
               → DEPOSIT_PAID   (verified webhook, confirmation email)
               → CONFIRMED_PREORDER (team confirms allocation)
               → FULLY_PAID     (80% balance received on delivery)

INVOICE workflow:
  form submitted → PENDING_CONFIRMATION (team reviews the request, email to team + customer)
               → AWAITING_DEPOSIT (team sent the 20% invoice)
               → DEPOSIT_PAID     (team records bank payment, confirmation email)
               → CONFIRMED_PREORDER → FULLY_PAID
plus: CANCELLED (either workflow)
```

`PARTNER_PAYMENT_MODE` (environment variable) selects which workflow the
form uses: `stripe`, `invoice`, or `both` (customer chooses).

### 6.2 Steps (Stripe workflow)

1. `/partners`: choose cases (5–10), summary shows quantity, base price,
   10% discount, total, 20% deposit today, 80% on delivery.
2. Partner form (name, company, address, email, phone, VAT/UID number if required).
3. `POST /api/b2b/preorder`: server validates everything, computes amounts,
   creates customer (`B2B`) + order + Stripe Checkout Session for the
   **deposit amount only**.
4. Stripe → webhook → `DEPOSIT_PAID` → confirmation email to partner and
   notification to the team.
5. The 80% balance is **never charged automatically**. It is recorded
   when paid (see question B4 on how the team updates statuses).

---

## 7. Stripe configuration

| Item | Setting |
|---|---|
| Mode | **Test mode** throughout development |
| Products / Prices | One Product + Price per B2C product; B2B deposit uses a server-computed amount on a "B2B pre-order deposit" Product |
| Coupons | `WELCOME20`: 20% coupon, applied by the server via `discounts: [{ coupon }]`. B2B: 10% partner coupon (so the Stripe page shows the discount line) |
| Promotion codes on the Stripe page | **Off.** Codes are validated only by our server. |
| Checkout session | `mode: payment`, `customer`, `client_reference_id` = order reference, `metadata` (order ref, channel, customer ID), `expires_at` = 30 min |
| Payment methods | Card (+ Apple/Google Pay); TWINT to be confirmed (question G3) |
| Webhook endpoint | `https://<domain>/api/stripe/webhook`, events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` |
| Signature | Verified with `STRIPE_WEBHOOK_SECRET` on the raw request body |
| Idempotency | `stripe_events.event_id` primary key + conditional status updates (`… WHERE status = 'PENDING_PAYMENT'`) + `emails_sent` unique key |
| Receipts | Stripe automatic receipts off, so the customer gets **one** confirmation email per payment, from Malaconda (to confirm, G4) |

Stored per order: Stripe customer ID, checkout session ID, payment intent ID.

---

## 8. Missing business rules (owner decisions needed)

### B2C
- **C1. B2C product(s):** what does an individual buy? Case of 24, a smaller pack, or single bottles? Price? Which flavours? Min/max quantity? (The current design shows "12 × 20 cl, CHF 36" for each flavour.)
- **C2. Guest checkout:** can customers buy **without** verifying their email when they don't use WELCOME20? (Recommended: yes, less friction.)
- **C3. "First purchase":** if someone already bought **without** the code, can they still use WELCOME20 later? (Recommended: no. Only customers with zero paid orders.)
- **C4. Refunds:** if a WELCOME20 order is refunded, does the customer get the discount back? (Recommended: no.)
- **C5. Other codes:** are ambassador codes still in scope? Can codes be combined? (Recommended: one code per order.)

### B2B
- **B1. Status flow** in §6.1: correct order? When exactly is a pre-order "Confirmed"?
- **B2. Stripe for B2B:** pays the **20% deposit only** (as before), or can partners pay **100%** by Stripe?
- **B3. Flavours:** does a partner choose flavours per case (Lulo / Guava / mixed)? The rules mention only "Malaconda".
- **B4. Manual status changes** (invoice sent, bank payment received, confirmed, fully paid): the MVP has no admin dashboard. Options: (a) a **minimal protected admin page** (list of B2B orders + status buttons; login by email code restricted to team addresses), recommended; (b) the team edits the database directly in phpMyAdmin, error-prone.
- **B5. Partner access:** is `/partners` public (prices visible to anyone who opens it), or do partners need approval / an access code before seeing prices and ordering?
- **B6. Eligibility:** is a VAT/UID number required to prove it's a business?
- **B7. Deadline:** close the pre-order automatically after Jan 31, 2027?
- **B8. Same email as B2C and B2B?** (Recommended: allowed. The channel is stored on every order, so one customer record can have both B2C and B2B orders. `customer_type` then records how the customer first registered.)

### General
- **G1. VAT:** are CHF 54 (B2B) and B2C prices incl. or excl. VAT? Is Malaconda VAT-registered? (Non-alcoholic beverages may be at the reduced Swiss rate; confirm with your accountant.)
- **G2. Shipping:** countries, costs, free-shipping threshold, B2B delivery included?
- **G3. Payment methods:** card, Apple/Google Pay, TWINT?
- **G4. Emails:** only Malaconda's confirmation (Stripe receipts off)? Sender address? Team notification address?
- **G5. Google Sheets:** still wanted as a read-only reporting copy, or is the database enough for the MVP?
- **G6. Legal:** privacy policy, terms and imprint are needed before live payments (we now store customer accounts and purchase history).

---

## 9. Hosting requirements (Hostinger Business)

| Requirement | Status |
|---|---|
| Node.js Web App | Supported on Business Web Hosting (Node 18/20/22/24). Target **22 LTS**. |
| Express | Listed as supported framework |
| MySQL | Included; created in hPanel, reached from the app via `localhost:3306` |
| Environment variables | Set in hPanel; available at build and runtime |
| GitHub deploy | Supported; **auto-deploy stays off** until owner approves |
| HTTPS | Hostinger SSL (needed for `Secure` cookies and Stripe webhooks) |
| Port | `process.env.PORT` |
| Proxy | `app.set("trust proxy", 1)` so rate limiting sees real IPs |
| Persistent files | None needed: all state in MySQL |
| Cron | Not needed (expiry handled by Stripe events + query conditions) |

New environment variables (added to `.env.example` at implementation):
`DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`,
`DATABASE_PASSWORD`, `SESSION_SECRET`, `STRIPE_COUPON_WELCOME20`,
`STRIPE_COUPON_PARTNER10`, `ADMIN_EMAILS` (if B4a).

---

## 10. Security summary

- Server is the only authority on prices, quantities, discounts and eligibility.
- Stripe webhook signature verification; idempotent processing.
- Passwordless login: hashed one-time codes, expiry, attempt limits, rate limits.
- Session cookies `HttpOnly`, `Secure`, `SameSite=Lax`; tokens stored hashed.
- Parameterised SQL only (no string-built queries) → no SQL injection.
- Input validation on every endpoint; `helmet` security headers; rate limiting
  on auth, checkout and form endpoints.
- No card data, no passwords, no secrets in code or Git.
- Logs contain order references, not customer personal data.

---

## 11. Implementation order (after approval)

1. Database schema + migrations (SQL files) + local MySQL for development.
2. Express skeleton: static serving, security middleware, error handling.
3. Catalog config + B2B pre-order API + Stripe deposit checkout + webhook.
4. Email verification + sessions.
5. B2C checkout + promo validation + reservation/confirmation.
6. Confirmation emails.
7. Frontend wiring (`/` B2C, `/partners` B2B), preserving the design.
8. Tests (Stripe test mode): every scenario in the project brief, plus
   concurrency tests (two simultaneous WELCOME20 checkouts).

Each step = its own feature branch and Pull Request into `develop`.
