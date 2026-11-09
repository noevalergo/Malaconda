# MALACONDA

E-commerce website for **MALACONDA**, a sparkling soda from the Amazon (Biting Lulo · Pink Guava).

> **Status:** backend implemented and tested (Firestore emulator, Stripe simulated), in review.
> Frontend not yet connected. Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
> Developer guide: [docs/BACKEND.md](docs/BACKEND.md).

This repository is the **single source of truth** for the project.
The project starts from scratch: no code from earlier experimental
implementations is reused.

---

## What the website does

Two **separate** purchasing experiences on top of the existing Artifact design:

| | B2C: individual customers | B2B: partners (bars, hotels, restaurants) |
|---|---|---|
| Where | `/` (existing shop + cart) | `/partners` (separate partner store) |
| Product | Case of **12 bottles**, Lulo or Guava | Case of **24 bottles**, one flavour per case |
| Price | **CHF 39.00** per case, VAT incl. | CHF 54.00 −10% partner discount = **CHF 48.60** per case, VAT incl. |
| Quantity | 1–10 cases per order | **5 or 10 cases of one flavour** (5 Lulo · 10 Lulo · 5 Guava · 10 Guava) |
| Discounts | **WELCOME20** (20%, first purchase only, verified email) · **ambassador codes** | Automatic 10% for **approved** partners |
| Payment | Stripe Checkout, full amount | **20% deposit** via Stripe **or** manual invoice; 80% on delivery (never charged automatically) |
| Account | Guest checkout; email verification (6-digit code, no password) for WELCOME20 | Partner application → admin approval → sign-in with email code |

Also:

- One **confirmation email** per verified payment.
- **Google Sheets** reporting: Customers, Orders, Partners, Discount redemptions, Payments, Ambassadors.
- **Ambassador codes** with commission tracking.
- Minimal protected **admin page** (`/admin`): approve partners, record manual payments, update order status, mark commissions paid, resync Sheets.
- Contact and ambassador application forms email the team.

## Architecture

```
Browser: static HTML + CSS + vanilla JS (existing Artifact design)
   │  /api/* (same domain, HTTPS)
   ▼
Node.js 22 + Express (one process on Hostinger Business)
   ├── Firestore      source of truth (customers, orders, codes, redemptions)
   ├── Stripe         Checkout + verified webhooks
   ├── Google Sheets  one-way reporting copy (Firestore → Sheets, never back)
   └── SMTP           confirmation and verification emails
```

| Area | Choice | Why |
|---|---|---|
| Frontend | Existing Artifact: static HTML, CSS, vanilla JS | Preserves the design; no frontend packages; easy to edit in VS Code |
| Backend | Node.js 22 + Express | Supported on Hostinger Business Node.js hosting |
| Database | **Firestore** (Zürich region proposed) | Managed, no server to maintain, transactions for one-time discounts, free at MVP volume |
| Payments | Stripe Checkout + webhooks | No card data on our server |
| Reporting | Google Sheets API | Daily overview; never used for decisions |
| Email | SMTP (`nodemailer`) | Provider swappable by configuration |
| Hosting | Hostinger Business, Node.js Web App from GitHub | Owner's hosting; auto-deploy off until approved |

Not used: React, Next.js, SQL databases, ORMs, Docker, Redis, microservices.

Key safety rules (details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)):

- The server is the only authority on prices, quantities, discounts and eligibility.
- WELCOME20 is reserved during checkout and confirmed only after a verified Stripe webhook; one redemption per customer, enforced by Firestore transactions.
- Duplicate webhooks are detected and skipped.
- If Google Sheets is unavailable, checkout keeps working.

## Project structure

```
client/          existing Artifact (index.html, css/, js/, images/), served as static files
server/
  index.js       entry point (npm start)
  app.js         Express app
  config/        catalog.js (products, prices, limits, dates) · env.js
  db/            ALL Firestore access
  services/      pricing · promo rules · checkout · b2b · webhook · stripe · email · sheets
  routes/        public · auth · b2c · b2b · forms · admin · stripe webhook
  emails/        editable email texts + templates
test/            unit + integration tests (Firestore emulator)
docs/            architecture, backend guide, audits, workflow
```

## Development phases

| Phase | Content | Status |
|---|---|---|
| 0 | Repository setup, Git workflow, docs | PR [#1](https://github.com/noevalergo/Malaconda/pull/1) open |
| 1 | Audit of the existing Artifact; import unchanged + frontend audit | PR [#2](https://github.com/noevalergo/Malaconda/pull/2) open |
| 2 | Architecture and business rules | PR [#3](https://github.com/noevalergo/Malaconda/pull/3): **awaiting approval** |
| 3 | Hostinger compatibility test (Firestore + Stripe from Hostinger) | Skipped for now (owner decision) |
| 4 | Backend: B2C checkout, WELCOME20, B2B pre-orders, webhooks, emails, Sheets, admin API | In review (`feature/backend`) |
| 5 | Frontend wiring on the existing design | — |
| 6 | Testing in Stripe test mode | — |
| 7 | Hostinger deployment (owner approval required) | — |

Each step is a feature branch and a Pull Request into `develop`. Nothing is merged into `main` or deployed without the owner's approval.

## Quick start (developers)

```bash
npm install
npm run test:emulator
```

Needs the Firebase CLI and Java. Setup, local run, API and deployment: [docs/BACKEND.md](docs/BACKEND.md).

## Documentation

- [docs/BACKEND.md](docs/BACKEND.md): developer guide (structure, local setup, tests, API, services setup)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): architecture, data model, flows, decisions and open questions
- [docs/FRONTEND_AUDIT.md](docs/FRONTEND_AUDIT.md): audit of the imported Artifact (PR #2)
- [docs/FRONTEND_PRESERVATION.md](docs/FRONTEND_PRESERVATION.md): how the Artifact design is protected (PR #1)
- [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md): branches, commits, Pull Requests, releases (PR #1)
- [.env.example](.env.example): all environment variables, documented

## Security basics

- Secrets live only in environment variables (`.env` locally, hPanel on Hostinger). Never in code or Git.
- Development uses **Stripe test mode only**.
- No card data and no passwords are stored.
- Firestore denies all direct browser access; only the backend reads and writes.
- `main` is changed only through an approved Pull Request.
