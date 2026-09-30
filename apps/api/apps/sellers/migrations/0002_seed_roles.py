from django.db import migrations

CAPABILITIES = {
    "seller.context.read": "Read the current seller context",
    "seller.settings.read": "Read seller settings",
    "seller.settings.update": "Update permitted seller settings",
    "seller.ownership.manage": "Manage seller ownership through explicit owner workflows",
    "staff.read": "Read seller staff",
    "staff.invite": "Invite seller staff",
    "staff.update": "Update permitted seller staff roles",
    "staff.remove": "Revoke seller staff membership",
    "catalog.product.read": "Read seller products",
    "catalog.product.create": "Create seller products",
    "catalog.product.update": "Update seller products",
    "catalog.product.archive": "Archive seller products",
    "inventory.read": "Read seller inventory",
    "inventory.adjust": "Adjust seller inventory",
    "orders.read": "Read seller orders",
    "orders.update": "Perform permitted seller order transitions",
    "orders.cancel": "Cancel eligible seller orders",
    "finance.read": "Read seller finance",
    "payouts.read": "Read seller payouts",
    "analytics.read": "Read seller analytics",
}
ROLES = {
    "OWNER": set(CAPABILITIES),
    "ADMIN": set(CAPABILITIES) - {"seller.ownership.manage"},
    "CATALOG_MANAGER": {
        "seller.context.read",
        "catalog.product.read",
        "catalog.product.create",
        "catalog.product.update",
        "catalog.product.archive",
        "inventory.read",
    },
    "ORDER_MANAGER": {
        "seller.context.read",
        "orders.read",
        "orders.update",
        "orders.cancel",
    },
    "WAREHOUSE_MANAGER": {
        "seller.context.read",
        "inventory.read",
        "inventory.adjust",
        "orders.read",
    },
    "FINANCE_MANAGER": {"seller.context.read", "finance.read", "payouts.read"},
    "SUPPORT_AGENT": {"seller.context.read", "orders.read"},
}


def seed(apps, schema_editor):
    permission = apps.get_model("sellers", "SellerPermission")
    role = apps.get_model("sellers", "SellerRole")
    link = apps.get_model("sellers", "SellerRolePermission")
    db = schema_editor.connection.alias
    permissions = {
        code: permission.objects.using(db).get_or_create(
            code=code, defaults={"description": description}
        )[0]
        for code, description in CAPABILITIES.items()
    }
    for name, codes in ROLES.items():
        seeded, _ = role.objects.using(db).get_or_create(
            name=name, seller=None, defaults={"is_system": True, "is_owner": name == "OWNER"}
        )
        for code in sorted(codes):
            link.objects.using(db).get_or_create(role=seeded, permission=permissions[code])


class Migration(migrations.Migration):
    dependencies = [("sellers", "0001_initial")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
