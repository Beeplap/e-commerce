# Production deployment architecture

## Architecture overview

The quick-commerce production deployment topology follows a vendor-neutral, multi-tier defense-in-depth architecture. It does not assume any specific cloud provider and can run on any container runtime supporting OCI standards (e.g. Docker, Kubernetes, AWS ECS, Google Cloud Run).

```
Internet (HTTPS)
      │
      ▼
┌──────────────┐
│   CDN / WAF  │  Cloudflare, AWS CloudFront, Fastly
│ (TLS Term.)  │  DDoS protection, rate limiting, bot management
└──────┬───────┘
       │
       ▼
┌────────────────────────────────────────────────────────┐
│               Ingress / Reverse Proxy                  │  Nginx 1.27
│  (Single-origin routing, security headers, buffering)  │  infra/nginx/nginx.conf
└──────────┬─────────────────────────────┬───────────────┘
           │ /_next/*, /*                │ /api/*
           ▼                             ▼
┌───────────────────────┐   ┌────────────────────────────┐
│   Next.js Frontend    │   │      Django API Monolith   │  Gunicorn 26.2
│ (Node 24 LTS, UID 10001)   │ (Python 3.14, UID 10001)   │  apps/api/Dockerfile
│   apps/web/Dockerfile │   └────────────┬───────────────┘
└───────────────────────┘                │
        ▲ (Internal frontend_net)        │ (Internal backend_net)
        └────────────────────────────────┤
                                         ├─────────────────────────┐
                                         ▼                         ▼
                              ┌───────────────────────┐ ┌──────────────────────┐
                              │  PostgreSQL 18.6 DB   │ │   Redis 8.2 Broker   │
                              │ (SCRAM-SHA-256, Scoped│ │(AOF, Auth required,  │
                              │  triggers, constraints)│ │ Celery queue/cache)  │
                              └───────────────────────┘ └──────────┬───────────┘
                                                                   │
                                                                   ▼
                                                        ┌──────────────────────┐
                                                        │ Celery Workers & Beat│
                                                        │ (Outbox, Webhooks,   │
                                                        │  Reconciliation)     │
                                                        └──────────────────────┘
```

## Network security & isolation

Production uses two isolated Docker bridge networks defined in `infra/compose.prod.yaml`:

1. `frontend_net`: External-facing network. Connects `ingress`, `web`, and `api`.
2. `backend_net`: Internal-only network (`internal: true`). Connects `api`, `celery_worker`, `celery_beat`, `postgres`, and `redis`.
   - `postgres` and `redis` have **no host port bindings** and **zero internet gateway access**.
   - `web` cannot access `backend_net` or communicate directly with `postgres` or `redis`.
   - Only `api` and Celery worker services bridge both networks.
   - External internet traffic can enter only through the `ingress` container on port 80/443.

## Single-origin routing & reverse proxy

The production reverse proxy (`infra/nginx/nginx.conf`) unifies frontend and backend under a single HTTPS origin, eliminating the need for CORS:

- `location /api/`: Proxies to Django API upstream (`http://api:8000/api/`).
  - Strict cache prevention: `Cache-Control "no-store, no-cache, must-revalidate"`.
  - Header preservation: `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`.
  - Payload size cap: `client_max_body_size 6M` (protects file upload limits).
- `location /_next/static/`: Proxies to Next.js frontend with immutable caching: `Cache-Control "public, max-age=31536000, immutable"`.
- `location /`: Proxies all other requests to Next.js frontend (`http://web:3000/`).

### Global security headers

The ingress enforces HTTP security headers on all responses:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: same-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `server_tokens off` (strips web server version disclosures)

## Containerization & non-root security

All application containers adhere to strict container security standards:

### API container (`apps/api/Dockerfile`)

- **Base image**: `python:3.14-slim-bookworm` (minimal, pinned, official Debian Bookworm base).
- **Multi-stage build**:
  - `builder` stage: installs locked dependencies with `uv` (`uv sync --frozen --no-dev`) and compiles bytecode.
  - `runner` stage: copies only the virtual environment and application source code.
