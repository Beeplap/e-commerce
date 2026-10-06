# Architecture

## UI overhaul boundary

Customer Phase 40 keeps `/cart` as a small Server Component entry with no private server data load. Shared client seller/item/summary rows and native drawer live in `features/cart`; API calls remain in the existing client. The root SessionCartProvider binds presentation state to auth identity without remounting page workflows. Tagged results prevent old cart/overlay data rendering after identity change; generation/cancellation and shared mutation serialization prevent obsolete reads/writes replacing current evidence. Every accepted response validates consumed UUIDs, stock/counts, bounded arrays, public stream URLs and exact amounts before shared state changes. More than 1,000 lines/groups fails visibly; backend pagination remains separate. These are UX/evidence checks, not authority or proof of server cancellation.

Cart summary displays actual subtotal/currency only. Shipping/taxes/final discounts are unknown until checkout; client totals are not recomputed. Existing coupon validation supplies a clearly labeled eligibility preview, with no persisted application or invented transfer workflow. Cart revisions/account changes discard previews and late completions. Error/pending/unavailable evidence disables checkout as a native button; Django rechecks cart ownership/inventory and determines final charges. Thumbnails use the installed Next Image component with per-image `unoptimized` and native lazy loading to retain validated same-origin Django streams; no optimizer, storage URL or global image configuration change is introduced. The native customer cart dialog adds only local boundary Tab cycling and styles; operational/navigation dialog behavior and backend/session/CSRF/tenant/checkout/payment boundaries remain unchanged. Original concurrent proxy changes and live populated/production acceptance remain separate.

The UI roadmap in `instrutions3.md` runs on the isolated `ui-overhaul` branch/worktree with its own `UI_CURRENT_PHASE.md`. The concurrent backend selector remains independent. UI Phase 23 establishes semantic CSS tokens in `apps/web/styles/tokens.css` and the concrete design contract in `docs/design-system.md`; feature-oriented routes/components and all Django authority/API boundaries are retained. Later presentation primitives live in `components/ui` and are consumed deliberately by domain features. Security/backend work merges first, then the clean, tested UI branch is rebased onto it. Visual evidence and unavailable browser access are recorded separately from code/test validation.

UI phases 23-33 retain small Server Component route entry points and client-side interactive API reads; they introduce no confidential server-load shortcut around Django. Shared semantic tables, fields, native overlays, tabs and actual timelines compose domain-specific workflows. Financial overview requests honor separate payout capability. Route-selected fulfillment views reset by destination/user identity. Account rendering lives outside the dashboard module to avoid shipping chart code on `/account`. The final implementation, artifact measurements and outstanding visual/integration evidence are recorded in `docs/ui-final-review.md`; implementation completion is not production/visual acceptance.

## Customer storefront audit boundary

The user explicitly authorized only Phase 34 of the supplied `instructions4.md` on 2026-10-04, with a stop after the audit. `docs/storefront-ui-audit.md` reviews the newer customer storefront on `main` at `f6fa9f3`; documentation is isolated on `ui-overhaul-phase34-audit` at UI baseline `7fac034`, preserving the user's concurrent rebase without merging functionality or changing application code. Future branding must scope customer tokens separately from operational seller/admin styles, retain semantic states and exact money, and preserve Django/session/CSRF/tenant/API authority. Copper values need deliberately accessible text/control pairings. Existing routes and backend evidence constrain navigation, prices, inventory, delivery and success claims. Live inspection exposed trailing-slash proxy redirects hidden by cart loading errors; corrections must preserve redirect rejection. Populated/authenticated visual acceptance and full branch integration remain separate gates. Phase 35 requires another explicit request.

## Customer presentation foundation (Phase 35)

The customer design boundary is `.sf-storefront` with inherited `--sf-*` tokens in `apps/web/styles/storefront.css`; operational root `--ui-*` tokens remain unchanged. Shared customer controls/content/feedback live in `components/storefront`, reuse precise `Money` formatting and native `Dialog` behavior, and contain no API/auth authority. Context-local overlay aliases style existing native behavior without changing seller/admin dialogs. Exact decimal strings and BigInt discount arithmetic preserve financial display precision; darker copper action tokens and stronger essential control borders address the written palette's contrast gaps. Local system/editorial fonts require no dependency or remote font fetch.

Foundation work is isolated on `ui-overhaul-phase35-foundation`, rebased onto committed integration baseline `803970d` after the user's independent rebase completed. The newer functional cart/checkout/account handlers, providers, validation and security controls are retained. Palette migration includes customer cart and checkout; the existing cart drawer receives a transparent scoped boundary outside page roots. Native customer overlay focus containment includes forward/reverse Tab wrapping and focus parking while busy; operational dialogs remain unchanged. The user's uncommitted proxy and stale-request fixes are separate and are not included in these checks. Page redesign and full transaction acceptance remain separate from Phase 35 validation. Phase 36 requires an explicit request.

## Customer shell (Phase 36)

