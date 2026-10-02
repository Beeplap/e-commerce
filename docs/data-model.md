# Data model

## Present schema

`accounts.User` is the custom swappable user in migration `0001_initial` before any domain foreign keys or sessions are used. It contains UUID `id`, unique canonical `email`, first/last name, active/staff/email-verification flags, created/updated timestamps, and Django's password, last-login and PermissionsMixin compatibility fields. No username field exists. The manager strips and lowercases email; PostgreSQL's check constraint rejects noncanonical or empty raw writes and unique email rejects duplicates. Login, password/session workflows and platform access now use this identity. Future relations must target `settings.AUTH_USER_MODEL`.

`platform_access.PlatformRole`, `PlatformPermission`, `PlatformRolePermission`, and `PlatformAccess` implement application platform capabilities. The migrations seed `SUPER_ADMIN` with `platform.access` and `platform.sellers.read`; they add no permission to Django groups or `is_superuser`. User grants are one-to-one and immediately revocable. Role name has no authorization effect without the linked capability.

`accounts.SecurityEvent` stores append-only security action snapshots with UUID actor/subject IDs, keyed digest of unknown submitted identities, optional direct client IP and creation time. It deliberately has no account foreign key, so deleting an account cannot mutate a historical event. A PostgreSQL trigger rejects event updates/deletes, including bulk writes. Raw unknown login addresses, passwords and session/CSRF material are not stored in these events. django-axes keeps canonical attempted account identifiers and IP addresses in its separate lockout table; treat that as restricted security telemetry and define retention before production.

Django's content-types, auth compatibility and database-session tables are migrated normally. Use `settings.AUTH_USER_MODEL` in future relations; never hardcode the built-in auth.User. UTC is the storage/default application timezone; seller/display timezones become explicit domain settings later.

`sellers.Seller` has UUID identity, unique public slug, legal/display names, contact details, lifecycle and verification states, default currency/timezone, timestamps and paired optional approval actor/time. PostgreSQL checks valid states, a three-letter uppercase currency format and paired approval metadata. Phase 4 validates IANA timezones and explicitly supports NPR, USD, INR, EUR and GBP at onboarding; currency stays fixed thereafter. Status changes use explicit services.

Phase 4 adds one-to-one `SellerProfile` (description/HTTPS website) and `SellerSettings` (support email), plus seller-owned `SellerAddress` (unique registered/returns kind, ISO-style two-uppercase-letter country format). Existing sellers are backfilled with empty profiles/settings by migration. New sellers must use the onboarding service; no model signal creates related records.

`SellerDocument` stores document type, generated private storage key, bounded byte size, MIME, SHA-256 of canonical bytes, submitting actor UUID, expiry and review state/actor/time/rejection reason. Raw document numbers are deliberately omitted to minimize duplicated sensitive identity data. One pending document per seller/type is enforced in PostgreSQL. State/actor/time/reason, type, MIME and size have database constraints. Submitted content identity cannot change or be deleted; completed reviews are immutable. Corrected documents are new submissions.

`SellerStatusHistory` records actor UUID, seller, old/new status, reason and timestamp. `AuditLog` stores UUID snapshots for actor, seller and target, action, safe changes, direct peer IP and timestamp. History and audit UPDATE/DELETE are rejected by SQL triggers, including bulk ORM calls. Profile/settings/address/document tenant identity is immutable in PostgreSQL. Approval records retain their original approval actor/time across suspension/reactivation.

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

## Phase 5 catalog schema

`catalog` introduces platform-managed taxonomies and seller-owned product hierarchies:

- `Category`: hierarchical categories with optional `parent` foreign key, unique `slug`, `sort_order`, `description`, and `is_active`. Cycles are forbidden and inactive ancestors block product association.
- `Brand`: platform-managed brands with unique `slug`, `name`, and `is_active`.
- `Attribute`: dynamic configurable attributes with unique `code`, `value_type` (`text`, `number`, `choice`, `boolean`), and `scope` (`product` or `variant`).
- `AttributeOption`: predefined choices for `choice` attributes with `attribute`, `label`, `value`, and `is_active`.
- `CategoryAttribute`: links categories to attributes with an `is_required` flag.
- `Product`: seller-owned product with `seller`, `category`, optional `brand`, `name`, unique `slug`, `description`, `short_description`, `status` (`draft`, `pending_review`, `active`, `rejected`, `archived`), `currency` (inherited from seller default currency and immutable), `created_by`, and paired optional `approved_by` / `approved_at`.
- `ProductVariant`: SKU-bearing sellable variant with `product`, `sku`, `barcode`, `price`, optional `compare_at_price`, `cost_price`, dimensions (`length`, `width`, `height`, `weight`), and `status` (`active`, `inactive`). Money fields use `DecimalField(max_digits=14, decimal_places=2)`. Dimensions use `DecimalField(max_digits=12, decimal_places=3)`.
- `ProductAttributeValue` and `VariantAttributeValue`: values for configured category attributes. Enforces scope matching: product attributes cannot be attached to variants; variant attributes cannot be attached to products. Choice attributes validate option foreign keys.
- `ProductImage`: private product images with `product`, `storage_key`, `content_type` (`image/png`, `image/jpeg`), `size`, `alt_text`, and `sort_order`. Uses named Django `catalog` storage.
- `ProductStatusHistory`: immutable append-only audit trail recording `product`, `actor_id`, `from_status`, `to_status`, `reason`, and timestamp.

