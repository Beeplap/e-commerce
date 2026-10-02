# Threat Model & Security Analysis

This document provides a comprehensive threat model for the Quick Commerce platform, covering all primary threat vectors, architectural defenses, concrete controls, validation mechanisms, and residual risk management across backend and frontend domains.

---

## 1. Authentication

- **Threat**: Credential stuffing, brute-force dictionary attacks, rainbow table lookups, password spray, and user enumeration.
- **Architectural Defenses & Controls**:
  - Custom `accounts.User` identified by normalized, lowercased, whitespace-trimmed canonical email.
  - Password hashing via Argon2 (`django.contrib.auth.hashers.Argon2PasswordHasher`), exceeding OWASP baseline recommendations.
  - Password complexity enforcement (`AUTH_PASSWORD_VALIDATORS`): minimum length 12 characters, similarity validation, numeric-only rejection, and common password reject list.
  - Unified error messaging: Login view emits identical HTTP 400 responses for unknown users, wrong passwords, and disabled accounts to prevent account enumeration.
  - Brute-force lockout via `django-axes`: 5 failed attempts per (normalized username, direct IP) tuple triggers 15-minute temporary lockout with HTTP 429 and `Retry-After: 900`.
- **Validation**: Adversarial tests verify argon2 algorithm presence, 12-character minimum bounds, normalized email matching, and lockout enforcement after 5 bad attempts.

---

## 2. Session Theft

- **Threat**: Session hijacking, session fixation, cookie interception over unencrypted networks, and credential theft from browser storage.
- **Architectural Defenses & Controls**:
  - Server-side database session store (`django.contrib.sessions.backends.db`). Sessions store only account identifier and rotation metadata.
  - Cookie security attributes: `SESSION_COOKIE_HTTPONLY = True`, `SESSION_COOKIE_SECURE = True`, `SESSION_COOKIE_SAMESITE = "Lax"`.
  - Absolute session lifetime: 8-hour cap (`SESSION_COOKIE_AGE = 28800`).
  - Session rotation: Login cycles session key (`request.session.cycle_key()`). Password change invalidates all other concurrent active sessions via stored password hash verification.
  - Strict zero-storage rule: Frontend client never writes tokens, credentials, or session IDs to `localStorage`, `sessionStorage`, or IndexedDB.
- **Validation**: Cookie inspection tests ensure `HttpOnly` and `SameSite` flags; login rotation tests confirm distinct session keys pre- and post-authentication.

---

## 3. Cross-Site Request Forgery (CSRF)

- **Threat**: Forcing authenticated users to perform unauthorized state-changing actions via malicious third-party websites or phishing vectors.
- **Architectural Defenses & Controls**:
  - Django CSRF token architecture with explicit per-request evaluation.
  - Cookie security: `CSRF_COOKIE_SECURE = True`, `CSRF_COOKIE_SAMESITE = "Lax"`.
  - Double-submit mitigation: Client retrieves CSRF token from `/api/v1/auth/csrf` and passes it in `X-CSRFToken` header for every unsafe HTTP method (`POST`, `PUT`, `PATCH`, `DELETE`).
  - Explicit anonymous CSRF guard: `BrowserAPIView` enforces CSRF checks on anonymous endpoints (including `/api/v1/auth/login`) before permission classes execute.
  - Origin validation: `CSRF_TRUSTED_ORIGINS` strictly allowlists production domains and development proxies; wildcard or HTTP origins are rejected at startup.
- **Validation**: CSRF omission tests confirm immediate HTTP 403 rejection on state-changing operations across all seller, platform, and auth endpoints.

---

## 4. Cross-Site Scripting (XSS)

- **Threat**: Injection of malicious JavaScript into the application via customer reviews, product descriptions, seller names, or query parameters.
- **Architectural Defenses & Controls**:
  - React/Next.js automatic output encoding for JSX expressions.
  - Prohibited use of `dangerouslySetInnerHTML`: Entire codebase forbids raw HTML injection unless sanitized by reviewed whitelists.
  - Strict Content-Security-Policy (CSP) configured in `next.config.ts`:
    `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';`
  - MIME type sniffing prevention: `SECURE_CONTENT_TYPE_NOSNIFF = True` and `X-Content-Type-Options: nosniff`.
  - Clickjacking protection: `X_FRAME_OPTIONS = "DENY"` and CSP `frame-ancestors 'none'`.
