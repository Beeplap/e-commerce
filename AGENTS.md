# Repository engineering rules

These rules apply to the entire repository. Read `instructions.md`, `CURRENT_PHASE.md`, and relevant docs before changing code.

- Start at `CURRENT_PHASE.md` and implement one phase at a time. Future phases are architectural context until their turn. After each phase passes its required validation, update progress/architecture docs and the phase selector, commit and push to GitHub, then continue automatically. A failed validation or push blocks advancement. After Phase 16, mark the roadmap complete; do not invent phases. Respect later user pause/scope instructions.
- Inspect existing work first. Preserve correct code, keep changes coherent, and never weaken tests or security controls to obtain a passing check.
- Use a modular Django monolith and feature-oriented Next.js App Router frontend. Do not introduce microservices, Kafka, Kubernetes, multiple databases, or broad event sourcing without a demonstrated later requirement.
- Keep business workflows in explicit services, complex reads in selectors, and request validation in explicit serializers. Avoid fat views, serializers, model saves, and signal chains.
- Django is the authentication and authorization authority. Browser guards provide UX only. Default API permission is `DenyAll`; every new view must choose its policy deliberately.
- Preserve the initial `accounts.User` UUID/email model and migration. Email is trimmed and lowercased in full; the database rejects noncanonical/empty and duplicate values. Do not migrate to Django's built-in user or use username login.
- Browser authentication must use server-side Django sessions, HttpOnly cookies, Secure cookies and HTTPS in production, SameSite, CSRF on every unsafe browser operation, session rotation on login, and invalidation on logout. Never store credentials/tokens in localStorage or sessionStorage.
- DRF session authentication alone does not protect anonymous login requests from CSRF. Phase 1 must explicitly enforce CSRF on login and test the real development proxy.
- Django `is_superuser` is infrastructure break-glass only. Application platform administrators use explicit roles/capabilities; platform access must not implicitly bypass seller API isolation.
- Seller is the tenant. Access comes through SellerMembership, never `User.seller_id` or `is_seller`. Validate active membership and capabilities on each operation and context change.
- Scope reads, writes, and related-object resolution to the authorized seller centrally. Never fetch an unscoped browser-supplied ID in seller services. Test cross-tenant read, enumeration, mutation, and foreign-key attacks for every seller feature.
- Use UUID public identifiers for business entities, explicit API fields, bounded pagination, allowlisted filtering/ordering and content types. Do not expose model fields automatically or permit mass assignment of system fields.
- PostgreSQL is authoritative, including in tests. Use foreign keys, constraints, indexes, transactions, and row locks for critical invariants and concurrent workflows. Never substitute SQLite to get tests to pass.
- Use Decimal for money and snapshot prices, currency, discounts, taxes, commissions, and totals at the event. Historical financial records are append-oriented; corrections create compensating entries.
- Inventory requires an attributable transaction ledger, not a stock field alone. Orders split into Order and SellerOrder; sellers see only their portion. State transitions require explicit backend actions.
- Security/business-sensitive operations must eventually write append-only audit records. Never log passwords, hashes, session/CSRF cookies, authorization headers, bank details, or secret configuration.
- Generate local secrets with `pnpm setup:env`; never commit `.env`, credentials, keys, or tokens. Missing/placeholder production configuration must fail closed. Do not trust proxy headers without a controlled ingress.
- Uploads must use generated names, size/type allowlists, private storage outside executable paths, and later scanning. Access storage through a vendor-neutral S3-compatible boundary; no MinIO coupling.
- Celery is deferred until an authorized async workflow needs it. Enqueue after commit, with retry/idempotency policy; evaluate an outbox when critical delivery requires it.
- Verify official stable/support status before adding dependencies; explain choices in `docs/stack.md`, pin direct versions, and update lockfiles. Prefer framework capabilities; defer TanStack, form libraries, storage and worker dependencies until used.
- Run `pnpm check` against PostgreSQL. Validate Compose with `docker compose --env-file .env -f infra/compose.yaml config --quiet`; never print expanded secrets. Add meaningful positive and negative tests in each phase.
- Keep `docs/architecture.md`, `security.md`, `authorization.md`, `data-model.md`, `testing.md`, `deployment.md`, `stack.md`, and `progress.md` accurate. Record persistent decisions here or in those docs.
- Phase 0 exposes only `GET /api/v1/health` and web `/health`; these are liveness, not readiness. OpenAPI is generated offline; Django admin and auth/business APIs are not enabled yet.
