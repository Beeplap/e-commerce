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
    "django.contrib.postgres",
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
    "apps.fulfillment",
    "apps.promotions",
    "apps.reviews",
    "apps.notifications",
    "apps.analytics",
    "apps.events",
    "apps.storefront",
    "apps.cart",
    "apps.checkout",
    "apps.payments",
    "apps.customers",
]

MIDDLEWARE = [
    "config.logging.RequestLoggingMiddleware",
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

# Payments: an empty/placeholder webhook secret rejects every webhook (fail closed).
_payment_webhook_secret = os.environ.get("PAYMENT_WEBHOOK_SECRET", "").strip()
PAYMENT_WEBHOOK_SECRET = (
    "" if _payment_webhook_secret.startswith("replace-with-") else _payment_webhook_secret
)
PAYMENT_MOCK_GATEWAY_ENABLED = True

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
    "EXCEPTION_HANDLER": "config.exceptions.custom_exception_handler",
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
        "ShipmentStatusEnum": "apps.fulfillment.models.Shipment.Status",
        "ReturnRequestStatusEnum": "apps.fulfillment.models.ReturnRequest.Status",
        "RefundStatusEnum": "apps.fulfillment.models.Refund.Status",
        "PromotionScopeEnum": "apps.promotions.models.Promotion.Scope",
        "AttributeScopeEnum": "apps.catalog.models.Attribute.Scope",
        "PromotionDiscountTypeEnum": "apps.promotions.models.Promotion.DiscountType",
        "ProductReviewStatusEnum": "apps.reviews.models.ProductReview.Status",
        "ReviewReportReasonEnum": "apps.reviews.models.ReviewReport.Reason",
        "ReviewReportStatusEnum": "apps.reviews.models.ReviewReport.Status",
        "ReviewModerationActionEnum": "apps.reviews.models.ReviewModeration.Action",
        "NotificationDeliveryChannelEnum": "apps.notifications.models.NotificationDelivery.Channel",
        "NotificationDeliveryStatusEnum": "apps.notifications.models.NotificationDelivery.Status",
        "OutboxEventStatusEnum": "apps.events.models.OutboxEvent.Status",
        "CheckStatusEnum": "config.health.CheckStatus",
        "ReadinessStatusEnum": "config.health.ReadinessStatus",
    },
}
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Celery background workers and task processing
_redis_pwd = os.environ.get("REDIS_PASSWORD", "")
_redis_auth = f":{_redis_pwd}@" if _redis_pwd else ""
_redis_host = os.environ.get("REDIS_HOST", "127.0.0.1")
_redis_port = os.environ.get("REDIS_PORT", "6379")

CELERY_BROKER_URL = os.environ.get(
    "CELERY_BROKER_URL", f"redis://{_redis_auth}{_redis_host}:{_redis_port}/0"
)
CELERY_RESULT_BACKEND = os.environ.get(
    "CELERY_RESULT_BACKEND", f"redis://{_redis_auth}{_redis_host}:{_redis_port}/1"
)
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TIMEZONE = "UTC"
CELERY_TASK_TIME_LIMIT = 300
CELERY_TASK_SOFT_TIME_LIMIT = 240
CELERY_TASK_DEFAULT_RETRY_DELAY = 10
CELERY_TASK_MAX_RETRIES = 5

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "config.logging.StructuredJsonFormatter",
        },
        "standard": {
            "format": "[%(asctime)s] %(levelname)s [%(name)s:%(lineno)s] %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json" if os.environ.get("LOG_FORMAT", "json") == "json" else "standard",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "apps": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "config": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
