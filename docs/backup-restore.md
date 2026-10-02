# Backup and disaster recovery guide

## 1. Disaster recovery objectives

The quick-commerce marketplace enforces strict continuity targets for business data, financial records, and operational assets:

- **Recovery Point Objective (RPO)**: **<= 5 minutes**
  - Maximum acceptable data loss in the event of catastrophic infrastructure failure.
  - Achieved via continuous PostgreSQL Write-Ahead Log (WAL) streaming and object storage versioning.
- **Recovery Time Objective (RTO)**: **<= 1 hour**
  - Maximum acceptable downtime to restore full transaction processing and customer availability.
  - Achieved via automated infrastructure-as-code provisioning and tested restore scripts.

---

## 2. PostgreSQL backup architecture

```
Primary PostgreSQL DB
        │
        ├────────────────────────┬────────────────────────┐
        ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Continuous WAL   │    │ Daily Full Dump  │    │ Snapshot Backups │
│ Streaming (PITR) │    │ (pg_dump, AES)   │    │ (EBS / Volume)   │
└────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                     ┌───────────────────────┐
                     │ Secure Backup Bucket  │
                     │ (KMS Encrypted, WORM) │
                     └──────────┬────────────┘
                                │ Cross-Region Replication
                                ▼
                     ┌───────────────────────┐
                     │ Secondary Region S3   │
                     │ (Disaster Safe Tier)  │
                     └───────────────────────┘
```

### 1. Continuous Write-Ahead Log (WAL) archiving (Point-in-Time Recovery)

- PostgreSQL streaming replication archives every transaction log segment to an off-site S3-compatible bucket as soon as it is committed.
- Enables granular Point-in-Time Recovery (PITR) to any specific timestamp within the last 14 days.
- Tools: Cloud-managed automated PITR (AWS RDS / GCP Cloud SQL) or `pgBackRest` / `WAL-G` for self-hosted clusters.

### 2. Daily full logical backups (`pg_dump`)

- Executed every 24 hours during low-traffic maintenance windows (02:00 UTC).
- Uses custom compressed directory format with parallel dumping:
  ```bash
  pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    --format=custom --compress=9 --no-owner --no-privileges \
    -f "/backup/quick_commerce_$(date +%Y%m%d_%H%M%S).dump"
  ```
- Backups are encrypted immediately with GPG/AES-256 before transport to off-site storage.

---

## 3. Object storage backup & versioning

Verification evidence (identity documents, business registrations) and seller assets are stored in S3-compatible private buckets:

1. **Bucket Versioning**: Enabled permanently on all production buckets. Overwrites or deletions append a new version rather than replacing data.
2. **Object Lock / WORM compliance**: Verification documents submitted for seller onboarding are protected under compliance mode retention policies (rejecting deletion even by root account credentials for 7 years).
3. **Cross-Region Replication (CRR)**: All objects written to the primary storage bucket are asynchronously replicated to a secondary geographical region within 15 minutes.
4. **Lifecycle Tiering**:
   - Days 1–90: S3 Standard
   - Days 91–365: S3 Infrequent Access (Standard-IA)
   - Year 2–7: S3 Glacier Flexible / Deep Archive

---

## 4. Encryption standards

- **Encryption at rest**:
  - All database volumes, WAL archives, logical dumps, and object storage buckets are encrypted using AES-256 with Customer-Managed Keys (CMK) via cloud KMS / Vault.
  - Encryption keys are rotated automatically every 365 days.
- **Encryption in transit**:
  - All database traffic requires TLS 1.3 with SCRAM-SHA-256 authentication.
  - S3 object storage transfers require HTTPS with TLS 1.3; unencrypted HTTP requests are rejected by bucket policy.

---

## 5. Retention policy schedule

