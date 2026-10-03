PHASE 20

Implement only Phase 20: Customer Checkout & Multi-Seller Order Splitting as defined in `instructions2.md`.

Scope: Dedicated `apps/checkout` app; CustomerAddress model for saved shipping addresses; checkout quote calculation service resolving per-seller shipping methods/rates (Phase 9) and coupon validation (Phase 10); atomic order placement service with select_for_update stock locking, inventory reservation (Phase 6), master Order creation and child SellerOrder splitting (Phase 7), OrderItem snapshots and commission rates (Phase 8), OrderStatusHistory, transactional outbox event order.created (Phase 14), and cart clearing; endpoints POST /api/v1/checkout/quote/ and POST /api/v1/checkout/place-order/; customer addresses CRUD endpoints; Next.js checkout workflow page at /checkout (address selection, per-seller shipping methods, order summary review, and order confirmation) and order confirmation page at /checkout/success. Future phases remain architectural context until their turn.

After Phase 20 passes all required validation, update documentation and progress, advance this selector, commit, and push before beginning the next phase. Sequential continuation is authorized. Stop advancement on failed validation or push, and respect later user pause or scope instructions.

