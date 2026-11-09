# MALACONDA

E-commerce website for **MALACONDA**, a sparkling soda from the Amazon (Biting Lulo · Pink Guava).

> **Status:** project setup. No application code yet.
> The frontend will come from the owner's existing Claude Artifact design.
> Backend work starts only after the architecture (Phase 2) is approved.

This repository is the **single source of truth** for the project.
The project starts from scratch: no code from earlier experimental
implementations is reused.

---

## Goals (initial version)

1. Sell the two products individually through **Stripe Checkout**.
2. Let bars, hotels and restaurants register **B2B pre-orders** with a **20% downpayment**.
3. Record customers, orders and payments in **Google Sheets**.
4. Send **confirmation emails** after verified payments or registrations.
5. Track **promo codes** and **ambassador commissions**.

Out of scope for now: customer accounts, admin dashboard, extra pages or features not listed above.

## Planned stack (to be confirmed in Phase 2)

| Area | Choice | Why |
|---|---|---|
| Frontend | The existing Artifact (preserved, not redesigned) | It is the approved brand design |
| Backend | Node.js + Express (REST) | Simple, runs on Hostinger Business Node.js hosting |
| Payments | Stripe Checkout + webhooks | No card data on our server |
| Reporting | Google Sheets API (service account) | Business admin already works in Sheets |
| Email | SMTP via a modular email service | Provider can be swapped by configuration |
| Hosting | Hostinger Business — Node.js Web App, deployed from GitHub | Owner's existing hosting |

Explicitly **not** used unless a concrete need appears: Next.js, Prisma, Docker, Redis, microservices.

## Development phases

| Phase | Content | Status |
|---|---|---|
| 1 | Audit of the existing Artifact and requirements | Done (presented in chat) |
| 0 | Repository setup, Git workflow, docs | In progress |
| 2 | Architecture: structure, endpoints, config, integrations, env vars | Waiting for Artifact export |
| 3 | Frontend integration (move Artifact into project, connect forms/buttons) | — |
| 4 | Backend (Stripe, webhooks, Sheets, email, promo codes) | — |
| 5 | Testing (Stripe test mode) | — |
| 6 | Hostinger deployment | — |

Each phase ends with a Pull Request and the owner's approval before the next one starts.

## Documentation

- [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md): branches, commits, Pull Requests, releases
- [docs/FRONTEND_PRESERVATION.md](docs/FRONTEND_PRESERVATION.md): how the Artifact design is protected
- [.env.example](.env.example): environment variables (names only, provisional)

## Security basics

- Secrets live only in environment variables (`.env` locally, hPanel on Hostinger). Never in code or Git.
- Development uses **Stripe test mode only**.
- No card data is ever handled by our server.
- `main` is changed only through an approved Pull Request.
