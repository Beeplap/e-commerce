# Production operations runbook

## 1. Service inventory & architecture

| Service           | Runtime / Technology                     | Internal Port | External Port      | Dependencies                        |
| :---------------- | :--------------------------------------- | :------------ | :----------------- | :---------------------------------- |
| **Ingress**       | Nginx 1.27 (Alpine)                      | 80, 443       | 80, 443            | `web`, `api`                        |
| **Frontend**      | Next.js 16.3 (Node 24 LTS)               | 3000          | None (via Ingress) | `api` (via browser proxy)           |
| **API**           | Django 5.2 / Gunicorn 26.2 (Python 3.14) | 8000          | None (via Ingress) | `postgres`, `redis`, Object Storage |
| **Celery Worker** | Celery 5.6 / Python 3.14                 | None          | None               | `postgres`, `redis`                 |
| **Celery Beat**   | Celery 5.6 / Python 3.14                 | None          | None               | `redis`                             |
| **PostgreSQL**    | PostgreSQL 18.6 Bookworm                 | 5432          | None (Internal)    | Storage volume                      |
| **Redis**         | Redis 8.2 Bookworm                       | 6379          | None (Internal)    | Storage volume                      |

---

## 2. Production deployment procedure

### Pre-deployment checklist

- [ ] CI pipeline passed on `main` branch (all 336 backend tests, 110 frontend tests, lints, types, builds, security audit).
- [ ] No unreviewed database migrations.
- [ ] Cloud secret manager has all required secrets populated.
- [ ] S3 storage buckets exist and have private policies attached.
- [ ] Recent backup verified within the last 24 hours.

### Standard deployment sequence

1. **Pull updated container images**:
   ```bash
   docker compose --env-file .env.prod -f infra/compose.prod.yaml pull
   ```
2. **Execute database migrations (Expand phase)**:
   Migrations must run before or concurrently with new code and must be strictly backwards-compatible:
   ```bash
   docker compose --env-file .env.prod -f infra/compose.prod.yaml run --rm api python manage.py migrate --noinput
   ```
3. **Deploy API backend & Celery workers (Rolling update)**:
   ```bash
   docker compose --env-file .env.prod -f infra/compose.prod.yaml up -d --no-deps api celery_worker celery_beat
   ```
4. **Verify backend readiness**:
   ```bash
   curl -f http://127.0.0.1/api/v1/health/ready
   ```
5. **Deploy Next.js frontend & reload Ingress**:
   ```bash
   docker compose --env-file .env.prod -f infra/compose.prod.yaml up -d --no-deps web
   docker compose --env-file .env.prod -f infra/compose.prod.yaml exec ingress nginx -s reload
   ```
6. **Post-deployment smoke verification**:
   - Check process liveness: `GET /health` and `GET /api/v1/health`
   - Check dependency readiness: `GET /api/v1/health/ready`
   - Test login flow with synthetic monitor account.

### Rollback procedure

If health check fails or error rate spikes post-deployment:

1. Revert container image tags to the previously tagged release in compose configuration.
2. Deploy previous containers:
   ```bash
   docker compose --env-file .env.prod -f infra/compose.prod.yaml up -d --no-deps api web celery_worker celery_beat
   docker compose --env-file .env.prod -f infra/compose.prod.yaml exec ingress nginx -s reload
   ```
3. Verify readiness probe returns HTTP 200.
4. If a backwards-compatible migration was applied, do NOT revert the migration unless strictly necessary, as older code is guaranteed to tolerate expand-phase columns.

---

## 3. Safe database migration procedure

### Core principles for zero-downtime migrations

In a high-availability quick-commerce marketplace, migrations must never lock tables or block live transactions. PostgreSQL default locks (`ACCESS EXCLUSIVE`) can stall active checkout and inventory reservations.

### The Expand / Contract pattern

Schema changes must occur in separate phases across distinct releases:

1. **Phase 1 (Expand)**: Add new nullable columns or tables. Old code and new code both run safely.
2. **Phase 2 (Migrate & Dual-Write)**: Application writes to both old and new columns. Asynchronous backfill reconciles historical data.
3. **Phase 3 (Contract)**: After all application pods run new code and data is verified, remove old columns or unused constraints.

