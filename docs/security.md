# Security model

## Checkout review integrity

Cart-bound storefront placement requires signed, short-lived quote evidence. Only a keyed digest and timestamp are exposed; signed JSON containing private address fields is deliberately avoided. Django still resolves the owned Cart and saved address, validates active actors/sellers/products, checks current stock under locks and enforces CSRF for guests and signed-in customers. A copied review token grants no cart/order access. The token stays in the in-memory request snapshot, never URL fragments, cookies or browser storage. Expired/altered/drifted review cannot create business writes. Exact committed replays are resolved before expiry checks, and durable closure protects a fresh review from late original requests. Legacy callers without `cart_id` retain live-price placement compatibility; they must opt into both review fields to obtain this additional consistency guarantee.

## Placement recovery security (October 28)

Recovery is an explicit unsafe command and requires fresh CSRF for anonymous and authenticated callers. Both cart UUID and attempt key are validated and scoped to the current active customer or original server-session guest cart before inspecting evidence. Known UUIDs/keys, foreign guest sessions, platform/superuser flags and changed identities do not grant access. Only a verified placed outcome returns an order UUID; no contact/address/order contents are returned. Guest recovery restores only the order binding evidenced by that same owned Cart.

The browser fragment contains non-authorizing cart/attempt identifiers only; fragments are excluded from HTTP/Referer and no credentials, private payload or provider/payment keys are written to storage or URLs. New placements bind to the original cart UUID. The recovery operation either finds the committed attempt or closes it transactionally; late same-key placement cannot create an order after verified closure. PostgreSQL guards mutually exclusive outcomes, immutable evidence and retention for the Cart lifetime. Deletion checks defer until commit to permit legitimate cart cascades; never disable these controls for guest merging or cleanup. A per-Cart 1,000-closure bound fails closed without eviction. Lost/failed/429/foreign responses never enable a fresh order. This is not cancellation/refund of an existing business order and has no gateway or inventory side effects.

## Payment recovery read boundary (October 27)

The explicit AllowAny payment-state view resolves an Order only through `payable_orders_for`: the authenticated customer owns it, or a customer-less order UUID was already bound to the guest's server-side Django session. Guessed UUIDs, foreign customers/guest sessions, logged-in users attempting to use old guest bindings and superusers receive no bypass. Expired/deactivated sessions cannot recover private evidence. Responses are `no-store`; unsupported queries/methods remain rejected. Reads do not create intents, charge, release inventory or alter audit/financial records, even with the gateway disabled.

Only a pending payable attempt exposes its original replay identifier in the response body. This identifier grants no authority, is not a provider credential, and is never put into URLs or local/session storage. Confirmation independently rechecks session ownership and fresh CSRF, locks the active actor/business rows and safely replays terminal outcomes. Reloading success uses recorded server status, never query claims. Mismatched IDs, amounts, currencies, states or malformed recovery keys fail client validation; stale/unmounted reads cannot initiate a payment command. Raw mock card fields remain transient and clear after tokenization. Production mock charging remains disabled.

## Settlement currency maintenance

New seller balances inherit the seller currency instead of hardcoded USD. Services and PostgreSQL independently reject foreign-currency settlement, payout and ledger sources, including cross-seller references. Currency identities cannot be changed to relabel history. Inconsistent legacy rows are retained and financial writes fail closed until reviewed reconciliation; the read-only `check_finance_currencies` command returns a nonzero exit code and counts without contact values, payment credentials or amounts.

Browser payment intent/confirmation revalidate and lock an active authenticated User before business locks. Guest order access remains bound to Django's server-side session; CSRF, payment ownership, signed webhooks, production-disabled mock charging and append-only ledgers remain enforced. Confirmation checks financial currency before calling the gateway. This is not a live provider integration or a conversion policy. Platform financial reports now scope amounts to one explicitly identified currency, default USD, without converted cross-currency totals.