- **Validation**: Frontend test suite and security linting confirm absence of unsafe HTML rendering; Next.js security headers verified on all route responses.

---

## 5. Insecure Direct Object References (IDOR / BOLA)

- **Threat**: Unauthorized actors manipulating UUID parameters in URLs to read or mutate resources belonging to other sellers or customers.
- **Architectural Defenses & Controls**:
  - UUIDv4 identifiers across all business entities, preventing sequential enumeration attacks.
  - Dual-layer object scoping:
    1. HTTP context level: `X-Seller-ID` header revalidated against database for active membership.
    2. Query level: `tenant_queryset` automatically appends `seller=request_seller` to all database lookups.
  - Uniform 404 response: When an object does not exist or belongs to another seller, the API returns HTTP 404 with identical generic error messages, preventing existence oracle probing.
- **Validation**: Multi-tenant adversarial test cases prove Seller A receives 404 when querying Seller B products, variants, warehouses, inventory, orders, shipments, returns, refunds, promotions, or payouts.

---

## 6. Broken Access Control

- **Threat**: Unauthenticated callers, unauthorized sellers, or low-privilege staff invoking restricted endpoints.
- **Architectural Defenses & Controls**:
  - Default-deny API policy: DRF configured with `REST_FRAMEWORK["DEFAULT_PERMISSION_CLASSES"] = ["config.permissions.DenyAll"]`. Every view must explicitly declare permissions.
  - Strict capability model: Roles alone grant zero access; every endpoint requires a specific granular capability (e.g., `catalog.product.create`, `finance.read`, `platform.sellers.manage`).
  - Separation of platform and tenant boundaries: Platform capabilities never implicitly grant access to tenant routes (`/api/v1/seller/*`), and seller capabilities never grant access to platform routes (`/api/v1/admin/*`).
  - Active status requirement: Suspended, rejected, or closed sellers cannot perform operations even with valid memberships.
- **Validation**: Automated capability matrix tests verify that callers lacking the exact permission receive HTTP 403 Forbidden.

---

## 7. Tenant Escape

- **Threat**: Breaching the logical isolation boundary between sellers to access or modify competitor catalog, inventory, order, or financial data.
- **Architectural Defenses & Controls**:
  - PostgreSQL database-level foreign key constraints and triggers (`catalog_check_child_scope`, `check_order_item_tenant`, `check_seller_ledger_scope`, `check_payout_item_scope`, `check_shipment_seller_scope`, `check_return_seller_scope`, `check_refund_seller_scope`).
  - Trigger enforcement rejects any attempt to insert or update child records pointing to parent records owned by different sellers.
  - Queryset `.create()` tenant enforcement: Creation services explicitly set `seller=request_seller` from verified authorization context, ignoring caller-supplied payload fields.
- **Validation**: Cross-tenant injection tests attempt to link Seller A items to Seller B orders, warehouses, and promotions; all fail closed with PostgreSQL database trigger exceptions.

---

## 8. Privilege Escalation

- **Threat**: Seller staff members granting themselves higher roles (e.g., Support Agent making themselves Owner) or platform users escalating to Super Admin.
- **Architectural Defenses & Controls**:
  - Delegation guard (`authorize_role_assignment`): Staff members can only assign roles whose permissions are a strict subset of their own active permissions.
  - Structural Owner protection: Only active owners with `seller.ownership.manage` can grant or modify owner roles.
  - Last-owner lock: Services lock the seller membership table and verify that demoting or revoking a member leaves at least one active OWNER.
  - System role immutability: Global system roles cannot be modified or deleted. Custom roles belong to exactly one seller and cannot be reassigned.
  - Platform grant isolation: Platform access can only be provisioned via offline infrastructure management commands (`grant_platform_access`), which append immutable `SecurityEvent` audit entries.
