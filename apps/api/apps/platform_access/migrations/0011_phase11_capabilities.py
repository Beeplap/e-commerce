from django.db import migrations

CODES = [
    "platform.analytics.read",
]


def seed(apps, schema_editor):
    Permission = apps.get_model("platform_access", "PlatformPermission")
    Role = apps.get_model("platform_access", "PlatformRole")
    Grant = apps.get_model("platform_access", "PlatformRolePermission")
    role = Role.objects.get(name="SUPER_ADMIN")
    for code in CODES:
        permission, _ = Permission.objects.get_or_create(code=code, defaults={"description": code})
        Grant.objects.get_or_create(role=role, permission=permission)


def reverse(apps, schema_editor):
    apps.get_model("platform_access", "PlatformPermission").objects.filter(code__in=CODES).delete()


class Migration(migrations.Migration):
    dependencies = [("platform_access", "0010_phase10_capabilities")]
    operations = [migrations.RunPython(seed, reverse)]
