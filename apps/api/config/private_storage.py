from typing import Any
from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured

from config.env import required


def production_verification_storage() -> dict[str, Any]:
    endpoint = required("STORAGE_ENDPOINT_URL")
    parsed = urlsplit(endpoint)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or parsed.path not in ("", "/")
    ):
        raise ImproperlyConfigured("STORAGE_ENDPOINT_URL must be an explicit HTTPS origin.")
    return {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "endpoint_url": endpoint,
            "bucket_name": required("STORAGE_VERIFICATION_BUCKET"),
            "region_name": required("STORAGE_REGION"),
            "access_key": required("STORAGE_ACCESS_KEY_ID"),
            "secret_key": required("STORAGE_SECRET_ACCESS_KEY"),
            "default_acl": "private",
            "querystring_auth": True,
            "custom_domain": None,
            "file_overwrite": False,
            "signature_version": "s3v4",
            "addressing_style": "path",
            "verify": True,
            "object_parameters": {"CacheControl": "no-store"},
        },
    }
