from django.db import migrations

PERMISSIONS = {
    "analytics.read": "Read seller dashboard metrics and analytics",
}

ROLE_PERMISSIONS_MAP = {
    "OWNER": list(PERMISSIONS.keys()),
    "ADMIN": list(PERMISSIONS.keys()),
}


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

    for role_name, perm_codes in ROLE_PERMISSIONS_MAP.items():
        try:
            role = SellerRole.objects.using(db).get(name=role_name, seller__isnull=True)
            for code in perm_codes:
                perm = created_perms[code]
                SellerRolePermission.objects.using(db).get_or_create(role=role, permission=perm)
        except SellerRole.DoesNotExist:
            pass


def reverse(apps, schema_editor):
    SellerPermission = apps.get_model("sellers", "SellerPermission")
    db = schema_editor.connection.alias
    SellerPermission.objects.using(db).filter(code__in=PERMISSIONS.keys()).delete()


class Migration(migrations.Migration):
    dependencies = [("sellers", "0007_phase10_permissions")]
    operations = [migrations.RunPython(seed, reverse)]
