# PostgreSQL Row-Level Security (RLS) Evaluation

This document provides a technical evaluation of PostgreSQL Row-Level Security (RLS) as a defense-in-depth mechanism for tenant-owned tables in the Quick Commerce platform, covering architectural benefits, operational complexity, asynchronous worker implications, administrative workflows, migration strategies, and a formal adoption decision.

---

## 1. Executive Summary & Adoption Decision

- **Recommendation**: **DO NOT ADOPT RLS AT THIS STAGE.**
- **Rationale**:
  1. The platform already implements defense-in-depth tenant isolation through **application service guards (`require_seller_access`)**, **centralized tenant selectors (`tenant_queryset`)**, and **PostgreSQL database integrity triggers** (`catalog_check_child_scope`, `check_order_item_tenant`, `check_seller_ledger_scope`, `check_payout_item_scope`, `check_shipment_seller_scope`, `check_return_seller_scope`, `check_refund_seller_scope`).
  2. Introducing RLS requires setting session-level or transaction-level configuration variables (e.g. `SET LOCAL app.current_seller_id = ...`) on every database connection checkout. In pooled connection architectures (e.g. PgBouncer in transaction pooling mode), session state leakage across reused connections presents a severe security and operational hazard.
  3. Administrative queries (Super Admin marketplace analytics, platform order oversight, fulfillment monitoring) and multi-seller checkout order splitting require bypass mechanisms that defeat the simplicity of uniform database-level isolation.
  4. Application-level tenant authorization remains 100% mandatory regardless of RLS presence.
  5. The risk of authorization inconsistency, connection pool corruption, and silent query filtering outweighs the marginal defense-in-depth benefit at the current architectural stage.

---

## 2. Benefits of Row-Level Security

If adopted, PostgreSQL RLS provides:

- **Engine-Level Defense-in-Depth**: If a developer inadvertently writes an unscoped query (e.g. omitting `.filter(seller=request_seller)` in a raw SQL query or custom ORM view), PostgreSQL's query engine automatically appends the RLS policy condition (`WHERE seller_id = current_setting('app.current_seller_id')::uuid`).
- **Protection Against Object Leaks in Bulk Operations**: Ensures that bulk updates (`.update()`) or bulk deletes (`.delete()`) cannot inadvertently touch foreign tenant records even if an application filter is incorrectly constructed.
- **Auditable Security Boundary at the Database Tier**: Security audits can inspect table policies directly in PostgreSQL system catalogs (`pg_policy`).

---

## 3. Operational Complexity & Connection Pooling Hazards

Implementing RLS correctly introduces severe operational friction:

### Connection Pooling (PgBouncer)

- Quick Commerce relies on pooled PostgreSQL connections.
- In **transaction pooling mode**, session-level variables set via `SET app.current_seller_id = '...'` persist across transactions if not meticulously cleared, leading to **connection contamination** where Request B for Seller B inherits Seller A's context.
- Mitigating this requires `SET LOCAL app.current_seller_id = '...'` inside an explicit transaction block on _every single request_ (including read-only GET requests).
- Read-only operations that previously ran autocommit would be forced into explicit transaction blocks, increasing database transaction ID (XID) consumption and locking overhead.

### Silent Query Truncation

- RLS does not raise an exception when accessing a foreign tenant's record; it **silently omits** the row from the result set.
- While this returns empty sets for `SELECT`, it can mask application bugs where code assumes an object exists and proceeds down unintended logical branches.

---

## 4. Asynchronous Workers & Celery Implications

- Background tasks running under Celery or cron schedulers execute outside of HTTP request cycles.
- Workers processing multi-tenant batch jobs (e.g., nightly payout generation, catalog search index rebuilding, inventory low-stock alerts) frequently need to iterate across multiple sellers in a single worker process.
- Under RLS, a worker would have to continually execute `SET LOCAL app.current_seller_id` per loop iteration, or run as a superuser/bypass role (`BYPASSRLS`).
- Running workers with `BYPASSRLS` completely eliminates RLS protection for asynchronous operations, creating an illusion of database security that does not exist in background workflows.

---

## 5. Platform Administration & Cross-Tenant Workflows

- Platform Super Admins require legitimate cross-tenant visibility:
  - Super Admin Dashboard (`/admin/analytics/dashboard`): Aggregates GMV, commission revenues, active sellers, and returns across all sellers simultaneously.
  - Multi-Seller Checkout (`/orders`): A single customer order may split into multiple `SellerOrder` records across distinct sellers. Creating or viewing parent orders spans multiple tenants.
  - Platform Product Moderation: Reviewing products submitted by all sellers.
- Implementing RLS requires either:
  1. A `BYPASSRLS` database role for platform admin requests (requiring dual database connection pools and connection routing logic).
  2. Complex conditional RLS policies checking role permissions (e.g., `WHERE seller_id = current_setting(...) OR current_setting('app.is_platform_admin') = 'true'`), which degrades query planner performance and increases policy complexity.

---

## 6. Migration Strategy (If Adopted in Future)

If RLS is deemed necessary in a future enterprise compliance phase:

1. **Prerequisite**: Establish dual database connection pools (Tenant Pool with RLS enabled; Admin/System Pool with `BYPASSRLS`).
2. **Phase 1: Session Setting Middleware**: Implement Django database connection checkout wrapper setting `app.current_seller_id` inside `SET LOCAL` for all tenant requests.
3. **Phase 2: Permissive Logging Mode**: Enable RLS in `PERMISSIVE` mode with audit logging to detect queries that would be blocked.
4. **Phase 3: Table-by-Table Rollout**: Enable `FORCE ROW LEVEL SECURITY` starting with lower-risk tables (`inventory_warehouse`, `catalog_product`) before critical financial tables (`finance_sellerledgerentry`, `finance_payout`).
5. **Phase 4: Verification**: Full regression test suite verifying both tenant isolation and administrative cross-tenant queries.

---

## 7. Conclusion

The Quick Commerce architecture maintains strict, verifiable tenant isolation through:

- Centralized `tenant_queryset` query filtering in all seller views.
- Robust mutation lock order and atomic service transactions.
- PostgreSQL database triggers enforcing cross-tenant foreign key immutability.
- Automated adversarial test suites verifying cross-tenant isolation on every build.

PostgreSQL RLS is deferred as unnecessary and operationally hazardous for the current platform requirements.
