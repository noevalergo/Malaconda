# Malaconda API

Node 22 + Express + MySQL. Accounts, orders, Stripe Checkout (test mode first), Brevo emails.
The prototype in `client/proto` keeps working on its own (data in the browser); this API is what replaces that storage.

## Run locally

```bash
cd api && npm install
cp ../.env.example ../.env        # fill in TEST values only
npm run migrate                   # creates the database and tables (safe to repeat)
npm start                         # http://localhost:3000  (also serves client/)
```

Stripe webhooks, locally (needs the Stripe CLI):

```bash
stripe listen --api-key "$STRIPE_SECRET_KEY" --events checkout.session.completed --forward-to localhost:3000/api/stripe/webhook
```

Put the `whsec_...` it prints in `STRIPE_WEBHOOK_SECRET`.

## Tests

```bash
DB_PORT=3307 DB_NAME=malaconda_test npm test
```

They need a MySQL and a database name ending in `_test` (the suite refuses to run against anything else). Stripe is faked; webhook signatures are real.

## What it does

| Endpoint | Purpose |
|---|---|
| `POST /api/quote` | price of a cart, computed by the server (same engine as the prototype) |
| `POST /api/auth/register`, `login`, `logout`; `GET /api/me`, `/api/me/orders` | accounts, session cookie (httpOnly) |
| `POST /api/checkout` | guest or account: stores a pending order, returns the Stripe Checkout URL |
| `POST /api/stripe/webhook` | Stripe says "paid": order becomes paid once (idempotent), confirmation email |
| `POST /api/contact` | contact form: stored, and mailed to `TEAM_EMAIL` |

Rules kept from the prototype: prices come from the server only; the 10% first-order offer is for accounts only and ends with the first paid order; money is integer cents; passwords are scrypt-hashed; sessions are stored hashed.

## Going live (after the founders confirm)

1. Replace the Stripe test keys with the founders' keys, add the webhook endpoint `https://<site>/api/stripe/webhook` in their Stripe dashboard and copy its signing secret.
2. Replace the Brevo key and validate the sender address / domain in Brevo.
3. Set `NODE_ENV=production`, `PUBLIC_BASE_URL`, the database variables, and `ALLOW_LIVE_PAYMENTS=yes` (a live Stripe key is refused without it).