- **Validation**: Test cases verify that non-owners cannot grant Owner roles, staff members cannot assign capabilities beyond their own grant, and the last owner cannot be demoted or removed.

---

## 9. Mass Assignment

- **Threat**: Attackers injecting internal or administrative fields (e.g., `id`, `is_owner`, `status`, `approved_by`, `commission_rate`, `created_at`) into JSON payloads.
- **Architectural Defenses & Controls**:
  - Explicit DRF Serializers: Serializers declare strict `fields` allowlists. Model serializers never use `fields = '__all__'`.
  - Read-only system fields: Identifiers, statuses, financial calculations, audit timestamps, and foreign keys are marked `read_only=True`.
  - Service-layer validation: Services accept typed dataclasses or explicit parameters, ignoring extraneous input dictionary keys.
  - `BrowserAPIView.allowed_query_parameters`: Rejects unknown query parameters on all GET/HEAD endpoints.
- **Validation**: Adversarial tests submit payloads containing unauthorized status and commission fields; responses verify fields remain unchanged.

---

## 10. SQL Injection

- **Threat**: Malicious SQL injected via query parameters, sorting arguments, or search strings.
- **Architectural Defenses & Controls**:
  - 100% Django ORM parameterized queries. Zero raw SQL string concatenation (`cursor.execute(f"...")` or `.raw()`) is used anywhere in the application.
  - Allowlisted sorting and filtering: Bounded pagination and filters validate allowed order fields against strict sets.
  - PostgreSQL trigger logic uses strictly parameterized PL/pgSQL variable bindings.
- **Validation**: Fuzzing tests submit SQL syntax fragments (`' OR 1=1 --`, `UNION SELECT`) into search, pagination, and filter parameters; all are safely parameterized and escaped.

---

## 11. File Upload Attacks

- **Threat**: Upload of executable scripts (PHP, Python, shell), webshells, polyglot files, SVG with embedded JavaScript, or decompression bombs (zip/pixel bombs).
- **Architectural Defenses & Controls**:
  - Strict MIME & extension allowlist: Only JPEG and PNG image formats are accepted (`image/jpeg`, `image/png`). PDFs, SVGs, HTML, and executables are rejected.
  - Streaming upload size limits: `BoundedUploadHandler` terminates uploads exceeding 5 MiB before temporary disk spooling.
  - Pixel decoding & re-encoding: Pillow opens the image with decompression bomb limits (12 megapixels max), decodes raw RGB pixel matrices, strips all EXIF/metadata and trailing payloads, and re-encodes a clean JPEG/PNG.
  - Storage isolation: Uploads stored in named private storage boundaries (`verification`, `catalog`) located outside web document roots and executable paths.
  - Non-executable private storage: S3-compatible private buckets with private ACLs in production; local directory permissions `0600` (files) and `0700` (dirs).
  - Authenticated streaming downloads: Files are streamed through Django with `Content-Disposition: attachment; filename="..."`, `Content-Type: application/octet-stream`, `X-Content-Type-Options: nosniff`, and `Cache-Control: no-store`. Public URLs or direct presigned links are never issued.
- **Validation**: Upload tests submit oversized files, corrupted images, invalid MIME types, and SVG payloads; all fail closed with descriptive validation errors.

---

## 12. Brute Force & Credential Stuffing

- **Threat**: Automated password guessing attacks against user accounts.
- **Architectural Defenses & Controls**:
  - `django-axes` integration tracking failed attempts in PostgreSQL `AccessAttempt` table.
  - Normalized username tracking: Email is lowercased and stripped prior to evaluation.
  - IP-based tracking: Tracks direct connection IP.
  - Cooldown policy: 5 failures locks account for 900 seconds. Lockout responses return generic HTTP 429 without distinguishing valid from invalid accounts.
- **Validation**: Test cases simulate 5 consecutive failed logins and verify subsequent login attempts are rejected with HTTP 429 until cooldown expires.

---

## 13. Rate-Limit Bypass