The customer header/footer and public discovery remain in `features/storefront`. Categories use the existing public category endpoint; Sellers is a labeled preview of at most eight distinct stores from the first 25 newest catalog products. It is neither a complete seller directory nor verification/ranking evidence. No directory, policy, support, social or campaign route is invented. Footer destinations follow the actual shop/account/onboarding/workspace architecture.

The header remounts by pathname and signed-in user identity to cancel/discard old public discovery and dismiss navigation. Autocomplete has instance-specific IDs, bounded validated destinations, AbortController plus request-generation protection, all-group keyboard selection and explicit failure/full-search recovery. Query echo validation honors Django's control-character removal and 100-code-point cap; it never replaces stale-request guards. Public discovery uses the existing same-origin API client without changing authority, cookie, redirect, CSRF or tenant behavior.

Mobile navigation reuses the scoped native `StorefrontOverlay` and its focus/scroll cleanup. Autocomplete consumes its first Escape; the drawer consumes the next before the native search input can clear its value. Resizing to desktop dismisses navigation and focuses the visible brand after dialog cleanup. Actual cart opening/provider remains intact, and a missing cart never becomes a fabricated zero count. Customer routes provide focusable main landmarks for the shell's skip link; their business handlers are not changed. `ui-overhaul-phase36-shell` builds on validated `cb0bd0a`; user-owned uncommitted proxy/abort/account/backend work remains separate. Evidence and inherited gaps are in `docs/storefront-shell-review.md`. Phase 37 requires another explicit request.

## Homepage discovery (Phase 37)

`app/page.tsx` is a small Server Component entry to `features/storefront/home`; all catalog reads remain client-side through the existing same-origin API client. No server-load/auth shortcut, new endpoint, dependency, browser persistence or business mutation is introduced. The branch `ui-overhaul-phase37-homepage` builds on validated shell `f60d7ee` while preserving the original worktree's concurrent changes.

The first bounded page of `sort=newest` supplies a real product spotlight, up to eight arrivals and up to four distinct seller identities. There is no popularity/curation signal or seller directory contract: label the sections as latest arrivals and stores represented in those arrivals, never trending, verified, ranked or exhaustive. Category discovery shows up to six records from a locally bounded 24-record preview, with a genuine catalog destination for more. Do not infer global counts from these samples or follow untrusted pagination URLs.

Homepage-specific runtime validation checks consumed identities, exact decimal/currency evidence, availability, bounded ratings/counts and same-product relative public image URLs. This supplements existing assertion-only storefront parsers; it does not establish validation for other customer routes. Independent AbortController reads discard canceled completions/errors, including Strict Mode cleanup; category/catalog failures retain separate retry and empty states. No stale records survive a retry. Genuine missing photography uses an explicit text fallback, not a fabricated merchandise asset. Homepage card composition/CSS remains local; shared listing/PDP components and workflows await their own phases.

`docs/storefront-homepage-review.md` separates actual anonymous catalog evidence from explicit intercepted browser fixtures and documents remaining acceptance. Phase 37 ends after validation/documentation/isolated commit and push. Phase 38 requires another explicit request.

## Customer listing/category/search discovery (Phase 38)

`app/search/page.tsx` and `app/categories/[id]/page.tsx` are small public Server Component entries with Suspense. They render the shared client-side `features/storefront/discovery` feature; no confidential server data or authorization shortcut is introduced. Keep the header/footer/main shell outside Suspense: fallback content supplies only loading geometry/status, avoiding duplicate main/field IDs during delayed hydration. Listing and category browsing both use the existing faceted `/api/v1/storefront/search` endpoint through the unchanged same-origin client. Categories remain route-scoped even when filters are cleared. The isolated `ui-overhaul-phase38-discovery` branch builds on validated homepage `a240719`, preserving original concurrent work and all other commerce handlers.

URL state is the single source for query, category/brand UUID or slug, seller, exact price bounds, availability, rating, sort and positive page. Reject unsupported/repeated/invalid addresses visibly before a product request; normalize UUID case and Django's printable 100-code-point query. Filters/sort reset to page one, pagination preserves all applied state, and browser history restores it. Every page holds at most 20 results. Build pagination destinations locally from the allowlisted state; never follow response `next`/`previous` URLs. Empty later pages offer a first-page recovery with the same filters.

Shared pure evidence validators supplement the existing API client's assertions for homepage and discovery consumed identities, prices/currency, availability, ratings, bounded facets and same-product relative public image URLs. Search errors/malformed evidence stay errors; independent category metadata failures stay visible where needed. The existing unpaginated category endpoint is locally capped at 1,000 metadata records and fails visibly beyond that bound. Canceled reads discard success and failure, including Strict Mode; URL changes immediately invalidate old products, facets and count. No response validation becomes authentication or inventory authority.

The backend's price bounds filter listed numeric units across currencies; there is no exchange conversion contract. Compare editable decimal bounds with bounded BigInt arithmetic, preserve actual product currencies and omit hard-coded dollar labels. Price-bracket facet counts use half-open maxima while applied maxima are inclusive, so quick ranges show bounds without those misleading counts. Category/brand/rating/stock counts explicitly describe the text-query population before filters. Correcting backend search/currency/facet contracts remains a separately authorized backend change.

