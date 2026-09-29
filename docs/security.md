# Security model

## Implemented in Phase 0

Django REST Framework defaults to `DenyAll`, including authenticated users. The sole health view explicitly allows public read-only liveness. Only JSON parsers/renderers are enabled by default. Pagination defaults to 25 with no caller-controlled page size. Django admin is not installed or routed. OpenAPI is generated offline, not served publicly.

The custom UUID user has canonical email identity: strip surrounding whitespace and lowercase the entire address. PostgreSQL enforces nonempty canonical values and uniqueness. Django's manager hashes passwords with Argon2. The initial model's `is_staff`, `is_superuser`, groups and Django permissions exist for framework/break-glass compatibility, not marketplace authorization.

Session infrastructure uses database sessions, HttpOnly cookies, SameSite=Lax, an eight-hour maximum cookie age, and CSRF middleware. Production cookies are Secure. The readable CSRF cookie will support the future same-origin X-CSRFToken header; it is not an authentication token. No authentication endpoints exist yet, so session lifecycle and abuse-control guarantees must be completed and tested in Phase 1. In particular, DRF does not enforce anonymous login CSRF automatically.

Production settings require a strong external secret, explicit hostnames and explicit HTTPS CSRF origins. Missing/placeholder secrets, wildcard origins, and HTTP origins fail startup. DEBUG is false, HTTPS redirects are enabled, HSTS is one year with subdomains (without preload), and secure cookie flags cannot be disabled by environment toggles. There is no proxy-header trust by default. Local development alone enables DEBUG and HTTP cookies; HSTS remains off locally.

Both stacks send nosniff, DENY frame, and same-origin referrer headers. Web disables the framework-identifying header and denies camera/microphone/geolocation. A nonce-based Content-Security-Policy must be designed with the frontend shell and audited in Phase 12; no permissive production CSP is installed as a substitute. HTTPS edge headers and safe proxy configuration are deployment requirements, not evidence that this development foundation is launch-ready.

Compose binds PostgreSQL and Redis only to loopback, requires generated credentials, and uses persistent named volumes. Redis requires authentication. PostgreSQL uses SCRAM host authentication. The local database bootstrap role is privileged for migrations/test database creation; production must separate migration and runtime roles. Containers and local `.env` are development infrastructure, not a production secret-management solution.

## Invariants for later phases

- Django is the security boundary. Frontend role checks and hidden navigation never authorize operations.
- Enforce authentication, active seller membership, required capability, tenant scoping, and related-object ownership independently on every sensitive backend operation.
- Deny cross-tenant enumeration and resource inference. Decide 403 versus tenant-scoped 404 intentionally and test it.
- Never use application superuser privileges as an implicit seller API override. Administrative operations use distinct `/api/v1/admin/*` routes and serializers.
- Never store browser auth tokens in localStorage/sessionStorage. Login rotates sessions; logout invalidates them; password changes need an explicit session policy.
- Validate explicit serializer fields, related IDs, content types, pagination bounds and allowed sort/filter keys. Restrict body/upload sizes at both ingress and application layers.
- Uploads use generated object names, MIME/extension allowlists, size limits, private non-executable storage, authorization for downloads, and a future malware-scanning boundary.
- Use immutable money snapshots and append-oriented accounting/audit ledgers. Corrections append compensating entries. Inventory/order/payment transitions require transactions, locks and idempotency where needed.
- Never log or return passwords, password hashes, session/CSRF cookies, authorization headers, secrets, private keys, full bank information, or sensitive uploaded contents. Do not log request bodies by default. Production error monitoring must redact them.
- Never commit credentials. Generate development secrets locally and inject production values through an external secret manager. Lockfiles belong in Git; `.env`, media, databases and artifacts do not.

Future dedicated hardening, upload scanning, login rate limits, audit retention, dependency scanning, and race-condition reviews remain explicit roadmap work. Their absence does not authorize bypasses when earlier sensitive features are built.
