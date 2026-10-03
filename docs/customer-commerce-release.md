# Customer Commerce Release & Architecture Overview

## Executive Summary

The Customer Commerce extension (Phases 17–23) builds upon the multi-seller marketplace foundation (Phases 0–16) to deliver a high-performance customer-facing commerce experience. Built strictly as a modular Django monolith and Next.js App Router frontend, it preserves all core invariants: server-authoritative calculations, PostgreSQL data integrity triggers, row-level locking for inventory allocation, zero raw card data retention, strict tenant isolation, and comprehensive adversarial verification.

Across the entire platform, all **23 Phases** are fully implemented, verified, and backed by **550 automated tests** (398 Django backend tests against authoritative PostgreSQL and 152 Next.js React Testing Library tests) with zero lint, type, or migration drift issues.

---

## Architecture Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CUSTOMER COMMERCE SYSTEM                        │
└────────────────────────────────────────────────────────────────────────┘

 [Storefront / Catalog]        [Search & Discovery]       [Cart & Reservations]
 • Public Categories/Brands    • Full-text Search (pg_trgm)• Guest / Auth Sessions
 • Filtered Active Products    • Faceted Filtering         • Live Warehouse Check
 • Reactive Variant Selector   • Instant Autocomplete      • Line/Seller Subtotals
 • Review Breakdown & Badges   • Zero Client Aggregations  • Real-time Merging
             │                              │                          │
             └──────────────────────┬───────┴──────────────────────────┘
                                    │
                                    ▼
                         [Checkout & Orchestration]
                         • Multi-Seller Shipping Rates
                         • Server-Authoritative Quote Engine
                         • Row-level Stock Locking (select_for_update)
                         • Master Order & SellerOrder Partition
                         • Atomic Cart Eviction & Outbox Event
                                    │
                                    ▼
                       [Payments & Idempotency Engine]
                       • Browser Card Tokenization (tok_mock_*)
                       • Zero Raw Card Digits Dispatched
                       • Deterministic Idempotency Keys
                       • Atomic Capture & Financial Ledger Settlement
                       • Automatic Stock Reversal on Decline
                                    │
                                    ▼
                       [Customer Account & Post-Purchase]
                       • Saved Address Book with Default Flag
                       • Multi-Package Carrier Tracking Timeline
                       • Self-Service Cancellation with Stock Release
                       • Verified Purchase Review Badges
                       • Formal RMA Return Request Lifecycle
