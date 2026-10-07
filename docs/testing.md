# Validation

## Customer cart (Phase 40)

`tests/storefront-cart.test.tsx` adds 44 meaningful cases: cart/empty evidence, invalid UUID/currency/decimal/count/stock/media and duplicate/oversized data, exact amounts above floating-point precision, coupon validity/amount bounds, loading/error/retry versus true empty, malformed mutation invalidation, real seller/product/checkout routes, stock/pending/quantity bounds, synchronous duplicate prevention, CSRF/quantity-only payloads, focused reject/reload, delete/clear errors and removal focus, promo preview with unchanged totals/revision reset/late completion, stale Strict Mode reads, account-change mutation discard, read-versus-add ordering, production session binding without page remount, broken image fallback and native dialog/opener return. Existing cart/customer-flow tests retain actual quantity and discount amounts, with explicit currency and correct eligibility semantics rather than fake applied totals. Checkout regressions still pass; no security/business assertion is weakened.

Standalone Chromium audits all six widths with actual HTTP 308 failure evidence and separately labeled multi-seller/long/empty/stock/loading/service/malformed fixtures. Pending/rejected/accepted quantity, promo preview, removal focus/clear, fresh CSRF and native keyboard/dialog behavior pass. Retained 102 PNGs and reports are under `docs/storefront-audit/phase40`; [the cart review](storefront-cart-review.md) records inspected states and acceptance limits. The final browser run follows the installed Next Image replacement; its regression additionally requires the exact resolved same-origin Django source, no optimizer srcset, native laziness and accessible failure handling. Capture helpers are local ignored audit tools; screenshots/reports and unit tests are committed.

Final `pnpm check` passes **398 PostgreSQL + 388 frontend tests** (786 total, 36 frontend files), Ruff/Mypy/Django/migration/schema, repository formatting, zero-warning ESLint, strict frontend types and production build (52 generated entries). Focused cart/customer-flow/checkout tests pass 61 cases. The initial full gate's new native-image lint warning is fixed through the installed Next Image component; no rule or assertion is weakened, and the entire gate passes again. Quiet Compose, 22 palette checks, the 59-source-page production audit (51 server/8 client entries), 102-PNG/report/link integrity and formatting/diff checks pass. Final reports/documentation receive repository formatting verification before commit. Commands: `pnpm check`, `docker compose --env-file .env -f infra/compose.yaml config --quiet` through the existing Ubuntu WSL Docker daemon, `node scripts/check_storefront_tokens.mjs`, `node scripts/audit_ui_build.mjs --json`, `python .artifacts/phase40-browser.py`, `python .artifacts/phase40-retain.py`, `python .artifacts/phase40-final-evidence.py`, `pnpm format:check` and `git diff --check`. Successful live populated cart/checkout acceptance remains pending behind the inherited redirect; fixtures are explicitly separated from real API evidence.

## Customer product detail (Phase 39)

`tests/storefront-detail.test.tsx` adds 36 cases covering consumed public evidence/identity, malformed exact prices/currency/media/stock/attributes/ratings/dates, bounded arrays, BigInt previous prices, same-origin request policy, invalid-ID blocking, 404/error/retry, late route/Strict Mode/user completion, gallery loading/missing/failure/selection, option stock bounds and quantity reset, unavailable/no-option disabling, pending duplicate guard, accepted/rejected cart feedback, focused error/retry, actual seller/brand destinations, conditional purchase badges/UTC dates/plain text, and related preview exclusion/error/retry/untrusted pagination URLs. The existing storefront regression now awaits acceptance and asserts honest stock/success wording; unconditional verification/reservation expectations were demonstrably incorrect. The customer-flow fixture supplies the API's required HTTP 201 and now also asserts confirmed feedback. The first full gate exposed a pre-existing payment-test collision: a random idempotency UUID contained the submitted CVC digits `123`. That test now mocks only UUID generation, restores the spy after each case, retains both leakage assertions and additionally checks exact intent/confirmation payloads. Payment implementation is unchanged. No security or business assertion is weakened.

