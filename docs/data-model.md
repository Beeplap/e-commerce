# Data model

## Present schema

`accounts.User` is the custom swappable user in migration `0001_initial` before any domain foreign keys or sessions are used. It contains UUID `id`, unique canonical `email`, first/last name, active/staff/email-verification flags, created/updated timestamps, and Django's password, last-login and PermissionsMixin compatibility fields. No username field exists. The manager strips and lowercases email; PostgreSQL's check constraint rejects noncanonical or empty raw writes and unique email rejects duplicates. Application identity workflows and platform role models are Phase 1.

Django's content-types, auth compatibility and database-session tables are migrated normally. Use `settings.AUTH_USER_MODEL` in future relations; never hardcode the built-in auth.User. UTC is the storage/default application timezone; seller/display timezones become explicit domain settings later.

## Required future relationships

- User -> SellerMembership -> Seller, with unique seller/user membership and separately managed role/capability links. Seller-owned entities carry explicit seller ownership.
- Product -> ProductVariant, with configurable attributes and explicit seller scope. Money uses Decimal, a documented scale/rounding policy and currency; no floats.
- Warehouse + Variant -> Inventory, with uniqueness, reserved/on-hand checks and an attributable InventoryTransaction ledger.
- Order -> SellerOrder -> OrderItem. SellerOrder is the seller dashboard boundary. Item and financial descriptions/totals are historical snapshots, independent of mutable catalog/configuration.
- SellerLedgerEntry and payout/refund records are append-oriented; corrections create compensating entries. Commission configuration changes cannot rewrite history.
- Audit records are append-only through ordinary application code and contain safe attributable changes, not secrets.

UUIDs are public business identifiers; human order numbers are separate. Foreign keys, unique/check constraints, indexes, atomic transactions and appropriate row locks enforce integrity in PostgreSQL. Each future migration must include its matching negative and concurrency tests where relevant. SQLite is not a test substitute.