Platform report currency choices are capability-protected aggregate metadata, bounded to 256 unique codes. Invalid, blank, repeated and unallowlisted query fields are rejected; dashboard dates must be ordered and at most 366 days apart. Client response validation rejects missing/mismatched currencies, malformed money/counts/identifiers and oversized/duplicate evidence instead of substituting financial zeroes. Currency/user/date query changes hide stale results and discard late completions. Existing session/CSRF, tenant and platform access boundaries are unchanged; no new mutation, dependency, credential storage or financial-history update is introduced.

## Authentication and session controls

The UUID custom user uses normalized email authentication and Argon2 password hashing. Django's validators require 12 characters, check common/numeric passwords and compare password text against account attributes. Password hashes and passwords never enter API serializers. The regular account bootstrap command prompts for a validated, confirmed password without accepting it as a command argument; it cannot create Django staff, superuser or platform access.

Browser sessions use Django's server-side database session engine. Cookies are HttpOnly, SameSite=Lax, eight-hour maximum age and Secure in production. The CSRF cookie is readable only because the same-origin browser must copy it into the X-CSRFToken header; it is not an authentication credential. Every unsafe browser auth request explicitly verifies CSRF. Login CSRF is enforced for anonymous sessions before DRF permissions. Successful login cycles the session key and CSRF token. Logout invalidates the server session. Password changes recheck the old password, lock and re-read the active database user, apply Django validators, rotate the current session and invalidate other sessions via the password hash.

Login, logout and current-user responses set `Cache-Control: no-store`. Auth serializers explicitly expose UUID, email, first/last name, verified-email flag and current platform capability names only. API responses never include passwords, password hashes, session IDs, staff/superuser flags, login-attempt state or authorization tokens. Auth operations reject query parameters and unknown fields.

## Brute-force limits

Maintained django-axes 8.3.1 uses PostgreSQL to track attempts. Five failures lock the independent normalized username and direct client IP for 15 minutes. A valid login does not reset the counter. Requests denied during lockout do not extend the expiry. This avoids permanent account lockout while resisting same-IP guessing and distributed attacks against one normalized email. The response is generic JSON HTTP 429 with `Retry-After: 900`. Invalid, missing and disabled account credentials use the same error. Forwarded client-IP headers are ignored until a real ingress contract is reviewed.

Axes admin and access-success logging are disabled. Its logger uses a fixed label, not username/IP/user-agent/path. It still stores attempted normalized email, direct IP, and request metadata in `AccessAttempt`, distinct from the application security-event table. Protect this table as restricted security telemetry and establish a retention/cleanup policy before production. Password fields/headers are explicitly redacted by Axes and request debugging decorators; JSON request bodies and query parameters are not persisted for authentication attempts.

## Security events

`SecurityEvent` records successful and failed login, lockout, logout, rejected old-password and password-change, plus application access grants. It stores immutable UUID snapshots rather than cascading user FKs, a keyed digest for attempted unknown identities, direct IP where available and an action timestamp. It never stores raw unknown email, password/hash, request body, headers, session/CSRF value or user agent. A PostgreSQL trigger rejects UPDATE and DELETE, including bulk ORM operations. This initial event stream is not a replacement for later general business audit logging, review access controls, retention and archival.

## Platform access

Application roles/capabilities live in `platform_access`. The database seeds `SUPER_ADMIN` with `platform.access` and `platform.sellers.read`. The protected admin access and seller-inspection endpoints require their respective capabilities on each request; `is_superuser`, `is_staff`, role strings, client state and session claims grant nothing. Capabilities remain separate for future finance/catalog/operations/support access. Grant is a management-command bootstrap operation with an append-only security event. Only authorized infrastructure operators may execute it. Django admin is not installed or routed.

## Seller tenancy and delegation

Seller is the tenant. Requests carry an explicit UUID `X-Seller-ID`; membership discovery exposes only the current user's accessible memberships. Django validates current user activity, active membership, seller availability, valid role scope and the endpoint capability. Service guards require ACTIVE sellers by default; the read-only context endpoint explicitly allows pending sellers for onboarding. No platform privilege bypasses seller routes. Missing and foreign sellers both return the same 404; insufficient capability within a verified seller returns 403. Revocations take effect on the next request. Seller access responses are uncached, explicitly serialized and exclude private legal/contact/approval data; platform inspection has a separately allowlisted representation.