Below 1,024px, filter editing uses the existing native `StorefrontOverlay`; drafts are in memory and commit to the URL only on Apply. Escape/Close discard them, return focus and restore scroll. The filter list scrolls independently of the action bar; resizing to desktop closes it and focuses a visible results heading. Desktop uses a plain 14rem rail. Discovery-specific product composition/CSS leaves shared seller/PDP cards and cart/payment workflows unchanged. Evidence and limitations live in `docs/storefront-discovery-review.md`. STOP after Phase 38; product-detail Phase 39 requires another explicit request.

## Customer product detail (Phase 39)

`app/products/[id]/page.tsx` is a small public Server Component entry to `features/storefront/detail`. Public reads continue through the unchanged API client/Django authority. Product/user identity keys discard obsolete detail, choices and local purchase feedback. AbortController checks discard canceled completions/errors, including Strict Mode; retry clears previous evidence. Invalid IDs never request product data, 404 offers recovery and malformed/temporary failures remain errors.

Detail evidence validates the requested identity, actual seller/category, exact decimals/currency, consistent option/aggregate stock, attributes, same-product public image URLs and published ratings/reviews. Presentation bounds are ten active images, 1,000 options with 100 attributes each and ten recent reviews; oversized options fail rather than silently disappearing. These bounds neither authorize data nor solve unpaginated backend reads. Eager main/lazy thumbnail streams preserve Django visibility, contain geometry and explicit loading/error/missing states. Native pressed buttons select gallery/options; unavailable options remain inspectable.

Stock is a received snapshot. Django/provider cart authority stays intact: send only variant UUID and integer quantity, block duplicates, await acceptance, freeze choices while pending and focus rejection. Product/user/unmount changes discard local completion; broader provider races remain deferred. Never invent verification, delivery dates, free shipping, cart reservation or Buy Now. Individual purchase flags and UTC review dates are rendered from evidence. Prices remain original strings; higher previous-price comparison uses bounded BigInt. Related products are an independent validated first-page category preview (25 received/four shown/current product excluded), not a recommendation service; never follow response pagination URLs.

PDP composition/CSS stays local; seller/discovery cards and backend/auth/cart/checkout/payment/proxy implementations remain unchanged. The inherited cart proxy redirect remains visible and documented; no redirect/security relaxation or concurrent user proxy edit is incorporated. See `docs/storefront-product-detail-review.md`. STOP after Phase 39; Phase 40 requires an explicit request.

## Current foundation

The repository is a modular monolith. `apps/api` owns the Django API and all business authority; `apps/web` is a Next.js App Router application. PostgreSQL is authoritative. Redis is reserved for future caching and workers. Seller onboarding/lifecycle management is implemented; catalog, commerce workflows and customer storefront are later phases.

The `accounts` domain owns the custom swappable UUID/email user, session login/logout/password workflows and append-only security-event record. The separate `platform_access` domain owns platform roles and capability grants. The `sellers` domain now owns tenants, memberships, seller roles/capabilities and tenant-scoped authorization. Read-only access endpoints expose the authenticated user's available seller contexts and one verified context; explicit platform inspection has its own capability.

The web app now has a public landing/login, protected workspace selector/account page, distinct seller/admin layouts, responsive navigation, account/logout menu, access-denied/not-found pages and loading/error recovery. Its dynamic `/health` endpoint and Django's `/api/v1/health` return only `{"status":"ok"}` with `Cache-Control: no-store`. They prove process liveness and intentionally do not query PostgreSQL or Redis. Dependency-aware readiness belongs to Phase 14.

The browser acquires `/api/v1/auth/csrf`, then uses same-origin JSON requests for login, current user, logout and password change. It holds an HttpOnly Django session cookie and a readable CSRF cookie/header pair, never a bearer token. Unsafe authentication endpoints explicitly enforce CSRF even for anonymous sessions. Successful login rotates both the session key and CSRF token. Password change rotates the current session and invalidates other sessions through Django's stored password-hash check.

## Request boundaries

In development, the browser uses `http://127.0.0.1:3000`. Next.js rewrites `/api/:path*` to the loopback Django server at `http://127.0.0.1:8000`. This preserves a same-origin browser interface without CORS. Django explicitly trusts only the two local frontend origins for development CSRF checks. Choose either localhost or 127.0.0.1 consistently; cookies are host-specific.

Production uses one HTTPS origin: ingress routes `/api/*` to Django and other paths to Next.js. The development rewrite is absent in production. No `NEXT_PUBLIC` secret configuration, browser bearer-token layer, or second Next.js identity store is permitted. The ingress must support cookies and preserve the browser origin; forwarded-header trust is not configured until a controlled ingress is chosen.

