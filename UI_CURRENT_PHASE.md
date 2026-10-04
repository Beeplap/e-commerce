# UI phase selector

STOREFRONT PHASE 36 COMPLETE

The user's “continue” after completed Phase 35 authorizes only Phase 36 of the supplied `instructions4.md`: customer header, navigation, search, mobile drawer and footer. Run required checks, inspect desktop/tablet/mobile, update progress/design decisions, commit/push the isolated branch, summarize and STOP. Phase 37 is not authorized. The original `CURRENT_PHASE.md` remains the independent completed functional roadmap selector.

Use `quick-commerce-ui` on `ui-overhaul-phase36-shell`, based on validated Phase 35 commit `cb0bd0a` and committed functional/operational integration baseline `803970d`. Preserve the original worktree's uncommitted backend/proxy/account/abort-handling work. Do not merge, move or force-push the user's working branches. Retain Django authorization, sessions, CSRF, tenant isolation, precise money, runtime API validation and actual cart/payment handlers.

Customer tokens/primitives are documented in `docs/storefront-design.md`; Phase 34/35 evidence is preserved. Phase 36 can reshape the customer shell and its own interactions, not homepage/listing/product/transaction/account content. Public discovery must use existing APIs and actual destinations; no fabricated sellers, campaigns, policy/support pages or merchandising promises.

Validation passed: PostgreSQL `pnpm check` (**398 backend + 248 frontend tests**, 32 frontend files), formatting/lint/types/schema/migrations and production build (52 generated entries); quiet Compose validation; **22** palette checks; production audit of **59** source pages; and diff/evidence validation. Standalone Playwright captured 32 screenshots at 375, 430, 768, 1024, 1440 and 1920px, with actual public catalog, native drawer/focus/Escape, desktop discovery/search, skip link, resize and reduced-motion checks. See `docs/storefront-shell-review.md` and `docs/progress.md` for inspected evidence and inherited/pending acceptance. STOP here. Phase 37 is the homepage redesign and requires an explicit request; do not advance this selector automatically.
