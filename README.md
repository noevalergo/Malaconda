# MALACONDA

Website and back office for **MALACONDA**, a sparkling soda from the Amazon (Biting Lulo · Pink Guava).
One site for everyone: visitors and customers (shop, cart, card payment, "My account"), professionals (bars, hotels, restaurants: pro prices, online ordering, pro space), ambassadors (commission space) and the founders' admin.

## What is where

| Folder | Content |
|---|---|
| `client/` | The site: static pages, no build step. `index.html` is the home page. |
| `api/` | Node 22 + Express 5 + MySQL: accounts, orders, Stripe card payments, emails. Also serves `client/`. See [api/README.md](api/README.md). |
| `docs/` | [COMMERCIAL_SPEC.md](docs/COMMERCIAL_SPEC.md) (prices, discounts, commissions) and [ACCOUNT_MODEL.md](docs/ACCOUNT_MODEL.md) (the rules per type of account). |
| `tests/` | Tests of the site's price rules and account logic. |
| `tools/` | Staging build and deploy, local server, email preview. |

## Run it

```bash
python3 tools/devserve.py 8000 client      # the site alone, at http://localhost:8000
node --test tests/*.test.js                # site tests
cd api && npm install && npm test          # API tests (need MySQL, see api/README.md)
```

The site alone keeps its demo data in the browser. With the API running (`cd api && npm start`), payments, accounts and orders go through the server and the database.

## Staging

`tools/build-staging.sh` builds the archive from a commit, checks that no secret is inside. `tools/deploy-staging.sh` sends it to Hostinger, replaces the whole `client/` folder and restarts the app.

## Security basics

- Secrets live only in environment variables (`.env` locally, hPanel on Hostinger). Never in code or Git. [.env.example](.env.example) lists the names.
- Development uses **Stripe test mode only**.
- No card data ever reaches our server: the card form is Stripe's.
- Before going live, all test data is deleted (`npm run reset:data` in `api/`).
