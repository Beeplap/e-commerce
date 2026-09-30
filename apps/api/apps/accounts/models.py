import uuid
from typing import Any, ClassVar

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.validators import validate_email
from django.db import models
from django.db.models.functions import Lower, Trim


class UserManager(BaseUserManager["User"]):
    use_in_migrations = True

    @classmethod
    def normalize_email(cls, email: str | None) -> str:
        return (email or "").strip().lower()

    def create_user(self, email: str, password: str | None = None, **extra: Any) -> User:
        email = self.normalize_email(email)
        validate_email(email)
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str | None = None, **extra: Any) -> User:
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("is_active", True)
        if not all(extra.get(field) is True for field in ("is_staff", "is_superuser", "is_active")):
            raise ValueError("Break-glass superusers must be active staff with is_superuser=True.")
        if not password:
            raise ValueError("Break-glass superusers require a password.")
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    """Swappable UUID/email identity; platform/business roles remain separate."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: ClassVar[list[str]] = []

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(email=Lower(Trim("email"))) & ~models.Q(email=""),
                name="accounts_user_email_normalized_nonempty",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.email = UserManager.normalize_email(self.email)


class SecurityEvent(models.Model):
    """Immutable event snapshots; actor IDs survive account deletion without mutation."""

    class Action(models.TextChoices):
        LOGIN_SUCCEEDED = "login.succeeded"
        LOGIN_FAILED = "login.failed"
        LOGIN_BLOCKED = "login.blocked"
        LOGOUT = "logout"
        PASSWORD_CHANGED = "password.changed"
        PASSWORD_REJECTED = "password.rejected"
        PLATFORM_ACCESS_GRANTED = "platform_access.granted"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    action = models.CharField(max_length=40, choices=Action.choices)
    actor_id = models.UUIDField(null=True)
    subject_id = models.UUIDField(null=True)
    identity_digest = models.CharField(max_length=64, blank=True)
    ip_address = models.GenericIPAddressField(null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["action", "created_at"])]
