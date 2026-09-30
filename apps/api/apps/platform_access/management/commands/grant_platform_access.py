from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.db import transaction

from apps.accounts.models import SecurityEvent, User, UserManager
from apps.accounts.security import record_event
from apps.platform_access.models import PlatformAccess, PlatformRole


class Command(BaseCommand):
    help = "Infrastructure-only bootstrap: grant a named platform role to an existing active user."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("email")
        parser.add_argument("--role", default="SUPER_ADMIN")

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        try:
            user = User.objects.select_for_update().get(
                email=UserManager.normalize_email(options["email"]), is_active=True
            )
            role = PlatformRole.objects.get(name=options["role"])
        except (User.DoesNotExist, PlatformRole.DoesNotExist) as error:
            raise CommandError("An active user and existing platform role are required.") from error
        PlatformAccess.objects.update_or_create(
            user=user, defaults={"role": role, "is_active": True}
        )
        record_event(SecurityEvent.Action.PLATFORM_ACCESS_GRANTED, subject_id=user.id)
        self.stdout.write(self.style.SUCCESS("Platform access granted to the specified user."))