PostgreSQL migration `0002_catalog_integrity` enforces:

- Nonnegative constraints for prices, compare_at, cost, weight, and dimensions.
- Compare-at price must be greater than or equal to price.
- Cross-tenant and child integrity triggers: products and variants cannot be reassigned to another seller; variant attribute values, product attribute values, and images cannot link across foreign seller boundaries.
- Attribute values must adhere to assigned category attributes and attribute option relationships.
- Self-approval impossible trigger: seller members cannot approve products of their own seller, even if possessing platform moderation capabilities.
- Append-only immutability trigger on `ProductStatusHistory`.

## Phase 6 inventory schema

`inventory` implements seller-owned warehouses and an attributable inventory transaction ledger:

- `Warehouse`: seller-scoped warehouse entity with `seller`, `code` (uppercase alphanumeric with hyphens/underscores, immutable after creation), `name`, `address_line1`, `address_line2`, `city`, `state`, `postal_code`, `country` (2-letter ISO uppercase code), and `is_active`. Unique constraint on `(seller, code)`.
- `Inventory`: unique stock entry per `(warehouse, variant)` pairing. Tracks integer quantities: `quantity_on_hand`, `quantity_reserved`, and `reorder_level`. Exposes computed property `available_quantity` (`quantity_on_hand - quantity_reserved`). Check constraints enforce `quantity_on_hand >= 0`, `quantity_reserved >= 0`, `quantity_reserved <= quantity_on_hand`, and `reorder_level >= 0`.
- `InventoryTransaction`: immutable append-only ledger tracking all stock movements. Types: `purchase`, `sale`, `return`, `adjustment`, `reservation`, `release`. Records `inventory`, `warehouse`, `variant`, `actor_id` UUID, `quantity_delta` integer, `quantity_on_hand_after` nonnegative integer, `quantity_reserved_after` nonnegative integer, optional `reference_type` and `reference_id` UUID, and optional `notes`.

PostgreSQL migration `0002_inventory_integrity` enforces:

- Warehouse immutable identity: SQL trigger rejects changes to `seller_id` or `code` on `Warehouse`.
- Inventory immutable identity: SQL trigger rejects changes to `warehouse_id` or `variant_id` on `Inventory`.
- Cross-tenant validation: SQL triggers verify that `ProductVariant.product.seller_id` matches `Warehouse.seller_id` before creating or updating `Inventory` or `InventoryTransaction`.
- Append-only immutability trigger on `InventoryTransaction`: SQL trigger rejects all UPDATE and DELETE operations on `inventory_inventorytransaction`.

## Phase 7 orders schema

`orders` implements the multi-seller marketplace order architecture and secure state machines:

- `Order`: Parent customer order recording customer email/ID, unique `order_number`, currency, financial totals (`subtotal`, `discount_total`, `tax_total`, `shipping_total`, `grand_total`), immutable `billing_address_snapshot` and `shipping_address_snapshot`, `payment_status` (`pending`, `authorized`, `paid`, `failed`, `refunded`), and `fulfillment_status` (`unfulfilled`, `partially_fulfilled`, `fulfilled`, `cancelled`).
- `SellerOrder`: Tenant-isolated sub-order partitioned per seller. Links to parent `order` and `seller`, with unique `seller_order_number`, financial breakdowns (`subtotal`, `discount_total`, `tax_total`, `shipping_total`, `commission_total`, `seller_net_total`), optional shipping details (`carrier`, `tracking_number`, `shipped_at`, `delivered_at`, `cancelled_at`, `cancellation_reason`), and order `status` (`pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`).
- `OrderItem`: Line items associated with a `SellerOrder`. Captures immutable product and pricing snapshots independent of mutable catalog entities: `product_id`, `variant_id`, `warehouse_id`, `product_name_snapshot`, `sku_snapshot`, `variant_snapshot` JSON, positive integer `quantity`, and Decimal financial snapshots (`unit_price`, `discount_amount`, `tax_amount`, `total`, `commission_amount`, `seller_net_amount`).
- `OrderStatusHistory`: Append-only transition audit ledger for `SellerOrder`. Records `seller_order`, optional `actor_id` UUID, `from_status`, `to_status`, `notes`, and timestamp.

PostgreSQL migration `0002_orders_integrity` enforces:

- Nonnegative financial constraints on all monetary amounts for `Order`, `SellerOrder`, and `OrderItem`.
- Check constraints enforcing `quantity >= 1` on `OrderItem`.
- Immutability trigger on `OrderStatusHistory`: Rejects all UPDATE and DELETE operations.
- Immutability trigger on `OrderItem`: Rejects UPDATE and DELETE operations once committed.
- SellerOrder immutable identity trigger: Rejects modifications to `seller_id` or `order_id`.
- Cross-tenant validation trigger: Verifies that `product.seller_id`, `variant.product.seller_id`, and `warehouse.seller_id` match the `SellerOrder.seller_id` before inserting any `OrderItem`. Rejecting foreign products, variants, or warehouses.
