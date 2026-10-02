import os
from datetime import timedelta
from pathlib import Path

from config.env import required

BASE_DIR = Path(__file__).resolve().parent.parent.parent
SECRET_KEY = required("DJANGO_SECRET_KEY")
DEBUG = False
ALLOWED_HOSTS: list[str] = []

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.staticfiles",
    "rest_framework",
    "drf_spectacular",
    "axes",
    "apps.accounts",
    "apps.platform_access",
    "apps.sellers",
    "apps.audit",
    "apps.catalog",
    "apps.inventory",
    "apps.orders",
    "apps.finance",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "axes.middleware.AxesMiddleware",
]
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"
APPEND_SLASH = False

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": required("POSTGRES_DB"),
        "USER": required("POSTGRES_USER"),
        "PASSWORD": required("POSTGRES_PASSWORD"),
        "HOST": os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        "CONN_MAX_AGE": 0,
        "OPTIONS": {"connect_timeout": 5},
    }
}
AUTH_USER_MODEL = "accounts.User"
AUTHENTICATION_BACKENDS = [
    "axes.backends.AxesStandaloneBackend",
    "django.contrib.auth.backends.ModelBackend",
]
AXES_HANDLER = "axes.handlers.database.AxesDatabaseHandler"
AXES_FAILURE_LIMIT = 5
AXES_COOLOFF_TIME = timedelta(minutes=15)
AXES_LOCKOUT_PARAMETERS = ["username", "ip_address"]
AXES_USERNAME_FORM_FIELD = "email"
AXES_RESET_ON_SUCCESS = False
AXES_RESET_COOL_OFF_ON_FAILURE_DURING_LOCKOUT = False
AXES_DISABLE_ACCESS_LOG = True  # Our append-only SecurityEvent records successful actions.
AXES_ENABLE_ADMIN = False
AXES_CLIENT_IP_CALLABLE = "apps.accounts.security.client_ip"
AXES_CLIENT_STR_CALLABLE = "apps.accounts.security.safe_client_label"
AXES_LOCKOUT_CALLABLE = "apps.accounts.security.lockout_response"
AXES_SENSITIVE_PARAMETERS = [
    "username",
    "email",
    "ip_address",
    "password",
    "old_password",
    "new_password",
    "sessionid",
    "csrftoken",
    "authorization",
]
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 12},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_AGE = 60 * 60 * 8
SESSION_SAVE_EVERY_REQUEST = False
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = False  # Future same-origin client submits it as X-CSRFToken.
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
DATA_UPLOAD_MAX_MEMORY_SIZE = 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 1024 * 1024
DATA_UPLOAD_MAX_NUMBER_FILES = 1
FILE_UPLOAD_HANDLERS = [
    "config.upload_handlers.BoundedUploadHandler",
    "django.core.files.uploadhandler.MemoryFileUploadHandler",
    "django.core.files.uploadhandler.TemporaryFileUploadHandler",
]
# Development storage is private, outside application code, and has no media route.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    "verification": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
        "OPTIONS": {
            "location": BASE_DIR.parent.parent / ".private-media" / "verification",
            "file_permissions_mode": 0o600,
            "directory_permissions_mode": 0o700,
        },
    },
    "catalog": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
        "OPTIONS": {
            "location": BASE_DIR.parent.parent / ".private-media" / "catalog",
            "file_permissions_mode": 0o600,
            "directory_permissions_mode": 0o700,
        },
    },
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["config.permissions.DenyAll"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
}
SPECTACULAR_SETTINGS = {
    "TITLE": "Quick Commerce API",
    "DESCRIPTION": "Session-authenticated marketplace administration API.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "ENUM_NAME_OVERRIDES": {
        "SellerStatusEnum": "apps.sellers.models.Seller.Status",
        "SellerVerificationStatusEnum": "apps.sellers.models.Seller.VerificationStatus",
        "SellerMembershipStatusEnum": "apps.sellers.models.SellerMembership.Status",
        "ProductStatusEnum": "apps.catalog.models.Product.Status",
        "ProductVariantStatusEnum": "apps.catalog.models.ProductVariant.Status",
        "InventoryTransactionTypeEnum": "apps.inventory.models.InventoryTransaction.Type",
        "OrderPaymentStatusEnum": "apps.orders.models.Order.PaymentStatus",
        "OrderFulfillmentStatusEnum": "apps.orders.models.Order.FulfillmentStatus",
        "SellerOrderStatusEnum": "apps.orders.models.SellerOrder.Status",
        "PayoutStatusEnum": "apps.finance.models.Payout.Status",
        "SellerLedgerEntryTypeEnum": "apps.finance.models.SellerLedgerEntry.EntryType",
    },
}
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