- **Threat**: Bypassing IP-based rate limiting by spoofing HTTP headers (`X-Forwarded-For`, `X-Real-IP`, `Client-IP`).
- **Architectural Defenses & Controls**:
  - No proxy IP trust without controlled ingress: Reverse proxy header trust is disabled in Django settings (`SECURE_PROXY_SSL_HEADER = None`).
  - Direct connection address: Axes and audit logs rely strictly on `REMOTE_ADDR` from the direct TCP socket.
  - Ingress requirement: Production deployment mandates ingress reverse proxies to strip and overwrite all incoming forwarding headers.
- **Validation**: Adversarial header spoofing tests submit randomized `X-Forwarded-For` headers during brute-force login attempts; Axes correctly attributes all attempts to `REMOTE_ADDR` and locks out the attacker.

---

## 14. Sensitive-Data Exposure

- **Threat**: Leaking passwords, tokens, full credit card numbers, bank details, or internal server errors to clients or logs.
- **Architectural Defenses & Controls**:
  - Serializer sanitation: User serializers explicitly expose only UUID, email, name, email verification status, and permissions. Passwords, hashes, and session keys are excluded.
  - Redacted logging: Passwords, authorization headers, session cookies, and CSRF tokens are explicitly redacted from server logs.
  - Append-only audit sanitization: `SecurityEvent`, `AuditLog`, and `SellerStatusHistory` store state diffs and changed field names, never raw passwords, request bodies, or confidential documents.
  - Production error handling: `DEBUG = False` prevents stack traces or environment variables from leaking in error responses. Custom 500/404 JSON handlers emit generic error payloads.
- **Validation**: Schema validation and API response tests verify zero credential leakage; production configuration tests confirm `DEBUG = False`.

---

## 15. Security Misconfiguration

- **Threat**: Deploying with default secret keys, debug mode enabled, permissive CORS, or insecure cookie flags.
- **Architectural Defenses & Controls**:
  - Fail-closed startup: Production settings (`config/settings/production.py`) require non-placeholder, high-entropy secrets (minimum 50 chars, 5 unique chars) via `DJANGO_SECRET_KEY`.
  - Environment validation: Missing or placeholder environment variables cause immediate startup failure (`config.env.required`).
  - Production security settings:
    - `DEBUG = False`
    - `SECURE_SSL_REDIRECT = True`
    - `SECURE_HSTS_SECONDS = 31536000` (1 year)
    - `SECURE_HSTS_INCLUDE_SUBDOMAINS = True`
    - `SECURE_CONTENT_TYPE_NOSNIFF = True`
    - `SECURE_REFERRER_POLICY = "same-origin"`
    - `X_FRAME_OPTIONS = "DENY"`
  - Compose configuration check: Docker Compose passes quiet validation without printing secrets.
- **Validation**: `node scripts/tasks.mjs check-api` validates production settings fail closed when secrets are missing.

---

## 16. Server-Side Request Forgery (SSRF)

- **Threat**: Forcing backend servers to make unauthorized HTTP requests to internal services (e.g. AWS metadata endpoint `169.254.169.254`, internal Redis, PostgreSQL).
- **Architectural Defenses & Controls**:
  - Zero arbitrary URL fetching: The core application accepts no user-supplied outbound URLs for fetching or rendering.
  - Private storage boundary: Storage adapters interact only with explicitly configured internal endpoints via environment variables.
  - Parcel tracking URLs: Shipment tracking links are validated and stored as display-only strings, never fetched by server processes.
- **Validation**: Codebase audit verifies absence of `requests.get(user_input)` or unvalidated outbound HTTP clients.

---

## 17. Open Redirects

- **Threat**: Redirecting users to external malicious sites post-login or after actions via `next` or `return_to` parameters.
- **Architectural Defenses & Controls**:
  - Centralized Next.js client: API client (`client.ts`) rejects external URLs and handles redirects strictly within the same-origin application router.
  - Django API endpoints: Authentication and action endpoints return JSON responses (`{"status": "ok"}` or data objects), never HTTP 301/302 redirects containing user-supplied target URLs.
- **Validation**: API client tests verify rejection of non-relative URLs and protocol relative URLs (`//attacker.com`).

---

## 18. Unsafe Deserialization