### Safe vs dangerous migration patterns

| Operation               | Safety Status  | Safe Procedure                                                                                                                                                    |
| :---------------------- | :------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Add column**          | SAFE in PG 11+ | `ALTER TABLE tbl ADD COLUMN col ... DEFAULT val;` (metadata-only update in PG 11+).                                                                               |
| **Add NOT NULL column** | REQUIRES CARE  | 1. Add column as nullable. 2. Backfill existing rows. 3. Add `CHECK (col IS NOT NULL) NOT VALID;` then `VALIDATE CONSTRAINT`.                                     |
| **Add Index**           | DANGEROUS      | NEVER use standard `CREATE INDEX` on live tables. ALWAYS use `CREATE INDEX CONCURRENTLY` in non-atomic migrations (`atomic = False`).                             |
| **Add Foreign Key**     | DANGEROUS      | 1. `ADD CONSTRAINT fk FOREIGN KEY (...) REFERENCES ... NOT VALID;` (does not lock table). 2. `ALTER TABLE tbl VALIDATE CONSTRAINT fk;` (locks read-only briefly). |
| **Rename Column**       | FORBIDDEN      | NEVER rename a column in a single migration. Add the new column, dual-write in services, backfill, switch reads, drop old column.                                 |
| **Drop Column**         | MULTI-PHASE    | 1. Stop reading/writing in code. 2. Deploy code. 3. Drop column in a subsequent release.                                                                          |

---

## 4. Service health monitoring & alerting

### Health check endpoints

- **Liveness Probe**: `GET /api/v1/health` and `GET /health`
  - Purpose: Process alive verification for container orchestrator liveness probes.
  - SLA: Must return HTTP 200 within 50ms without querying database or cache.
- **Readiness Probe**: `GET /api/v1/health/ready`
  - Purpose: Assesses backend dependencies (PostgreSQL `SELECT 1` and Redis `client.ping()`).
  - Response format:
    ```json
    {
      "status": "ok",
      "timestamp": "2026-10-02T18:00:00Z",
      "checks": {
        "database": { "status": "ok", "latency_ms": 2.1 },
        "redis": { "status": "ok", "latency_ms": 0.8 }
      }
    }
    ```
  - SLA: Returns HTTP 200 when all dependencies respond; returns HTTP 503 `status: degraded` if any critical dependency fails. Caching disabled via `Cache-Control: no-cache, no-store`.

### Service Level Objectives (SLOs) & alert thresholds

| Metric                        | Target / SLO        | Warning Threshold     | Critical Alert Threshold |
| :---------------------------- | :------------------ | :-------------------- | :----------------------- |
| **API Availability**          | >= 99.9% uptime     | < 99.5% over 5m       | < 99.0% over 2m          |
| **API Latency (p95)**         | < 250ms             | > 400ms over 5m       | > 800ms over 2m          |
| **API Error Rate**            | < 0.1% 5xx errors   | > 1.0% over 5m        | > 5.0% over 1m           |
| **PostgreSQL Connections**    | < 70% pool limit    | > 75% connection pool | > 90% connection pool    |
| **Celery Queue Lag**          | < 100 items pending | > 500 items pending   | > 2000 items pending     |
| **Outbox Events Unprocessed** | 0 events > 5m old   | > 50 pending events   | > 200 pending events     |

---

## 5. Incident response runbooks

### Severity levels

- **P1 (Critical Outage)**: System completely inaccessible, orders/checkout blocked, or security compromise in progress. Immediate 24/7 on-call escalation.
- **P2 (Major Degradation)**: Core functionality degraded (e.g. payouts failing, inventory updates lagging, high latency). Response within 30 minutes.
- **P3 (Minor Issue)**: Non-critical feature impaired (e.g. report generation slow, analytics delayed). Response during business hours.
- **P4 (Informational)**: Minor UI glitch or non-blocking edge-case warning. Scheduled in regular backlog.

---

### Incident 1: Total service outage (HTTP 502 / 503 / connection refused)

**Symptoms**: All API requests fail; Ingress returns 502 Bad Gateway; readiness probe returns 503.