Standalone Playwright checks both actual products at six required widths and separates 32 intercepted gallery/long/loading/error/availability/cart/related cases. The real redirect failure remains explicit; successful provider/drawer integration uses labeled fixtures. Final `pnpm check` passes **398 PostgreSQL + 344 frontend tests** (742 total, 35 frontend files), with Ruff/Mypy/Django/migration/schema, repository formatting, zero-warning ESLint, strict TypeScript and production build (52 generated entries). Quiet Compose, 22 palette checks, the 59-source-page production audit (50 server/9 client entries), 82-PNG/report/link integrity and formatting/diff gates pass. Final reports/documentation receive repository formatting verification before commit. Commands are `pnpm check`, `docker compose --env-file .env -f infra/compose.yaml config --quiet` through the existing Ubuntu WSL Docker daemon, `node scripts/check_storefront_tokens.mjs`, `node scripts/audit_ui_build.mjs --json`, `python .artifacts/phase39-capture.py`, `python .artifacts/phase39-states.py`, `python .artifacts/phase39-final-evidence.py`, `pnpm format:check` and `git diff --check`. Retained reports contain evidence, not request secrets. See [product-detail visual evidence and acceptance limits](storefront-product-detail-review.md).

## Customer listing/category/search discovery (Phase 38)

`apps/web/tests/storefront-discovery.test.tsx` adds 50 cases for URL allowlists/duplicates/UUID case/category scope, exact decimal comparison and allocation bounds, malformed product/facet/media/money evidence, full filter pagination, actual currency/seller/stock, slug selection, category metadata partial failure/retry, request error/retry, invalid-address request blocking, empty recovery, immediate stale-data clearing, Strict Mode/late success/failure/unmount cancellation, native drawer local drafts/cancel/apply and price-field resynchronization. The five existing search tests retain their callbacks and query/sort/price/recovery assertions; currency-neutral range text and explicit router scroll options follow the actual design. No security/business assertion is weakened. Final `pnpm check` passes **398 PostgreSQL + 308 frontend tests** (706 total), across 34 frontend files, with Ruff format/lint (256 files), strict Mypy (190 files), Django/migration/offline schema, repository formatting, zero-warning ESLint, strict frontend types and production build (52 generated entries). An initial gate stopped on prop reassignment in UUID normalization; a local value fixes it, and the full gate passed again with the same rules.

Standalone Playwright uses the actual anonymous PostgreSQL catalog for listing/search/category at six widths (18 route/width cases), actual empty recovery, skip link, reduced motion and three native mobile filter drawers. Drawer focus containment, Escape/opener return, draft cancellation, Apply, Back/Forward and visible desktop-resize focus are verified. Twenty separately labeled intercepted cases cover dense/long results at all six widths and empty/failure/loading/malformed evidence at 375/1440px. Safe local pagination/history/focus, sort preservation, exact price editing, keyboard retries, loading resolution, geometry and no overflow/page errors are required. No catalog mutations or fake merchandise are shipped. Sixty-two screenshots and reports are retained under `docs/storefront-audit/phase38`; visual inspection and acceptance limits are in `docs/storefront-discovery-review.md`.

Commands run: `pnpm check` against PostgreSQL; `docker compose --env-file .env -f infra/compose.yaml config --quiet` via existing Ubuntu WSL Docker; `node scripts/check_storefront_tokens.mjs`; `node scripts/audit_ui_build.mjs --json`; PNG/report/link checks; `pnpm format:check`; `git diff --check`. Quiet Compose, 22 palette checks, the 59-source-page production audit (49 server/10 client route entries) and 62-PNG/report/link/browser evidence validation pass. Final reports/docs receive repository formatting verification before commit. All three navigation drawers additionally preserve their original scrolling, focus containment and Escape/opener return, proving filter CSS isolation. Preview processes were stopped and generated route types revalidated. Original concurrent edits and all backend/API/security/cart/payment/dependency contracts are outside this branch's modifications. Production `next start` without ingress cannot route API requests by design; do not enable the development rewrite in production to pass a preview. Actual screenshots use the development same-origin proxy; production ingress/browser/transaction acceptance remains separate.

## Customer homepage (Phase 37)

`apps/web/tests/storefront-home.test.tsx` adds ten cases using the real API client with response fixtures: section/destination composition, precise large decimal/current/previous prices and currency, actual empty catalog/categories/sellers, independent catalog/category failure and retry, bounded arrivals/seller previews without inferred counts/rankings, malformed money/media/UUID failure, Strict Mode stale rejection and unmount cancellation. The foundation heading expectation follows the new homepage copy while preserving the main landmark and genuine seller-onboarding destination assertions. No security or business assertions are weakened.

