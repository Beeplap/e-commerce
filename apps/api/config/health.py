from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthSerializer(serializers.Serializer[dict[str, str]]):
    status = serializers.ChoiceField(choices=["ok"])


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
