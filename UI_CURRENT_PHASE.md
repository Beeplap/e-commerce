# UI phase selector

STOREFRONT PHASE 37 COMPLETE

The user's “continue” after completed Phase 36 authorized only Phase 37 of `instructions4.md`: homepage composition, real product/category/seller discovery, editorial merchandising and evidence-based value statements. Implementation, responsive review and required validation are complete. Deliver only the isolated branch, summarize and STOP. Phase 38 is not authorized. The original `CURRENT_PHASE.md` remains the independent completed functional selector.

Work in `quick-commerce-ui` on `ui-overhaul-phase37-homepage`, based on validated Phase 36 `f60d7ee` and integration `803970d`. Preserve the original worktree's concurrent backend/account/proxy/product/seller edits. Do not merge, move or force-push user branches. Preserve Django/session/CSRF/tenant/API authority, precise money and real cart/payment workflows.

Use scoped customer tokens/primitives and the completed shell. Only homepage-specific presentation and loading/discovery change. Do not redesign listing/search, PDP, seller, cart, checkout or account routes early. Existing APIs constrain all merchandise/destinations; do not fabricate campaigns, popularity, verification, delivery, imagery or metrics. Distinguish empty data from errors and discard canceled/stale reads.

`pnpm check` passed all 398 PostgreSQL and 258 frontend tests (656 total), formatting, Ruff/Mypy/Django/migration/schema, zero-warning ESLint, strict types and production build. Quiet Compose, all 22 palette checks, the 59-page production audit and diff/evidence checks pass. Existing Playwright captured 32 screenshots at 375, 430, 768, 1024, 1440 and 1920px; six actual catalog cases and 20 separately labeled fixture cases pass. Inspected screenshots, iteration, architecture decisions and acceptance limits are recorded in `docs/storefront-homepage-review.md`, `docs/storefront-design.md`, `docs/architecture.md`, `docs/testing.md` and `docs/progress.md`.

STOP here. Phase 38 will cover product listing, category and search discovery only after another explicit request. Do not begin it automatically.
