# Preserving the existing Artifact frontend

The MALACONDA website design already exists as a Claude Artifact.
That design is the **visual foundation** of the project. This document
defines how it is protected while the backend is connected.

> Status: principles and process only. The concrete integration approach
> is decided **after** the owner provides the exported Artifact source,
> and is documented in Phase 2.

## Principles

1. **Import first, unchanged.** The exported source is committed to the
   repository exactly as received, in its own commit, before any edit.
   This creates a permanent, verifiable baseline in Git history.
2. **Integrate, don't redesign.** No change to layout, typography,
   colours, images, copy, animations or responsive behaviour unless the
   owner asks for it.
3. **Smallest possible change.** Only the code needed to talk to the
   backend is touched: form submissions, the checkout action, promo code
   validation, and values that must come from server configuration
   (prices, dates).
4. **No generic e-commerce additions.** No extra pages, widgets, banners
   or product details beyond the agreed scope. New pages that are strictly
   required (Stripe success / cancel) reuse the existing styles.
5. **Stays editable in VS Code.** Texts, translations and styles remain
   in plain, readable files.

## Process

1. Owner provides the exported Artifact source.
2. It is compared against the published Artifact to confirm it is complete
   (all files, images, fonts).
3. Committed unchanged on a dedicated branch (`feature/import-artifact`)
   as the baseline commit.
4. Phase 2 decides the integration approach (for example: keep as static
   HTML/CSS/JS served by Express, or another option), presented to the owner
   for approval.
5. Every later frontend change is a separate, reviewable diff against the
   baseline. PRs state explicitly whether anything visual changed.

## Visual checks

Before each frontend PR is merged:

- Screenshots of the page at desktop, tablet and phone widths are compared
  with the baseline.
- Any visual difference is listed in the PR, or the PR is not merged.

## Known items to resolve with the owner

From the Phase 1 audit (to be re-verified against the export):

- Headline font files (Andreas) were not included in the published Artifact.
- Some content is placeholder (sample reviews, review link, phone number,
  favicon) and must be replaced with real content before launch.
- Existing form targets (`*.php`) do not exist and will be replaced by
  backend API endpoints.
