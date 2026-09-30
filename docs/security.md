# Security model

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

Membership discovery uses fixed pages of 25, allowlists only `page`, rejects duplicate/invalid query arguments and caps the page number. All currently implemented seller endpoints are read-only; unsafe methods still enforce CSRF and cannot assign membership, change roles, approve sellers or modify profiles. Onboarding and staff operations are deferred to their authorized phases.

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

Future work includes MFA and recovery with a real email provider, login risk monitoring beyond threshold lockouts, generalized audit and retention, upload scanning, dedicated CSP/production hardening, and tenant/RLS review. Implement only in the authorized phase.
