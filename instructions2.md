# QUICK-COMMERCE ROADMAP: PART 2 — CUSTOMER COMMERCE

This document defines the second implementation arc of the `quick-commerce` repository, expanding the platform from platform administration and seller operations into the complete, customer-facing commerce experience:

- Phase 17: Customer Storefront & Browse Experience
- Phase 18: High-Performance Search & Faceted Filtering
- Phase 19: Shopping Cart & Real-Time Reservation Checks
- Phase 20: Customer Checkout & Multi-Seller Order Splitting
- Phase 21: Payment Integration & Idempotency
- Phase 22: Customer Account, Order History, Tracking & Post-Purchase
- Phase 23: Customer Commerce Hardening, E2E Integration & Final Release

Each phase follows the exact repository engineering rules defined in `AGENTS.md`:

- PostgreSQL is authoritative. No Kafka, Kubernetes, Elasticsearch, or separate microservices.
- Modular Django monolith backend (`apps/api`) and feature-oriented Next.js App Router frontend (`apps/web`).
- Strict tenant and customer data isolation: Customer A cannot read or modify Customer B's cart, addresses, or orders.
- Decimal math for all prices, discounts, and payments.
- Real-time stock validation and row-level locking (`select_for_update`) to prevent overselling.
- Single-origin API communication through the central typed client.
- Comprehensive automated backend and frontend tests before advancing.
- Automatic sequential continuation: validate with `pnpm check`, update progress/architecture docs, commit, push to GitHub, and advance to the next phase.

---

# PHASE 17 — Customer Storefront & Browse Experience

Implement the public, high-performance customer browsing experience for marketplace catalog discovery.

### Backend (`apps/api/apps/storefront` or scoped catalog selectors)

- Implement public read-only storefront endpoints:
  - `GET /api/v1/storefront/categories/`: Category tree with active product counts.
  - `GET /api/v1/storefront/brands/`: Active brands list.
  - `GET /api/v1/storefront/products/`: Paginated product cards with filtering by category or brand.
    - Must ONLY return approved products (`status == ACTIVE`) from verified active sellers (`seller__status == ACTIVE`).
    - Excludes drafts, archived, rejected products, and products from suspended/rejected sellers.
    - Fields: UUID id, title, slug, thumbnail image, brand name, category name, starting price (lowest active variant), currency, ratings summary, seller name and id.
  - `GET /api/v1/storefront/products/<id_or_slug>/`: Comprehensive product detail view.
    - Title, description, brand, category, image gallery.
    - Active variants with SKU, options/attributes, price, compare-at price, and available stock flag (`in_stock`, `low_stock`).
    - Verified reviews summary (average rating, review count, rating distribution).
    - Seller profile card (store name, rating, verified badge).
  - `GET /api/v1/storefront/sellers/<id>/`: Public seller store page with seller profile, address location, and active product catalog.
- Security & Invariants:
  - Public endpoints: unauthenticated access allowed (`AllowAny`).
  - Zero leakage of seller private documents, bank accounts, or internal commission rates.
  - Response caching headers enabled (`Cache-Control: public, max-age=60, s-maxage=300`).

### Frontend (`apps/web`)

- Customer Storefront Layout (`app/(storefront)/layout.tsx` or customer shell):
  - Storefront navigation header with brand logo, search trigger, category menu, cart drawer badge with counter, and account link.
  - Category navigation bar.
  - Responsive footer with marketplace trust badges and support links.
- Landing page (`app/page.tsx` or `/store`):
  - Hero banner with featured campaigns / promotions.
  - Featured categories carousel / grid.
  - "New Arrivals" and "Top Rated" product sections.
  - Verified seller spotlight section.
- Category browsing page (`app/categories/[id]/page.tsx`):
  - Category banner, breadcrumbs, and product grid.
