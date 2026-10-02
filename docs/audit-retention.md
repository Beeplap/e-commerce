# Audit Retention & Operational Resilience Strategy

## 1. Regulatory Context & Compliance Standards

Quick Commerce operates a multi-tenant marketplace handling monetary transactions, seller identity verification, customer orders, and sensitive authentication lifecycles. Legal and regulatory standards govern how long different categories of audit and business records must be preserved:

- **Financial & Tax Records (IRS, HMRC, VAT, SOX)**: Financial transaction records, settlement ledgers, and commission calculations must be preserved for a minimum of **7 years**.
- **Customer Contracts & Dispute Records (Commercial Law)**: Order snapshots, return authorizations, and dispute logs must be preserved for **6 years** past contract fulfillment.
- **Security & Access Events (PCI-DSS, SOC 2, ISO 27001)**: Authentication attempts, privilege escalations, and security event logs must be retained for at least **1 year** in accessible storage, and **3 years** in cold archival.
- **Data Privacy & Right to Erasure (GDPR, CCPA)**: Audit logs must never store raw unhashed PII (e.g. raw passwords, session cookies, unhashed plain emails). Where user deletion requests occur, financial audit records are anonymized rather than deleted, preserving historical balance reconciliation while stripping identifiable personal metadata.

---

## 2. Authoritative Append-Only Records in PostgreSQL

The database architecture employs strict PostgreSQL database triggers preventing mutation (`UPDATE`) or destruction (`DELETE`) across all audit entities:

1. **`AuditLog` (`audit_logs`)**: Records administrative actions across sellers, products, and configurations. Protected by trigger `audit_protect_mutation`.
2. **`SecurityEvent` (`security_events`)**: Records logins, logouts, lockouts, and capability grants. Uses salted HMAC email digests rather than raw emails. Protected by trigger `accounts_protect_security_event_mutation`.
3. **`SellerStatusHistory` (`seller_status_history`)**: Records seller lifecycle transitions (`PENDING`, `ACTIVE`, `SUSPENDED`, `REJECTED`, `CLOSED`). Protected by trigger `sellers_reject_history_mutation`.
4. **`SellerLedgerEntry` (`seller_ledger_entries`)**: Double-entry financial journal for order settlements, commissions, fees, refunds, and payouts. Immutable once written.
5. **`OrderStatusHistory` (`order_status_history`)**: State machine transitions for customer and seller orders.
6. **`OutboxEvent` (`events_outbox`)**: Domain event publication log. Protected by `protect_events_outbox_mutation` and `protect_events_outbox_deletion`.

---

## 3. Tiered Storage & Archival Architecture

To maintain sub-millisecond query performance on live PostgreSQL tables while meeting long-term compliance retention requirements, Quick Commerce utilizes a three-tiered lifecycle:

```
┌─────────────────────────────────────────────────────────────┐
│ Tier 1: Hot Operational Storage (PostgreSQL)                │
│ Active indexes, row-level locking, live API queries.        │
│ Retention: 0 - 12 months                                    │
└──────────────────────────────┬──────────────────────────────┘
                               │ Daily / Monthly Partition Sweep
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Tier 2: Warm Queryable Storage (PostgreSQL Partitions)      │
│ Declarative range partitioning on `created_at`.             │
│ Compression enabled, read-only tablespace.                  │
│ Retention: 12 - 24 months                                   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Scheduled Archival Export
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Tier 3: Cold Compliance Storage (Encrypted S3 / WORM)        │
│ Compressed Parquet / JSONL exports signed with SHA-256.     │
│ Object Lock / Compliance Mode (immutability enforced by S3).│
│ Retention: 7 - 10 years                                     │
└─────────────────────────────────────────────────────────────┘
```

### Tier 1: Hot Operational Storage

- Stored directly in authoritative PostgreSQL on NVMe SSD storage.
- Immediate query access for seller dashboards, platform dispute resolution, and audit logs.
- Strict bounded pagination limits (maximum 100 rows per query).

### Tier 2: Warm Queryable Partitions

- Large tables (`audit_logs`, `events_outbox`, `seller_ledger_entries`) utilize PostgreSQL declarative range partitioning based on `created_at`:
  ```sql
  CREATE TABLE audit_logs_y2026m10 PARTITION OF audit_logs
      FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
  ```
- Partitions older than 12 months have indexes compacted or dropped if operational lookups are no longer required.

### Tier 3: Cold Archival

- Monthly Celery archival task queries closed partitions.
- Dumps data to compressed columnar Parquet files or compressed JSON Lines (`.jsonl.gz`).
- Uploads to private S3-compatible cold storage configured with **AWS S3 Object Lock in Compliance Mode** (write-once, read-many, cannot be deleted by root or AWS accounts until retention period expires).
- Generates SHA-256 cryptographic manifests for tamper-evidence verification.

---

## 4. Retention Schedule by Record Type

| Record Type                 | Hot Storage (PostgreSQL) | Warm Storage (Partitions) | Cold Storage (WORM Archive) | Total Retention | Action at Expiry          |
| :-------------------------- | :----------------------- | :------------------------ | :-------------------------- | :-------------- | :------------------------ |
| **SellerLedgerEntry**       | 24 months                | 36 months                 | 7 years                     | **7 years min** | Legal Review before purge |
| **Payout & PayoutItem**     | 24 months                | 36 months                 | 7 years                     | **7 years min** | Legal Review before purge |
| **OrderStatusHistory**      | 12 months                | 24 months                 | 5 years                     | **6 years**     | Archival purge            |
| **AuditLog**                | 12 months                | 24 months                 | 5 years                     | **6 years**     | Archival purge            |
| **SecurityEvent**           | 12 months                | 24 months                 | 3 years                     | **3 years**     | Automated purge           |
| **OutboxEvent (Processed)** | 30 days                  | 60 days                   | N/A                         | **90 days**     | Truncate / Partition drop |
| **NotificationDelivery**    | 14 days                  | 30 days                   | N/A                         | **44 days**     | Automated purge           |

---

## 5. Security & Redaction Safeguards

1. **Credential & Secret Stripping**:
   - `password`, `token`, `secret`, `authorization`, `sessionid`, and `csrftoken` are scrubbed before logging via `redact_secrets()` in `config.logging`.
   - Error traces captured by `capture_exception()` in `config.monitoring` redact authorization headers and request body passwords.
2. **IP Address Trust Boundary**:
   - Client IP addresses are derived strictly from `REMOTE_ADDR` (`apps.accounts.security.client_ip`). Untrusted proxy headers (`X-Forwarded-For`) are rejected without an authenticated ingress contract.
3. **Cryptographic Digests**:
   - Unknown login attempts record salted SHA-256 digests rather than raw email strings, preventing unauthorized enumeration or credential stuffing leakage in database dumps.
