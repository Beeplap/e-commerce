import os

from django.core.exceptions import ImproperlyConfigured


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value or value.startswith("replace-with-"):
        raise ImproperlyConfigured(f"Set {name} to a non-placeholder value.")
    return value


def required_list(name: str) -> list[str]:
    values = [value.strip() for value in required(name).split(",") if value.strip()]
    if not values or any("*" in value for value in values):
        raise ImproperlyConfigured(f"{name} requires explicit values without wildcards.")
    return values