Standalone Playwright captures the actual existing anonymous catalog at 375, 430, 768, 1024, 1440 and 1920px with no API interception or backend mutations. Six route/width cases check overflow, heading/IDs, operational token isolation, real destinations and precise displayed prices; skip-link activation, seller anchor, reduced motion and absence of page errors pass. Twelve actual screenshots and the capture report are retained under `docs/storefront-audit/phase37`.

Twenty supplemental browser cases explicitly intercept only public category/product/image responses. Empty, catalog failure, category failure and loading run at 375/1440px; dense mixed-image and long-label/large-price fixtures run at all six widths. These verify no document overflow, bounded eight-product/four-seller previews, consistent image heights, exact digits, native keyboard retries, loading resolution and no page errors. One-pixel image fixtures establish source/aspect geometry only, never real product-photo acceptance. No demo fixtures enter application code or the database. `docs/storefront-homepage-review.md` names the visually inspected subset and limitations.

Final `pnpm check` passes **398 PostgreSQL + 258 frontend tests** across 33 frontend files, with Ruff/Mypy/Django/migration/schema, repository formatting, zero-warning ESLint, strict TypeScript and production build (52 generated entries). Quiet Compose, all 22 palette checks, the 59-source-page production audit, retained PNG/report/link checks and diff checks pass. Commands remain `pnpm check`, `docker compose --env-file .env -f infra/compose.yaml config --quiet` through the existing Ubuntu WSL Docker daemon, `node scripts/check_storefront_tokens.mjs`, `node scripts/audit_ui_build.mjs --json` and `git diff --check`. The first full gate's generated contrast-report formatting failure was fixed and the full gate rerun successfully; no test or API/security assertion was weakened. Final documentation/reports receive repository formatting verification before commit. Counts and limits are also recorded in `docs/progress.md`.

## Customer storefront shell (Phase 36)

`apps/web/tests/storefront-shell.test.tsx` adds **18 regressions** for actual/current category destinations, category failure/retry, bounded lazy seller previews, real cart action/count/unavailable semantics, native drawer entry points/cancel, autocomplete-then-drawer Escape, desktop-resize focus recovery, route/identity cancellation, all suggestion groups/IDs/exact money, Escape and full-query submission, stale query races, pending dismissal/clear, failure recovery, multiple instances/IME, malformed/mismatched responses and Django-normalized long query echoes. Existing storefront navigation/footer expectations now reflect real disclosed destinations rather than unsupported verification claims; existing search integrations focus the field as an actual shopper does. The cart assertion that exposed duplicated badge text remains unchanged; production markup was corrected.

Real standalone Playwright/Chromium captures at six required widths use an anonymous session and the existing development catalog, without new accounts/catalog/order/payment fixtures, API interception or transaction mutations. The retained `docs/storefront-audit/phase36/capture-report.json` records 12 home/shop route-width cases, four mobile native-modal focus/Escape/return/scroll cases, desktop disclosures/search, skip link, resize recovery, reduced motion and absence of page errors. Thirty-two screenshots include full pages, first-fold home images and shell interactions. The visual review names images actually inspected; remaining captures have automated measurements only. Component fixtures and anonymous shell evidence do not prove authenticated transaction or assistive-technology acceptance.

Final `pnpm check` passes **398 PostgreSQL + 248 frontend tests** across 32 frontend files, with Ruff/Mypy/Django/migration/schema, repository formatting, zero-warning ESLint, strict TypeScript and production build (52 generated entries). Quiet Compose, all 22 palette checks, 59-page production audit, diff and retained evidence/link/PNG checks pass. Commands are `pnpm check`, `docker compose --env-file .env -f infra/compose.yaml config --quiet` (via the existing Ubuntu WSL Docker daemon), `node scripts/check_storefront_tokens.mjs`, `node scripts/audit_ui_build.mjs --json` and `git diff --check`. No new browser tooling dependency is introduced; the user's authorized existing Python Playwright installation is used. Original user edits are excluded from this branch's claims. See `docs/storefront-shell-review.md` for inherited cart/proxy/product errors and later scope.

## Customer storefront foundation (Phase 35)

`apps/web/tests/storefront-foundation.test.tsx` adds eleven checks for busy/native controls, unique field labels and descriptions, quantity bounds, exact large/fractional/currency amounts, BigInt discount display, genuine/unavailable images, textual ratings/breadcrumbs, native overlay busy/error/focus behavior, forward/reverse/busy focus loops and caller-owned persistent notifications. Existing customer price assertions now require the explicit actual currency; workflow assertions remain. An existing staff-dialog focus assertion waits for the same passive effect and still requires focus on the backend rejection. No expected security behavior is weakened.

