# Project progress

## Completed

- Phase 0: monorepo, Next.js App Router/Tailwind and Django/DRF foundations, initial UUID/email user migration boundary, PostgreSQL/Redis development infrastructure, generated local environment, strict tooling, liveness endpoints and offline OpenAPI.
- Phase 1: server-side Django session authentication, explicit CSRF-protected browser login/logout, current-user and password-change APIs, brute-force lockout, immutable security events, application platform roles/capabilities, bootstrap management commands, and a real Next.js proxy smoke test.
- Phase 2: seller tenancy and UUID memberships, seven system seller roles, explicit capabilities and owner-delegation protection, per-request seller context, scoped selectors and service guards, read-only seller-access/platform-inspection endpoints, PostgreSQL cross-tenant/identity constraints and adversarial authorization tests.
- Architecture, security, authorization, data-model, stack, testing, deployment and progress guidance are maintained alongside the implementation.

## Current phase

Phase 1 was committed as `56c1d72` and pushed; [its GitHub validation passed](https://github.com/Beeplap/e-commerce/actions/runs/36666039048). Phase 2 implementation, documentation and all local validation are complete. Its commit/push and GitHub validation gate remain before beginning Phase 3.

## Phase 1 validation results

- `pnpm check`: passed after implementation. PostgreSQL backend suite: **55 passed**; frontend suite: **3 passed**. Ruff format/lint, strict mypy (36 source files), Django checks, migration drift, OpenAPI validation, Prettier, ESLint, TypeScript and Next.js production build passed.
- `pnpm smoke:auth`: passed against the actual Next.js proxy, verifying anonymous login CSRF rejection, cookie attributes and rotation, password change, logout invalidation and replay rejection.
- Compose configuration validation passed using the Ubuntu WSL Docker daemon.
- `pnpm audit --prod`: no known vulnerabilities reported. django-axes 8.3.1 was verified and documented for login throttling.
- CI now provisions PostgreSQL/Redis and runs the proxy smoke after the full check suite.

## Known issues

- No known local validation failures remain. Phase 2 GitHub validation is pending its push.
- Local Compose runs through the Ubuntu WSL daemon; a foreground Compose session may be needed to keep WSL and localhost forwarding alive.

## Technical debt

- Seller workflows, storefront/customer identity, CSP, production deployment, object storage and async jobs remain for their numbered phases.
- Login lockout currently tracks canonical attempted email and source IP using the trusted direct peer address. Operational retention and trusted-ingress design remain deployment concerns.
- ESLint 9.39.5 remains the latest patch compatible with the selected framework plugin peer ranges; revisit when those plugins support ESLint 10.

## Security considerations

- Django remains the authorization authority; unsafe browser operations enforce CSRF, sessions are server-side and login rotates the session.
- App-level platform capabilities are explicit and do not inherit Django `is_superuser` access or override seller isolation.
- Security events are append-only at the PostgreSQL boundary. Local credentials remain generated and ignored; PostgreSQL remains authoritative in tests.

## Next phase

After Phase 2's completion gate, Phase 3 covers the Next.js session-authentication shell, typed API client, seller/admin layouts, accessible UI primitives and frontend permission UX. Seller onboarding/lifecycle remains Phase 4.

## Phase 0 validation history

- `pnpm check`: passed; PostgreSQL **24 tests passed**, frontend **3 tests passed**, and lint/format/types/migration/schema/build checks passed.
- Compose, locked installation, liveness/production-routing smoke and production fail-closed checks passed. `pnpm audit --prod` reported no known vulnerabilities.
- [GitHub Linux validation passed](https://github.com/Beeplap/e-commerce/actions/runs/36590505157) for foundation commit `1014506`.

## Phase 2 validation results

- New PostgreSQL migrations applied successfully, including role seeds and integrity triggers.
- Strict mypy passed for 46 source files.
- Final `pnpm check`: passed. PostgreSQL backend suite: **122 passed**, including **67 seller-authorization cases**. Frontend suite: **3 passed**. Ruff formatting/lint, strict mypy, Django checks, migration drift, warning-free OpenAPI, Prettier, ESLint, TypeScript and Next.js production build passed.
- `pnpm smoke:auth`: passed through the actual Next.js development proxy after the shared browser-view validation changes.
- Compose configuration validation passed through the Ubuntu WSL Docker daemon. No dependencies were added in Phase 2.
- Schema enum collisions were fixed with explicit names derived from model choices; no warnings were suppressed and no test/security assertions were weakened.
