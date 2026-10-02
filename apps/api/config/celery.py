import os

from celery import Celery

# Set default Django settings module for the celery program.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

app = Celery("quick_commerce")

# Read configuration from Django settings with CELERY_ prefix.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover task modules across all installed apps.
app.autodiscover_tasks()
