# UI phase selector

STOREFRONT PHASE 44 COMPLETE

The user's explicit request authorizes only Phase 44 of `instructions4.md`: responsive and accessibility master pass. Audit and correct the customer storefront at 375, 430, 768, 1024, 1280, 1440 and 1920px across header, navigation, search, product/category cards, filters, product detail, cart, checkout, authentication and account flows.

Audit landmarks, heading order, form labels, accessible names, focus management, keyboard navigation, native dialog/drawer behavior, contrast, reduced motion, errors and status semantics. Automated checks supplement browser/manual review; they do not replace it. Keep all existing security, session, CSRF, tenant, API and backend constraints. Do not begin Phase 45.

Work is isolated on `ui-overhaul-phase44-responsive-a11y`, based on pushed Phase 43 commit `8d34f4b`. Original worktrees and the Phase 43 branch remain untouched. The Phase 44 PostgreSQL repository gate, quiet Compose, production artifact/palette checks, formatting and responsive/accessibility audit passed; progress/architecture/design/testing docs are updated. Commit and push this verified branch, report the outcome, and STOP. Phase 45 requires a later explicit request.
