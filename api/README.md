# Malaconda API

Node 22 + Express + MySQL. Accounts, orders, card payment with Stripe Elements (test mode first), Brevo emails.
The site in `client/` keeps working on its own (data in the browser); this API is what replaces that storage.

## Run locally

```bash
cd api && npm install
cp ../.env.example ../.env        # fill in TEST values only
npm run migrate                   # creates the database and tables (safe to repeat)
npm start                         # http://localhost:3000  (also serves client/)
```

Stripe webhooks, locally (needs the Stripe CLI):

```bash
stripe listen --api-key "$STRIPE_SECRET_KEY" --events payment_intent.succeeded --forward-to localhost:3000/api/stripe/webhook
```

Put the `whsec_...` it prints in `STRIPE_WEBHOOK_SECRET`. Locally the webhook is optional: the page's status check settles the order too.

The payment form needs `STRIPE_PUBLISHABLE_KEY` (pk_test_...) next to the secret key. Payment methods shown (card, Apple Pay, Google Pay, TWINT) are set in the Stripe dashboard and in `client/pay.js`.

## Tests

```bash
DB_PORT=3307 DB_NAME=malaconda_test npm test
```

They need a MySQL and a database name ending in `_test` (the suite refuses to run against anything else). Stripe is faked; webhook signatures are real.

## What it does

| Endpoint | Purpose |
|---|---|
| `POST /api/quote` | price of a cart, computed by the server (same engine as the site) |
| `POST /api/auth/register`, `login`, `logout`; `GET /api/me`, `/api/me/orders` | accounts, session cookie (httpOnly) |
| `GET /api/config` | the Stripe publishable key, for the payment form |
| `POST /api/checkout` | guest or account: stores a pending order priced by the server, creates the PaymentIntent, returns its `clientSecret` (the page confirms it with the Payment Element, without leaving the site) |
| `POST /api/order/status` | after paying (also after a TWINT or bank redirect): order status for a `clientSecret`; settles the order if Stripe says paid before the webhook arrives |
| `POST /api/stripe/webhook` | `payment_intent.succeeded`: order becomes paid once (idempotent), confirmation email |
| `POST /api/contact` | contact form: stored, and mailed to `TEAM_EMAIL` |

Rules shared with the site: prices come from the server only; the 10% first-order offer is for accounts only and ends with the first paid order; money is integer cents; passwords are scrypt-hashed; sessions are stored hashed.

## Going live (after the founders confirm)

0. **Start from nothing.** Nothing created while testing may stay: accounts, passwords, orders, demo pros, contact messages. On the live database run `npm run reset:data` (it lists what it would delete), then `npm run reset:data -- --yes`. Never run `seed:pros` there (it refuses in production). The staging-only parts ("view as" eye, demo accounts page) disappear on their own: they only exist when `STAGING_USER` / `STAGING_PASSWORD` are set.

1. Replace the Stripe test keys (secret and publishable) with the founders' keys, add the webhook endpoint `https://<site>/api/stripe/webhook` in their Stripe dashboard and copy its signing secret.
2. Replace the Brevo key and validate the sender address / domain in Brevo.
3. Set `NODE_ENV=production`, `PUBLIC_BASE_URL`, the database variables, and `ALLOW_LIVE_PAYMENTS=yes` (a live Stripe key is refused without it).
