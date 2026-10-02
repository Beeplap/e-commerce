# Security & Authorization Audit

This document provides a comprehensive security and authorization audit across all 71 Seller endpoints and 61 Admin endpoints implemented in the Quick Commerce platform.

---

## 1. Audit Methodology

Every endpoint was audited against seven mandatory security criteria:

1. **Authentication**: Enforces session authentication via `SessionAuthentication`; rejects unauthenticated requests with HTTP 401/403.
2. **Context & Seller Membership**: Seller endpoints require valid `X-Seller-ID` revalidated against PostgreSQL database on every request; caller must hold an active membership in the target seller.
3. **Required Capability**: Zero access by role string or `is_superuser`. The caller must possess the specific granular capability.
4. **Tenant Filtering**: Database queries filter strictly by `seller=request_seller` via `tenant_queryset` or explicit service filters.
5. **Object-Level Checks**: Verification that target entity belongs to the active tenant. Non-existent and cross-tenant lookups both return identical HTTP 404 to avoid enumeration.
6. **Protected Fields**: Read-only enforcement on system fields (`id`, `created_at`, `status`, `seller_id`, `is_owner`, `balance`, `commission_rate`).
7. **Negative Tests**: Verification that negative test cases exist covering unauthenticated access, wrong tenant, missing capability, and invalid payloads.

---

## 2. Seller Endpoints Audit (`/api/v1/seller/*`)

