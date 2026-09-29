# Validation

Generate local `.env`, install locked dependencies, and start PostgreSQL/Redis first (README). From the repository root:

```sh
pnpm check
```

The cross-platform runner fails immediately on errors and runs backend Ruff formatting/lint, strict mypy with Django/DRF plugins, Django system checks, missing-migration checks, OpenAPI generation/validation, PostgreSQL pytest, repository Prettier, frontend ESLint, strict TypeScript, Vitest/Testing Library, and a Next.js production build. Schema generation refreshes `docs/openapi.yaml`; review and commit changes. CI checks for uncommitted schema drift.

Use `pnpm check:api`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` for individual portions. To format Python, run `python -m uv run --project apps/api ruff format apps/api scripts`; `pnpm format` formats supported repository files. The original roadmap/phase selector are excluded from automatic formatting to preserve user instructions.

Backend tests cover liveness, unsupported methods, unknown routes, invalid host handling, deny-by-default behavior (including authenticated users), WSGI/ASGI imports, production fail-closed settings and Django deployment checks, PostgreSQL email constraints and Argon2 hashing. Tests use the configured PostgreSQL server and a separate Django-created test database. The local bootstrap role can create test databases; never run this against production.

Production deployment checks intentionally return exactly `security.W021`: HSTS preload is not opted into before a real domain/ingress decision. The test asserts that exact advisory set, so any additional warning fails. An initial test incorrectly required zero warnings despite this documented policy; it was corrected rather than enabling preload merely to pass. No Django checks are silenced.

Frontend tests render the accessible foundation page, validate the health route, and ensure the development API rewrite is absent in test/production. A real development-server smoke test must also verify `/api/v1/health` through Next.js, web `/health`, and unsupported health methods. Phase 1 must extend real proxy tests to session cookies, Origin/Host behavior, anonymous login CSRF, rotation, and logout.

Validate infrastructure without printing expanded credentials:

```sh
docker compose --env-file .env -f infra/compose.yaml config --quiet
docker compose --env-file .env -f infra/compose.yaml ps
```

Every phase adds meaningful negative tests. Later suites must cover CSRF, abuse limits, authentication, RBAC, cross-tenant reads/writes/enumeration/foreign keys, mass assignment, uploads, state transitions, Decimal accounting, idempotency, and concurrent inventory/financial changes. Do not delete or relax correct assertions to make failures disappear.

Full business E2E/performance/race coverage belongs to Phase 13. Foundation CI is a validation gate, not the production deployment pipeline of Phase 15.