`node scripts/check_storefront_tokens.mjs` calculates contrast directly from the customer source palette, resolves aliases and fails below ordinary-text or essential control/focus thresholds. Root palette isolation is checked. It does not replace whole-page visual, keyboard, zoom or assistive-technology acceptance. jsdom supplies only dialog open/close; native focus containment/background inertness require separate browser evidence. Phase 35 is based on committed integration revision `803970d`; the original worktree's uncommitted proxy and abort-handling fixes remain outside its test claims. Browser evidence and remaining acceptance gaps are recorded in `docs/storefront-foundation-review.md`.

The final `pnpm check` passes all 398 PostgreSQL tests and 230 frontend tests across 31 frontend files, with Ruff/Mypy/Django/schema/migration, formatting, ESLint, strict TypeScript and production build gates. Quiet Compose validation and all 22 palette checks pass. The production artifact audit covers all 59 source pages and excludes the removed temporary fixture. Twelve native modal/drawer kind/width cases pass actual browser focus, Escape, return, scroll and busy-state checks. Existing commerce redirect/abort failures are recorded as observed baseline defects rather than passing transaction acceptance.

## UI overhaul validation

Phase 33 adds two final promotion-state/pagination and fulfillment-destination regressions; the final isolated UI suite is **187 tests across 25 files**. Lint, strict TypeScript, production build, repository formatting and `git diff --check` pass. `node scripts/audit_ui_build.mjs` verifies all 51 source pages against production entries and measures static script/CSS artifacts; it is not a browser performance or hydration test. The warehouse error-focus assertion now waits for the existing passive effect while keeping the same expected focus. The complete gate was rerun after separating account rendering from dashboards. See `docs/ui-final-review.md` for remaining visual/integration evidence; PostgreSQL/Compose/proxy validation must follow the security-first integration.

Phase 32 adds three financial/promotion workflow regressions; the suite is **185 tests across 25 files**. A finance-only member does not request payout evidence or see payout commands; read-only promotion staff retains exact discount/usage/coupon evidence without mutation actions; a denied promotion change preserves visible failure, seller context, fresh CSRF and the original PATCH payload. Existing tests remain intact. Initial new-test failures came from incomplete pagination envelopes and incorrect mocked promotion paths; fixtures were corrected to the real contract, not the runtime validator.

Phase 31 added six accessibility workflow tests. See `docs/ui-accessibility.md` for source/contrast evidence and every unverified viewport/manual check. The user directed continued implementation after being informed of unavailable browser access; no screenshot or screen-reader pass is claimed.

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

## Phase 20 test coverage: Checkout & Multi-Seller Order Splitting

Phase 20 adds 8 PostgreSQL backend tests in `apps/api/tests/test_phase20_checkout.py` and 4 frontend tests in `apps/web/tests/checkout.test.tsx`:

- Address book management: verified CRUD operations, authorization boundary (customers cannot access foreign addresses), and default address promotion/unsetting.
- Real-time checkout quote: verified logistics rate resolution across multiple sellers and coupon discount calculation.
- Atomic multi-seller order placement:
  - Zero overselling: verified `select_for_update` row locks on product variants prevent race conditions.
  - Inventory reservation: verified `reserve_order_inventory` creates attributable ledger transactions without double-allocating stock.
  - Order splitting: verified master `Order` and distinct child `SellerOrder` partition per seller with category-specific commission rates.
  - Outbox emission: verified atomic insertion of `orders.order.created` outbox event.
- Frontend checkout: tested address selection, multi-seller shipping options, quote reactivity, order submission, and navigation.

## Phase 21 test coverage: Payments & Idempotency

Phase 21 adds 11 PostgreSQL backend tests in `apps/api/tests/test_phase21_payments.py` and 5 frontend tests in `apps/web/tests/payments.test.tsx`:

- Payment intent creation & idempotency:
  - `test_successful_capture_confirms_orders_converts_reservations_and_settles`: verified end-to-end capture confirms master/child orders, converts reservations to SALE ledger entries, settles seller balances, and emits `payments.payment.captured`.
  - `test_payment_intent_and_confirm_idempotency_replay`: verified duplicate intent creation and confirm calls replay existing records without re-charging or double-crediting balances.
  - `test_idempotency_key_cannot_be_reused_for_another_order`: verified key conflict returns HTTP 409.