- Product detail page (`app/products/[id]/page.tsx`):
  - Multi-image gallery with zoom/thumbnail selection.
  - Variant picker (color, size, etc.) dynamically updating price, SKU, and stock availability.
  - "Add to Cart" button with quantity counter.
  - Seller information card with store link.
  - Verified customer reviews section with star ratings and seller responses.
- Seller storefront page (`app/sellers/[id]/page.tsx`):
  - Seller banner, ratings, and product listing.

### Validation & Quality Gates

- Backend tests in `apps/api/tests/test_phase17_storefront.py`:
  - Public product list returns only active products from active sellers.
  - Suspended seller products and draft products return 404.
  - Product detail correctly computes starting price and aggregates reviews.
  - Cache headers verified on public read endpoints.
- Frontend tests in `apps/web/tests/storefront.test.tsx`:
  - Storefront landing page renders categories and product cards.
  - Product detail page allows variant selection and updates price/stock display.
  - Seller storefront renders seller info and products.
- `pnpm check` must pass cleanly.

---

# PHASE 18 — High-Performance Search & Faceted Filtering

Implement authoritative PostgreSQL full-text search and dynamic faceted catalog navigation without adding external search clusters.

### Backend (`apps/api/apps/storefront/search.py`)

- Full-text search engine:
  - PostgreSQL `SearchVector` and `SearchQuery` (or trigram similarity via `pg_trgm`) indexing product title, description, brand, category, and variant SKUs.
  - Search endpoint: `GET /api/v1/storefront/search/`:
    - Text query `q=...` with ranking using `SearchRank`.
    - Faceted filters: `category`, `brand`, `min_price`, `max_price`, `in_stock=true`, `seller`, `min_rating`.
    - Dynamic facet calculation: aggregated counts for matching categories, brands, and price brackets returned alongside results in a single roundtrip.
    - Sorting options: `relevance`, `price_asc`, `price_desc`, `newest`, `rating`.
  - Autocomplete / suggestions endpoint:
    - `GET /api/v1/storefront/search/suggest/?q=...`: returns fast query suggestions and top matching products.
- Security & Invariants:
  - Query sanitization preventing SQL injection or regex DoS.
  - Bounded pagination (`limit` capped at 50).
  - Strict tenant isolation: only active products from active sellers qualify.

### Frontend (`apps/web`)

- Search bar with instant autocomplete dropdown and keyboard navigation.
- Dedicated search results page (`app/search/page.tsx`):
  - Faceted filter sidebar: category checkboxes, brand checkboxes, price range inputs, rating filter, and in-stock toggle.
  - Sort dropdown selector.
  - Active filter badges with one-click removal and "Clear All" button.
  - Responsive mobile filter sheet / modal.
  - Empty state with query suggestions when no items match.

### Validation & Quality Gates

- Backend tests in `apps/api/tests/test_phase18_search.py`:
  - Full-text search matches partial terms, brand names, and categories.
  - Faceted counts accurately reflect filtered search results.
  - Sorting orders results correctly.
  - Query budget verified for search execution.
- Frontend tests in `apps/web/tests/search.test.tsx`:
  - Autocomplete triggers on search input.
  - Filtering by facets updates search results dynamically.
  - Filter chips can be cleared individually.
- `pnpm check` must pass cleanly.

---

# PHASE 19 — Shopping Cart & Real-Time Reservation Checks

Implement a resilient shopping cart supporting guest sessions, authenticated customer cart merging, multi-seller item grouping, and real-time stock checks.

### Backend (`apps/api/apps/cart`)

- Cart data model:
  - `Cart`: linked to `User` (if authenticated) or `session_key` (if guest), `created_at`, `updated_at`.
  - `CartItem`: linked to `Cart`, `ProductVariant`, `quantity`, `created_at`, `updated_at`.
  - Unique constraint on `(cart, variant)`.
