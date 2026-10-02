from django.db import migrations

PERMISSIONS = {
    "fulfillment.read": "Read seller fulfillment and shipments",
    "fulfillment.manage": "Create and manage shipments and shipping methods",
    "returns.read": "Read seller return requests",
    "returns.manage": "Approve, reject, and process return requests",
}

ROLE_NAMES = ["OWNER", "ADMIN", "ORDER_MANAGER", "WAREHOUSE_MANAGER"]


def seed(apps, schema_editor):
    SellerPermission = apps.get_model("sellers", "SellerPermission")
    SellerRole = apps.get_model("sellers", "SellerRole")
    SellerRolePermission = apps.get_model("sellers", "SellerRolePermission")
    db = schema_editor.connection.alias

    created_perms = {}
    for code, desc in PERMISSIONS.items():
        perm, _ = SellerPermission.objects.using(db).get_or_create(
            code=code, defaults={"description": desc}
        )
        created_perms[code] = perm

    for role_name in ROLE_NAMES:
        try:
            role = SellerRole.objects.using(db).get(name=role_name, seller__isnull=True)
            for perm in created_perms.values():
                SellerRolePermission.objects.using(db).get_or_create(role=role, permission=perm)
        except SellerRole.DoesNotExist:
            pass


def reverse(apps, schema_editor):
    SellerPermission = apps.get_model("sellers", "SellerPermission")
    db = schema_editor.connection.alias
    SellerPermission.objects.using(db).filter(code__in=PERMISSIONS.keys()).delete()


class Migration(migrations.Migration):
    dependencies = [("sellers", "0005_lifecycle_integrity")]
    operations = [migrations.RunPython(seed, reverse)]