Seller context is explicit on each seller operation through a UUID `X-Seller-ID` header. It selects a tenant after membership and capability validation, rather than granting access. There is no shared mutable session seller, so two tabs can work with different tenants. The frontend discovers contexts through `/api/v1/seller/memberships`, then inspects its selected context through `/api/v1/seller/access`. Membership, user, seller and permission revocation are checked against current PostgreSQL state. Internal services must independently use `require_seller_access` and tenant-scoped selectors, which require ACTIVE sellers by default. The read-only context view explicitly permits pending sellers for later onboarding.

`SellerRole` holds system roles or one seller's custom role; PostgreSQL prevents cross-tenant role assignment and changing role/membership identity. The delegation guard rejects capabilities the actor does not hold and protects owner-role delegation. Staff mutation workflows and owner-transfer/last-owner rules remain Phase 10 work. Phase 4 onboarding creates an active OWNER membership in a pending seller in the same transaction as its profile/settings and audit/history records.

## Domain boundaries and later modules

- `accounts`: identity, session/password workflows and security-event snapshots.
- `platform_access`: application administrator roles and explicit capabilities (initially only `platform.access`).
- `sellers`: implemented tenancy/memberships/RBAC foundation; seller lifecycle and staff workflows follow later. Seller permissions live with this domain; no empty separate permissions app is needed.
- `catalog`, `inventory`: products and attributable stock movements.
- `orders`: parent Order and per-seller SellerOrder, snapshots and explicit state transitions.
- `payments`, `payouts`: payment references, commission snapshots, immutable seller accounting.
- `shipping`, `returns`: fulfillment and refunds integrated with inventory/accounting.
- `promotions`, `reviews`, `notifications`, `analytics`, `audit`: later supporting domains.

Create modules when they contain real authorized code. Write APIs as view -> explicit validation -> service -> model operations. Use selectors for complex scoped reads. Services own transactions; critical concurrency requires row locking and database constraints. Avoid core signal workflows. Future async work uses Celery only after commit; evaluate an outbox for reliable critical events.

Frontend features belong under `features/<domain>`, reusable primitives under `components/ui`, and shared API/auth/permission helpers under `lib`. These directories and libraries are created when used. Accessible primitives such as shadcn/ui, TanStack Query/Table, React Hook Form and Zod are deferred until their relevant UI phases.

Phase 3 implements the auth/workspace features and a centralized typed browser API client. Responses are validated at runtime against explicit identity/membership/pagination shapes. Cookie credentials, fresh CSRF acquisition, explicit seller headers, safe error parsing, request references and strict same-origin paths are handled centrally. The small query hook cancels stale work and never renders a prior user's or seller's delayed response. Auth generations prevent an earlier session lookup from overwriting a later login/logout. Failed logout keeps identity visible and reports failure until Django confirms invalidation.

Client guards provide UX only; current Server Components contain no confidential business data. Future server-side data fetching must call authenticated, authorized Django APIs before producing HTML/RSC, regardless of client layout guards. Seller selection remains in memory and is revalidated by Django. The initial table/form/display/dialog primitives use framework/HTML capabilities rather than adding unused state, form or table dependencies. Displayed account and membership data comes from authoritative API responses; dashboards/metrics belong to Phase 11.

## Seller lifecycle and evidence

`sellers.lifecycle_services` owns onboarding, settings/address writes, document submission/review/download and lifecycle transitions. `lifecycle_selectors` separates seller scope from explicit platform authority. Explicit serializers validate all write input; no model-wide PATCH is enabled. `audit.AuditLog` is a separate domain for business audit, while login/password events remain in `accounts.SecurityEvent`.

Writes lock in this order: active actor User; for platform commands its PlatformAccess, role and permission-link rows; Seller; seller membership, role and permission-link rows for seller writes; then child resources. Revalidate current authority after locking. Future staff/grant services must coordinate on these locks rather than authorizing outside the transaction. Seller locking serializes review, lifecycle, address and upload invariants. Failed audit insertion rolls back the business change. Concurrent approval commits once.

Legal name and currency are immutable through seller settings. Registered address is editable while pending until the first verified document, then frozen so evidence cannot approve a different identity. Mutable profile/contact fields are unrelated to registered identity. Registration verification and seller approval are separate platform commands; both reject any current membership by the actor, including inactive memberships. Rejected/closed sellers have no self-service reopening command.

Files use the named Django `verification` storage boundary: private local filesystem under ignored `.private-media/verification` in development; django-storages S3-compatible backend in production. Keys are server-generated UUID paths. Downloads stream through independently authorized Django endpoints with attachment/no-store/nosniff, never public or presigned browser URLs. Production requires explicit HTTPS endpoint/bucket/region/credentials and private bucket policy. Original names, EXIF and appended payloads are discarded by pixel decoding/re-encoding. Uploads own a durable transaction and compensate saved storage objects on ordinary database/audit failures; process crashes can leave private orphans requiring later reconciliation.

Phase 4 adds no worker or notification infrastructure. Malware scanning integration remains later hardening work. The frontend extends the centralized client for FormData and authenticated binary downloads; it does not duplicate fetch/session/CSRF logic. Private data is loaded only through Django-authorized client requests; dynamic page parameters are validated but never treated as authorization.

