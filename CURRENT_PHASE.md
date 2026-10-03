PHASE 19

Implement only Phase 19: Shopping Cart & Real-Time Reservation Checks as defined in `instructions2.md`.

Scope: Dedicated `apps/cart` app; Cart and CartItem models supporting guest sessions (session_key) and authenticated customers (user); multi-seller item grouping with server-authoritative line subtotals and seller subtotals; atomic real-time stock availability verification (`quantity_on_hand - quantity_reserved`); cart endpoints (GET /api/v1/cart/, POST /api/v1/cart/items/, PATCH /api/v1/cart/items/<id>/, DELETE /api/v1/cart/items/<id>/, POST /api/v1/cart/clear/); automated guest-to-authenticated cart merging on login; Next.js slide-out Cart Drawer, navigation badge count, and full Cart page at /cart with seller grouping, coupon discount preview, and out-of-stock checkout guards. Future phases remain architectural context until their turn.

After Phase 19 passes all required validation, update documentation and progress, advance this selector, commit, and push before beginning the next phase. Sequential continuation is authorized. Stop advancement on failed validation or push, and respect later user pause or scope instructions.