- **Threat**: Remote code execution via unsafe pickle, YAML, or object deserialization.
- **Architectural Defenses & Controls**:
  - JSON-only parsers: DRF is configured exclusively with `rest_framework.parsers.JSONParser`. Python `pickle`, XML, and unsafe YAML deserializers are forbidden.
  - Session serializer: Django uses JSON session serialization (`django.contrib.sessions.serializers.JSONSerializer`).
  - PostgreSQL JSONField validation: Models storing structured snapshots (`billing_address_snapshot`, `shipping_address_snapshot`, `metadata`) use Django native `JSONField` validated against schema dictionaries.
- **Validation**: Request parsing tests ensure non-JSON content types are rejected with HTTP 415 Unsupported Media Type.

---

## 19. Webhook & Integration Spoofing

- **Threat**: Forged webhook payloads or tampered payment/carrier status updates.
- **Architectural Defenses & Controls**:
  - State machine transitions require authenticated internal operator actions.
  - Future payment and carrier webhooks (Phases 14-15) must verify cryptographic HMAC signatures against secret keys before processing payloads.
- **Validation**: State machine tests verify unauthenticated or forged requests cannot force transition of orders, shipments, or payouts.

---

## 20. Replay & Idempotency Problems

- **Threat**: Replaying network requests to duplicate payments, inventory deductions, refunds, or payouts.
- **Architectural Defenses & Controls**:
  - Unique transaction references: Orders, payments, shipments, returns, refunds, and payouts generate unique business numbers (e.g. `ORD-...`, `REF-...`, `PO-...`).
  - Database unique constraints: Invariants enforced by PostgreSQL unique constraints preventing duplicate records.
  - State guards: Transition actions verify current status before progressing (e.g., cannot confirm an already confirmed order, cannot approve an approved payout).
  - Compensating ledger accounting: Financial adjustments write single attributable entries with idempotency checks on target references.
- **Validation**: Replay tests submit duplicate order confirmation, payout processing, and refund creation calls; duplicates fail closed with descriptive conflicts.

---

## 21. Race Conditions & Concurrency Hazards

- **Threat**: Concurrent requests exploiting race conditions to oversell inventory, double-withdraw balances, or double-approve payouts.
- **Architectural Defenses & Controls**:
  - Atomic transaction blocks: All multi-table updates execute inside `transaction.atomic()`.
  - Strict mutation lock hierarchy:
    `User (Actor) -> PlatformAccess -> Seller -> SellerMembership -> Child Resources`
  - Explicit row-level locking (`select_for_update()`):
    - Inventory movements lock `Inventory` rows to prevent negative stock or over-reservation.
    - Payout requests lock `SellerBalance` to prevent double-spending available balances.
    - Role changes lock membership rows to prevent concurrent owner demotions.
  - PostgreSQL database constraints: `quantity_reserved <= quantity_on_hand` and `quantity_on_hand >= 0` check constraints reject concurrency violations at the database engine level.
- **Validation**: Concurrent test cases execute parallel payout approvals and inventory adjustments, verifying zero over-allocation or balance corruption.

---

## 22. Financial Tampering

- **Threat**: Manipulation of item prices, discount percentages, commission fees, or account balances.
- **Architectural Defenses & Controls**:
  - Strict Decimal arithmetic: Floating-point math is forbidden for monetary calculations. All calculations use Python `decimal.Decimal` and PostgreSQL `numeric(14, 2)`.
  - Immutable historical snapshots: `OrderItem` snapshots unit price, total, commission amount, and seller net total at checkout.
  - Append-only seller ledger: `SellerLedgerEntry` records every balance change with signed amounts and `balance_after` snapshots. PostgreSQL triggers reject UPDATE and DELETE operations on ledger entries.
  - Commission engine precedence: Server-side calculation applies strict precedence (Seller+Category > Seller > Category > Default plan). Client-provided commission rates are rejected.
  - Closed financial state machine: Completed refunds and processed payouts are locked against modification via database triggers.
- **Validation**: Financial test suite verifies Decimal precision preservation, database trigger immutability, commission snapshot calculations, and anti-self-approval enforcement.