- Cart services & endpoints:
  - `GET /api/v1/cart/`: Fetch cart. Returns items grouped by seller with item prices, quantities, line subtotals, seller subtotals, and real-time availability warnings (e.g. `is_available`, `available_stock`).
  - `POST /api/v1/cart/items/`: Add item with requested quantity. Validates requested quantity against current available stock (`quantity_on_hand - quantity_reserved`).
  - `PATCH /api/v1/cart/items/<id>/`: Update item quantity. Capped at available stock.
  - `DELETE /api/v1/cart/items/<id>/`: Remove item from cart.
  - `POST /api/v1/cart/clear/`: Remove all items.
  - Cart merging: on user login, existing guest cart items automatically merge into the user's cart without losing items or exceeding stock limits.
  - Real-time stock validation service: `validate_cart_stock(cart)` verifying stock availability before checkout progression.
- Security & Invariants:
  - Strict cart ownership: users can only view or mutate their own cart. Guest sessions identify carts via secure signed session cookies.
  - Price tamper protection: line prices are calculated server-side from authoritative `ProductVariant.price`.

### Frontend (`apps/web`)

- Global Cart Context & slide-out Cart Drawer (`components/cart/cart-drawer.tsx`):
  - Accessible from any page via navigation bar cart icon with live badge counter.
  - Quick quantity controls (+ / -) with instant optimistic feedback and server sync.
  - Real-time stock alerts (e.g., "Only 2 left in stock").
- Full Cart page (`app/cart/page.tsx`):
  - Items grouped neatly by seller.
  - Promotional coupon code entry box with instant discount preview using Phase 10 promotions API.
  - Price breakdown: Subtotal, Estimated Shipping, Coupon Discounts, Total.
  - "Proceed to Checkout" action button disabled if cart contains out-of-stock items.

### Validation & Quality Gates

- Backend tests in `apps/api/tests/test_phase19_cart.py`:
  - Adding items, updating quantities, removing items, clearing cart.
  - Guest cart creation and authenticated login cart merging.
  - Quantity capping when requested quantity exceeds available stock.
  - Cross-customer cart access denied (404/403).
- Frontend tests in `apps/web/tests/cart.test.tsx`:
  - Cart drawer opens and updates badge counts.
  - Quantity modifications update totals dynamically.
  - Out-of-stock warnings disable checkout progression.
- `pnpm check` must pass cleanly.

---

# PHASE 20 — Customer Checkout & Multi-Seller Order Splitting

Implement the complete checkout lifecycle: customer shipping addresses, multi-seller shipment options, promotional coupon redemptions, and atomic order placement partitioned into per-seller orders.

### Backend (`apps/api/apps/checkout`)

- Checkout models & services:
  - `CustomerAddress`: customer saved shipping addresses (full name, phone, line1, line2, city, state, postal_code, country, is_default).
  - Checkout quote calculation service:
    - Resolves shipping methods and shipping rates per seller using Phase 9 logistics engine.
    - Evaluates coupon code validity and discount caps using Phase 10 promotions engine.
    - Computes item subtotals, shipping totals, discount allocations, and final order total using strict Decimal arithmetic.
  - Atomic Order Placement service:
    - Locks required variant stock via `select_for_update` across inventory warehouses.
    - Reserves inventory using Phase 6 `InventoryTransaction` (`reservation`).
    - Creates master `Order` and partitions into `SellerOrder` records per seller (Phase 7).
    - Snapshots line items (`OrderItem`) with title, SKU, variant, price, currency, tax, and snapshot commission rates (Phase 8).
    - Records initial `OrderStatusHistory` entries.
    - Emits `order.created` transactional outbox event (Phase 14).
    - Clears items from the customer's cart atomically upon successful order creation.
- Endpoints:
  - `POST /api/v1/checkout/quote/`: Preview shipping fees, discounts, and total order amounts.
  - `POST /api/v1/checkout/place-order/`: Atomic order placement returning order ID and payment instructions.