| Endpoint                                                   | HTTP Methods     | Required Capability              | Tenant Scoping           | Object Check                     | Protected Fields                        | Test Status |
| ---------------------------------------------------------- | ---------------- | -------------------------------- | ------------------------ | -------------------------------- | --------------------------------------- | ----------- |
| `/seller/memberships`                                      | GET              | Authenticated User               | User-scoped              | Self only                        | Read-only                               | Passed      |
| `/seller/access`                                           | GET              | `seller.context.read`            | `X-Seller-ID`            | Active member                    | Read-only                               | Passed      |
| `/seller/onboarding`                                       | POST             | Authenticated User               | Self -> Pending Seller   | Atomic owner creation            | Status, verification, fees immutable    | Passed      |
| `/seller/settings`                                         | GET, PATCH       | `seller.settings.read`, `update` | Scoped to seller         | Single settings row              | Legal name, currency immutable          | Passed      |
| `/seller/addresses`                                        | POST             | `seller.settings.update`         | Scoped to seller         | Verified address frozen          | Verification status immutable           | Passed      |
| `/seller/addresses/<id>`                                   | PATCH            | `seller.settings.update`         | Scoped to seller         | Object tenant match              | Verification status immutable           | Passed      |
| `/seller/documents`                                        | GET              | `seller.settings.read`           | Scoped to seller         | Tenant documents only            | Review status immutable                 | Passed      |
| `/seller/documents/upload`                                 | POST             | `seller.settings.update`         | Scoped to seller         | 5MB limit, JPEG/PNG              | File key, review status immutable       | Passed      |
| `/seller/documents/<id>/download`                          | GET              | `seller.settings.read`           | Scoped to seller         | Object tenant match              | Streamed attachment, no public URL      | Passed      |
| `/seller/catalog/<kind>`                                   | GET              | `catalog.product.read`           | Platform taxonomies      | Read-only taxonomies             | Read-only                               | Passed      |
| `/seller/products`                                         | GET, POST        | `catalog.product.read`, `create` | Scoped to seller         | Filtered by seller               | Seller, currency auto-assigned          | Passed      |
| `/seller/products/<id>`                                    | GET, PUT         | `catalog.product.read`, `update` | Scoped to seller         | Object tenant match              | Status, approval immutable              | Passed      |
| `/seller/products/<id>/submit-for-review`                  | POST             | `catalog.product.update`         | Scoped to seller         | Object tenant match              | Requires active variants                | Passed      |
| `/seller/products/<id>/revise`                             | POST             | `catalog.product.update`         | Scoped to seller         | Object tenant match              | Clears approval metadata                | Passed      |
| `/seller/products/<id>/archive`                            | POST             | `catalog.product.archive`        | Scoped to seller         | Object tenant match              | State transition only                   | Passed      |
| `/seller/products/<id>/variants`                           | GET, POST        | `catalog.product.read`, `update` | Scoped to product/seller | Trigger validates seller         | Price must be positive Decimal          | Passed      |
| `/seller/products/<id>/variants/<vid>`                     | GET, PUT, DELETE | `catalog.product.read`, `update` | Scoped to product/seller | Object tenant match              | SKU unique per seller                   | Passed      |
| `/seller/products/<id>/attributes`                         | GET, POST        | `catalog.product.read`, `update` | Scoped to product        | Object tenant match              | Attribute must belong to taxonomy       | Passed      |
| `/seller/products/<id>/attributes/<val_id>`                | DELETE           | `catalog.product.update`         | Scoped to product        | Object tenant match              | Scoped deletion                         | Passed      |
| `/seller/products/<id>/variants/<vid>/attributes`          | GET, POST        | `catalog.product.read`, `update` | Scoped to variant/seller | Object tenant match              | Scoped attachment                       | Passed      |
| `/seller/products/<id>/variants/<vid>/attributes/<val_id>` | DELETE           | `catalog.product.update`         | Scoped to variant/seller | Object tenant match              | Scoped deletion                         | Passed      |
| `/seller/products/<id>/images`                             | GET              | `catalog.product.read`           | Scoped to product/seller | Object tenant match              | Read-only                               | Passed      |
| `/seller/products/<id>/images/upload`                      | POST             | `catalog.product.update`         | Scoped to product/seller | 5MB, re-encoded JPEG/PNG         | Storage key auto-generated              | Passed      |
| `/seller/products/<id>/images/<img_id>`                    | DELETE           | `catalog.product.update`         | Scoped to product/seller | Object tenant match              | Deletes attachment & file               | Passed      |
| `/seller/products/<id>/images/<img_id>/download`           | GET              | `catalog.product.read`           | Scoped to product/seller | Object tenant match              | Streamed attachment                     | Passed      |
| `/seller/products/<id>/history`                            | GET              | `catalog.product.read`           | Scoped to product/seller | Object tenant match              | Read-only audit history                 | Passed      |
| `/seller/warehouses`                                       | GET, POST        | `inventory.adjust`               | Scoped to seller         | Filtered by seller               | Seller auto-assigned                    | Passed      |
| `/seller/warehouses/<id>`                                  | GET, PATCH       | `inventory.adjust`               | Scoped to seller         | Object tenant match              | Seller immutable                        | Passed      |
| `/seller/inventory`                                        | GET              | `inventory.adjust`               | Scoped to seller         | Warehouse tenant match           | Read-only                               | Passed      |
| `/seller/inventory/transactions`                           | GET              | `inventory.adjust`               | Scoped to seller         | Ledger entries append-only       | Read-only                               | Passed      |
| `/seller/inventory/<id>`                                   | GET              | `inventory.adjust`               | Scoped to seller         | Object tenant match              | Stock fields immutable                  | Passed      |
| `/seller/inventory/<id>/adjust`                            | POST             | `inventory.adjust`               | Scoped to seller         | Row locked (`select_for_update`) | Quantity verified >= 0                  | Passed      |
| `/seller/inventory/<id>/reserve`                           | POST             | `inventory.adjust`               | Scoped to seller         | Row locked                       | Reserved <= OnHand enforced             | Passed      |
| `/seller/inventory/<id>/release`                           | POST             | `inventory.adjust`               | Scoped to seller         | Row locked                       | Reserved >= 0 enforced                  | Passed      |
| `/seller/inventory/<id>/transactions`                      | GET              | `inventory.adjust`               | Scoped to seller         | Object tenant match              | Read-only                               | Passed      |
| `/seller/orders/`                                          | GET              | `orders.read`                    | Scoped to seller         | Filtered by seller               | Read-only                               | Passed      |
| `/seller/orders/<id>/`                                     | GET              | `orders.read`                    | Scoped to seller         | Object tenant match              | Read-only snapshots                     | Passed      |
| `/seller/orders/<id>/confirm/`                             | POST             | `orders.update`                  | Scoped to seller         | Object tenant match              | Status transition PENDING->CONFIRMED    | Passed      |
| `/seller/orders/<id>/begin-processing/`                    | POST             | `orders.update`                  | Scoped to seller         | Object tenant match              | Status transition CONFIRMED->PROCESSING | Passed      |
| `/seller/orders/<id>/ship/`                                | POST             | `orders.update`                  | Scoped to seller         | Object tenant match              | Status transition PROCESSING->SHIPPED   | Passed      |
| `/seller/orders/<id>/deliver/`                             | POST             | `orders.update`                  | Scoped to seller         | Object tenant match              | Status transition SHIPPED->DELIVERED    | Passed      |
| `/seller/orders/<id>/cancel/`                              | POST             | `orders.cancel`                  | Scoped to seller         | Object tenant match              | Releases inventory reservations         | Passed      |
| `/seller/finance/balance`                                  | GET              | `finance.read`                   | Scoped to seller         | Single balance record            | Read-only balance snapshots             | Passed      |
| `/seller/finance/transactions`                             | GET              | `finance.read`                   | Scoped to seller         | Ledger append-only               | Trigger blocks UPDATE/DELETE            | Passed      |
| `/seller/finance/payouts`                                  | GET, POST        | `payouts.read`, `request`        | Scoped to seller         | Row-locked balance check         | Requires available balance              | Passed      |
| `/seller/finance/payouts/<id>`                             | GET              | `payouts.read`                   | Scoped to seller         | Object tenant match              | Status immutable by seller              | Passed      |
| `/seller/fulfillment/shipments`                            | GET, POST        | `fulfillment.read`, `manage`     | Scoped to seller         | Verified order item match        | Trigger validates item tenant           | Passed      |
| `/seller/fulfillment/shipments/<id>`                       | GET              | `fulfillment.read`               | Scoped to seller         | Object tenant match              | Read-only                               | Passed      |
| `/seller/fulfillment/shipments/<id>/events`                | POST             | `fulfillment.manage`             | Scoped to seller         | Append-only tracking             | Trigger blocks UPDATE/DELETE            | Passed      |
| `/seller/fulfillment/shipments/<id>/deliver`               | POST             | `fulfillment.manage`             | Scoped to seller         | Object tenant match              | Completes shipment delivery             | Passed      |
| `/seller/fulfillment/returns`                              | GET              | `returns.read`                   | Scoped to seller         | Filtered by seller               | Read-only                               | Passed      |
| `/seller/fulfillment/returns/<id>`                         | GET              | `returns.read`                   | Scoped to seller         | Object tenant match              | Read-only                               | Passed      |
| `/seller/fulfillment/returns/<id>/approve`                 | POST             | `returns.manage`                 | Scoped to seller         | Object tenant match              | Requires REQUESTED status               | Passed      |
| `/seller/fulfillment/returns/<id>/reject`                  | POST             | `returns.manage`                 | Scoped to seller         | Object tenant match              | Reason mandatory                        | Passed      |
| `/seller/fulfillment/returns/<id>/receive`                 | POST             | `returns.manage`                 | Scoped to seller         | Restock creates ledger trans     | Atomic stock increment                  | Passed      |
| `/seller/fulfillment/refunds`                              | GET, POST        | `returns.read`, `manage`         | Scoped to seller         | Proportional commission reversed | Completed refund trigger locked         | Passed      |
| `/seller/fulfillment/refunds/<id>`                         | GET              | `returns.read`                   | Scoped to seller         | Object tenant match              | Read-only                               | Passed      |
| `/seller/promotions`                                       | GET, POST        | `promotions.read`, `manage`      | Scoped to seller         | Scope forced to SELLER           | Trigger checks target items             | Passed      |
| `/seller/promotions/<id>`                                  | GET, PATCH       | `promotions.read`, `manage`      | Scoped to seller         | Object tenant match              | Scope immutable                         | Passed      |
| `/seller/promotions/<id>/coupons`                          | POST             | `promotions.manage`              | Scoped to seller         | Promotion tenant match           | Unique coupon code per promo            | Passed      |
| `/seller/coupons`                                          | GET              | `promotions.read`                | Scoped to seller         | Filtered by seller promos        | Read-only                               | Passed      |
| `/seller/reviews`                                          | GET              | `reviews.read`                   | Scoped to seller         | Filtered by seller products      | Direct review deletion blocked          | Passed      |
| `/seller/reviews/<id>/respond`                             | POST             | `reviews.respond`                | Scoped to seller         | Trigger checks product seller    | Official seller response only           | Passed      |
| `/seller/staff`                                            | GET              | `seller.staff.read`              | Scoped to seller         | Filtered by seller               | Read-only                               | Passed      |
| `/seller/staff/invite`                                     | POST             | `seller.staff.manage`            | Scoped to seller         | Delegation guard enforced        | Cannot grant higher roles               | Passed      |
| `/seller/staff/<id>/role`                                  | PATCH            | `seller.staff.manage`            | Scoped to seller         | Last owner lock enforced         | Demotion of last owner blocked          | Passed      |
| `/seller/staff/<id>`                                       | DELETE           | `seller.staff.manage`            | Scoped to seller         | Last owner lock enforced         | Revocation of last owner blocked        | Passed      |
| `/seller/staff/roles`                                      | GET, POST        | `seller.staff.read`, `manage`    | Scoped to seller         | Custom roles tenant-scoped       | Trigger blocks foreign roles            | Passed      |
| `/seller/staff/roles/<id>`                                 | PATCH, DELETE    | `seller.staff.manage`            | Scoped to seller         | Cannot delete system roles       | Name & permissions only                 | Passed      |
| `/seller/staff/permissions`                                | GET              | `seller.staff.read`              | Scoped to seller         | Returns caller's grant subset    | Read-only                               | Passed      |
| `/seller/analytics/dashboard`                              | GET              | `seller.context.read`            | Scoped to seller         | Date range filtered              | Cancelled orders excluded               | Passed      |