- Payment failure & decline recovery:
  - `test_declined_payment_marks_failed_cancels_orders_and_releases_reservations`: verified decline returns HTTP 402, cancels seller orders, releases inventory reservations, and emits `payments.payment.failed`.
  - `test_order_with_cancelled_item_or_altered_amount_rejects_confirmation`: verified amount tampering or order alteration mid-flight is rejected with HTTP 409.
- Webhook signature verification:
  - `test_webhook_success_captures_payment`: verified HMAC-SHA256 signature verification and asynchronous capture via webhook.
  - `test_webhook_failure_marks_payment_failed_and_releases_inventory`: verified failure webhook releases reservations.
  - `test_webhook_signature_verification_enforced_fail_closed`: verified forged, missing, or mismatched HMAC signatures return HTTP 400.
  - `test_webhook_deduplication_via_event_id`: verified duplicate webhook event IDs are rejected idempotently.
- Authorization & security controls:
  - `test_payment_endpoints_isolated_to_order_owner_or_guest_session`: verified cross-customer and unauthenticated attacks receive HTTP 404.
  - `test_payment_endpoints_enforce_csrf_and_reject_card_data`: verified CSRF protection and rejection of raw card numbers/CVC.
  - `test_seller_order_confirmation_rejects_committed_paid_order`: verified seller cannot re-confirm already committed orders.
- Frontend payment form:
  - Verified local Luhn, expiry, and CVC validation.
  - Verified card tokenization and zero raw card data dispatch.
  - Verified 402 decline alert rendering with clear cancellation explanation.
  - Verified synchronous double-click prevention.
  - Verified payment pay page navigation to order confirmation.

## Phase 22 test coverage: Customer Account, Order History, Tracking & Post-Purchase

Phase 22 adds 9 PostgreSQL backend tests in `apps/api/tests/test_phase22_customer_portal.py` and 10 frontend tests in `apps/web/tests/customer-portal.test.tsx`:

- Customer profile & address management:
  - `test_get_and_update_customer_profile`: verified customer profile retrieval, updating profile details, phone number persistence, and canonical email normalization.
  - `test_customer_address_book_crud`: verified adding, reading, updating, and deleting customer saved addresses, with automatic default address promotion.
- Order history & isolation:
  - `test_list_and_get_customer_orders`: verified customer only sees orders associated with their account with correct package count and total items.
  - `test_cannot_view_or_cancel_other_customer_order`: verified cross-customer order read and cancellation attempts fail closed with HTTP 404.
- Self-service cancellation & inventory release:
  - `test_cancel_pending_order_releases_inventory`: verified cancelling a pending order immediately updates order statuses to cancelled and releases warehouse stock reservations back to available pool.
  - `test_cannot_cancel_already_shipped_or_delivered_order`: verified cancelling a shipped or delivered order fails with HTTP 400.
- Post-purchase engagement:
  - `test_submit_verified_product_review`: verified customer can submit verified product review on delivered, paid order items, automatically tagging `verified_purchase = True`.
  - `test_cannot_submit_review_for_undelivered_item`: verified review submission for pending/shipped items is rejected with HTTP 400.
  - `test_submit_customer_return_request`: verified customer can initiate return request (RMA) for delivered items, returning generated RMA number and status.
- Frontend customer portal:
  - Order history page: verified rendering orders list with order number, status badge, total amount, and items preview; verified empty state.
  - Order detail page: verified rendering packages, multi-seller tracking numbers, and delivery progress stepper.
  - Cancellation dialog: verified pending order cancellation with stock release confirmation.
  - Address book page: verified saved address cards, adding new address modal, editing address, setting default address, and deletion.
  - Profile & security page: verified profile form submission and secure password change form submission.
  - Delivery stepper component: verified 5-stage milestone progression and tracking event details.
  - Review & return modals: verified rating/title/body inputs and reason/quantity/notes inputs with API submissions.

## Phase 23 test coverage: Customer Commerce Hardening, E2E Integration & Release Verification

Phase 23 adds 7 comprehensive PostgreSQL backend hardening tests in `apps/api/tests/test_phase23_hardening.py` and 8 full-stack customer journey end-to-end tests in `apps/web/tests/customer-e2e-flows.test.tsx`:

- Backend Adversarial Hardening Suite (`test_phase23_hardening.py`):
  - `test_client_price_tampering_rejected_in_checkout`: verified checkout rejects smuggled prices, discounts, or modified line totals via `StrictSerializer` and server-authoritative calculations.
  - `test_cross_customer_cart_isolation_and_tampering_denied`: verified cross-customer cart access, injection, and tampering fail closed with HTTP 404.
  - `test_cross_customer_address_tampering_denied`: verified cross-customer address mutations fail closed with HTTP 404.
  - `test_cross_customer_order_tampering_denied`: verified foreign order reads, cancellations, review submissions, and return requests fail closed with HTTP 404.
  - `test_concurrent_checkout_prevents_stock_overselling`: verified row-level locking (`select_for_update()`) on `Inventory` serializes concurrent checkouts and prevents overselling when available stock is exhausted.
  - `test_payment_idempotency_prevents_duplicate_charge`: verified payment intent and capture idempotency keys prevent duplicate charges and safely replay existing transaction records.
  - `test_verified_reviews_and_returns_lifecycle_integrity`: verified post-purchase actions (reviews and RMA returns) are rejected prior to delivery and succeed post-delivery with verified purchase badges.
- Frontend Customer Commerce E2E Suite (`customer-e2e-flows.test.tsx`):
  - `Flow 1: Customer browses catalog, selects variant, and adds item to cart`: verified variant attributes selection, reactive price recalculation ($120 -> $130), quantity increments, and dispatching cart mutation.
  - `Flow 2: Customer searches for product with full-text search and faceted filters`: verified real-time query suggestions via `/suggest` endpoint and faceted sidebar filtering (category, brand, price, rating, in-stock).
  - `Flow 3: Customer updates cart quantities, applies coupon code, and verifies discount`: verified cart view, item line total updates, promotional coupon validation (`/api/v1/promotions/validate`), and instant discount banner rendering.
  - `Flow 4: Customer completes checkout with address book and multi-seller shipping selection`: verified saved shipping address selection, multi-seller shipping method calculation, quote generation, and order placement.
  - `Flow 5: Customer processes idempotent payment with zero raw card leakage`: verified in-browser card validation, local tokenization to `tok_mock_4242`, zero raw card digits dispatched over HTTP, and idempotent capture.
  - `Flow 6: Verifies multi-seller order splitting and partition into seller packages`: verified marketplace master order correctly splits into individual seller orders and fulfillment packages.
  - `Flow 7: Customer views order in account history and inspects tracking timeline`: verified customer order detail page renders master order, seller package tracking numbers, carrier details, and delivery timeline events.
  - `Flow 8: Customer submits verified product review and initiates RMA return request`: verified verified review submission dialog and return authorization (RMA) modal with defective notes and reason selection.

## Checkout presentation validation (UI Phase 41)

`apps/web/tests/storefront-checkout.test.tsx` adds positive/negative quote, address, order and payment evidence; exact large decimal repricing; tenant/item/quantity/selection/stock inconsistencies; malformed/duplicate order query IDs; read/quote/address/session recovery; stale quote cancellation; stock blocking; UUID-only navigation; accepted-order refresh failure; uncertain-placement duplicate blocking; forged guest confirmation; pending/authorized server status; explicit guest payment review; session snapshot clearing; raw-input clearing; unmounted payment guards; changed amounts; cross-order intents and mismatched capture responses. Existing checkout/payment/customer-flow tests retain command, decline, idempotency, CSRF and card-disclosure assertions. Old URL-derived success assertions are replaced by authenticated paid-order evidence and explicit forged-link negatives, and money matchers retain exact amounts/currencies with nonbreaking-space display.

Standalone six-width Chromium evidence in `storefront-audit/phase41` separates actual inherited cart-proxy failure from intercepted synthetic checkout/payment fixtures and keyboard flows. Screenshots contain no submitted card data; reports retain boolean protocol/focus assertions, not cookies, tokens or private payloads. PNG signatures, dimensions, CRCs, IEND and hashes are verified. Full PostgreSQL `pnpm check`, quiet Compose, palette, final production route audit and documentation/link checks remain required. This evidence is not production/live transaction or assistive/other-browser acceptance. See `storefront-checkout-review.md`.

## Customer auth/account presentation (UI Phase 42)