- Security & Invariants:
  - Zero overselling: aborts transaction with descriptive `ValidationError` if any variant stock was exhausted between cart and checkout.
  - Tenant isolation: sellers only receive their respective `SellerOrder` partition.

### Frontend (`apps/web`)

- Checkout workflow page (`app/checkout/page.tsx`):
  - Step 1: Shipping address selection (saved addresses list or new address form with validation).
  - Step 2: Shipping method selection per seller.
  - Step 3: Order summary with clear itemized breakdown per seller, discounts, shipping fees, and grand total.
  - Step 4: Order review and confirmation.
- Order success page (`app/checkout/success/page.tsx`):
  - Displays order number, estimated delivery windows per seller, and link to track orders.

### Validation & Quality Gates

- Backend tests in `apps/api/tests/test_phase20_checkout.py`:
  - Quote calculation accurately applies shipping rates and coupon discounts.
  - Atomic order placement partitions multi-seller cart into correct child `SellerOrder` records.
  - Stock is reserved atomically with `reservation` ledger transactions.
  - Concurrency test: simultaneous checkouts against last available unit reject second buyer cleanly without overselling.
- Frontend tests in `apps/web/tests/checkout.test.tsx`:
  - Shipping address selection and validation.
  - Multi-seller shipment options render correctly.
  - Order placement navigates to confirmation screen with order reference.
- `pnpm check` must pass cleanly.

---

# PHASE 21 — Payment Integration & Idempotency

Implement payment processing abstraction with idempotency guarantees, mock/Stripe gateway handlers, signed webhooks, and automatic order settlement.

### Backend (`apps/api/apps/payments`)

- Payment architecture:
  - Models: `Payment` (linked to `Order`, amount, currency, status, provider, reference_id, idempotency_key), `PaymentTransaction` (audit log of payment gateway interactions).
  - Payment statuses: `PENDING`, `AUTHORIZED`, `CAPTURED`, `FAILED`, `REFUNDED`.
  - Idempotency key middleware/guard: rejects duplicate payment attempts with HTTP 409 or returns existing transaction.
  - Payment confirmation service:
    - On successful payment capture:
      - Transitions `Order` and all child `SellerOrder`s from `PENDING` to `CONFIRMED` / `PROCESSING`.
      - Converts inventory reservation to `sale` transactions (Phase 6).
      - Credits `SellerBalance` with net payout amounts and snapshot commission debits (Phase 8).
      - Emits `payment.captured` transactional outbox event (Phase 14).
    - On payment failure or expiration:
      - Marks payment `FAILED`.
      - Automatically releases reserved inventory via `release` transactions (Phase 6).
      - Cancels order.
  - Webhook listener: `POST /api/v1/webhooks/payment/` with HMAC signature validation.
- Endpoints:
  - `POST /api/v1/checkout/payment-intent/`: Initializes payment for an order.
  - `POST /api/v1/checkout/confirm-payment/`: Confirms payment with idempotency key.
  - `POST /api/v1/webhooks/payment/`: Signed webhook handler.

### Frontend (`apps/web`)

- Payment integration component (`features/checkout/payment-form.tsx`):
  - Card input form with validation (card number, expiration, CVC).
  - Idempotent submit handling with loading indicators disabling double-clicks.
  - Payment failure alerts with clear retry instructions.

### Validation & Quality Gates

- Backend tests in `apps/api/tests/test_phase21_payments.py`:
  - Successful payment capture transitions order and converts reservations to sales.
  - Replayed payment request with same idempotency key returns existing payment without double-charging.
  - Failed payment releases reserved stock back to available pool.
  - Webhook with invalid HMAC signature rejected with HTTP 400.
- Frontend tests in `apps/web/tests/payments.test.tsx`:
  - Payment form validates card inputs and handles payment errors gracefully.
- `pnpm check` must pass cleanly.

---

# PHASE 22 — Customer Account, Order History, Tracking & Post-Purchase