---

## 3. Platform Admin Endpoints Audit (`/api/v1/admin/*`)

| Endpoint                                            | HTTP Methods     | Required Capability                  | Isolation Boundary        | Object-Level Verification         | Anti-Self-Approval     | Test Status |
| --------------------------------------------------- | ---------------- | ------------------------------------ | ------------------------- | --------------------------------- | ---------------------- | ----------- |
| `/admin/access`                                     | GET              | `platform.access`                    | User platform grant       | Self platform capabilities        | N/A                    | Passed      |
| `/admin/sellers/<id>/access`                        | GET              | `platform.sellers.read`              | Explicit admin route      | Unscoped inspection               | N/A                    | Passed      |
| `/admin/sellers`                                    | GET              | `platform.sellers.read`              | Bounded pagination        | Search allowlisted                | N/A                    | Passed      |
| `/admin/sellers/<id>`                               | GET              | `platform.sellers.read`              | Unscoped inspection       | Exposes verification status       | N/A                    | Passed      |
| `/admin/sellers/<id>/approve`                       | POST             | `platform.sellers.manage`            | State transition          | Verified registration required    | Actor member forbidden | Passed      |
| `/admin/sellers/<id>/reject`                        | POST             | `platform.sellers.manage`            | State transition          | Reason mandatory                  | Actor member forbidden | Passed      |
| `/admin/sellers/<id>/suspend`                       | POST             | `platform.sellers.manage`            | State transition          | Reason mandatory                  | Actor member forbidden | Passed      |
| `/admin/sellers/<id>/reactivate`                    | POST             | `platform.sellers.manage`            | State transition          | Verified address required         | Actor member forbidden | Passed      |
| `/admin/sellers/<id>/documents`                     | GET              | `platform.sellers.documents.read`    | Unscoped inspection       | Lists seller documents            | N/A                    | Passed      |
| `/admin/sellers/<id>/documents/<doc_id>/download`   | GET              | `platform.sellers.documents.read`    | Streamed attachment       | Download audited                  | N/A                    | Passed      |
| `/admin/sellers/<id>/documents/<doc_id>/approve`    | POST             | `platform.sellers.documents.review`  | State transition          | Audited document review           | Actor member forbidden | Passed      |
| `/admin/sellers/<id>/documents/<doc_id>/reject`     | POST             | `platform.sellers.documents.review`  | State transition          | Reason mandatory                  | Actor member forbidden | Passed      |
| `/admin/sellers/<id>/history`                       | GET              | `platform.sellers.read`              | Unscoped inspection       | Append-only status history        | N/A                    | Passed      |
| `/admin/sellers/<id>/audit`                         | GET              | `platform.sellers.audit.read`        | Explicit audit capability | Append-only business audit log    | N/A                    | Passed      |
| `/admin/sellers/<id>/members`                       | GET              | `platform.sellers.read`              | Unscoped inspection       | Lists active members              | N/A                    | Passed      |
| `/admin/catalog/<kind>`                             | GET, POST        | `platform.catalog.read`, `manage`    | Platform taxonomy         | Global taxonomy management        | N/A                    | Passed      |
| `/admin/catalog/<kind>/<id>`                        | GET, PUT, DELETE | `platform.catalog.read`, `manage`    | Platform taxonomy         | Object check                      | N/A                    | Passed      |
| `/admin/products`                                   | GET              | `platform.products.read`             | Unscoped inspection       | Filter by review status           | N/A                    | Passed      |
| `/admin/products/<id>`                              | GET              | `platform.products.read`             | Unscoped inspection       | Product details                   | N/A                    | Passed      |
| `/admin/products/<id>/approve`                      | POST             | `platform.products.moderate`         | State transition          | Requires PENDING_REVIEW           | Actor member forbidden | Passed      |
| `/admin/products/<id>/reject`                       | POST             | `platform.products.moderate`         | State transition          | Reason mandatory                  | Actor member forbidden | Passed      |
| `/admin/products/<id>/variants`                     | GET              | `platform.products.read`             | Unscoped inspection       | Product variants                  | N/A                    | Passed      |
| `/admin/products/<id>/images`                       | GET              | `platform.products.read`             | Unscoped inspection       | Product image metadata            | N/A                    | Passed      |
| `/admin/products/<id>/attributes`                   | GET              | `platform.products.read`             | Unscoped inspection       | Product attribute values          | N/A                    | Passed      |
| `/admin/products/<id>/history`                      | GET              | `platform.products.read`             | Unscoped inspection       | Product moderation history        | N/A                    | Passed      |
| `/admin/products/<id>/variants/<vid>/attributes`    | GET              | `platform.products.read`             | Unscoped inspection       | Variant attribute values          | N/A                    | Passed      |
| `/admin/products/<id>/images/<img_id>/download`     | GET              | `platform.products.read`             | Streamed attachment       | Download audited                  | N/A                    | Passed      |
| `/admin/inventory`                                  | GET              | `platform.inventory.read`            | Unscoped inspection       | Marketplace stock overview        | N/A                    | Passed      |
| `/admin/inventory/transactions`                     | GET              | `platform.inventory.read`            | Unscoped inspection       | Marketplace stock ledger          | N/A                    | Passed      |
| `/admin/inventory/<id>`                             | GET              | `platform.inventory.read`            | Unscoped inspection       | Specific inventory record         | N/A                    | Passed      |
| `/admin/orders/`                                    | GET              | `platform.orders.read`               | Unscoped inspection       | Marketplace orders list           | N/A                    | Passed      |
| `/admin/orders/<id>/`                               | GET              | `platform.orders.read`               | Unscoped inspection       | Order and seller orders breakdown | N/A                    | Passed      |
| `/admin/finance/summary`                            | GET              | `platform.finance.read`              | Aggregated metrics        | Marketplace financial overview    | N/A                    | Passed      |
| `/admin/finance/commissions/plans`                  | GET, POST        | `platform.finance.read`, `manage`    | Platform commissions      | Commission plans management       | N/A                    | Passed      |
| `/admin/finance/commissions/plans/<id>`             | GET, PUT, DELETE | `platform.finance.read`, `manage`    | Platform commissions      | Default plan protection           | N/A                    | Passed      |
| `/admin/finance/commissions/plans/<id>/rules`       | POST             | `platform.finance.manage`            | Platform commissions      | Precedence rule creation          | N/A                    | Passed      |
| `/admin/finance/commissions/rules/<id>`             | PUT, DELETE      | `platform.finance.manage`            | Platform commissions      | Rule modification                 | N/A                    | Passed      |
| `/admin/finance/commissions/preview`                | GET              | `platform.finance.read`              | Simulation only           | Evaluates precedence tree         | N/A                    | Passed      |
| `/admin/finance/seller-balances`                    | GET              | `platform.finance.read`              | Unscoped inspection       | Seller balances list              | N/A                    | Passed      |
| `/admin/finance/seller-balances/<seller_id>`        | GET              | `platform.finance.read`              | Unscoped inspection       | Specific seller balance           | N/A                    | Passed      |
| `/admin/finance/seller-balances/<seller_id>/adjust` | POST             | `platform.finance.manage`            | Compensating adjustment   | Append-only ledger adjustment     | N/A                    | Passed      |
| `/admin/finance/payouts`                            | GET              | `platform.finance.read`              | Unscoped inspection       | Marketplace payouts queue         | N/A                    | Passed      |
| `/admin/finance/payouts/<id>`                       | GET              | `platform.finance.read`              | Unscoped inspection       | Payout details and items          | N/A                    | Passed      |
| `/admin/finance/payouts/<id>/approve`               | POST             | `platform.finance.manage`            | State transition          | PENDING -> APPROVED               | Actor member forbidden | Passed      |
| `/admin/finance/payouts/<id>/process`               | POST             | `platform.finance.manage`            | State transition          | APPROVED -> PROCESSED             | Actor member forbidden | Passed      |
| `/admin/finance/payouts/<id>/reject`                | POST             | `platform.finance.manage`            | State transition          | Restores seller balance           | Actor member forbidden | Passed      |
| `/admin/fulfillment/shipments`                      | GET              | `platform.fulfillment.read`          | Unscoped inspection       | Marketplace shipments list        | N/A                    | Passed      |
| `/admin/fulfillment/shipments/<id>`                 | GET              | `platform.fulfillment.read`          | Unscoped inspection       | Specific shipment and tracking    | N/A                    | Passed      |
| `/admin/fulfillment/returns`                        | GET              | `platform.returns.read`              | Unscoped inspection       | Marketplace returns list          | N/A                    | Passed      |
| `/admin/fulfillment/returns/<id>`                   | GET              | `platform.returns.read`              | Unscoped inspection       | Return details and items          | N/A                    | Passed      |
| `/admin/fulfillment/refunds`                        | GET              | `platform.returns.read`              | Unscoped inspection       | Marketplace refunds list          | N/A                    | Passed      |
| `/admin/fulfillment/refunds/<id>`                   | GET              | `platform.returns.read`              | Unscoped inspection       | Specific refund transaction       | N/A                    | Passed      |
| `/admin/promotions`                                 | GET, POST        | `platform.promotions.read`, `manage` | Platform scope            | Global promotion campaigns        | N/A                    | Passed      |
| `/admin/promotions/<id>`                            | GET, PATCH       | `platform.promotions.read`, `manage` | Platform scope            | Campaign details                  | N/A                    | Passed      |
| `/admin/promotions/<id>/coupons`                    | POST             | `platform.promotions.manage`         | Platform scope            | Creates platform coupons          | N/A                    | Passed      |
| `/admin/reviews`                                    | GET              | `platform.reviews.read`              | Unscoped inspection       | Marketplace customer reviews      | N/A                    | Passed      |
| `/admin/reviews/<id>/moderate`                      | POST             | `platform.reviews.moderate`          | Append-only moderation    | APPROVE, REJECT, REMOVE           | N/A                    | Passed      |
| `/admin/reviews/reports`                            | GET              | `platform.reviews.read`              | Unscoped inspection       | Reported customer reviews         | N/A                    | Passed      |
| `/admin/reviews/reports/<id>/resolve`               | POST             | `platform.reviews.moderate`          | Dispute resolution        | Marks report resolved/dismissed   | N/A                    | Passed      |
| `/admin/notifications/broadcast`                    | POST             | `platform.notifications.broadcast`   | System-wide messaging     | Broadcasts in-app messages        | N/A                    | Passed      |
| `/admin/analytics/dashboard`                        | GET              | `platform.analytics.read`            | Platform analytics        | Real-time database aggregates     | N/A                    | Passed      |

