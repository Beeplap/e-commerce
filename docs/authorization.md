# Authorization

## Phase 1 platform capability foundation

Django remains the only authorization authority. DRF defaults to `config.permissions.DenyAll`, preventing accidental access even to authenticated users. The authentication API explicitly opts into public CSRF/login or authenticated-self operations. `/api/v1/admin/access` uses `PlatformCapabilityRequired` and requires `platform.access` on an active `PlatformAccess` grant. It returns only the signed-in account's safe identity and capabilities. Admin account creation or Django superuser flags never grant application capabilities.

`PlatformRole`, `PlatformPermission`, `PlatformRolePermission` and the user's one-to-one `PlatformAccess` grant are the capability foundation. The first migration seeds `SUPER_ADMIN` and only the `platform.access` capability. A role name by itself grants nothing; no permission is implied by `is_staff`, `is_superuser`, Django groups, session contents or the frontend. `platform_capabilities` reads current state from PostgreSQL per request, so revocation takes effect without waiting for session expiry.

The management commands `create_account <email>` (hidden password prompts, password validation, regular unprivileged account) and `grant_platform_access <email> [--role SUPER_ADMIN]` are infrastructure bootstrap operations. Restrict production command access to authorized operators, protect/record shell access, and never expose them over HTTP. Grant actions append a `SecurityEvent`. Normal platform access must use explicit application capabilities, never the Django admin.

## Authentication boundaries

`/api/v1/auth/me` exposes only UUID, email, first/last name, email-verification state and current platform capability names. It never serializes password hashes, staff/superuser flags, session IDs, or axes state. Login normalizes email and returns one generic response for unknown, wrong-password and disabled accounts.

Unsafe session-authenticated browser actions require CSRF. Login is anonymous, so `BrowserAPIView` explicitly invokes Django's CSRF check before permission handling; DRF's normal session authenticator would otherwise skip CSRF for anonymous login. State changing routes reject query parameters, unknown body fields and unsupported methods. The same-origin Next.js proxy keeps browser credentials same-origin without CORS.

Future platform roles (OPERATIONS_ADMIN, FINANCE_ADMIN, CATALOG_ADMIN, SUPPORT_ADMIN) need explicit capabilities and permission-specific views. `platform.access` currently protects the self-inspection test surface only; it does not automatically grant future finance, seller or catalog capabilities.

## Future tenant boundary

Phase 2 defines Seller as tenant, SellerMembership as user-to-tenant access, and seller Role/Permission/RolePermission. Membership is checked for each sensitive operation. A user may belong to multiple sellers. Browser-supplied seller IDs select context only after backend membership verification; they never grant authority.

Every seller API independently establishes identity, seller context, active membership, capability, tenant-filtered query and related-object ownership. Services also guard sensitive permissions when invoked outside HTTP. Platform inspection of seller data occurs through intentionally distinct admin endpoints. Platform capability never silently widens access through seller routes.

Use capability names such as `catalog.product.read`, `inventory.adjust`, `orders.update`, `finance.read`, and `staff.invite`. Prevent self-escalation, unauthorized delegation and owner-removal hazards. Validate list results and foreign-key submissions as strictly as detail endpoints.

Tenant-scoped lookups should return the same 404 for missing and foreign resources. Use 403 for denied capabilities when it does not reveal private resource existence. DRF's standard `detail` error and field-validation shapes are the API convention. Phase 3's client handles them centrally. Explicit serializers, bounded pagination and allowlisted ordering/filtering remain mandatory.
