# Git workflow

Simple and safe: nothing reaches `main` (production) without a reviewed,
approved Pull Request.

## Branches

```
main          production. What is (or will be) live on Hostinger.
  └─ develop  integration. All finished work is merged here first.
       ├─ feature/<short-name>   new functionality   e.g. feature/stripe-checkout
       ├─ fix/<short-name>       bug fixes            e.g. fix/webhook-duplicate-row
       ├─ chore/<short-name>     setup, tooling, deps e.g. chore/project-setup
       └─ docs/<short-name>      documentation only
```

| Branch | Who changes it | How |
|---|---|---|
| `main` | Owner only | Merge PR `develop → main` after approval. Hostinger deploys from here. |
| `develop` | Via PR | Merge PR `feature/* → develop` after review |
| `feature/*`, `fix/*`, `chore/*`, `docs/*` | Developer | Direct commits, short-lived |

Rules:

1. **Never commit directly to `main` or `develop`.**
2. One branch = one topic. Keep branches small and short-lived.
3. Start every branch from the latest `develop`.
4. Delete the branch after its PR is merged.

## Day-to-day

```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-change
# ...work, commit...
git push -u origin feature/my-change
# open a Pull Request: feature/my-change → develop
```

## Commits

- Short imperative subject line, ≤ 72 characters: `Add Stripe webhook signature check`
- Body (optional): *why* the change was made.
- Never commit `.env`, keys, service account JSON or customer data.

## Pull Requests

Every PR uses the template in `.github/pull_request_template.md` and states:

- what changed and why,
- how it was tested (Stripe **test mode** only),
- whether the visual design changed (it normally must not),
- new or changed environment variables.

## Releases to production

1. `develop` is tested end-to-end in Stripe test mode.
2. PR `develop → main` is opened with a release checklist.
3. **Owner approves and merges.** Hostinger deploys `main`.
4. Production is checked with the production checklist (Phase 6).

No deployment to production happens without the owner's explicit approval.

## Recommended GitHub settings (owner decision)

Currently `main` has **no branch protection**. Recommended, in
GitHub → Settings → Branches → Add rule for `main`:

- Require a pull request before merging
- Block force pushes
- Do not allow deletions

Same rule optionally for `develop`.
