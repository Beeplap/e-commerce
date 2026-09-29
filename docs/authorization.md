# Authorization

Phase 0 has no business authorization endpoints. The global DRF default is `config.permissions.DenyAll`, preventing accidental access even for authenticated users. Health is the only `AllowAny` exception and accepts GET/HEAD/OPTIONS. Schema generation runs through a management command.

Phase 1 must introduce application platform roles starting with SUPER_ADMIN and explicit capabilities; Django superuser is emergency infrastructure access only. Future OPERATIONS_ADMIN, FINANCE_ADMIN, CATALOG_ADMIN and SUPPORT_ADMIN must use capabilities rather than role-name conditionals spread across views. Django admin, if introduced, needs network restriction and break-glass controls in production.

Phase 2 defines Seller as the tenant, SellerMembership as user-to-tenant access, and Role/Permission/RolePermission as the seller RBAC foundation. Membership must be active and revalidated per sensitive operation. A user can belong to multiple sellers. Browser-supplied seller IDs select context only after backend membership checks; they never grant authority.

Every seller API must independently establish identity, seller context, membership, capability, tenant-filtered query and related-object ownership. Services must also guard permissions when invoked outside HTTP. Platform inspection of seller data happens through intentionally distinct admin endpoints. A platform role does not silently grant access through seller routes.

Use names such as `catalog.product.read`, `inventory.adjust`, `orders.update`, `finance.read`, and `staff.invite`. Prevent self-escalation, unauthorized delegation and owner-removal hazards. Validate list results and foreign-key submissions as strictly as detail endpoints.

Tenant-scoped lookups should return the same 404 for missing and foreign resources. Use 403 for denied capabilities where it does not reveal private resource existence. DRF's standard `detail` error and field-validation error shapes are the initial convention. Phase 3's API client must handle them centrally. Explicit serializers, bounded pagination and allowlisted ordering/filtering remain mandatory.
