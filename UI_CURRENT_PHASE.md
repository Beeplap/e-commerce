# UI phase selector

STOREFRONT PHASE 39 COMPLETE

The user's “continue” after completed Phase 38 authorizes only Phase 39 of `instructions4.md`: product detail, gallery, exact prices, options, actual stock, seller identity, reviews, related discovery and confirmed cart feedback. Validate, inspect screenshots, document, commit/push the isolated branch, summarize and STOP. Phase 40 is not authorized. The original `CURRENT_PHASE.md` remains the independent completed functional selector.

Work in `quick-commerce-ui` on `ui-overhaul-phase39-product-detail`, based on validated Phase 38 `5a3d0ff` and integration `803970d`. Preserve the original worktree's concurrent backend/account/proxy/product/seller edits. Do not merge, move or force-push user branches. Preserve Django/session/CSRF/tenant/API authority, precise money and real cart/payment workflows.

The PDP implementation uses scoped customer tokens, a small server entry/client API reads, bounded actual evidence, native gallery/options/quantity and focused rejection after real provider acceptance. It invents no seller verification, delivery timing, stock reservation, Buy Now or photography. Keep existing shell/home/discovery and seller/cart/checkout/account workflows. The inherited cart HTTP 308 proxy rejection remains visible; original concurrent proxy changes are separate. See `docs/storefront-product-detail-review.md`.

Passed: full PostgreSQL `pnpm check` (398 backend and 344 frontend tests, formatting/lint/types/schema/migrations and production build), quiet Compose, 22 palette checks, production audit (59 source pages, 50 server/9 client entries), formatting/diff and retained PNG/report/link validation. Existing standalone Playwright captured both actual products at 375, 430, 768, 1024, 1440 and 1920px, plus 32 labeled supplemental gallery/long/loading/error/availability/cart/related cases. All 82 retained PNGs pass integrity checks. Delivery uses only this isolated branch. Production ingress/real photography/authenticated transactions and other-browser/assistive/performance acceptance remain separate.

STOP after Phase 39. Phase 40 covers the existing multi-seller cart only after another explicit request. Do not begin it automatically.