## Catalog domain and product architecture

`apps/catalog` encapsulates categories, brands, configurable attributes, and seller-owned products, variants, images, and attribute values.

- Services: `apps/catalog/services.py` coordinates creation, mutation, and status lifecycle. Seller access is revalidated and locked under transaction; child entities (variants, attribute values, images) are tenant-scoped and locked in order.
- Selectors: `apps/catalog/selectors.py` provides tenant-scoped read queries with bounded pagination and strict allowlisted filters.
- Money handling: prices and compare-at amounts are validated as nonnegative decimal strings. Frontend displays use BigInt grouping and explicit locale formatting without floating-point conversion.
- Safe image handling: uses the named Django `catalog` storage boundary (private local directory in development; S3-compatible boundary in production). UUID storage keys, strict content-type validation (`image/png`, `image/jpeg`), and Pillow byte verification ensure private storage outside executable paths. Failed audit insertions compensate uploaded storage files.

## Inventory domain and ledger architecture

`apps/inventory` provides seller-isolated warehouse management and an attributable inventory ledger:

- Attributable transaction ledger: stock is never updated with a blind counter. Every stock increase, decrease, reservation, release, sale, or return generates an immutable `InventoryTransaction` recording the actor UUID, quantity delta, post-operation on-hand and reserved balances, reference keys, and optional audit notes.
- Concurrency and lock order: inventory operations adhere to the mutation lock order: actor `User` -> `Seller` -> `SellerMembership` -> `Inventory` row (`select_for_update()`). This serializes concurrent adjustments, reservations, and releases for the same SKU/warehouse and prevents race conditions.
- Tenant isolation: warehouse creation and inventory operations enforce tenant scope via `lock_seller_access`. Database triggers reject any attempt to link a variant belonging to Seller A with a warehouse belonging to Seller B.
- Capability authorization: seller warehouse and inventory operations require `seller.inventory.manage` or `seller.inventory.read` via `require_seller_access`. Platform administrators require explicit `platform.inventory.read` capability to view inventory across sellers; Django `is_superuser` alone grants no implicit access.

## Order domain and marketplace state machine architecture

`apps/orders` implements multi-seller order partitioning and secure, auditable state machine transitions:

- Partitioned order model: Customer orders create a top-level `Order` capturing overall customer reference, payment reference, contact/shipping addresses, and currency. Each cart item is partitioned by seller into a distinct `SellerOrder`. Each seller sees and manages exclusively their own `SellerOrder` and line items (`OrderItem`).
- Immutable line item snapshots: Line items capture denormalized catalog and pricing snapshots (`product_name_snapshot`, `sku_snapshot`, `variant_snapshot`, `unit_price`, `quantity`, `tax_amount`, `discount_amount`, `total`, `commission_amount`, `seller_net_amount`). Subsequent mutations or deletions in the catalog or warehouse do not alter historical order line items. PostgreSQL triggers reject UPDATE and DELETE operations on committed `OrderItem` records.
- Cross-tenant validation trigger: A PostgreSQL trigger enforces that every `OrderItem` referenced product, variant, and warehouse strictly belongs to the `SellerOrder`'s tenant `seller_id`, preventing cross-tenant injection at the database level.
- Append-only status transition ledger: `OrderStatusHistory` captures every lifecycle change with source and destination statuses, actor UUID, timestamp, and transition notes. PostgreSQL triggers reject UPDATE and DELETE operations.
- Explicit state transitions: Order status mutations are governed by dedicated services (`confirm_seller_order`, `begin_processing_seller_order`, `ship_seller_order`, `deliver_seller_order`, `cancel_seller_order`). Generic status setter APIs are rejected.
- Inventory integration: Order placement reserves warehouse inventory atomically. Cancellation releases reserved inventory back to available stock. Shipment consumes reserved stock into final sales and updates overall parent `Order` fulfillment status.
- Access control: Seller endpoints (`/api/v1/seller/orders/*`) require active seller membership and capability (`orders.read`, `orders.update`, `orders.cancel`). Platform inspection and management (`/api/v1/admin/orders/*`) require explicit capabilities `platform.orders.read` and `platform.orders.manage`. Django `is_superuser` provides break-glass infrastructure access only and does not bypass platform capability checks.

## Finance domain and commission engine architecture

`apps/finance` implements the marketplace commission engine, authoritatively maintained seller balances, and immutable financial accounting:

- Precision Decimal accounting: All monetary calculations, commission deductions, and fee snapshots operate exclusively on high-precision Python `Decimal` instances using standard `ROUND_HALF_UP` rounding to two decimal places. Floating-point conversions are strictly forbidden across both Django services and Next.js UI components.
- Commission rule precedence: Fee deductions are calculated using explicit priority:
  1. Specific Seller + Specific Category rule (`priority` ordered)
  2. Specific Seller rule
  3. Specific Category rule
  4. Commission plan default percentage
