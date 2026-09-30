# Data model

## Present schema

`accounts.User` is the custom swappable user in migration `0001_initial` before any domain foreign keys or sessions are used. It contains UUID `id`, unique canonical `email`, first/last name, active/staff/email-verification flags, created/updated timestamps, and Django's password, last-login and PermissionsMixin compatibility fields. No username field exists. The manager strips and lowercases email; PostgreSQL's check constraint rejects noncanonical or empty raw writes and unique email rejects duplicates. Login, password/session workflows and platform access now use this identity. Future relations must target `settings.AUTH_USER_MODEL`.

`platform_access.PlatformRole`, `PlatformPermission`, `PlatformRolePermission`, and `PlatformAccess` implement application platform capabilities. The migrations seed `SUPER_ADMIN` with `platform.access` and `platform.sellers.read`; they add no permission to Django groups or `is_superuser`. User grants are one-to-one and immediately revocable. Role name has no authorization effect without the linked capability.

`accounts.SecurityEvent` stores append-only security action snapshots with UUID actor/subject IDs, keyed digest of unknown submitted identities, optional direct client IP and creation time. It deliberately has no account foreign key, so deleting an account cannot mutate a historical event. A PostgreSQL trigger rejects event updates/deletes, including bulk writes. Raw unknown login addresses, passwords and session/CSRF material are not stored in these events. django-axes keeps canonical attempted account identifiers and IP addresses in its separate lockout table; treat that as restricted security telemetry and define retention before production.

Django's content-types, auth compatibility and database-session tables are migrated normally. Use `settings.AUTH_USER_MODEL` in future relations; never hardcode the built-in auth.User. UTC is the storage/default application timezone; seller/display timezones become explicit domain settings later.

`sellers.Seller` has UUID identity, unique public slug, legal/display names, contact details, lifecycle and verification states, default currency/timezone, timestamps and paired optional approval actor/time. PostgreSQL checks valid states, a three-letter uppercase currency format and paired approval metadata. Complete onboarding input validation, supported currencies, timezone validation and explicit state transitions belong to Phase 4.

`SellerMembership` links one user to one seller and one role, with invited/active/suspended status, inviter, join time and creation time. The seller/user pair is unique; active membership requires a join time. Seller/user identity is immutable after insertion. Roles have UUID identities and either system scope (seller NULL) or custom scope (one seller, non-system, non-owner). Role names are unique in their scope; only one system owner-role identity exists. `SellerPermission` codes and `SellerRolePermission` links define capabilities; names do not imply permissions. PostgreSQL triggers reject membership roles belonging to another seller and changing role ownership/system/owner identity. This cross-table invariant cannot be implemented with a Django CHECK alone, which cannot reference another table.

## Required future relationships

- The implemented User -> SellerMembership -> Seller foundation extends to later seller-owned entities carrying explicit seller ownership.
- Product -> ProductVariant, with configurable attributes and explicit seller scope. Money uses Decimal, a documented scale/rounding policy and currency; no floats.
- Warehouse + Variant -> Inventory, with uniqueness, reserved/on-hand checks and an attributable InventoryTransaction ledger.
- Order -> SellerOrder -> OrderItem. SellerOrder is the seller dashboard boundary. Item and financial descriptions/totals are historical snapshots, independent of mutable catalog/configuration.
- SellerLedgerEntry and payout/refund records are append-oriented; corrections create compensating entries. Commission configuration changes cannot rewrite history.
- Audit records are append-only through ordinary application code and contain safe attributable changes, not secrets.

UUIDs are public business identifiers; human order numbers are separate. Foreign keys, unique/check constraints, indexes, atomic transactions and appropriate row locks enforce integrity in PostgreSQL. Each future migration must include its matching negative and concurrency tests where relevant. SQLite is not a test substitute.

Phase 3 adds no database entities or migrations. The frontend runtime contracts mirror safe `CurrentUser`, seller summaries, membership/role capabilities and bounded pagination from OpenAPI. Seller selection and rendered permission hints are ephemeral browser memory, not persisted grants or an alternative identity store. Money components consume decimal strings without numeric coercion; dates carry explicit timezone/locale for deterministic display.