Membership discovery uses fixed pages of 25, allowlists only `page`, rejects duplicate/invalid query arguments and caps the page number. Phase 4 adds explicit CSRF-protected onboarding/settings/address/document commands; staff invitation/role mutations remain deferred. Seller payloads cannot assign arbitrary membership, role, approval, verification, commission or other system fields.

PostgreSQL enforces membership uniqueness/status/join-time, role scope and cross-tenant role references. Triggers prevent moving role or membership identity after creation. Capability delegation is constrained to the actor's current capabilities; owner-role delegation also requires structural ownership and the ownership capability. This guard is a prerequisite for later transactional/audited staff workflows, not an invitation or role-change API. Tenant queryset filtering never grants authority to caller-provided creation or reassignment fields; later creation services must set tenant ownership from verified access.

## Production and browser hardening

Production settings require an external high-entropy secret, explicit hostnames and HTTPS CSRF origins. Missing/placeholder secrets, wildcard origins and HTTP origins fail startup. DEBUG is false, HTTPS redirects are enabled, HSTS is one year with subdomains (without preload), and cookies are Secure. No proxy-header trust is configured before the ingress strips and resets untrusted headers. Local development alone uses HTTP cookies and has HSTS off.

Both stacks send nosniff, DENY frame and same-origin referrer headers. Web disables the identifying header and restricts camera/microphone/geolocation. A nonce-compatible Content-Security-Policy is deferred to Phase 12. Same-origin production ingress must preserve cookies and browser Origin. Browser access tokens, localStorage/sessionStorage auth, permissive CORS and disabling CSRF are prohibited.

The Phase 3 browser API client only accepts local `/api/v1/*` paths and rejects external URLs, fragments and path traversal. Requests include cookies, disable caching and reject redirects. Every unsafe request acquires a fresh CSRF token first so login rotation cannot leave a cached stale token. Responses are checked against the runtime contract; successful logout requires the expected HTTP 204. Authentication and authorization errors remain visible, with field errors/request references where available. Raw HTML and 5xx exception payloads are not shown or retained as error details. Login password fields are cleared after submission, and credentials/tokens are never written to browser storage.

The auth provider distinguishes anonymous sessions from service failures, preserves identity on failed logout and rejects stale session lookup results. Seller queries are keyed by account/context/route, cancel obsolete work and discard delayed results, preventing a previous seller's data from appearing after a context change. Current guarded Server Components contain no private business data; any future SSR/RSC data source must authorize with Django before rendering.

PostgreSQL and Redis bind locally, use generated credentials and persistent volumes; Redis requires authentication and PostgreSQL uses SCRAM host authentication. The local DB bootstrap role is privileged for migrations/tests; production must separate migration/runtime roles and provision secrets externally. No production launch is claimed by this foundation.

## Invariants for later phases

- Django is the security boundary. Frontend guards improve UX only.
- Enforce authentication, active seller membership, capability, tenant filtering and related-object ownership independently on each sensitive operation.
- Do not use platform access as implicit seller API override. Separate `/api/v1/admin/*` and `/api/v1/seller/*` serializers/selectors/permissions intentionally.
- Never mass-assign model fields, accept arbitrary foreign keys, trust unrestricted filters or expose unbounded page sizes.
- Uploads need byte limits, generated names, MIME/extension allowlists, private non-executable storage and scanning integration.
- Money snapshots use Decimal, historical financial entries are append-only and corrections add compensating entries. Inventory/order/payment workflows need transactions, locks and idempotency.
- Do not log or return passwords, hashes, cookies, CSRF/auth headers, secrets, full bank details, or request bodies. Production error monitoring must redact them.
- No raw SQL or proxy trust is introduced without a reviewed requirement. Never commit credentials.

## Verification files and business audits