- Historical rate snapshotting: Line item commission amounts are captured and frozen at order item creation. Modifying a commission plan or updating rule percentages never retroactively alters previously placed orders or historical ledger entries.
- Append-only financial ledger: The seller ledger (`SellerLedgerEntry`) is append-only. Every financial event (`SALE`, `COMMISSION`, `REFUND`, `PAYOUT`, `ADJUSTMENT`) generates an attributable entry recording the signed amount, post-transaction balance snapshot (`balance_after`), currency, and reference identifiers. Manual accounting corrections create explicit compensating adjustment entries; historical records are never modified or purged.
- PostgreSQL integrity enforcement: Database triggers strictly enforce financial invariants:
  - `sellers_reject_history_mutation()` rejects any UPDATE or DELETE operation on `finance_sellerledgerentry`.
  - Payout trigger locks `amount` and status from further mutation once marked `PROCESSED`.
  - Scope integrity triggers prevent cross-tenant foreign key linkage: `SellerLedgerEntry` verifies `seller_order.seller_id == seller_id` and `payout.seller_id == seller_id`; `PayoutItem` verifies `payout.seller_id == ledger_entry.seller_id`.
- Payout state machine & anti-self-approval: Payouts progress through `PENDING` -> `APPROVED` -> `PROCESSED`, or `REJECTED`. Rejection automatically posts a compensating credit restoring the seller's available balance. Zero self-approval is strictly enforced: platform administrators who possess a membership in the requesting seller are forbidden from approving, processing, or rejecting their own seller's payouts.
- Explicit capability gating: Seller finance APIs (`/api/v1/seller/finance/*`) require `finance.read` and `payouts.read`. Platform finance APIs (`/api/v1/admin/finance/*`) require explicit `platform.finance.read` and `platform.finance.manage` capabilities seeded to `SUPER_ADMIN`.

## Phase 9 shipping, fulfillment, returns, and refunds architecture

- Multi-shipment order fulfillment: Fulfillment operates independently per `SellerOrder`. A seller can create one or multiple `Shipment` records fulfilling line items via designated carriers (e.g., FedEx, UPS, DHL), tracking numbers, and live parcel tracking URLs.
- Tracking timeline: Parcel events (`TrackingEvent`) are appended to a shipment chronologically. Each event snapshot records status, location, description, and timestamp. SQL triggers reject updates or deletions of tracking events.
- Customer return authorizations (RMA): Return workflows operate against individual `OrderItem` records on orders with status `SHIPPED` or `DELIVERED`. The lifecycle follows explicit transitions: `REQUESTED` -> `APPROVED` | `REJECTED` -> `IN_TRANSIT` -> `RECEIVED` -> `REFUND_PENDING` -> `REFUNDED` -> `CLOSED`.
- Inventory restock integration: When returned items are received and inspected (`receive_return_request`), items marked `restock_inventory=True` atomically create `return` transactions on the target warehouse via `receive_return`, restoring `quantity_on_hand` with full audit attribution.
- Financial integration & commission reversal: Customer refunds (`Refund`) compute proportional marketplace commission reversals (`commission_reversed`) and seller ledger deductions (`seller_deduction`). Processing a refund automatically posts compensating `REFUND` (negative debit) and `COMMISSION` (positive reversal) entries to `SellerLedgerEntry`, adjusting the seller's available balance in real time without mutating past financial history. Completed refunds are locked against modification via PostgreSQL triggers.
- Tenant isolation & cross-tenant rejection: PostgreSQL triggers prevent foreign-seller linkages across shipments, shipment items, return requests, return items, and refunds. Platform admins cannot approve or manage returns without explicit platform capabilities.

## Phase 10 promotions, reviews, seller staff management, and notifications architecture

- Promotions & coupon engine (`apps/promotions`):
  - Campaign scoping: Promotions operate at `PLATFORM` scope (marketplace-wide or targeted to specific sellers via `PromotionSeller`) or `SELLER` scope (seller-specific discounts).
  - Discount evaluation: Discounts (`PERCENTAGE`, `FIXED_AMOUNT`, `FREE_SHIPPING`) are evaluated authoritatively on the backend (`evaluate_coupon_discount`). Date validity, minimum order thresholds, maximum discount caps, usage limits, and seller boundaries are verified. Client-calculated discount amounts are never trusted.
  - Coupon redemption: Redemptions record an append-only `CouponUsage` entry linking customer, order, and coupon. PostgreSQL triggers reject mutations on usage records and prevent cross-tenant targeting.
- Product reviews & moderation (`apps/reviews`):
  - Verified purchases: Customer product reviews link to verified customer orders and purchased order items.
  - Seller responses: Sellers can view published reviews and submit official responses (`SellerReviewResponse`). Database triggers ensure the responding seller matches the product's owning seller. Direct deletion of legitimate negative reviews by sellers is prevented.
  - Platform moderation: Suspicious or reported reviews (`ReviewReport`) undergo administrative review (`ReviewModeration`). Moderation decisions (`APPROVE`, `REJECT`, `REMOVE`) write immutable audit entries.