Implement customer account management, order history, live parcel tracking, product reviews, and return requests.

### Backend (`apps/api/apps/customers`)

- Customer endpoints:
  - `GET /api/v1/customer/profile/` & `PATCH /api/v1/customer/profile/`: Manage name, email, phone.
  - `GET`, `POST`, `PATCH`, `DELETE` on `/api/v1/customer/addresses/`: Saved address book.
  - `GET /api/v1/customer/orders/`: Paginated order history scoped strictly to the authenticated customer.
  - `GET /api/v1/customer/orders/<id>/`: Full order detail with items, seller packages, and live tracking timelines (Phase 9 `TrackingEvent`).
  - `POST /api/v1/customer/orders/<id>/cancel/`: Customer-initiated order cancellation for orders still in `PENDING` state. Releases reservations.
  - `POST /api/v1/customer/reviews/`: Submit verified product reviews for delivered order items (Phase 10).
  - `POST /api/v1/customer/returns/`: Submit return requests (RMA) for delivered order items with return reason (Phase 9).
- Security & Invariants:
  - Customer isolation: Customer A cannot view, cancel, or return Customer B's orders (HTTP 404).
  - Verified review enforcement: Customer can only review products they actually purchased and received.

### Frontend (`apps/web`)

- Customer Portal (`app/account/*`):
  - `/account/orders`: Chronological list of orders with status badges, thumbnail previews, and order dates.
  - `/account/orders/[id]`: Interactive order detail screen with delivery progress stepper, carrier tracking numbers, and links to external parcel carriers.
  - "Write Review" modal: Star rating picker, review title, body, and submit.
  - "Request Return" modal: Item selector, return reason dropdown, and notes.
  - `/account/addresses`: Saved shipping address management (add, edit, delete, set default).
  - `/account/profile`: Name, email, and password change.

### Validation & Quality Gates

- Backend tests in `apps/api/tests/test_phase22_customer_portal.py`:
  - Customer can only see their own orders; other customer orders return 404.
  - Cancellation is permitted on pending orders and releases inventory.
  - Reviews can only be submitted for delivered order items.
  - Return requests create RMA records linked to the correct seller.
- Frontend tests in `apps/web/tests/customer-portal.test.tsx`:
  - Order history renders list and detail views.
  - Tracking stepper renders carrier events.
  - Review modal submits review and updates UI.
- `pnpm check` must pass cleanly.

---

# PHASE 23 — Customer Commerce Hardening, E2E Integration & Final Release

Conduct a comprehensive security and adversarial verification of customer commerce, end-to-end integration flows, and final production release.

### Tasks

- Adversarial Security Pass:
  - Attempt price manipulation by tampering with client-submitted payload during checkout.
  - Attempt cross-customer cart, order, and address access.
  - Attempt stock overselling under heavy concurrency.
  - Attempt replaying payments or refunding already refunded orders.
- End-to-End Integration Flows (`apps/web/tests/customer-e2e-flows.test.tsx`):
  1. Browse catalog, select variant, add to cart.
  2. Search for product with full-text search, apply category and price filters.
  3. Update cart quantities, apply coupon code, verify discount.
  4. Complete checkout: enter shipping address, choose seller shipping methods.
  5. Process idempotent payment, verify order placement.
  6. Verify seller order created and inventory reserved.
  7. View order in customer account, inspect tracking timeline.
  8. Submit verified product review and request return on delivered item.
- Documentation & Final Release:
  - Update `docs/architecture.md`, `docs/data-model.md`, `docs/security.md`, `docs/testing.md`, `docs/progress.md`.
  - Regenerate OpenAPI schema (`manage.py spectacular`).
  - Run full repository validation (`pnpm check`).
  - Author `docs/customer-commerce-release.md`.
  - Advance `CURRENT_PHASE.md` to complete and push to GitHub.

Print:
CUSTOMER COMMERCE ROADMAP COMPLETE
