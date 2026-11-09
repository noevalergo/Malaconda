# Backend — developer guide

Node.js 22 + Express, Firestore, Stripe Checkout, Google Sheets (reporting),
SMTP email. Design and business rules: [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. Folder structure

```
server/
  index.js            entry point (npm start): reads env, wires dependencies, starts HTTP
  app.js              builds the Express app (dependencies injected → testable)
  config/
    catalog.js        ★ ALL prices, quantities, discounts, timeline (single source of truth)
    env.js            environment variables: validation, defaults, warnings
  db/                 ★ the ONLY code that talks to Firestore (swap database = rewrite this folder)
    firestore.js      connection + collection names
    customers.js      customers, one customer per email (emailIndex)
    auth.js           verification codes, sessions (hashed)
    partners.js       partner applications / approval
    orders.js         orders, payments, webhook transactions, admin actions, commissions
    promotions.js     promo codes, reservation, ambassadors, duplicate-use signals
    export.js         read helpers for Google Sheets
    seed.js           creates WELCOME20
  services/
    pricing.js        pure price calculations (B2C cart, discounts, shipping, B2B pre-order)
    promo-rules.js    pure eligibility rules for WELCOME20 / ambassador codes
    checkout-b2c.js   B2C checkout flow (reserve code → Stripe session)
    b2b.js            partner application, catalogue, pre-orders (Stripe / invoice)
    webhook.js        Stripe event handling
    stripe.js         every Stripe API call
    auth.js           6-digit email code sign-in
    notifications.js  confirmation + team emails
    email.js          SMTP sender (nodemailer)
    sheets.js         Google Sheets API client (upsert by key)
    reporting.js      Firestore → Sheets rows (never the other way)
  routes/             HTTP endpoints (thin: validate input, call a service)
  middleware/         security headers, origin check, rate limits, sessions, errors
  emails/
    content.js        ★ editable email texts (product info, storage, delivery…)
    templates.js      email layouts
  lib/                small helpers (errors, ids, money, dates, validation, logging)
client/               existing website (Artifact design), served as static files
test/                 unit + integration tests (Firestore emulator)
scripts/seed.js       creates the WELCOME20 code
firestore.rules       denies all browser access to Firestore
firestore.indexes.json  composite indexes (deploy with the Firebase CLI)
```

★ = files the business is most likely to change.

## 2. Run locally

Requirements: Node.js 22, Java 11+ (for the Firestore emulator), Firebase CLI.

```bash
npm install
npm install -g firebase-tools
```

Terminal 1, the local database (no Google account needed):

```bash
firebase emulators:start --only firestore --project demo-malaconda
```

Terminal 2, the app:

```bash
cp .env.example .env
```

In `.env` set at least: `SESSION_SECRET`, `STRIPE_SECRET_KEY` (sk_test_…),
`STRIPE_WEBHOOK_SECRET`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`,
`FIREBASE_PROJECT_ID=demo-malaconda`, `SHIPPING_CH_CENTS` (any test value).

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seed.js
```

```bash
npm run dev
```

Open http://localhost:3000. Without SMTP settings, emails (including the 6-digit
codes) are printed in the terminal.

Stripe webhooks locally (Stripe CLI):

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`.

## 3. Tests

```bash
npm test
```

Runs the unit tests only; integration tests are skipped without the emulator.

```bash
npm run test:emulator
```

Runs everything (46 tests) against a temporary Firestore emulator. The integration
tests use the real app and the real Firestore engine (transactions included), with
a simulated Stripe. Webhook signatures are generated and checked with Stripe's
real library.

Covered: purchase of each product, server-side prices, successful / cancelled /
failed payment, duplicate webhook delivery, B2B 5 and 10 cases, Stripe deposit,
invoice workflow with manual payments, WELCOME20 (verification, first order only,
reservation, confirmation, release), 6 parallel discounted checkouts, takeover of
an older checkout, ambassador code + commission, refunds, duplicate-use flags,
Sheets outage, CSRF, webhook signatures, admin access, code brute force, rate limits.

Note: tests use Firestore over gRPC (the emulator doesn't support the REST mode
without Google credentials); production uses REST (`preferRest`). Transaction
semantics are enforced by the Firestore server and are the same for both.

## 4. API reference

All `POST` requests: JSON body, and must come from the site's own origin
(`Origin` header). Errors: `{ "error": { "code": "…", "message": "…" } }`.

### Public
| Method | Path | Notes |
|---|---|---|
| GET | `/api/public/health` | `{ ok: true }` |
| GET | `/api/public/config` | B2C products and prices, max cases, shipping, timeline. No B2B prices. |

### Sign-in (customers and partners)
| Method | Path | Body |
|---|---|---|
| POST | `/api/auth/request-code` | `{ email }`: sends a 6-digit code (same answer for every email) |
| POST | `/api/auth/verify-code` | `{ email, code }`: sets `mlc_session` cookie (HttpOnly, 30 days) |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | own status: `signedIn, email, emailVerified, partnerStatus` |

### B2C shop
| Method | Path | Body |
|---|---|---|
| POST | `/api/b2c/promo/check` | `{ code, items }` → `{ valid, discountCents }` or reason (reserves nothing) |
| POST | `/api/b2c/checkout` | `{ items: [{ sku, quantity }], promoCode?, lang? }` → `{ orderRef, url }`: redirect to `url` |

SKUs: `B2C_LULO_12`, `B2C_GUAVA_12`. Codes need a signed-in, verified customer.

### B2B partner store
| Method | Path | Notes |
|---|---|---|
| POST | `/api/b2b/apply` | signed in; `{ fullName, companyName, businessAddress, phone }` |
| GET | `/api/b2b/status` | signed in; `{ approvalStatus }` |
| GET | `/api/b2b/catalog` | approved partner; prices and rules |
| POST | `/api/b2b/preorder` | approved partner; `{ sku: "B2B_LULO_24"|"B2B_GUAVA_24", quantity: 5|10, workflow: "STRIPE"|"INVOICE" }` → `{ orderRef, url? }` |

### Forms (email to the team)
`POST /api/forms/contact`, `POST /api/forms/ambassador`: field names as in the existing HTML forms.

### Stripe
`POST /api/stripe/webhook`: events `checkout.session.completed`,
`checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
`checkout.session.expired`, `charge.refunded`.