- Seller staff & role delegation (`apps/sellers`):
  - Team management: Sellers can invite users via email, assign roles, change member roles, and revoke memberships.
  - Custom roles: Sellers can define tenant-scoped custom roles with granular permission subsets.
  - Safe delegation: `authorize_role_assignment` re-verifies inside database transactions that actors cannot assign permissions they do not possess.
  - Last-owner protection: Revocation and role modification services count remaining active owners; demoting or revoking the final active owner of a seller is blocked.
- Notifications infrastructure (`apps/notifications`):
  - In-app & async multi-channel messaging: `Notification` and `NotificationDelivery` provide transactional notifications across in-app, email, and future channels.
  - Fault isolation: Delivery attempt failures (e.g. SMTP connectivity issues) are captured and marked as `FAILED` in `NotificationDelivery` without rolling back the enclosing database transaction.

## Phase 11 analytics and dashboards architecture

- Single-roundtrip authoritative metrics (`apps/analytics`):
  - Queries operate as direct PostgreSQL aggregates over authoritative tables (`SellerOrder`, `OrderItem`, `Inventory`, `SellerBalance`, `Payout`, `ReturnRequest`, `Refund`, `Seller`).
  - Single source of truth: No denormalized aggregate tables or out-of-sync caching layers. Real-time changes in orders, fulfillment, payouts, and stock are immediately reflected in dashboard responses.
  - Order cancellation exclusion: Cancelled seller orders (`status == CANCELLED`) and failed payments are rigorously excluded from gross sales, net sales, units sold, and GMV aggregates.
  - Tenant isolation: Seller dashboard endpoint (`/api/v1/seller/analytics/dashboard`) validates `X-Seller-ID` context and executes all subqueries filtered strictly to `seller=request_seller`. Cross-tenant data leakage is structurally impossible.
  - Date range query parameters: Allowlisted to `start_date` and `end_date`, supporting preset intervals (last 7 days, 30 days, 90 days, all time) and custom date intervals.
- Platform Super Admin dashboard:
  - Endpoint (`/api/v1/admin/analytics/dashboard`) guarded by explicit `platform.analytics.read` capability.
  - Computes platform-wide marketplace GMV, commission revenues, active seller counts, pending onboarding approvals, customer base, refund rates, return rates, outstanding seller balances, and upcoming payouts.
  - Provides category and seller breakdowns with sales volume and daily sales-over-time trends.
- Frontend Next.js integration:
  - Responsive dashboards rendered at `/seller` and `/admin` featuring KPI cards, operational risk badges (low-stock alerts, pending orders, pending seller approvals), balances, top performance tables, and daily sales trends.
  - Date range picker presets seamlessly trigger re-fetches using `useApiQuery` with abort signal support.

## Phase 14 observability, background jobs, operational resilience, and transactional outbox

- Request correlation & structured logging (`apps/api/config/logging.py`):
  - Request correlation middleware: Inspects incoming HTTP requests for `X-Request-ID` or generates a valid UUIDv4. Populates thread-local and `contextvars` context. Echoes `X-Request-ID` on all responses and logging entries.
  - Structured JSON logging: `StructuredJsonFormatter` outputs log events as JSON containing timestamp (ISO 8601), log level, message, logger name, request ID, user ID, seller ID, route path, method, status code, latency (ms), and client IP.
  - Secret redaction: Automatic regex masking for sensitive fields (passwords, tokens, cookies, authorization headers, credit cards).
- Health & readiness probes (`apps/api/config/health.py`):
  - Liveness: `/api/v1/health` and `/api/v1/health/live` remain lightweight, dependency-free process liveness probes.
  - Readiness: `/api/v1/health/ready` actively probes PostgreSQL connectivity (`SELECT 1`) and Redis availability (`client.ping()`). Returns HTTP 200 `status: ok` when healthy; returns HTTP 503 `status: degraded` with check details when either fails. Responses set `Cache-Control: no-cache, no-store, must-revalidate`.
- Custom exception handling & monitoring abstraction (`apps/api/config/monitoring.py`, `apps/api/config/exceptions.py`):
  - Unified error monitoring abstraction with Sentry integration when configured (`SENTRY_DSN`), failing open to structured logging.
  - Custom DRF exception handler attaches `X-Request-ID` to all DRF error responses; unhandled 500 errors produce structured JSON error payloads with error reference IDs.
- Transactional Outbox Pattern & Celery Workers (`apps.events`):
  - Database schema: `OutboxEvent` table records domain events atomically within the originating business transaction (`create_order`, `confirm_seller_order`, `ship_seller_order`, `process_payout`).
  - Immutability & database triggers: PostgreSQL triggers `events_outbox_mutation_trigger` and `events_outbox_deletion_trigger` guarantee append-only immutability, preventing updates to topic, payload, event key, or deletion of events.
  - Worker dispatch: Post-commit dispatch via `transaction.on_commit(trigger_outbox_processing.delay)` triggers Celery task execution immediately after database commit.
  - Concurrency & locking: Outbox event processing uses `select_for_update(skip_locked=True)` in batches, preventing double-processing by concurrent Celery workers.
  - Operational reconciliation: Periodic scheduled task `reconcile_outbox_events_task` scans for unprocessed or failed retryable events, providing operational resilience against worker crashes or lost triggers.
  - Webhook delivery: Celery task `deliver_webhook_task` implements exponential backoff with jitter and retry limits.

