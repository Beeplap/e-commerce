# Quick Commerce

A modular Django/Next.js foundation for multi-vendor seller and platform administration. The completed foundation and session-authentication phases provide development infrastructure, secure browser authentication, and capability-based platform access. Marketplace workflows follow `instructions.md` and the phase selected by `CURRENT_PHASE.md`.

## Prerequisites

- Node 24 LTS (24.15.0 or later in the 24 line), pnpm 11.1.1.
- Python 3.14 and uv 0.12.20 (`python -m pip install --user uv==0.12.20`).
- Docker Engine/Desktop with Compose v2.

## Local setup

Run from the repository root:

```sh
pnpm install --frozen-lockfile
python -m uv sync --project apps/api --locked
pnpm setup:env
pnpm infra:up
pnpm db:migrate
```

`setup:env` generates fresh local credentials in ignored `.env` and preserves existing configuration. `.env.example` contains safe placeholders only. PostgreSQL and Redis bind to loopback and persist through named volumes. Never commit `.env` or print expanded Compose configuration containing secrets.

Start the backend and frontend in separate terminals:

```sh
pnpm dev:api
pnpm dev:web
```

Visit `http://127.0.0.1:3000/login` to sign in, then choose a workspace at `/workspaces`. Seller and platform layouts are at `/seller` and `/admin`; `/account` shows the signed-in identity. Web liveness is `/health`; API liveness is `/api/v1/health` through the same origin, or directly at `http://127.0.0.1:8000/api/v1/health`. These endpoints report process liveness only. Browser auth endpoints are proxied on the same origin at `/api/v1/auth/*`; CSRF protection is required for every unsafe request.

To stop infrastructure without removing local data, run `pnpm infra:down`. Do not delete the volumes unless intentionally resetting the database.

On Windows with Docker Engine installed inside the Ubuntu WSL distribution instead of Docker Desktop, run Compose there. From the repository's PowerShell terminal:

```powershell
wsl -d Ubuntu -u root --cd /mnt/c/Users/beepl/dev/quick-commerce -- docker compose --env-file .env -f infra/compose.yaml up -d --wait
```

Adjust the path/distribution for another machine. Native Windows apps connect using WSL localhost forwarding. Docker commands require access to that daemon; the normal pnpm infrastructure commands assume Docker is on the current PATH. App commands remain the same.

If WSL shuts down when the command exits, run the same Compose command with `up` (without `-d --wait`) in a dedicated terminal to keep the distribution alive. Wait for both containers to become healthy before migrations/checks. The current machine required that foreground session during validation.

## Validation

```sh
pnpm check
```

This runs backend formatting/lint/types, Django/migration/OpenAPI checks, PostgreSQL tests, repository formatting, frontend lint/types/component tests, and production build. See `docs/testing.md` for individual checks and future test requirements. `docs/openapi.yaml` is the generated contract.

## Account and platform bootstrap

Create the first account with `python -m uv run --project apps/api --env-file .env python apps/api/manage.py create_account <email>`. It prompts for the password and confirmation without echoing them. Accounts receive no platform capabilities by default. The `grant_platform_access <email>` command is an explicit operator action for granting the seeded platform role and records an immutable security event. Django superuser status is reserved for infrastructure break-glass access and does not grant application platform capabilities.

For the proxied login, retrieve `/api/v1/auth/csrf`, then submit the returned CSRF cookie/header pair to `/api/v1/auth/login`. The browser session remains in an HttpOnly cookie. See `docs/security.md` and `docs/testing.md` for session, lockout and smoke-test details.

Discover your accessible sellers at `GET /api/v1/seller/memberships`, then send that seller's UUID as `X-Seller-ID` to `GET /api/v1/seller/access`. Each request independently validates current membership and capabilities. The seller ID is a context selector, not a credential. Staff management remains a later phase. Platform inspection uses explicit admin endpoints and capabilities.

Register a business from `/workspaces` → `/onboarding`. In `/seller/settings`, choose the new seller, add its registered address and upload a JPEG/PNG registration scan (up to 5 MiB / 12 megapixels). A separately authorized platform reviewer uses `/admin/sellers` to inspect documents, verify registration, and then approve the seller. Seller members cannot review or approve their own seller. Rejection/suspension require reasons, and status/audit history is retained. Local documents use ignored private storage; production requires S3-compatible configuration described in `docs/deployment.md`.

## Structure and security

- `apps/api`: Django settings, accounts, platform access, seller tenancy/RBAC, API endpoints, services and tests.
- `apps/web`: Next.js App Router/Tailwind, session-authentication and seller/admin shells, typed API client, accessible UI primitives and frontend tests.
- `infra`: authenticated PostgreSQL/Redis development Compose.
- `scripts`: local secret generation and cross-platform validation tasks.
- `docs`: architecture, security, authorization, schema, stack, testing, deployment and progress.

Django is the security authority. Sessions are server-side; APIs deny by default. Seller tenancy is membership-based as seller features are added. No browser auth tokens, business superuser shortcuts, or SQLite test fallback are permitted. Production settings fail closed and require HTTPS; this scaffold is not a production launch.

Read `AGENTS.md` before making changes. Consult `docs/progress.md` for completion status and pending work.
