from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured

from config.env import required_list
from config.settings.base import *  # noqa: F403
from config.settings.base import SECRET_KEY

if len(SECRET_KEY) < 50 or len(set(SECRET_KEY)) < 5:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be a strong random secret.")
ALLOWED_HOSTS = required_list("DJANGO_ALLOWED_HOSTS")
CSRF_TRUSTED_ORIGINS = required_list("DJANGO_CSRF_TRUSTED_ORIGINS")
for origin in CSRF_TRUSTED_ORIGINS:
    parsed = urlsplit(origin)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.path
        or parsed.query
        or parsed.fragment
    ):
        raise ImproperlyConfigured("CSRF origins must be explicit HTTPS origins without paths.")
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = False
# No forwarded-header trust until a controlled production ingress is configured.
