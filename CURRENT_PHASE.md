PHASE 22

Implement only Phase 22: Customer Account, Order History, Tracking & Post-Purchase as defined in `instructions2.md`.

Scope: Dedicated `apps/customers` app; Customer profile endpoints (GET/PATCH `/api/v1/customer/profile/`); Address book CRUD (`/api/v1/customer/addresses/`); Paginated customer order history (`/api/v1/customer/orders/`) and detail with live tracking timeline (`/api/v1/customer/orders/<id>/`); Customer cancellation for PENDING orders with inventory release (`/api/v1/customer/orders/<id>/cancel/`); Verified product reviews for delivered order items (`/api/v1/customer/reviews/`); Customer return requests (RMA) for delivered items (`/api/v1/customer/returns/`); Next.js customer account screens at `/account/orders`, `/account/orders/[id]`, `/account/addresses`, `/account/profile`, with write review and return request modals. Future phases remain architectural context until their turn.

After Phase 22 passes all required validation, update documentation and progress, advance this selector, commit, and push before beginning the next phase. Sequential continuation is authorized. Stop advancement on failed validation or push, and respect later user pause or scope instructions.
