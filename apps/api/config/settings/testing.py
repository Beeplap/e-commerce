from config.settings.development import *  # noqa: F403

DEBUG = False
ALLOWED_HOSTS = ["testserver", "localhost", "127.0.0.1"]
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
