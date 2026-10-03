# Validation

## UI overhaul validation

Phase 31 adds six accessibility workflow tests; the suite is **182 tests across 24 files**. See `docs/ui-accessibility.md` for source/contrast evidence and every unverified viewport/manual check. The user directed continued implementation after being informed of unavailable browser access; no screenshot or screen-reader pass is claimed.

Each phase from `instrutions3.md` requires `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and formatting before commit/push/advancement. Phase 23 passes all 120 existing frontend tests and calculates 18 contrast pairings for the new presentation tokens. Backend/API behavior is not changed by this foundation. Browser screenshots, keyboard/zoom/screen-reader behavior and responsive/cross-browser QA are distinct evidence: code inspection and jsdom tests do not establish them. Record route, viewport, state and image path at the Phase 26 dashboard checkpoint and later visual passes; explicitly record unavailable browser access. Test the integrated UI again after the security-first rebase.

Phase 28 adds form/navigation/dialog and staff-revocation regressions; the frontend suite is **164 tests across 21 files**. Form errors and failed inputs, saved/dirty baselines, duplicate pending submits, native traversal cancellation, unmount cleanup and nested dialog application state are covered. Jsdom's shared `showModal`/`close` mocks set open state only. They do not implement modality, tab containment or browser navigation. Live focus, Back/Forward across supported browsers, zoom and narrow layout remain separate required evidence.

Phase 29 adds eight operational-detail regressions. Phase 30 adds four geometry/loading/clipboard checks; the current isolated UI suite is **176 tests across 23 files**. ResizeObserver is mocked to check height retention and cleanup, not actual browser reflow. Clipboard completion, failure and stale-record feedback remain honest. Reduced-motion styles require browser verification. Every frontend lint, strict TypeScript, test and production-build check passed; backend integration remains a separate gate after the concurrent work is ready.

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

Phase 10 adds 19 PostgreSQL backend tests in `tests/test_phase10.py`.
Backend coverage includes:

- Seller staff invitation, role assignment, role updating, and membership revocation with permission gating (`seller.staff.read`, `seller.staff.manage`).
- Custom `SellerRole` lifecycle, uniqueness within seller tenant, assignable permission set calculation, and role mutation guards.
- Delegation guard validation: prevents staff members from assigning permissions beyond their own active grant.
- Structural owner protection: owner role mutations require structural `is_owner` status and `seller.ownership.manage` permission; demoting or revoking the last active owner of a seller is strictly rejected.
- Database trigger enforcement: cross-tenant custom role assignment rejection and role identity immutability.
- Promotion and coupon lifecycle: `PLATFORM` vs `SELLER` promotions, discount calculations (percentage, fixed amount, free shipping), usage limits, minimum order constraints, maximum discount caps, and date validity.
- Backend coupon evaluation: validation of seller scope (seller promotions apply only to the owning seller; platform promotions can restrict to designated sellers via `PromotionSeller`).
- PostgreSQL integrity enforcement: append-only trigger on `CouponUsage` records; cross-tenant product/category qualification triggers.
- Product reviews and moderation: customer review submission requiring verified purchase, seller response submission scoped to the product's owning seller (cross-tenant response rejected by DB trigger), and review reporting.
- Platform moderation actions (`publish`, `reject`, `remove`) writing append-only `ReviewModeration` records enforced by database triggers.
- In-app and multi-channel notification infrastructure: delivery failure isolation ensuring failed email attempts do not roll back enclosing business transactions.

Frontend coverage includes:

- Seller staff list with member details, role selection, role changing, and membership revocation.
- Custom role builder with dynamic assignable permissions checkboxes.
- Seller promotions table, creation modal with validation, and coupon management drawer.
- Seller product reviews with star ratings, verified purchase badges, seller response submission, and dispute reporting.
- In-app notifications panel with unread badge counters, mark-read, and mark-all-as-read actions.
- Platform admin promotions overview and platform promotion creation modal.
- Platform admin review moderation queue with status filters and approval/rejection/removal confirmation dialogs.

Phase 11 adds 6 PostgreSQL backend tests in `tests/test_phase11.py` and 3 frontend tests in `apps/web/tests/dashboard.test.tsx`.
Backend coverage includes:

- Authoritative calculation of seller dashboard metrics: gross sales, net sales, orders count, AOV, units sold, pending orders, low stock variants, returns count, platform fees, available/pending balances, payout history, top products, and daily sales over time.
- Cancellation exclusion: Cancelled orders and failed payments are verified to be excluded from revenue and order metrics.
- Cross-tenant isolation: Complete verification that Seller B's sales and orders never leak into Seller A's metrics or top products.
- Date range query boundary filtering: Verifying historical orders outside specified `start_date` and `end_date` are excluded.
- Authentication and capability gating: Seller dashboard requires active seller membership and context; unauthenticated or foreign callers receive 401/403/404.
- Super Admin platform dashboard: Total marketplace GMV, platform revenue, order count, AOV, active sellers, pending seller approvals, customers count, refund rate, return rate, outstanding seller balances, upcoming payouts, top categories, top sellers, and daily GMV trends.
- Platform capability gating: Platform dashboard requires explicit `platform.analytics.read`; regular seller owners are denied (403 Forbidden).

Frontend coverage includes:

- `SellerOverview` dashboard rendering: Verifies KPI cards (Gross/Net sales, Orders placed, Units sold), balances (Available/Pending balance, Payouts), operational alert badges (low-stock warning, pending orders), top products table, and workspace details.
- Seller date range preset filtering: Verifies switching presets ("Last 7 days", "Last 30 days", "Last 90 days") triggers re-fetching with updated `start_date` query parameters.
- `AdminOverview` dashboard rendering: Verifies platform GMV, platform commission revenue, total orders, refund rate, top sellers table, top categories table, and pending approvals alert badge.

Phase 12 adds 12 PostgreSQL backend adversarial security tests in `apps/api/tests/test_phase12_security.py`.
Adversarial coverage includes:

- Cross-tenant read protection: Confirms an active seller owner cannot inspect another seller's products, warehouses, inventories, or orders (all returning HTTP 404).
- Cross-tenant mutation protection: Confirms an active seller owner cannot edit another seller's products or trigger order state transitions (returning HTTP 404).
- Database foreign-key scope integrity: Validates that database trigger `catalog_check_child_scope` aborts variant creation referencing another tenant's product with `IntegrityError`.
- Privilege escalation prevention: Validates that a seller staff member with restricted capabilities (e.g. `SUPPORT_AGENT`) cannot invite new staff members or delegate administrative roles (HTTP 403 Forbidden).
- Platform field immutability: Validates that seller owners cannot alter platform-controlled fields (`status`, `verification_status`, `default_currency`) through seller settings endpoints (HTTP 400 Bad Request via `StrictSerializer`).
- Universal admin endpoint protection: Validates that ordinary authenticated users without platform roles are denied access across all administrative endpoints (`/api/v1/admin/*`, HTTP 403 Forbidden).
- Granular platform capability gating: Validates that platform administrators with limited roles (e.g. inspector) cannot access sensitive financial endpoints lacking explicit capability grants (HTTP 403 Forbidden).
- Mass assignment protection: Validates that `StrictSerializer` actively detects and rejects injected system fields (such as `id` or `created_at`) with HTTP 400 Bad Request.
- CSRF omission enforcement: Validates that browser mutations without valid CSRF tokens are rejected with HTTP 403 Forbidden.
- Malformed and tampered identifier resilience: Validates that path traversal sequences (`../../etc/passwd`), non-UUID strings, and corrupted UUIDs are safely handled with HTTP 404 without internal server errors.
- Replayed financial action rejection: Validates that sensitive financial workflows cannot be replayed (e.g. an already `PROCESSED` payout cannot be approved or processed again, returning HTTP 400/409).

Phase 13 adds 11 PostgreSQL backend tests (6 multithreaded concurrency tests in `apps/api/tests/test_phase13_concurrency.py` and 5 performance query budget tests in `apps/api/tests/test_phase13_performance.py`), alongside 11 frontend E2E high-value flow tests in `apps/web/tests/e2e-flows.test.tsx` and comprehensive performance profiling documentation in `docs/performance.md`.
Backend coverage includes:

- Real multithreaded concurrency testing with `ThreadPoolExecutor` and PostgreSQL `select_for_update`:
  - `test_concurrent_inventory_reservation`: 5 concurrent threads attempting to reserve 10 units each from a stock pool of 20; exactly 2 succeed and 3 fail with `ValidationError`, proving no stock overselling.
  - `test_concurrent_inventory_adjustments`: 10 concurrent threads each incrementing stock by +10; all 10 serialize safely via row-level locks without lost updates (+100 net stock, 10 immutable transactions).
  - `test_concurrent_order_confirmation`: concurrent confirmation attempts on the same pending order; exactly 1 succeeds and duplicates are rejected, resulting in a single transition history record.
  - `test_concurrent_payout_approval`: concurrent approval attempts on requested payouts; exactly 1 succeeds and duplicates receive `ValidationError`.
  - `test_concurrent_payout_processing`: concurrent processing attempts on approved payouts; exactly 1 transitions to `PROCESSED` with a single debit ledger entry and balance deduction.
  - `test_concurrent_refund_processing`: concurrent refund executions; exactly 1 succeeds and creates the single compensating refund transaction and ledger entry.
- Query budget enforcement with `CaptureQueriesContext`:
  - Products list query budget: <= 12 queries for 20 items (uses `select_related("category", "brand")` and `prefetch_related("variants")`).
  - Inventory list query budget: <= 12 queries for 20 items (uses `select_related("warehouse", "variant", "variant__product")`).
  - Orders list query budget: <= 12 queries for 15 orders (uses `select_related("order")` and `prefetch_related("items")`).
  - Seller dashboard metrics query budget: <= 15 queries across sales, units, balances, and operational alerts.
  - Platform dashboard metrics query budget: <= 18 queries across marketplace GMV, revenue, top sellers, categories, and balances.

Frontend coverage includes:

- End-to-end integration flows across the 12 core user journeys in `apps/web/tests/e2e-flows.test.tsx`:
  1. Super Admin login: authenticates and verifies platform capability grant.
  2. Super Admin approves seller registration and addresses.
  3. Seller owner logs in and discovers active seller workspace.
  4. Seller creates a product draft with category and brand pickers.
  5. Seller views product detail and variants table.
  6. Seller performs stock adjustments and verifies immutable transaction ledger.
  7. Seller views order detail and performs state transition to confirmed.
  8. Permitted order state transitions and ship action with carrier tracking.
  9. Seller views finance ledger, current balances, and pending balances.
  10. Cross-tenant isolation verification (Seller A receives 404 attempting to view Seller B order).
  11. Platform admin access barrier (regular seller denied admin workspace via `ForbiddenScreen`).
  12. Logout invalidates session and navigates back to `/login`.

Phase 14 adds 19 PostgreSQL backend tests in `apps/api/tests/test_phase14_observability.py`.
Observability and resilience coverage includes:

- Structured JSON logging:
  - `test_structured_json_formatter_outputs_required_fields`: verifies log output conforms to structured JSON format containing timestamp (ISO 8601), log level, logger name, message, request ID, user ID, seller ID, route, method, status code, and latency.
  - `test_structured_logging_redacts_sensitive_fields`: verifies regex redaction transforms passwords, credit cards, bearer tokens, cookies, and secret configuration into `[REDACTED]`.
- Correlation ID propagation & context:
  - `test_correlation_id_propagated_from_incoming_header`: verifies incoming `X-Request-ID` is respected and echoed in response headers and log context.
  - `test_correlation_id_generated_when_missing`: verifies missing `X-Request-ID` results in an auto-generated valid UUIDv4 attached to response headers.
- Custom DRF exception handling & error reporting:
  - `test_custom_exception_handler_attaches_request_id_and_returns_500_json`: verifies unhandled 500 exceptions trigger error monitoring capture and return a structured JSON body with `detail` and correlation `request_id`.
  - `test_custom_exception_handler_preserves_drf_validation_errors`: verifies 400 validation error responses preserve exact field error structures while attaching `X-Request-ID` to response headers.
- Health check endpoints:
  - `test_liveness_endpoints_return_200_without_db_query`: verifies `/api/v1/health` and `/api/v1/health/live` return HTTP 200 `{"status": "ok"}` with `no-store` cache headers.
  - `test_readiness_probe_returns_200_when_healthy`: verifies `/api/v1/health/ready` executes PostgreSQL `SELECT 1` and Redis `client.ping()`, returning HTTP 200 with status `ok` and component check results.
  - `test_readiness_probe_returns_503_when_database_fails`: verifies simulated database failure degrades readiness status to `degraded` and returns HTTP 503.
  - `test_readiness_probe_returns_503_when_redis_fails`: verifies simulated Redis failure degrades readiness status to `degraded` and returns HTTP 503.
- Transactional Outbox pattern & PostgreSQL triggers:
  - `test_publish_outbox_event_creates_pending_record`: verifies atomic insertion of `OutboxEvent` with topic, event key, and payload.
  - `test_process_outbox_event_success_transitions_to_processed`: verifies successful event dispatch sets status to `PROCESSED` with `processed_at` timestamp.
  - `test_process_outbox_event_failure_increments_retry_count`: verifies processing failure increments retry count and updates status to `FAILED` with error message.
  - `test_process_pending_outbox_batch_uses_skip_locked`: verifies batch query executes with row-level locks preventing duplicate processing across concurrent workers.
  - `test_postgresql_trigger_rejects_outbox_event_mutation`: verifies PostgreSQL trigger `events_outbox_mutation_trigger` raises `IntegrityError` when attempting to alter `topic`, `event_key`, `payload`, or `created_at`.
  - `test_postgresql_trigger_rejects_outbox_event_deletion`: verifies PostgreSQL trigger `events_outbox_deletion_trigger` raises `IntegrityError` on SQL `DELETE` attempts.
- Domain workflow outbox integration:
  - `test_order_creation_publishes_outbox_event`: verifies `create_order` atomically emits `order.created` outbox event with order ID, number, and total.
  - `test_order_confirmation_publishes_outbox_event`: verifies `confirm_seller_order` atomically emits `seller_order.confirmed` outbox event.
  - `test_payout_processing_publishes_outbox_event`: verifies `process_payout` atomically emits `payout.processed` outbox event with payout and seller details.
