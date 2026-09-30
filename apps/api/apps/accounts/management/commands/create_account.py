from getpass import getpass
from typing import Any

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.db import IntegrityError
from django.views.decorators.debug import sensitive_variables

from apps.accounts.models import User, UserManager


class Command(BaseCommand):
    help = (
        "Create a regular account using hidden password prompts (no business or Django privileges)."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("email")

    @sensitive_variables("password", "confirmation")
    def handle(self, *args: Any, **options: Any) -> None:
        email = UserManager.normalize_email(options["email"])
        password = getpass("Password: ")
        confirmation = getpass("Password (again): ")
        if password != confirmation:
            raise CommandError("Passwords do not match.")
        try:
            validate_password(password, User(email=email))
            User.objects.create_user(email, password)
        except ValidationError as error:
            raise CommandError(" ".join(error.messages)) from error
        except IntegrityError as error:
            raise CommandError("An account with this email already exists.") from error
        self.stdout.write(self.style.SUCCESS("Regular account created."))
