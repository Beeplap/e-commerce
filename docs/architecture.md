# Architecture

## Current foundation

The repository is a modular monolith. `apps/api` owns the Django API and all eventual business authority; `apps/web` is a Next.js App Router application. PostgreSQL is the authoritative database. Redis is an authenticated local dependency reserved for future caching and workers. No marketplace business workflows or customer storefront are implemented yet.

The `accounts` domain owns the custom swappable UUID/email user, session login/logout/password workflows and append-only security-event record. The separate `platform_access` domain owns platform roles and capability grants. Phase 1 intentionally provides only the `platform.access` capability and protected session-inspection endpoint; later business admin and seller resources remain unimplemented.

The web app currently has a semantic landing page and a dynamic `/health` endpoint. Django exposes `/api/v1/health`. Both return only `{"status":"ok"}` with `Cache-Control: no-store`. They prove process liveness and intentionally do not query PostgreSQL or Redis. Dependency-aware readiness belongs to Phase 14.

The browser acquires `/api/v1/auth/csrf`, then uses same-origin JSON requests for login, current user, logout and password change. It holds an HttpOnly Django session cookie and a readable CSRF cookie/header pair, never a bearer token. Unsafe authentication endpoints explicitly enforce CSRF even for anonymous sessions. Successful login rotates both the session key and CSRF token. Password change rotates the current session and invalidates other sessions through Django's stored password-hash check.

## Request boundaries

In development, the browser uses `http://127.0.0.1:3000`. Next.js rewrites `/api/:path*` to the loopback Django server at `http://127.0.0.1:8000`. This preserves a same-origin browser interface without CORS. Django explicitly trusts only the two local frontend origins for development CSRF checks. Choose either localhost or 127.0.0.1 consistently; cookies are host-specific.

Production uses one HTTPS origin: ingress routes `/api/*` to Django and other paths to Next.js. The development rewrite is absent in production. No `NEXT_PUBLIC` secret configuration, browser bearer-token layer, or second Next.js identity store is permitted. The ingress must support cookies and preserve the browser origin; forwarded-header trust is not configured until a controlled ingress is chosen.

## Future module boundaries (not implemented)

- `accounts`: identity, session/password workflows and security-event snapshots.
- `platform_access`: application administrator roles and explicit capabilities (initially only `platform.access`).
- `sellers`, `permissions`: tenancy, memberships, seller lifecycle and RBAC.
- `catalog`, `inventory`: products and attributable stock movements.
- `orders`: parent Order and per-seller SellerOrder, snapshots and explicit state transitions.
- `payments`, `payouts`: payment references, commission snapshots, immutable seller accounting.
- `shipping`, `returns`: fulfillment and refunds integrated with inventory/accounting.
- `promotions`, `reviews`, `notifications`, `analytics`, `audit`: later supporting domains.

Create modules when they contain real authorized code. Write APIs as view -> explicit validation -> service -> model operations. Use selectors for complex scoped reads. Services own transactions; critical concurrency requires row locking and database constraints. Avoid core signal workflows. Future async work uses Celery only after commit; evaluate an outbox for reliable critical events.

Frontend features belong under `features/<domain>`, reusable primitives under `components/ui`, and shared API/auth/permission helpers under `lib`. These directories and libraries are created when used. Accessible primitives such as shadcn/ui, TanStack Query/Table, React Hook Form and Zod are deferred until their relevant UI phases.

Future files use a private S3-compatible storage adapter via Django's storage interface. Bucket, region, endpoint, and credentials are configuration; MinIO may serve development but must not be a domain dependency. No upload endpoint or storage SDK is installed in Phase 0.