Verification scans are private JPEG/PNG images only, with matching filename extension, declared MIME and actual decoded format; PDF/SVG/HTML/animated files are rejected. A streaming upload handler bounds each file to 5 MiB before temporary-disk spooling. Pillow verifies/decode-loads at most 12 megapixels, promotes decompression warnings to errors and re-encodes a fresh RGB image without original metadata/trailing bytes. Output also has a 5 MiB bound. Production ingress must enforce a 6 MiB total request limit as defense in depth. Files are never executable, rendered inline or served through MEDIA_URL.

Uploads use generated UUID keys in a private storage alias outside app directories. Production requires an HTTPS S3-compatible endpoint, private bucket and explicit credentials; missing/placeholder configuration fails startup. Bucket policy must deny anonymous reads/listing; service credentials are limited to its bucket/prefix and object operations. Downloads recheck current seller or platform document-read permission and stream as `application/octet-stream` attachments with no-store/nosniff. No storage URL, original filename, raw document number, hash or storage credentials enter API responses.

Human verification is explicit and attributable; it is not automated identity proof. At least one unexpired verified registration document and a registered address are required for approval/reactivation. Seller members cannot approve/review/suspend/reactivate their own seller even with platform capabilities. Verified registration evidence freezes the registered address; legal name and currency cannot be changed via settings. Other contact/profile edits cannot mutate verification or approval state.

Business audit and status history are append-only in PostgreSQL and committed with the business action. Audit diffs include old/new lifecycle/review states or changed-field names for contact/address edits, not private document contents/contact values. Reasons are restricted free text shown only to the appropriate seller/platform audience; operators must avoid putting sensitive document identifiers in reasons. Direct peer IP is recorded without trusting forwarded headers. Retention/deletion exceptions require a separately reviewed operational process; no application evidence/history-delete endpoint exists.

Malware scanning remains a later integration; re-encoding is not represented as a malware scanner. New files are compensated on ordinary DB/audit failures, but process-crash orphans need later reconciliation. No S3 provider is provisioned or production launch claimed by local validation.

## Phase 12 security hardening pass

Phase 12 conducted an exhaustive security audit and hardening pass across the repository:

- **Threat Model**: Documented in `docs/threat-model.md`, examining 22 distinct attack vectors across authentication, session management, multi-tenancy, cross-tenant leaks, privilege escalation, IDOR, mass assignment, injection, financial workflows, and infrastructure.
- **Authorization Audit**: Exhaustive audit documented in `docs/security-audit.md`, indexing all 71 Seller API endpoints and 61 Admin API endpoints, detailing their capability checks, context validation, and database triggers.
- **PostgreSQL RLS Evaluation**: Detailed in `docs/rls-evaluation.md`, evaluating Row-Level Security vs the repository's current application-level scoped queryset architecture and database triggers. Found that PostgreSQL triggers (`catalog_check_child_scope`, `orders_check_scope`, `finance_check_scope`, `fulfillment_check_scope`, `promotions_check_scope`, `reviews_check_scope`) provide strong mathematical boundary enforcement at zero connection pooling or session variable overhead, deferring RLS to future high-concurrency needs.
- **Content-Security-Policy (CSP)**: Added strict CSP headers in `apps/web/next.config.ts` enforcing `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, and restricted script/style sources.
- **Dependency Audit**: Verified production dependencies with `pnpm audit --prod`, confirming 0 known vulnerabilities.
- **Adversarial Test Suite**: Added 12 rigorous adversarial test cases in `apps/api/tests/test_phase12_security.py` directly targeting multi-tenant data leaks, horizontal privilege escalation, mass assignment via `StrictSerializer`, CSRF bypass attempts, path traversal, pagination exhaustion, and financial workflow replay attacks.

## Phase 21 payment security & webhook integrity

Phase 21 introduces payment processing and webhook ingestion under strict financial and data security invariants:

- **Zero Raw Card Data Ingestion**: Backend serializers strictly forbid card numbers, expiration dates, and security codes (CVC). Any smuggled card fields are rejected by `StrictSerializer`. Only opaque client-side gateway tokens (e.g. `tok_mock_*` or provider-hosted tokens) are accepted.
- **Client-Side Tokenization & Memory Sanitization**: In the web frontend, card validation runs entirely locally in memory. Upon submission, card digits are tokenized, and sensitive input fields are wiped from component state immediately. Card numbers and CVCs are never written to `localStorage`, `sessionStorage`, cookies, or browser logs.
- **Deterministic Idempotency Key Guards**: Every payment attempt requires a caller-supplied `idempotency_key` (16–128 characters). Idempotency keys are scoped strictly to the order. Duplicate submissions with the same key safely replay the recorded outcome without charging twice. Submissions using the same key across different orders or conflicting keys on an existing payment are rejected with `409 Conflict`.
- **Database Partial Unique Constraints**: Concurrency races are prevented at the PostgreSQL engine level via `payment_one_active_per_order` (only one PENDING, AUTHORIZED, or CAPTURED payment per order) and `payment_txn_unique_webhook_event` (deduplicating webhook event IDs).
- **Append-Only Payment Transactions**: A PostgreSQL trigger `payments_transaction_immutable` rejects any `UPDATE` or `DELETE` operations on `PaymentTransaction` records, maintaining an unalterable audit ledger of all gateway attempts.
- **Fail-Closed Webhook Verification**: Inbound payment webhooks (`POST /api/v1/webhooks/payment/`) require an `X-Payment-Signature` header computed via HMAC-SHA256. In production, `PAYMENT_WEBHOOK_SECRET` must be at least 32 characters with high entropy. If the secret is missing or placeholder, startup fails closed and webhook requests are rejected with `400 Bad Request`.
- **Automated Reversal on Decline**: If a payment is declined, the order is transitioned to `FAILED`/`CANCELLED` and reserved inventory items are released immediately (`release_order_inventory`), preventing deadlocks on scarce stock.

## Phase 23 Customer Commerce Hardening & Adversarial Defenses

Phase 23 provides end-to-end hardening and adversarial verification across all customer commerce domains (Storefront, Search, Cart, Checkout, Payments, and Customer Portal):

- **Price Manipulation & Tampering Protection**: All checkout pricing, discounts, shipping fees, tax lines, and grand totals are calculated server-authoritatively. Client-supplied price, discount, or tax overrides are rejected outright by `StrictSerializer` and server calculation engines (`compute_checkout_quote` and `place_order`).
- **Cross-Customer Tenant Isolation**:
  - **Cart Isolation**: Carts are scoped strictly to the authenticated customer or anonymous session key. Unauthorized cross-customer cart access, item injection, or mutation returns `404 Not Found`.
  - **Address Book Isolation**: Customer addresses are strictly isolated to the authenticated customer owner. Cross-customer mutation, deletion, or enumeration returns `404 Not Found`.
  - **Order & Post-Purchase Isolation**: Orders, tracking packages, reviews, and return requests are strictly verified against the authenticated customer's ownership. Cross-customer read, cancellation, review creation, or return initiation returns `404 Not Found`.
- **Concurrency & Over-Allocation Prevention**: Stock reservation during checkout leverages PostgreSQL row-level locks (`select_for_update()`) on `Inventory` rows. Concurrent checkout attempts competing for finite inventory are serialized; attempts exceeding available stock fail closed with clean stock exhaustion errors, preventing overselling.
- **Post-Purchase Lifecycle Integrity**: Product reviews and RMA return requests are enforced at the business logic layer to require completed delivery (`status='delivered'`). Reviewing or returning an item in `pending`, `confirmed`, or `shipped` state is rejected with `400 Bad Request`. Delivered orders generate verified purchase review badges and immutable return records.

## Checkout presentation evidence (UI Phase 41)

Payment and confirmation URLs carry only a valid single order UUID. Client-supplied totals, currency, email and confirmation claims are ignored. Paid presentation requires a validated server capture snapshot or an authenticated existing Django order read. Small order display snapshots stay in memory and reset across session identities; they carry no authorization. Guest ownership remains in Django?s server-side session. Guest payment review and confirmation reload now use the minimal session-scoped payment-state read documented above; no browser-stored authority is introduced.

Raw mock card number, expiry and CVC clear immediately after local tokenization. Only the existing opaque token reaches the API, with stable per-view payment idempotency and fresh CSRF. A changed server intent amount requires another review before capture. Late/unmounted responses cannot dispatch a further payment command or show stale private evidence. An already-dispatched unsafe operation remains subject to Django?s transaction and session checks. Backend placement replay is Cart-scoped and the UI retains the original payload/key for explicit same-page recovery; an accepted placement is not repeated for a subsequent cart refresh failure. Hard reload discards the private payload; fragment-based recovery now resolves or closes the original attempt without repeating it.

## Customer auth/account presentation (UI Phase 42)

No backend, auth provider, API client, session, CSRF, permission, proxy or dependency change accompanies the account redesign. Shared login preserves generic rejections, fresh login CSRF, raw-password clearing and the fixed workspace destination; an unmounted login form cannot trigger a late navigation. Customer pages never authorize private Server Component/RSC output with a browser guard. They send only public shells and load private data through authenticated Django APIs after session validation.

In-memory private reads and form/dialog lifetimes are bound to the user, pathname and resource/page. Pending reads are aborted and delayed results discarded; mutations serialize duplicate submissions and discard stale UI completions. Browser state, item eligibility and verification flags remain server evidence, not grants of authority. Neither credentials nor private account data are placed in browser storage or URLs. Profile edits refresh session identity. Password length help matches Django's twelve-character minimum; all other password validation remains authoritative on the server, and raw fields clear after accepted/rejected commands. Exact financial history is displayed without float calculations or URL-derived totals.

Preserved backend debt: the current profile email-change service does not reset `is_email_verified`, require password reauthentication or write a general profile-change audit. The UI displays the returned verification flag and does not claim a new verification delivery workflow; production email-change assurance needs a separately authorized backend phase. Review/return eligibility flags are coarse status hints; duplicate requests and actual remaining eligibility must still be enforced by Django. Request abort/unmount is not rollback, and non-idempotent writes without a definitive response may require reloading before a deliberate retry. These limitations are not addressed through weakened CSRF/auth controls or new backend behavior in this UI phase.

## Dependency audit follow-up (2026-10-10)

The production dependency gate remains `pnpm audit --prod`, with no severity exclusions or advisory exceptions. Next.js 16.3.8 and the compatible `source-map-js` 1.2.2 lockfile resolution address all seven production advisories found in the October 10 CI run. CI cleanup skips only when the generated `.env` does not exist; failures from Docker teardown still fail the cleanup step.

The broader development audit reports the unresolved high-severity `braces` recursive-pattern denial of service in ESLint glob tooling (GHSA-vfj7-8cjw-p6xm). No patched version is currently published. It is absent from the production graph; lint operates on repository-owned paths, not browser-supplied patterns. Continue to track the upstream patch and preserve the finding until it is resolved.

## October 26 remediation

Next.js 16.4.1 fixes the production advisories discovered in this review. Vitest 5.0.3, an explicit compatible Vite 8.3.3 test-peer pin and refreshed Undici resolutions also clear the current development audit. Both `pnpm audit --prod` and full `pnpm audit` are required in CI; no exceptions or severity exclusions were added. The October 10 development finding above is historical: the current locked graph has no reported advisories.

Checkout retries are authorized using the current Cart's active customer or guest session, never a globally supplied key. Anonymous and authenticated unsafe requests retain the existing CSRF policy. Mixed-currency orders, archived products, foreign/ineligible shipping selections and guest coupon redemption are rejected before committing orders or reservations. Guest coupons require sign-in because the existing redemption ledger requires a customer; this prevents discounts that evade usage limits.

Changing an email address resets its verification; case-only normalization preserves verification of the same canonical address. The active User is locked and the change is paired atomically with an append-only audit containing field names only, without addresses, email values, phone numbers or passwords. Password reauthentication and delivery of verification emails remain separate account-policy work. Product-image URLs use the existing authorized public-catalog stream; missing storage objects produce 404 rather than unhandled errors, and inactive product/seller/image guards remain in force.
