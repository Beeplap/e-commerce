# UI phase selector

STOREFRONT PHASE 35 COMPLETE

The user's “start” after the completed Phase 34 audit authorizes ONLY Phase 35 of the user-supplied `instructions4.md`: scoped customer tokens and shared storefront foundation, validation, documentation and STOP. Phase 36 and later phases require another explicit request. The original `CURRENT_PHASE.md` remains the independent functional roadmap selector.

Phase 34 evidence is preserved in `docs/storefront-ui-audit.md`. Phase 35 introduces `apps/web/styles/storefront.css` and customer primitives in `components/storefront`; the design contract is `docs/storefront-design.md`. Preserve page composition and real workflow handlers. Do not implement the later shell/home/listing/product/cart/checkout/account redesigns early. The supplied roadmap remains in the original worktree and has not been rewritten.

Representative standalone Playwright inspection at 375, 430, 768, 1024, 1440 and 1920px is recorded in `docs/storefront-foundation-review.md`, with thirty retained screenshots. Real catalog/route evidence is separate from component fixtures and source inference. Populated detail/commerce, authenticated content, assistive technology, cross-browser, zoom and performance acceptance remain pending; foundation checks do not establish storefront release acceptance.

Use the separate `quick-commerce-ui` worktree on `ui-overhaul-phase35-foundation`, now based on committed integration revision `803970d` after the user's independent rebase completed. Preserve the original worktree's uncommitted work. No merge, rebase continuation or force-push to the user's working branches belongs to this phase. The backend `CURRENT_PHASE.md` belongs to the concurrent functional/security roadmap and is not this UI selector.

PostgreSQL `pnpm check` passes with 398 backend and 230 frontend tests, lint, type checks, formatting, offline schema validation and production build. Quiet Compose validation, all 22 palette checks, the 59-page production route audit and diff checks pass. Results and limitations are recorded in `docs/progress.md`. Preserve the existing auth/API/CSRF/tenant controls and operational tests. Delivery is only on the isolated foundation branch. STOP; Phase 36 is not authorized.

UI phases 23–33 remain implemented. Their seller/admin visual acceptance gaps are historical and are not resolved by customer foundation work. Phases 34 and 35 are complete. Phase 36 covers the customer header, search, navigation and footer after another explicit request. Do not continue automatically or invent additional phases.

Integration stays separate: preserve the other worktree's work. The foundation was rebased in its isolated worktree onto the user's committed integration baseline after their independent rebase completed. Genuine frontend conflicts were resolved by retaining the real cart context/actions and applying customer tokens. The user's uncommitted fixes are not imported. Preserve authorization, tenant isolation, CSRF, runtime validators and working functionality.

After Phase 26, critique actual Seller Dashboard screenshots at 1440px and mobile before further dashboard changes when browser access or supplied screenshots are available. Record visual evidence and limitations honestly.