`tests/storefront-account.test.tsx` adds consumed-response and workflow regressions for bounded/malformed/duplicate profile/order/package/item/tracking evidence, exact large monetary values, historical null catalog references, invalid UUID navigation, page-number traversal without following server URLs, read-failure versus empty-state recovery, unpaid cancellation and server review/return eligibility, late navigation/session reads, honest verification state, field validation, twelve-character/matching passwords and raw-input clearing, native delete confirmation, fresh CSRF and allowlisted default-address payloads, malformed address rejection, unknown delivery status, fractional returns, rejected/duplicate/unmounted review commands, failed logout and late login navigation. Existing CSRF, login/password, customer-flow and negative security assertions remain.

The old cancellation fixture claimed a pending unpaid workflow while returning a paid order with delivered packages, then returned that old state after accepted cancellation. It now models pending payment/packages and retains the cancelled state on reload. Fake tracking IDs become actual contract UUIDs; heading selectors target semantic headings in the shell, and price assertions require exact amount/currency without a hardcoded dollar symbol. No correct security assertion is removed.

Standalone Python Playwright/Chromium uses the six specified widths. Actual anonymous reads remain separate from explicitly intercepted populated account/read/error/loading/long/modal/mutation fixtures; no browser fixture changes Django users, addresses, orders, reviews or returns. Reports contain boolean assertions and command counts, not submitted passwords, cookies, CSRF tokens or private command bodies. Screenshots never contain submitted password values. Retained evidence, observed design iterations, full gate results and acceptance limitations are in [the Phase 42 review](storefront-account-review.md). Native focus/inertness is verified in Chromium separately from jsdom's minimal dialog mock; other browsers and assistive technology remain pending.

## UI Phase 43 microinteraction validation

`pnpm check` passes against PostgreSQL: 398 backend tests, 472 frontend tests across 38 files, Python formatting/lint, strict mypy, Django/migration/OpenAPI, Prettier, zero-warning ESLint, strict TypeScript and production build (59 source routes). `docker compose --env-file .env -f infra/compose.yaml config --quiet` passed via the existing Ubuntu WSL Docker CLI; `node scripts/check_storefront_tokens.mjs` passed 22 contrast checks; `node scripts/audit_ui_build.mjs --json` and `git diff --check` passed.

Playwright Chromium 149 audited screenshots at 375, 430, 768, 1024, 1440 and 1920px, one-main/one-H1 and no horizontal overflow; menu Escape/focus return; native filter/cart drawers; accepted add-to-cart with fresh CSRF and only `{variant_id, quantity}`; loading/failed same-origin image states; and reduced-motion zero transition/animation. No browser or fixture-route errors occurred. Screenshots/reports are local ignored `.artifacts/phase43-browser` evidence, not production acceptance; all storefront API responses are deterministic intercepted fixtures. Live authenticated imagery/commerce, other browsers, assistive technology and production interaction performance remain unverified. See `storefront-microinteractions-review.md`.

## UI Phase 44 responsive and accessibility validation

Playwright Chromium 149 covered 12 storefront/auth/account routes at all seven widths (375, 430, 768, 1024, 1280, 1440, 1920; 84 route/viewport combinations), with 48 inspected representative PNG captures. No horizontal overflow, heading-level skips, duplicate IDs, missing labels, unnamed interactive controls or runtime/API fixture errors were found. Keyboard checks cover search listbox status and selection, ArrowDown/Escape/Enter, visible first-tab focus, mobile navigation, cart/filter drawers and address-dialog focus containment/return. Account profile and rejected sign-in errors are announced/focused and sign-in password input clears. Reduced-motion mode has no animation or transition. The final text contrast scan found zero active-text failures; its minimum measured active-text ratio was 4.57:1. The initially low-contrast cart note was corrected and is protected by `scripts/check_storefront_tokens.mjs`; this script still passes all 22 palette pairs. Remaining below-threshold readings were on disabled controls only.

The full `pnpm check` passes against PostgreSQL with 398 backend tests and 472 frontend tests across 38 files, Python formatting/lint, strict mypy, Django/migration/OpenAPI, Prettier, ESLint, strict TypeScript and production build. Quiet Compose validation, 22 palette pairs, production route audit (59 source pages, 58 server/1 client, 50 static artifacts), `pnpm format:check` and `git diff --check` pass. Screenshots/reports are local ignored `.artifacts/phase44-browser` evidence.

All page data and error responses are intercepted deterministic fixtures; the audit does not prove production data, live authenticated workflows, other browsers or screen-reader compatibility. Screenshots/reports are ignored local `.artifacts/phase44-browser` evidence. See `storefront-responsive-accessibility-review.md`.