## Phase 20 customer checkout & multi-seller order splitting architecture

- Saved address book & default address promotion (`apps.checkout`):
  - `CustomerAddress` provides persistent address storage for authenticated shoppers. Setting an address as default atomically demotes all other addresses for that user within a database transaction.
- Dynamic multi-seller checkout quote:
  - Aggregates cart items by seller and resolves available shipping methods and rates from `apps.fulfillment` shipping rules.
  - Validates applied promotion coupons against promotion eligibility rules, computing itemized subtotal, per-seller shipping total, discounts, and grand total.
- Atomic multi-seller order placement:
  - Concurrency control: Executes `select_for_update` on product variants in deterministic ID order to prevent database deadlocks.
  - Real-time stock verification: Validates sufficient available stock (`quantity_on_hand - quantity_reserved`) across active warehouses.
  - Inventory reservation: Atomically invokes `reserve_order_inventory` (Phase 6), allocating reservations across warehouses.
  - Multi-seller partition: Creates the master `Order` and partitions line items into distinct child `SellerOrder` records per seller with snapshot commission rates.
  - Transactional outbox: Emits `orders.order.created` event within the same commit.

## Phase 21 payment integration & idempotency architecture

- Dedicated payments module (`apps.payments`):
  - Models: Master `Payment` entity and append-only `PaymentTransaction` records.
  - Idempotency guard: Every payment operation requires an `idempotency_key` (16–128 characters) indexed with a unique database constraint. Replays return the existing payment status without re-charging.
- Capture & failure workflows:
  - Deterministic locking: Capturing a payment locks the order and associated inventory records in deterministic key order.
  - Reservation to sale transition: On capture, `SellerOrder.inventory_committed` is set to `True`, inventory reservations are converted into immutable SALE transactions via `consume_order_inventory`, seller balances are credited net of commissions, and an outbox event `payments.payment.captured` is emitted.
  - Failure reversal: If a payment is declined or fails, the master order and pending child seller orders are cancelled, inventory reservations are released immediately (`release_order_inventory`), and an outbox event `payments.payment.failed` is emitted.
- Provider abstraction & signed webhooks:
  - Gateway interface (`BasePaymentGateway`) decouples vendor specifics (e.g. MockGateway, Stripe).
  - Mock provider declines specific test tokens (`tok_chargeDeclined`, `*_0002`) and succeeds for valid tokens (`tok_visa`, `tok_mock_*`).
  - Webhook verification: Inbound gateway webhooks verify caller authenticity using HMAC-SHA256 signatures with `settings.PAYMENT_WEBHOOK_SECRET`, strictly failing closed if unverified or unsigned.
- Frontend payment processing:
  - Pure client-side validation for Luhn algorithm, expiration dates, and CVC security codes.
  - Zero sensitive data transmission: Raw card digits and CVC codes are converted into an opaque token and never dispatched to Django or stored in browser persistence.
  - Synchronous double-click guard prevents concurrent form submission.
  - Clear decline guidance informs the customer of order cancellation and stock release with recovery navigation.

## Phase 22 customer account & post-purchase architecture

- Dedicated customer portal module (`apps.customers`):
  - User identity preservation: Retains `accounts.User` as the sole authentication authority. `CustomerProfile` links 1:1 to `accounts.User` for customer phone numbers and preferences.
  - Profile update service: Validates canonical email normalization, uniqueness, and profile attributes. Password updates route to secure session-aware `apps.accounts.services.change_password`.
- Order history & package tracking:
  - Scoped queries: Customer order endpoints filter by `order.customer_email == user.email` or `order.customer_user == user`. Cross-tenant or foreign user order access yields 404.
  - Multi-seller package breakdown: Orders report child seller packages independently with fulfillment statuses, tracking numbers, carriers, and historical tracking events.
- Self-service cancellation:
  - Permitted strictly when the order is in `pending` payment status and unfulfilled.
  - Cancellation atomically cancels master and seller orders, releases inventory reservations via `release_order_inventory` across all order item lines, and writes `OrderStatusHistory` records.
- Post-purchase engagement:
  - Verified product reviews: Order items on delivered, paid orders expose review eligibility (`can_review = True`). Submitting a review attaches `verified_purchase = True` and links to the verified product.
  - Return requests (RMA): Delivered items expose return eligibility (`can_return = True`). Submitting a return creates a formal `ReturnRequest` with an RMA number and audit trail.
- Customer account frontend:
  - Account screens integrated into `<WorkspaceFrame mode="account">` with sub-navigation for Orders, Addresses, and Profile.
  - Delivery stepper component renders milestone progression from Order Placed through Delivered.
  - Accessible modal dialogs for writing product reviews and requesting item returns.