| Backup Artifact            | Retention Period | Storage Location          | Immutability / Compliance  |
| :------------------------- | :--------------- | :------------------------ | :------------------------- |
| **Continuous WAL Logs**    | 14 Days          | Primary + Replicated S3   | High-frequency PITR        |
| **Daily Full Dumps**       | 30 Days          | Primary + Replicated S3   | Daily logical rollbacks    |
| **Weekly Snapshots**       | 12 Weeks         | Replicated S3 Standard-IA | Weekly milestones          |
| **Monthly Archives**       | 7 Years          | S3 Glacier Flexible       | Tax & statutory compliance |
| **Financial / Audit Logs** | 7 Years          | S3 Glacier Deep Archive   | WORM Object Lock           |

---

## 6. Step-by-step restoration procedures

### Scenario A: Point-in-Time Recovery (PITR) to a specific timestamp

Use this procedure if data corruption, human error, or bad migration occurred at a known time (e.g. `2026-10-02 14:32:00 UTC`):

1. Stop application traffic to prevent inconsistent writes:
   ```bash
   docker compose --env-file .env.prod -f infra/compose.prod.yaml stop api celery_worker celery_beat
   ```
2. Provision a clean PostgreSQL instance with the base backup preceding the target incident.
3. Configure `recovery.signal` and `postgresql.conf`:
   ```ini
   restore_command = 'wal-g wal-fetch "%f" "%p"'
   recovery_target_time = '2026-10-02 14:31:00 UTC'
   recovery_target_action = 'promote'
   ```
4. Start PostgreSQL to replay WAL segments up to the exact recovery target time.
5. Verify database integrity and row counts:
   ```sql
   SELECT count(*) FROM orders_order;
   SELECT count(*) FROM finance_sellerledgerentry;
   ```
6. Update application connection credentials to point to the restored database and restart API containers.

---

### Scenario B: Restoring from a daily logical dump (`pg_restore`)

Use this procedure to restore to a fresh database from a daily `.dump` file:

1. Create a fresh target database:
   ```sql
   DROP DATABASE IF EXISTS quick_commerce_restore;
   CREATE DATABASE quick_commerce_restore;
   ```
2. Restore schema, tables, triggers, and data in parallel:
   ```bash
   pg_restore -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d quick_commerce_restore \
     --clean --if-exists --no-owner --no-privileges \
     --jobs=4 "/backup/quick_commerce_20261002_020000.dump"
   ```
3. Run Django database verification check:
   ```bash
   python manage.py check --database default
   ```
4. Verify append-only triggers and constraints are active:
   ```sql
   SELECT tgname, tgenabled FROM pg_trigger WHERE tgname LIKE '%mutation%' OR tgname LIKE '%history%';
   ```

---

### Scenario C: Recovering corrupted or deleted S3 verification files

Because S3 Bucket Versioning is permanently active:

1. List object versions for the target key:
   ```bash
   aws s3api list-object-versions --bucket "$STORAGE_VERIFICATION_BUCKET" --prefix "verification/$DOCUMENT_KEY"
   ```
2. If a delete marker was created, remove the delete marker to restore the previous version:
   ```bash
   aws s3api delete-object --bucket "$STORAGE_VERIFICATION_BUCKET" --key "verification/$DOCUMENT_KEY" --version-id "$DELETE_MARKER_VERSION_ID"
   ```
3. Verify that the file is once again retrievable through Django's private verification download API.

---

## 7. Disaster recovery verification & testing drills

### Automated daily backup verification

A scheduled CI/CD job runs every 24 hours to prove that backups are recoverable:

1. Downloads the latest daily logical backup from secondary storage.
2. Spins up an ephemeral PostgreSQL Docker container.
3. Restores the backup dump.
4. Executes a suite of integrity verification queries (validating foreign keys, trigger definitions, and ledger balances).
5. Destroys the ephemeral container and logs verification success to monitoring.

### Quarterly live DR simulation drill

Every quarter, the engineering team executes a scheduled disaster recovery simulation drill:

- **Scenario**: Simulated complete loss of the primary data center.
- **Action**: Provision entire application stack in a secondary region using infrastructure automation and replicate data from secondary S3 storage.
- **Success Criteria**: Entire marketplace operational with RTO < 60 minutes and verified RPO < 5 minutes.