1. Check container health status:
   ```bash
   docker compose --env-file .env.prod -f infra/compose.prod.yaml ps
   ```
2. Inspect Ingress and API container logs for crash traces:
   ```bash
   docker compose --env-file .env.prod -f infra/compose.prod.yaml logs --tail=100 ingress api
   ```
3. If API containers are restarting in a crash loop, check database connectivity:
   ```bash
   docker compose --env-file .env.prod -f infra/compose.prod.yaml exec postgres pg_isready -U quick_commerce_user
   ```
4. Restart stalled containers cleanly:
   ```bash
   docker compose --env-file .env.prod -f infra/compose.prod.yaml restart api web ingress
   ```

---

### Incident 2: Database connection pool exhaustion

**Symptoms**: API responses return 500 with `OperationalError: remaining connection slots are reserved for non-replication superuser connections`.

1. Inspect active PostgreSQL connections and locks:
   ```sql
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
   FROM pg_stat_activity
   WHERE (now() - pg_stat_activity.query_start) > interval '10 seconds'
   ORDER BY duration DESC;
   ```
2. Terminate rogue long-running queries holding locks:
   ```sql
   SELECT pg_cancel_backend(pid);   -- Graceful cancel
   SELECT pg_terminate_backend(pid); -- Force kill if unresponsive
   ```
3. Restart API workers to flush stale connections:
   ```bash
   docker compose --env-file .env.prod -f infra/compose.prod.yaml restart api
   ```

---

### Incident 3: Celery queue backlog / task stagnation

**Symptoms**: Outbox events accumulating in `PENDING` status; webhook delivery alerts firing.

1. Check Celery worker process status:
   ```bash
   docker compose --env-file .env.prod -f infra/compose.prod.yaml logs --tail=100 celery_worker
   ```
2. Inspect Redis queue length:
   ```bash
   docker compose --env-file .env.prod -f infra/compose.prod.yaml exec redis redis-cli -a "$REDIS_PASSWORD" llen celery
   ```
3. Trigger outbox reconciliation manually via Django management command:
   ```bash
   docker compose --env-file .env.prod -f infra/compose.prod.yaml run --rm api python -c "
   import django; django.setup()
   from apps.events.services import process_pending_outbox_batch
   processed = process_pending_outbox_batch(limit=200)
   print(f'Manually processed {processed} outbox events')
   "
   ```
4. Scale Celery worker concurrency if queue backlog is large:
   ```bash
   docker compose --env-file .env.prod -f infra/compose.prod.yaml up -d --scale celery_worker=3
   ```

---

### Incident 4: Secret credential compromise / emergency key rotation

**Symptoms**: Leaked API keys, compromised admin token, or suspected credential breach.

1. **Rotate Django Secret Key (`DJANGO_SECRET_KEY`)**:
   - Invalidate all existing browser sessions immediately.
   - Generate a new random secret:
     ```bash
     python -c "import secrets; print(secrets.token_urlsafe(64))"
     ```
   - Update `DJANGO_SECRET_KEY` in external secret manager.
   - Restart API containers: `docker compose ... restart api celery_worker`.
2. **Rotate Database Password (`POSTGRES_PASSWORD`)**:
   - Update role password in PostgreSQL: `ALTER USER quick_commerce_user WITH PASSWORD 'new_password';`
   - Update secret manager and restart API services.
3. **Audit security events**:
   - Query `accounts_securityevent` to inspect all suspicious login or token activity.

---

## 6. Emergency break-glass access

### Creating a break-glass platform Super Admin

In catastrophic scenarios where access credentials are lost or locked out:

1. Access the database host console directly.
2. Run the secure bootstrap command inside an isolated container:
   ```bash
   docker compose --env-file .env.prod -f infra/compose.prod.yaml run --rm api \
     python manage.py bootstrap_superadmin \
     --email emergency-admin@marketplace.internal \
     --password "$EMERGENCY_ONE_TIME_PASSWORD"
   ```
3. This creates the Super Admin user, assigns the `SUPER_ADMIN` role with all platform capabilities, and logs an immutable `SecurityEvent` audit record.
4. Perform required remediation.
5. Invalidate the emergency account once normal operations are restored.
