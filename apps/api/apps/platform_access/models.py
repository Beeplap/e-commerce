import uuid

from django.conf import settings
from django.db import models


class PlatformPermission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255)


class PlatformRole(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, unique=True)
    permissions = models.ManyToManyField(PlatformPermission, through="PlatformRolePermission")


class PlatformRolePermission(models.Model):
    role = models.ForeignKey(PlatformRole, on_delete=models.CASCADE)
    permission = models.ForeignKey(PlatformPermission, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["role", "permission"], name="platform_role_permission_unique"
            )
        ]


class PlatformAccess(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    role = models.ForeignKey(PlatformRole, on_delete=models.PROTECT)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
