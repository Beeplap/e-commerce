# UI phase selector

STOREFRONT PHASE 42 COMPLETE

The user's next continue after completed Phase 41 authorizes ONLY Phase 42 of instructions4.md: existing customer sign-in, verification display, profile/security, addresses, order history and order detail polish. Do not invent signup, password reset, verification delivery or saved-items workflows. Preserve Django sessions, CSRF, API contracts, tenant isolation, exact money and all security tests.

Work is isolated in quick-commerce-ui on ui-overhaul-phase42-account, based on validated Phase 41 c369935. Original user/backend/account/proxy/product/seller work, branches and functional CURRENT_PHASE.md remain unchanged. Do not merge, rebase or force-push concurrent branches.

Completed existing shared sign-in and customer overview/profile/security/address/order/detail presentation. Separate customer route-group entries preserve public URLs and Django authorization while allowing static accepted-save feedback to survive a session identity recheck. No signup, recovery, verification delivery or saved-items workflow was invented.

Full PostgreSQL pnpm check passes: 398 backend and 471 frontend tests (869 total), formatting/lint/types, Django/migration/OpenAPI and production build. Real same-origin proxy auth smoke, quiet Compose, 22 palette checks, 80 six-width PNGs/native flows, production audit (59 source pages: 58 server entries/1 client entry), PNG integrity and local links pass. Progress, architecture/security/design/testing and the Phase 42 review record the decisions and acceptance limits.

Deliver the isolated commit and push, summarize and STOP. Phase 43 is not authorized; do not advance the selector or begin microinteractions until an explicit new request. Production live authenticated visual acceptance, other browsers and assistive/touch/zoom/performance acceptance remain pending.
