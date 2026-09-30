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
