# Validation

Generate local `.env`, install locked dependencies, and start PostgreSQL/Redis first (README). From the repository root:

```sh
pnpm check
```

The cross-platform runner fails immediately on errors and runs backend Ruff formatting/lint, strict mypy with Django/DRF plugins, Django system checks, missing-migration checks, OpenAPI generation/validation, PostgreSQL pytest, repository Prettier, frontend ESLint, strict TypeScript, Vitest/Testing Library, and a Next.js production build. Schema generation refreshes `docs/openapi.yaml`; review and commit changes. CI checks for uncommitted schema drift.

Use `pnpm check:api`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` for individual portions. To format Python, run `python -m uv run --project apps/api ruff format --config apps/api/pyproject.toml apps/api scripts`; `pnpm format` formats supported repository files. The original roadmap/phase selector are excluded from automatic formatting to preserve user instructions.

Backend tests cover liveness, unsupported methods, unknown routes, invalid host handling, deny-by-default behavior (including authenticated users), WSGI/ASGI imports, production fail-closed settings and Django deployment checks, PostgreSQL email constraints and Argon2 hashing. Phase 1 additionally tests valid/invalid/disabled-user authentication, generic credential errors, required login CSRF for anonymous requests, origin/token rejection, session/CSRF rotation, logout and replay rejection, expired/disabled sessions, strict request fields, strong/change-different password validation, revocation of other sessions, no elevated regular-user bootstrap, capability grant/revocation, no superuser bypass, append-only event SQL triggers, secret redaction in events/logs, and five-attempt account/IP lockouts including cool-off recovery and spoofed forwarding-header resistance. Tests use PostgreSQL and a separately created Django test database; the local bootstrap role can create tests but must never be used by production.

Phase 2 tests add Seller A/B isolation for context, membership enumeration, queryset read/update/delete and related-role references; malformed context, independent multi-seller requests, inactive memberships and unavailable sellers; immediate membership/user/role/capability revocation; current-user service guards; mass-assignment/self-assignment rejection and CSRF on refused unsafe operations; role-name independence, capability delegation and owner escalation; PostgreSQL uniqueness/check/role-scope/immutable-identity triggers; bounded pagination without N+1 queries; separate platform inspection permission and no platform or break-glass seller override. The phase intentionally has no onboarding or staff mutation API. Tests exercise the reusable delegation guard without prematurely implementing those later workflows.

Production deployment checks intentionally return exactly `security.W021`: HSTS preload is not opted into before a real domain/ingress decision. The test asserts that exact advisory set, so any additional warning fails. An initial test incorrectly required zero warnings despite this documented policy; it was corrected rather than enabling preload merely to pass. No Django checks are silenced.

Frontend tests render the accessible foundation page, validate the health route, and ensure the development API rewrite is absent in production. To exercise the actual session flow through Next.js, start `pnpm dev:api` and `pnpm dev:web`, then run `python -m uv run --project apps/api --env-file .env python scripts/smoke_auth.py`. The script creates and deletes a disposable local account, proves anonymous login CSRF denial, cookie security flags and rotation, password change, logout invalidation and replay denial, and leaves the intentionally immutable security events in PostgreSQL. It refuses to run outside DEBUG development.

Phase 3 frontend coverage includes login/rejection/logout and failed logout, required CSRF and cookie requests, strict origin/path/response/status validation, visible HTTP/validation/rate-limit/network errors, secret-safe 5xx/HTML error handling, cancellation and stale authentication/context races, regular/admin/revoked route access, seller switching/no-membership behavior, capability-based navigation, authoritative paginated membership data, labels/table semantics/pagination/modal focus/cancel/busy behavior, exact decimal money display and deterministic timezone dates. Native dialog methods are simulated in jsdom solely for component focus/lifecycle tests; actual browser-native focus trapping is reserved for browser/E2E validation.

Validate infrastructure without printing expanded credentials:

```sh
docker compose --env-file .env -f infra/compose.yaml config --quiet
docker compose --env-file .env -f infra/compose.yaml ps
```

Every phase adds meaningful negative tests. Later suites must cover CSRF, abuse limits, authentication, RBAC, cross-tenant reads/writes/enumeration/foreign keys, mass assignment, uploads, state transitions, Decimal accounting, idempotency, and concurrent inventory/financial changes. Do not delete or relax correct assertions to make failures disappear.

Full business E2E/performance/race coverage belongs to Phase 13. Foundation CI is a validation gate, not the production deployment pipeline of Phase 15.

Phase 4 adds PostgreSQL onboarding ownership/status, strict protected fields, permitted settings/address updates, cross-seller context/read/write/enumeration/foreign-key denial, independent platform document/audit/manage grants, self-review prevention, lifecycle legality/replay/reason requirements, suspension revocation, document upload MIME/extension/decode/size/expiry rejection, private attachment download isolation and audit, evidence/history immutability, audit rollback/storage compensation, search/filter bounds and concurrency. Two simultaneous approvals must commit exactly one transition/audit event. Production storage fail-closed configuration is covered by subprocess tests. Files use an isolated in-memory Django storage backend in tests; PostgreSQL still stores all business data.

Frontend Phase 4 tests cover multipart CSRF/cookies/seller header, encoded search and traversal rejection, runtime document/page validation, private download error handling, onboarding success, capability-gated list/actions/documents, server filters, authoritative approval denial, and entering a full rejection reason before confirmation. Native dialog lifecycle uses the existing jsdom simulation approach; these are component tests, not a claim of browser E2E.

Phase 5 adds 51 PostgreSQL catalog backend tests in `tests/test_catalog.py` and 9 frontend tests in `apps/web/tests/catalog.test.tsx`.
Backend coverage includes:

- Cross-tenant read, mutation, and foreign-key isolation across products, variants, images, attribute values, and history.
- Immediate revocation and capability enforcement (`catalog.product.*`, `platform.catalog.*`, `platform.products.*`).
- Decimal price validation (nonnegative, decimal string requirement, compare_at relationship) and money scale.
- Category hierarchy integrity, cycle rejection, and inactive ancestor guards.
- Dynamic attributes and value typing, category-attribute link requirement enforcement, and scope mismatch rejection.
- Explicit product lifecycle transitions (`submit-for-review`, `revise`, `archive`, `approve`, `reject`), reason requirements, and self-approval denial.
- Safe private image uploads, mime/size checks, download isolation, and audit rollback storage compensation.
- Concurrent moderation locking and commit serialization.

Frontend coverage includes:

- Seller products table and draft creation navigation.
- Permission gates for seller products and admin moderation.
- Platform moderation workflows, rejection reasons, category management, and attribute option management.

Phase 6 adds 12 PostgreSQL inventory backend tests in `tests/test_inventory.py` and 7 frontend tests in `apps/web/tests/inventory.test.tsx`.
Backend coverage includes:

- Cross-tenant warehouse and inventory isolation, foreign key rejection, and cross-seller variant/warehouse assignment denial.
- Nonnegative constraints (`quantity_on_hand >= 0`, `quantity_reserved >= 0`, `reorder_level >= 0`) and reserved stock bound (`quantity_reserved <= quantity_on_hand`).
- Append-only immutability of `InventoryTransaction` via PostgreSQL trigger; rejection of UPDATE and DELETE operations.
- Warehouse immutable code/seller identity and inventory immutable warehouse/variant identity.
- Concurrent inventory operations tested with `ThreadPoolExecutor` and row-level `select_for_update()` locking.
- Explicit services for `adjust_inventory`, `reserve_inventory`, `release_inventory`, `consume_reserved_inventory`, and `receive_return`.
- Seller permission enforcement (`seller.inventory.manage`, `seller.inventory.read`) and platform capability enforcement (`platform.inventory.read`).

Frontend coverage includes:

- Warehouse listing, status badges, and warehouse creation modal validation.
- Inventory listing with calculated available stock, low-stock warning badges, and search/filter controls.
- Stock adjustment modal with delta/reason validation and optimistic/server error handling.
- Immutable inventory transaction ledger with delta indicators and transaction-type filtering.
- Platform inventory overview accessible only with `platform.inventory.read` capability.

Phase 7 adds 12 PostgreSQL order backend tests in `tests/test_orders.py` and 7 frontend tests in `apps/web/tests/orders.test.tsx`.
Backend coverage includes:

- Multi-seller order creation, partitioning of single customer checkout into distinct `SellerOrder` instances, and snapshot preservation on `OrderItem`.
- Cross-tenant injection rejection: PostgreSQL trigger rejection of foreign seller products, variants, or warehouses on order items.
- Immutability enforcement via database triggers: rejection of UPDATE and DELETE operations on `OrderStatusHistory` and `OrderItem`.
- SellerOrder immutable identity trigger: rejection of mutations to `seller_id` or `order_id`.
- Explicit state machine transitions (`confirm`, `begin-processing`, `ship`, `deliver`, `cancel`) and rejection of invalid status transitions (e.g. shipping a cancelled order, delivering a pending order).
- Atomic inventory reservation upon order placement, release of reserved stock upon cancellation (with mandatory reason), and consumption of reserved stock upon shipment.
- Parent `Order` status derivation: shipping or delivering child seller orders advances parent order fulfillment status.
- Seller authorization and tenant isolation: seller endpoints reject access to foreign seller orders; operations require `orders.read`, `orders.update`, or `orders.cancel`.
- Platform management and authorization: platform views require `platform.orders.read` or `platform.orders.manage`; superuser without platform roles is denied access.

Frontend coverage includes:

- Seller orders list table with status badges, pagination, and navigation to order details.
- Seller order detail page displaying financial summaries, line items, historical snapshots, and audit timeline.
- Seller order lifecycle action buttons and confirmation dialogs (`confirm`, `begin-processing`, `ship` with tracking details, `cancel` with reason modal).
- Platform admin orders list and detail views displaying multi-seller breakdown and audit history.
- Client-side error handling and permission gating for order actions.

Phase 8 adds 12 PostgreSQL finance backend tests in `tests/test_finance.py` and 9 frontend tests in `apps/web/tests/finance.test.tsx`.
Backend coverage includes:

- Commission rate hierarchy and calculation: specific seller + category rule > specific seller rule > specific category rule > plan default percentage. Precision Decimal math with `ROUND_HALF_UP` 2-decimal rounding.
- Snapshot commission and fee values: commission snapshotting on `SellerOrder` line items upon order fulfillment; immutability of historical commissions on past orders.
- Append-only immutability of `SellerLedgerEntry` via PostgreSQL trigger; rejection of UPDATE and DELETE operations.
- Processed payout immutability via PostgreSQL trigger; rejection of mutations to `PROCESSED` payout amounts or statuses.
- Scope integrity triggers preventing cross-tenant links on `SellerLedgerEntry` (`seller_order.seller_id == seller_id`, `payout.seller_id == seller_id`) and `PayoutItem` (`payout.seller_id == ledger_entry.seller_id`).
- Seller balance tracking: non-negative available and locked balances, balance updates via ledger entries, row-level locking with `select_for_update()`.
- Payout lifecycle state machine: request payout, hold/lock balance, approve, reject (release lock), process payout (deduct balance, snapshot references). Anti-self-approval enforcement.
- Platform capability enforcement (`platform.finance.read`, `platform.finance.manage`) and seller permission gating (`finance.read`).
- Compensating ledger entries for manual administrative adjustments (no mutation of existing ledger entries).

Frontend coverage includes:

- Seller financial overview displaying balance cards (available, pending, paid out), currency formatting, and quick payout request triggers.
- Seller transaction ledger displaying append-only records, credit/debit indicators, reference IDs, and type filters.
- Seller payout management displaying payout history, status badges, and request payout modal.
- Platform commission management: list, create, and inspect commission plans and rules.
- Platform seller balance management: table of seller balances with manual adjustment modal.
- Platform payout processing: payout queue with approve, reject, and process workflows.
- Permission gating and error handling for finance views.

Phase 9 adds 12 PostgreSQL fulfillment backend tests in `tests/test_fulfillment.py` and 5 frontend tests in `apps/web/tests/fulfillment.test.tsx`.
Backend coverage includes:

- Shipping zone, method, and rate setup scoped to sellers.
- Multi-shipment creation per `SellerOrder` with carrier tracking and item manifest validation.
- Append-only parcel `TrackingEvent` logging and immutable database triggers rejecting updates/deletions.
- Shipment delivery marking and order fulfillment progression.
- Customer return authorizations (`ReturnRequest` and `ReturnItem`) operating against delivered order items.
- Return lifecycle state transitions (`REQUESTED` -> `APPROVED` | `REJECTED` -> `IN_TRANSIT` -> `RECEIVED` -> `REFUND_PENDING` -> `REFUNDED` -> `CLOSED`).
- Inventory restock integration: returning inspected items with `restock_inventory=True` creating `return` inventory ledger transactions.
- Customer refund processing (`Refund`): automatic proportional marketplace commission reversal calculation, posting compensating `REFUND` debit and `COMMISSION` credit entries to the seller financial ledger.
- Completed refund immutability via PostgreSQL trigger; rejection of mutations to completed refunds.
- Scope integrity triggers preventing cross-tenant links on shipments, shipment items, return requests, return items, and refunds.
- Capability and permission gating: seller capabilities (`fulfillment.read`, `fulfillment.manage`, `returns.read`, `returns.manage`) and platform capabilities (`platform.fulfillment.read`, `platform.returns.read`, `platform.refunds.manage`).

Frontend coverage includes:

- Seller shipments list with carrier tracking, status badges, status filter, and parcel inspection modal displaying items and timeline.
- Seller returns list with status filters, inspection modal, return approval, rejection with reason, and receipt with restock selection.
- Seller refunds list with financial deductions, commission reversals, and issue refund modal.
- Platform admin fulfillment overview with unified tabs for marketplace shipments, customer returns, and administrative refunds.
- Administrative refund modal for platform concessions.
- Permission gating, 403 handling, and robust form validation.
