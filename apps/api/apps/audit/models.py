import uuid

from django.db import models


class AuditLog(models.Model):
    """Safe UUID snapshots survive account deletion. SQL forbids update/delete."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor_id = models.UUIDField()
    seller_id = models.UUIDField(db_index=True)
    action = models.CharField(max_length=80)
    target_type = models.CharField(max_length=80)
    target_id = models.UUIDField()
    changes = models.JSONField(default=dict)
    remote_ip = models.GenericIPAddressField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["seller_id", "-created_at"])]