- **Non-root execution**: runs under unprivileged system user `appuser` (UID 10001, GID 10001) without shell access (`/sbin/nologin`).
- **WSGI server**: Gunicorn 26.2.0 with synchronous/threaded worker model (`--workers 4 --threads 2 --timeout 60`).
- **Health check**: Built-in Python `urllib` probe testing `/api/v1/health` every 15s.

### Frontend container (`apps/web/Dockerfile`)

- **Base image**: `node:24-bookworm-slim` (official Node 24 LTS Bookworm base).
- **Multi-stage build**:
  - `deps` stage: installs locked dependencies with `pnpm install --frozen-lockfile`.
  - `builder` stage: builds Next.js with `output: "standalone"` via Turbopack.
  - `runner` stage: copies only the standalone output, `.next/static`, and `public` directory.
- **Non-root execution**: runs under unprivileged system user `nextjs` (UID 10001, GID 10001).
- **Standalone execution**: runs directly via `node apps/web/server.js` without entire `node_modules` overhead.
- **Health check**: Built-in Node HTTP probe testing `/health` every 15s.

### Celery workers & beat

- Reuses the hardened `quick-commerce-api` image with specialized commands:
  - Worker: `celery -A config worker --loglevel=INFO --concurrency=4`
  - Beat: `celery -A config beat --loglevel=INFO`

## Secret management & configuration

Production configuration must never be committed to git. Secrets must be injected at container runtime using an external secret manager:

- **Cloud secret providers**: AWS Secrets Manager / Parameter Store, Google Secret Manager, HashiCorp Vault, or Doppler.
- **Required production variables**:
  - `DJANGO_SECRET_KEY`: Minimum 50 cryptographically random characters (generated via `secrets.token_urlsafe(64)`).
  - `DJANGO_ALLOWED_HOSTS`: Explicit domain names (e.g. `example.com,api.example.com`).
  - `DJANGO_CSRF_TRUSTED_ORIGINS`: Explicit HTTPS origins (e.g. `https://example.com`).
  - `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`: Production database credentials.
  - `REDIS_PASSWORD`: Strong authentication secret for Redis broker.
  - `PAYMENT_WEBHOOK_SECRET`: High-entropy secret for HMAC-SHA256 signature verification (minimum 32 characters, fail-closed on startup).
  - `STORAGE_ENDPOINT_URL`, `STORAGE_VERIFICATION_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`: Private S3-compatible credentials.
  - `SENTRY_DSN`: Error monitoring endpoint.

## Continuous Integration & release gates (`.github/workflows/checks.yaml`)

Every pull request and merge to `main` must pass all CI gates:

1. **Dependency & security audit**: `pnpm audit --prod` ensuring zero known production vulnerabilities.
2. **Infrastructure validation**: `docker compose config --quiet` validating both `infra/compose.yaml` (dev) and `infra/compose.prod.yaml` (prod).
3. **Backend quality**:
   - Ruff linting and formatting check
   - Mypy strict type checking across all 148 source files
   - Django system check (`manage.py check --deploy`)
   - Migration drift check (`manage.py makemigrations --check --dry-run`)
   - OpenAPI schema validation (`manage.py spectacular --validate --fail-on-warn`)
   - 336 PostgreSQL backend tests
4. **Frontend quality**:
   - Prettier formatting check
   - ESLint with `--max-warnings 0`
   - TypeScript `tsc --noEmit` check
   - 110 Vitest frontend tests
   - Next.js production build (`next build` with standalone output across 44 routes)
5. **Real development proxy smoke test**: Verifies live CSRF acquisition, session authentication, cookie rotation, and logout through Next.js proxy.
6. **Container build & non-root verification**: Builds both API and Web Dockerfiles and verifies unprivileged non-root users (`appuser`, `nextjs`).