---

## 4. Key Security Invariants Verified

1. **Zero Implicit Privilege**: `is_superuser` and `is_staff` Django flags grant zero application privileges. Every platform view checks explicit capabilities assigned through `platform_access`.
2. **Strict Anti-Self-Approval**: In seller approval, document review, product moderation, and payout processing, platform administrators who hold any active or inactive membership in the target seller are strictly barred from approving their own seller's requests. This invariant is enforced in both application services and PostgreSQL triggers.
3. **Immutability of Audit and Ledger Records**:
   - `SecurityEvent`: PostgreSQL trigger rejects UPDATE and DELETE.
   - `AuditLog`: PostgreSQL trigger rejects UPDATE and DELETE.
   - `SellerStatusHistory`: PostgreSQL trigger rejects UPDATE and DELETE.
   - `SellerLedgerEntry`: PostgreSQL trigger rejects UPDATE and DELETE.
   - `CouponUsage`: PostgreSQL trigger rejects UPDATE and DELETE.
   - `ReviewModeration`: PostgreSQL trigger rejects UPDATE and DELETE.
   - `TrackingEvent`: PostgreSQL trigger rejects UPDATE and DELETE.
4. **Tenant Scope Trigger Enforcement**:
   - `catalog_check_child_scope`: Verifies variant and product seller IDs match.
   - `check_order_item_tenant`: Verifies order item and seller order seller IDs match.
   - `check_seller_ledger_scope`: Verifies ledger entry and associated seller order/payout match.
   - `check_payout_item_scope`: Verifies payout item and ledger entry seller IDs match.
   - `check_shipment_seller_scope`: Verifies shipment and seller order seller IDs match.
   - `check_return_seller_scope`: Verifies return request and seller order seller IDs match.
   - `check_refund_seller_scope`: Verifies refund and seller order seller IDs match.
   - `check_seller_role_tenant`: Verifies custom role belongs to the target seller.
