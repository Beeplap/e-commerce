# UI phase selector

STOREFRONT PHASE 40 — COMPLETE

The user's “continue” after completed Phase 39 authorizes only Phase 40 of `instructions4.md`: the existing multi-seller cart, truthful seller/item/stock/summary evidence, pending/error/retry interactions, useful empty states and responsive cart presentation. Validate, inspect screenshots, document, commit/push the isolated branch, summarize and STOP. Phase 41 is not authorized. The original `CURRENT_PHASE.md` remains the independent completed functional selector.

Work in `quick-commerce-ui` on `ui-overhaul-phase40-cart`, based on validated Phase 39 `2499530` and integration `803970d`. Preserve the original worktree's concurrent backend/account/proxy/product/seller edits. Do not merge, move or force-push user branches. Preserve Django/session/CSRF/tenant/API authority, precise money and real checkout/payment workflows.

Keep completed shell/home/discovery/PDP and existing checkout/payment/account behavior. Use customer-scoped tokens, exact server amounts, explicit stock/loading/error states and native controls/dialog behavior. The cart API supplies subtotal, not shipping, taxes, final totals or persisted coupon application; do not invent these. Preserve redirect rejection and the original concurrent proxy correction. Cart results must not survive account changes or supersede accepted mutations with stale reads.

Required: full PostgreSQL `pnpm check`, quiet Compose, palette, production route audit, formatting/diff and retained PNG/report/link validation. Use existing standalone Playwright at 375, 430, 768, 1024, 1440 and 1920px. Separate actual API evidence from explicit populated/error/loading/mutation fixtures; do not claim successful live commerce if the inherited proxy blocks it. Production ingress, real photography, authenticated transactions and other-browser/assistive/performance acceptance remain separate.

Completed validation: full `pnpm check` passes 398 PostgreSQL and 388 frontend tests (786 total, including 44 new cart cases), zero-warning lint, strict types, formatting, API/schema/migration checks and production build (52 generated entries). Quiet Compose and all 22 palette checks pass. The production audit matches 59 source pages (51 server/8 client entries). Final six-width browser evidence retains 102 PNGs (18 actual/84 fixtures); integrity, report and documentation links are checked before the isolated commit/push. See `docs/storefront-cart-review.md` and `docs/progress.md`. Owned previews are stopped; existing PostgreSQL/Redis and original user work remain intact.

STOP after Phase 40. Phase 41 covers checkout only after another explicit request. Do not begin it automatically.
