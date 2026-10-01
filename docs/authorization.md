# Authorization

## Platform capability foundation

Django remains the only authorization authority. DRF defaults to `config.permissions.DenyAll`, preventing accidental access even to authenticated users. The authentication API explicitly opts into public CSRF/login or authenticated-self operations. `/api/v1/admin/access` uses `PlatformCapabilityRequired` and requires `platform.access` on an active `PlatformAccess` grant. It returns only the signed-in account's safe identity and capabilities. Admin account creation or Django superuser flags never grant application capabilities.

`PlatformRole`, `PlatformPermission`, `PlatformRolePermission` and the user's one-to-one `PlatformAccess` grant are the capability foundation. The migrations seed `SUPER_ADMIN` with `platform.access` and `platform.sellers.read`. A role name by itself grants nothing; no permission is implied by `is_staff`, `is_superuser`, Django groups, session contents or the frontend. `platform_capabilities` reads current state from PostgreSQL per request, so revocation takes effect without waiting for session expiry. `/api/v1/admin/sellers/{seller_id}/access` is a read-only inspection endpoint requiring `platform.sellers.read`. It is intentionally unscoped by seller membership inside the explicit platform boundary.

The management commands `create_account <email>` (hidden password prompts, password validation, regular unprivileged account) and `grant_platform_access <email> [--role SUPER_ADMIN]` are infrastructure bootstrap operations. Restrict production command access to authorized operators, protect/record shell access, and never expose them over HTTP. Grant actions append a `SecurityEvent`. Normal platform access must use explicit application capabilities, never the Django admin.

## Authentication boundaries

`/api/v1/auth/me` exposes only UUID, email, first/last name, email-verification state and current platform capability names. It never serializes password hashes, staff/superuser flags, session IDs, or axes state. Login normalizes email and returns one generic response for unknown, wrong-password and disabled accounts.

Unsafe session-authenticated browser actions require CSRF. Login is anonymous, so `BrowserAPIView` explicitly invokes Django's CSRF check before permission handling; DRF's normal session authenticator would otherwise skip CSRF for anonymous login. State changing routes reject query parameters, unknown body fields and unsupported methods. The same-origin Next.js proxy keeps browser credentials same-origin without CORS.

Future platform roles (OPERATIONS_ADMIN, FINANCE_ADMIN, CATALOG_ADMIN, SUPPORT_ADMIN) need explicit capabilities and permission-specific views. `platform.access` currently protects the self-inspection test surface only; it does not automatically grant future finance, seller or catalog capabilities.

## Implemented tenant boundary

Phase 2 defines Seller as tenant, SellerMembership as user-to-tenant access, and SellerRole/SellerPermission/SellerRolePermission. Membership is checked for each operation. A user may belong to multiple sellers. Browser-supplied seller IDs select context only after backend membership verification; they never grant authority.

`GET /api/v1/seller/memberships` requires authentication and returns only that user's active memberships in pending/active sellers. It uses bounded pages of 25 with only the `page` query parameter. `GET /api/v1/seller/access` requires the selected UUID in `X-Seller-ID` and the explicit `seller.context.read` capability. No selected seller or permission list is trusted from session state. Each tab/request selects its own context and current database grants are rechecked; missing or malformed context returns 400, inaccessible/missing seller returns the same 404, and denied capability in a verified context returns 403.

`SellerCapabilityRequired` resolves HTTP context, `require_seller_access` guards services, and `tenant_queryset` first authorizes and then filters existing rows by seller FK. Use it for object retrieval, related-object resolution and scoped update/delete selection. Querysets are not capability tokens: services must obtain them per operation, and creation must explicitly assign verified seller ownership because Django queryset `.create()` does not inherit filters. These guards require ACTIVE sellers by default. Pending-seller context inspection explicitly opts into `allow_pending_seller`; later onboarding services must similarly make any pending access an explicit choice.

System roles are seeded with explicit capabilities:

- OWNER: all initial seller capabilities, including structural owner identity and `seller.ownership.manage`.
- ADMIN: all initial capabilities except ownership management.
- CATALOG_MANAGER: context, product read/create/update/archive and inventory read.
- ORDER_MANAGER: context and order read/update/cancel.
- WAREHOUSE_MANAGER: context, inventory read/adjust and order read.
- FINANCE_MANAGER: context, finance read and payout read.
- SUPPORT_AGENT: context and order read.

Role labels have no authorization effect. Global system roles have no seller; custom-role records have one seller and cannot be owner roles. No custom-role or staff mutation HTTP API exists yet. `authorize_role_assignment` requires `staff.invite` or `staff.update`, resolves the role within the current seller/system scope and rejects permission delegation beyond the actor's current grant. Owner-role delegation additionally requires an owner membership and the ownership capability. Later staff commands must run validation and mutation together under appropriate transaction locks, preserve owner invariants and audit changes.

Every seller API independently establishes identity, seller context, active membership, capability, tenant-filtered query and related-object ownership. Services also guard sensitive permissions when invoked outside HTTP. Platform inspection of seller data occurs through intentionally distinct admin endpoints. Platform capability never silently widens access through seller routes.

Use capability names such as `catalog.product.read`, `inventory.adjust`, `orders.update`, `finance.read`, and `staff.invite`. Prevent self-escalation, unauthorized delegation and owner-removal hazards. Validate list results and foreign-key submissions as strictly as detail endpoints.

Tenant-scoped lookups should return the same 404 for missing and foreign resources. Use 403 for denied capabilities when it does not reveal private resource existence. DRF's standard `detail` error and field-validation shapes are the API convention. Phase 3's client handles them centrally. Explicit serializers, bounded pagination and allowlisted ordering/filtering remain mandatory.

## Phase 4 endpoint policies

- Authenticated active users can `POST /api/v1/seller/onboarding` with CSRF; the service creates only a pending seller and that actor's OWNER membership. Caller-supplied status, user, role, seller, approval and commission fields are rejected.
- Seller settings/address/document routes require current membership and `seller.settings.read` to view; updates/uploads additionally revalidate `seller.settings.update` in the service. These onboarding routes explicitly permit pending sellers. Suspended/rejected/closed sellers stay inaccessible. Related address/document UUIDs are resolved inside the authorized seller; tenant ownership is never caller-assigned.
- `GET /api/v1/admin/sellers` and seller detail/history/members require `platform.sellers.read`; list queries allow only page/search/status/verification_status with bounded pagination and search length. No arbitrary ordering/filtering is supported.
- `approve`, `reject`, `suspend`, `reactivate` require `platform.sellers.manage`. Legal transitions are pending → active/rejected, active → suspended and suspended → active. Reject/suspend require a reason. Approval/reactivation require a registered address and an unexpired verified business registration. The platform actor must not have any membership in the target seller.
- Document list/download requires `platform.sellers.documents.read`; explicit document approve/reject requires `platform.sellers.documents.review`, a pending seller/document, and no actor membership in that seller. Rejection requires a reason. Seller audit history additionally requires `platform.sellers.audit.read` alongside seller-read permission. Downloads are audited for both seller and platform callers.
- The migration grants these capabilities to the seeded SUPER_ADMIN role. Runtime authority still comes from capabilities, never the role name or Django superuser. A read-only inspector cannot download documents, mutate lifecycle or inspect audit history without the respective grant.

## Frontend authorization UX

Phase 3 adds session lookup/login/logout, protected workspace layouts and permission utilities. Anonymous protected navigation goes to `/login`; inaccessible seller/admin workspaces show a 403 screen. Platform navigation is shown only for the explicit `platform.access` capability. Admin and seller layouts also call Django's respective access endpoint before rendering their children; a role label never grants UI authority. Memberships are fetched through the bounded user-scoped endpoint and every chosen seller ID is validated through `/seller/access`.

Frontend capabilities are hints for rendering controls and are never sent as trusted grants. Seller permission utilities require active membership and ACTIVE sellers by default, with an explicit pending-context option matching backend policy. In-memory context/query state is isolated by user and seller; stale work is aborted and late results are discarded. Backend permissions remain mandatory on every subsequent operation. Do not expose sensitive Server Component/RSC data behind a client-only guard.
