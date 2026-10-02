import os
from typing import Any

import redis
from django.db import connection, models
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView


class CheckStatus(models.TextChoices):
    OK = "ok", "OK"
    ERROR = "error", "Error"


class ReadinessStatus(models.TextChoices):
    READY = "ready", "Ready"
    UNAVAILABLE = "unavailable", "Unavailable"


class HealthSerializer(serializers.Serializer[dict[str, str]]):
    status = serializers.ChoiceField(choices=["ok"])


class ReadinessChecksSerializer(serializers.Serializer[dict[str, str]]):
    database = serializers.ChoiceField(choices=CheckStatus.choices)
    redis = serializers.ChoiceField(choices=CheckStatus.choices)


class ReadinessSerializer(serializers.Serializer[dict[str, Any]]):
    status = serializers.ChoiceField(choices=ReadinessStatus.choices)
    checks = ReadinessChecksSerializer()


class HealthView(APIView):
    """Public liveness only; no database, dependency details, or user information."""

    authentication_classes = []
    permission_classes = [AllowAny]
    http_method_names = ["get", "head", "options"]

    @extend_schema(responses=HealthSerializer, auth=[], tags=["Infrastructure"])
    def get(self, request: Request) -> Response:
        response = Response({"status": "ok"})
        response["Cache-Control"] = "no-store"
        return response


class ReadinessView(APIView):
    """Assesses critical infrastructure readiness (authoritative PostgreSQL and Redis).

    Fails closed with HTTP 503 if any dependency is unavailable without leaking credentials.
    """

    authentication_classes = []
    permission_classes = [AllowAny]
    http_method_names = ["get", "head", "options"]

    @extend_schema(
        responses={200: ReadinessSerializer, 503: ReadinessSerializer},
        auth=[],
        tags=["Infrastructure"],
    )
    def get(self, request: Request) -> Response:
        db_status = "ok"
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except Exception:
            db_status = "error"

        redis_status = "ok"
        try:
            host = os.environ.get("REDIS_HOST", "127.0.0.1")
            port = int(os.environ.get("REDIS_PORT", "6379"))
            password = os.environ.get("REDIS_PASSWORD", None)
            client = redis.Redis(
                host=host,
                port=port,
                password=password,
                socket_timeout=2.0,
                socket_connect_timeout=2.0,
            )
            if not client.ping():
                redis_status = "error"
        except Exception:
            redis_status = "error"

        is_ready = db_status == "ok" and redis_status == "ok"
        status_code = 200 if is_ready else 503
        data = {
            "status": "ready" if is_ready else "unavailable",
            "checks": {
                "database": db_status,
                "redis": redis_status,
            },
        }
        response = Response(data, status=status_code)
        response["Cache-Control"] = "no-store"
        return response
