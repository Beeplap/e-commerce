# Data model

## Present schema

`accounts.User` is the custom swappable user in migration `0001_initial` before any domain foreign keys or sessions are used. It contains UUID `id`, unique canonical `email`, first/last name, active/staff/email-verification flags, created/updated timestamps, and Django's password, last-login and PermissionsMixin compatibility fields. No username field exists. The manager strips and lowercases email; PostgreSQL's check constraint rejects noncanonical or empty raw writes and unique email rejects duplicates. Login, password/session workflows and platform access now use this identity. Future relations must target `settings.AUTH_USER_MODEL`.

`platform_access.PlatformRole`, `PlatformPermission`, `PlatformRolePermission`, and `PlatformAccess` implement application platform capabilities. The migration seeds only `SUPER_ADMIN` and `platform.access`; it adds no permission to Django groups or `is_superuser`. User grants are one-to-one and immediately revocable. Role name has no authorization effect without the linked capability.

`accounts.SecurityEvent` stores append-only security action snapshots with UUID actor/subject IDs, keyed digest of unknown submitted identities, optional direct client IP and creation time. It deliberately has no account foreign key, so deleting an account cannot mutate a historical event. A PostgreSQL trigger rejects event updates/deletes, including bulk writes. Raw unknown login addresses, passwords and session/CSRF material are not stored in these events. django-axes keeps canonical attempted account identifiers and IP addresses in its separate lockout table; treat that as restricted security telemetry and define retention before production.

Django's content-types, auth compatibility and database-session tables are migrated normally. Use `settings.AUTH_USER_MODEL` in future relations; never hardcode the built-in auth.User. UTC is the storage/default application timezone; seller/display timezones become explicit domain settings later.

## Required future relationships

- User -> SellerMembership -> Seller, with unique seller/user membership and separately managed role/capability links. Seller-owned entities carry explicit seller ownership.
- Product -> ProductVariant, with configurable attributes and explicit seller scope. Money uses Decimal, a documented scale/rounding policy and currency; no floats.
- Warehouse + Variant -> Inventory, with uniqueness, reserved/on-hand checks and an attributable InventoryTransaction ledger.
- Order -> SellerOrder -> OrderItem. SellerOrder is the seller dashboard boundary. Item and financial descriptions/totals are historical snapshots, independent of mutable catalog/configuration.
- SellerLedgerEntry and payout/refund records are append-oriented; corrections create compensating entries. Commission configuration changes cannot rewrite history.
- Audit records are append-only through ordinary application code and contain safe attributable changes, not secrets.

UUIDs are public business identifiers; human order numbers are separate. Foreign keys, unique/check constraints, indexes, atomic transactions and appropriate row locks enforce integrity in PostgreSQL. Each future migration must include its matching negative and concurrency tests where relevant. SQLite is not a test substitute.
