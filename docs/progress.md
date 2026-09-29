# Project progress

## Completed

- Phase 0 implementation: monorepo, Next.js App Router/Tailwind foundation, Django/DRF foundation, initial UUID/email user migration boundary, PostgreSQL/Redis development infrastructure, generated local environment, strict tooling, minimal health endpoints, and offline OpenAPI.
- Architecture, security, authorization, data-model, stack, testing and deployment guidance recorded.

## In progress

- No Phase 0 implementation remains. Phase 1 is queued for the next execution run under the updated sequential continuation policy.

## Next phase

Phase 1: secure identity workflows, Django session login/logout/current user/password changes, explicit login CSRF, brute-force controls, security events and application platform roles/capabilities. No Phase 1 workflows are implemented yet. Per the user's updated policy, `CURRENT_PHASE.md` starts the next run at Phase 1; subsequent phases advance sequentially after validation, documentation, commit and successful push.

## Phase 0 validation results (2026-09-29)

- `pnpm check`: passed. Ruff formatting/lint, strict mypy (19 source files), Django system checks, migration drift check, validated OpenAPI, Prettier, ESLint, TypeScript, Vitest and Next.js production build all passed.
- PostgreSQL pytest: **24 passed**. Frontend Vitest: **3 passed**.
- `pnpm install --frozen-lockfile` and `python -m uv sync --project apps/api --locked`: passed.
- Initial PostgreSQL migration: passed. Compose configuration validation and both service health checks: passed.
- Live HTTP smoke checks: Django health, proxied API health, web health and home page passed; unsafe health POST requests returned 405.
- Production HTTP smoke checks: home and health passed, the identifying header was absent, and `/api/v1/health` returned 404 as expected without a production ingress (development rewrite disabled).
- `pnpm audit --prod`: no known vulnerabilities reported. This is not the comprehensive Phase 12 security audit.
- Redis rejected unauthenticated commands. Local `.env`, virtualenv and build output are ignored by Git.
- Production deployment checks return only the deliberate `security.W021` HSTS preload advisory; tests fail on any additional warning.
- GitHub Actions repeated locked installation, Compose startup/migrations and the complete validation suite on Linux: [successful Phase 0 run](https://github.com/Beeplap/e-commerce/actions/runs/36590505157) for implementation commit `1014506`.

## Known issues

- No failing Phase 0 checks remain; both local Windows validation and GitHub-hosted Linux CI passed.
- Docker was installed in the available Ubuntu WSL distribution. This environment needs a foreground Compose session to keep WSL and localhost forwarding alive; Docker Desktop or a normal persistent Linux daemon does not need that workaround.

## Technical debt

- CSP implementation, dependency-aware readiness, production containers/ingress, worker/storage integrations and business UI remain assigned to their roadmap phases.
- No marketplace metrics, business endpoints or fake infrastructure are introduced.
- ESLint 9.39.5 is deprecated upstream but is the latest patch compatible with the current Next.js React/import/accessibility plugin peer ranges. Upgrade to ESLint 10 when those plugins support it; strict peer validation remains enabled.

## Security considerations

- Fail-closed API defaults and production configuration; local secrets are generated and ignored by Git.
- Custom user precedes all migrations. Application roles remain separate from Django break-glass superuser semantics.
- PostgreSQL is required for database tests. Local bootstrap privileges must not become production runtime privileges.