```

---

## Subsystem Breakdown

### 1. Storefront & Browse Experience (Phase 17)

- **Public Read-Only Endpoints**: `/api/v1/storefront/products/`, `/api/v1/storefront/categories/`, `/api/v1/storefront/brands/`, and `/api/v1/storefront/sellers/<id>/`.
- **Status Filtering**: Strictly scopes products to `status == 'ACTIVE'` belonging to approved, active sellers (`seller__status == 'ACTIVE'`).
- **Dynamic Inventory Calculation**: Reports available stock as `quantity_on_hand - quantity_reserved` across active seller warehouses.
- **PII-Sanitized Reviews**: Masks reviewer names in public feeds (e.g. `Alex R.`) with verified purchase indicators.
- **Caching**: Employs HTTP `Cache-Control: public, max-age=60, s-maxage=300` for high-throughput public catalog queries.

### 2. Search & Discovery (Phase 18)

- **Engine**: Authoritative PostgreSQL full-text search leveraging `pg_trgm` and `SearchVector` across titles, descriptions, categories, and brands.
- **Faceted Aggregation**: Server-side aggregation computes categories, brands, price brackets, and rating distributions in unified response bodies.
- **Autocomplete Suggestions**: `/api/v1/storefront/search/suggest/` delivers debounced search suggestions, category shortcuts, and brand matches with zero client compute overhead.

### 3. Shopping Cart & Inventory Checks (Phase 19)

- **Dual Session Model**: Supports anonymous shoppers via `session_key` and authenticated users via user UUID.
- **Atomic Cart Merging**: Automatically migrates guest cart items to the authenticated customer account upon login.
- **Live Stock Validation**: Validates variant inventory against active warehouses in real time before checkout.
- **Promotional Coupon Preview**: Validates coupon codes against owning seller boundaries and order subtotals prior to checkout initiation.

### 4. Checkout & Multi-Seller Order Splitting (Phase 20)

- **Quote Engine**: Computes shipping rates, seller subtotals, platform/seller discounts, and taxes with strict 2-decimal string quantization.
- **Atomic Multi-Seller Partition**: Atomically splits a single customer purchase into:
  - 1 master `Order` representing the customer transaction.
  - _N_ child `SellerOrder` records scoped exclusively to each participating merchant.
  - _M_ immutable `OrderItem` line snapshots freezing prices, commission rates, and attributes.
- **Stock Reservation**: Executes atomic inventory reservations (`reserve_order_inventory`) during order placement.

### 5. Payment Integration & Idempotency (Phase 21)

- **Zero Card Data Leakage**: Card numbers, expiry dates, and CVC codes are validated locally in browser memory and tokenized into opaque identifiers (`tok_mock_*`). Raw card numbers never touch the backend or browser storage.
- **Strict Idempotency**: Payment intents and capture executions require a unique caller-generated `idempotency_key`. Duplicate requests replay identical results without double-charging or duplicate ledger entries.
- **Capture Workflow**: Confirms orders, converts reserved stock to permanent `SALE` inventory transactions, credits seller balance ledgers, and emits `payments.payment.captured` outbox events.
- **Decline Recovery**: Immediate decline handling cancels seller orders, releases reserved inventory back to available stock, and provides user guidance.

### 6. Customer Portal & Post-Purchase Tracking (Phase 22)

- **Customer Profile**: Centralized profile management preserving the canonical lowercase email model and UUID identity.
- **Address Book**: Full address CRUD with single-default-address invariants.
- **Order Tracking**: Multi-package inspection with carrier names, tracking numbers, and delivery timeline milestones.
- **Self-Service Cancellation**: Allows customers to cancel pending orders, immediately rolling back order states and releasing reserved stock.
- **Verified Reviews & RMAs**: Enforces delivery prerequisites before permitting review submissions or RMA return requests.

---

## Security & Adversarial Defenses Matrix

| Attack Vector                           | Defense Mechanism                                                                                                                                  | Verified By                                                 |
| :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| **Price Tampering**                     | Server calculates all line prices, shipping fees, discounts, and taxes authoritatively. Smuggled prices or totals rejected via `StrictSerializer`. | `test_phase23_hardening.py`                                 |
| **Cross-Customer Cart Tampering**       | Carts scoped to authenticated user or session key; foreign item additions, updates, or deletions fail closed with HTTP 404.                        | `test_phase23_hardening.py`                                 |
| **Cross-Customer Address Mutation**     | Address mutations/deletions require verified customer ownership; foreign address mutations return HTTP 404.                                        | `test_phase23_hardening.py`                                 |
| **Cross-Customer Order Tampering**      | Foreign order reads, cancellations, review submissions, and return requests return HTTP 404.                                                       | `test_phase23_hardening.py`                                 |
| **Stock Overselling & Race Conditions** | Row-level locking (`select_for_update()`) on warehouse `Inventory` rows serializes concurrent checkouts.                                           | `test_phase23_hardening.py`                                 |
| **Payment Double-Charge**               | Unique idempotency keys per order replay recorded transactions idempotently; conflicting keys return HTTP 409.                                     | `test_phase23_hardening.py`                                 |
| **Card Data Interception**              | Client-side card tokenization; serializers reject card digits; zero storage in cookies/localStorage.                                               | `test_phase23_hardening.py` & `customer-e2e-flows.test.tsx` |
| **Premature Review / Return Fraud**     | Business logic requires `status == 'delivered'` on order items before review creation or return authorization.                                     | `test_phase23_hardening.py`                                 |

---

## Test Verification Summary

The complete codebase passes all automated test suites, typechecks, linters, and schema validations:

- **Django Backend Test Suite**: `398/398 passed` in 88s against PostgreSQL.
- **Frontend Vitest Suite**: `152/152 passed` across 20 test files in 22s.
- **Total Repository Tests**: `550/550 passed`.
- **Backend Lint & Types**: Ruff (256 files checked, 0 errors), Strict Mypy (190 source files checked, 0 errors).
- **Frontend Lint & Types**: ESLint (`--max-warnings 0`, 0 warnings), Next.js / TypeScript (`tsc --noEmit`, 0 errors).
- **Formatting**: Prettier (all repository files formatted and verified).
- **OpenAPI Schema**: Warning-free offline schema generation via `drf-spectacular`.
- **Production Build**: Next.js App Router built cleanly with standalone output across 52 routes.

---

## Roadmap Completion Signoff

With the completion and validation of Phase 23:

- **Instructions 1 (Phases 0–16)**: Super Admin, Seller Admin, Marketplace Core (Catalog, Inventory, Orders, Finance, Fulfillment, Staff, Promotions, Reviews, Analytics, Security, Observability, Deployment).
- **Instructions 2 (Phases 17–23)**: Customer Commerce (Storefront, Search, Cart, Checkout, Payments, Customer Portal, Hardening & E2E Verification).

**CUSTOMER COMMERCE ROADMAP COMPLETE.**
