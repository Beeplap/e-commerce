# Project progress

## Completed

- Phase 0: monorepo, Next.js App Router/Tailwind and Django/DRF foundations, initial UUID/email user migration boundary, PostgreSQL/Redis development infrastructure, generated local environment, strict tooling, liveness endpoints and offline OpenAPI.
- Phase 1: server-side Django session authentication, explicit CSRF-protected browser login/logout, current-user and password-change APIs, brute-force lockout, immutable security events, application platform roles/capabilities, bootstrap management commands, and a real Next.js proxy smoke test.
- Architecture, security, authorization, data-model, stack, testing, deployment and progress guidance are maintained alongside the implementation.

## Current phase

Phase 1 implementation, validation and documentation are complete locally. Its commit and push are the remaining release gate; Phase 2 must not begin until that push succeeds.

## Phase 1 validation results

- `pnpm check`: passed after implementation. PostgreSQL backend suite: **55 passed**; frontend suite: **3 passed**. Ruff format/lint, strict mypy (36 source files), Django checks, migration drift, OpenAPI validation, Prettier, ESLint, TypeScript and Next.js production build passed.
- `pnpm smoke:auth`: passed against the actual Next.js proxy, verifying anonymous login CSRF rejection, cookie attributes and rotation, password change, logout invalidation and replay rejection.
- Compose configuration validation passed using the Ubuntu WSL Docker daemon.
- `pnpm audit --prod`: no known vulnerabilities reported. django-axes 8.3.1 was verified and documented for login throttling.
- CI now provisions PostgreSQL/Redis and runs the proxy smoke after the full check suite.

## Known issues

- The Phase 1 final smoke and validation must pass before commit/push. GitHub CI must pass before Phase 2 starts.
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

Phase 2: seller onboarding, seller records, membership and seller-scoped access foundations, as defined in `instructions.md`.
