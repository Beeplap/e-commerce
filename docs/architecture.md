# Architecture

## Current foundation

The repository is a modular monolith. `apps/api` owns the Django API and all eventual business authority; `apps/web` is a Next.js App Router application. PostgreSQL is the authoritative database. Redis is an authenticated local dependency reserved for future caching and workers. No marketplace business workflows or customer storefront are implemented yet.

The `accounts` domain owns the custom swappable UUID/email user, session login/logout/password workflows and append-only security-event record. The separate `platform_access` domain owns platform roles and capability grants. The `sellers` domain now owns tenants, memberships, seller roles/capabilities and tenant-scoped authorization. Read-only access endpoints expose the authenticated user's available seller contexts and one verified context; explicit platform inspection has its own capability.

The web app now has a public landing/login, protected workspace selector/account page, distinct seller/admin layouts, responsive navigation, account/logout menu, access-denied/not-found pages and loading/error recovery. Its dynamic `/health` endpoint and Django's `/api/v1/health` return only `{"status":"ok"}` with `Cache-Control: no-store`. They prove process liveness and intentionally do not query PostgreSQL or Redis. Dependency-aware readiness belongs to Phase 14.

The browser acquires `/api/v1/auth/csrf`, then uses same-origin JSON requests for login, current user, logout and password change. It holds an HttpOnly Django session cookie and a readable CSRF cookie/header pair, never a bearer token. Unsafe authentication endpoints explicitly enforce CSRF even for anonymous sessions. Successful login rotates both the session key and CSRF token. Password change rotates the current session and invalidates other sessions through Django's stored password-hash check.

## Request boundaries

In development, the browser uses `http://127.0.0.1:3000`. Next.js rewrites `/api/:path*` to the loopback Django server at `http://127.0.0.1:8000`. This preserves a same-origin browser interface without CORS. Django explicitly trusts only the two local frontend origins for development CSRF checks. Choose either localhost or 127.0.0.1 consistently; cookies are host-specific.

Production uses one HTTPS origin: ingress routes `/api/*` to Django and other paths to Next.js. The development rewrite is absent in production. No `NEXT_PUBLIC` secret configuration, browser bearer-token layer, or second Next.js identity store is permitted. The ingress must support cookies and preserve the browser origin; forwarded-header trust is not configured until a controlled ingress is chosen.

Seller context is explicit on each seller operation through a UUID `X-Seller-ID` header. It selects a tenant after membership and capability validation, rather than granting access. There is no shared mutable session seller, so two tabs can work with different tenants. The frontend discovers contexts through `/api/v1/seller/memberships`, then inspects its selected context through `/api/v1/seller/access`. Membership, user, seller and permission revocation are checked against current PostgreSQL state. Internal services must independently use `require_seller_access` and tenant-scoped selectors, which require ACTIVE sellers by default. The read-only context view explicitly permits pending sellers for later onboarding.

`SellerRole` holds system roles or one seller's custom role; PostgreSQL prevents cross-tenant role assignment and changing role/membership identity. The delegation guard rejects capabilities the actor does not hold and protects owner-role delegation. Staff mutation workflows and owner-transfer/last-owner rules remain Phase 10 work; the current guard performs no mutation. Onboarding, lifecycle transitions and profile/settings writes remain Phase 4 work.

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

Future files use a private S3-compatible storage adapter via Django's storage interface. Bucket, region, endpoint, and credentials are configuration; MinIO may serve development but must not be a domain dependency. No upload endpoint or storage SDK is installed in Phase 0.
