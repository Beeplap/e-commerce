from django.db import migrations


def seed(apps, schema_editor):
    permission = apps.get_model("platform_access", "PlatformPermission")
    role = apps.get_model("platform_access", "PlatformRole")
    link = apps.get_model("platform_access", "PlatformRolePermission")
    db = schema_editor.connection.alias
    admin = role.objects.using(db).get(name="SUPER_ADMIN")
    access, _ = permission.objects.using(db).get_or_create(
        code="platform.sellers.read",
        defaults={"description": "Inspect sellers through explicit platform API endpoints"},
    )
    link.objects.using(db).get_or_create(role=admin, permission=access)


class Migration(migrations.Migration):
    dependencies = [("platform_access", "0002_seed_platform_access")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