### Admin (`mlc_admin` cookie, emails in `ADMIN_EMAILS` only)
See the header of [server/routes/admin.js](../server/routes/admin.js): sign-in, partner
approval, orders, manual payments, order status, invoice sent, resend confirmation,
ambassadors, monthly commissions, Sheets resync.

## 5. Status vocabularies

| | Order status | Payment status |
|---|---|---|
| B2C | `NEW` → `SHIPPED` → `DELIVERED` / `CANCELLED` | `PENDING` → `PROCESSING` → `PAID` / `FAILED` / `EXPIRED` / `REFUNDED` |
| B2B | `PENDING_CONFIRMATION` → `CONFIRMED_PREORDER` → `DELIVERED` / `CANCELLED` | `AWAITING_DEPOSIT` → `DEPOSIT_PAID` → `FULLY_PAID` (+ `PROCESSING`, `FAILED`, `EXPIRED`, `REFUNDED`) |

## 6. Setting up the real services (owner / engineer)

**Firebase**
1. console.firebase.google.com → new project (Blaze plan recommended, with a budget alert).
2. Firestore Database → create → location **europe-west6 (Zürich)**. The location can't be changed later.
3. Deploy rules and indexes:

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes --project <id>
   ```
4. Project settings → Service accounts → Generate new private key → Base64 → `FIREBASE_SERVICE_ACCOUNT_BASE64`.
5. Create WELCOME20:

   ```bash
   node --env-file=.env scripts/seed.js
   ```

**Stripe (test mode)**
1. Developers → API keys → `sk_test_…` → `STRIPE_SECRET_KEY`.
2. Developers → Webhooks → add endpoint `https://<domain>/api/stripe/webhook` with the 5 events above → signing secret → `STRIPE_WEBHOOK_SECRET`.
3. Settings → Payment methods: card, Apple Pay / Google Pay, TWINT.
4. Settings → Customer emails: turn off "Successful payments" receipts (one email from Malaconda per payment).
5. No products or prices need to be created in Stripe: prices come from `server/config/catalog.js`.

**Google Sheets**: create a spreadsheet, share it (Editor) with the service
account's `client_email`, put its ID in `GOOGLE_SHEETS_SPREADSHEET_ID`. Tabs are
created automatically.

**Email**: any SMTP mailbox (e.g. Hostinger) → `SMTP_*`, `EMAIL_FROM`, `EMAIL_TEAM_TO`.

## 7. Hostinger

- Start command `npm start`; Node 22; the app listens on `process.env.PORT`.
- Environment variables in hPanel (same names as `.env.example`), with `NODE_ENV=production` and an `https://` `PUBLIC_BASE_URL`.
- No build step. No files are written to disk; all state is in Firestore.
- Logs: one JSON line per event in the Node.js app logs (no personal data).

## 8. Not done yet / open items

- **Frontend wiring** (next phase): `client/js/main.js` still uses the old
  email/WhatsApp checkout. The pages `/partners`, `/admin`, `/success.html`
  and `/cancel.html` don't exist yet; Stripe returns to `/success.html` and `/cancel.html`.
- **Shipping cost** (G2b): checkout stays closed until `SHIPPING_CH_CENTS` is set.
- **Email texts** in `server/emails/content.js` are placeholders ("[to be provided]").
- **German emails**: emails are English only for now.
- **C5** (refund gives the code back?) is implemented as "no", pending owner confirmation.
- `npm audit`: 6 moderate warnings, all from `rimraf` → `glob` / `minimatch`
  nested inside Google's `google-gax` (a file-deletion utility; the server never
  calls it and it isn't reachable by user input). The fix (rimraf 6.1.4) was
  published on 2026-11-03; update with `npm audit fix` once it is at least two
  weeks old or when `firebase-admin` updates.
- Not yet tested against a real Firebase project, real Stripe test account, real
  Google Sheet or real SMTP server, or deployed on Hostinger.
