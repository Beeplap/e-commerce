# Quick Commerce

A modular Django/Next.js foundation for multi-vendor seller and platform administration. Phase 0 implements development infrastructure and engineering standards; authentication and marketplace workflows follow the roadmap in `instructions.md` and the authorization in `CURRENT_PHASE.md`.

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

Visit `http://127.0.0.1:3000`. Web liveness is `/health`; API liveness is `/api/v1/health` through the same origin, or directly at `http://127.0.0.1:8000/api/v1/health`. These endpoints report process liveness only. Use one hostname consistently for future cookie-based authentication.

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

## Structure and security

- `apps/api`: Django settings, minimal accounts migration foundation, API health and tests.
- `apps/web`: Next.js App Router, Tailwind, accessible landing page and health.
- `infra`: authenticated PostgreSQL/Redis development Compose.
- `scripts`: local secret generation and cross-platform validation tasks.
- `docs`: architecture, security, authorization, schema, stack, testing, deployment and progress.

Django is the security authority. Sessions are server-side; APIs deny by default. Seller tenancy will be membership-based. No browser auth tokens, business superuser shortcuts, or SQLite test fallback are permitted. Production settings fail closed and require HTTPS; this scaffold is not a production launch.

Read `AGENTS.md` before making changes. Consult `docs/progress.md` for completion status and pending work.
