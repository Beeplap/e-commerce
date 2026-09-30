from typing import Any

from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.debug import sensitive_post_parameters, sensitive_variables
from drf_spectacular.utils import extend_schema
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts import services
from apps.accounts.serializers import (
    CSRFSerializer,
    DetailSerializer,
    EmptySerializer,
    LoginSerializer,
    PasswordChangeSerializer,
    UserSerializer,
)


@method_decorator(
    sensitive_post_parameters("password", "old_password", "new_password"), name="dispatch"
)
class BrowserAPIView(APIView):
    """CSRF applies even to anonymous unsafe browser requests, including login."""

    allowed_query_parameters: frozenset[str] = frozenset()

    def initial(self, request: Request, *args: Any, **kwargs: Any) -> None:
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            SessionAuthentication().enforce_csrf(request)
        if set(request.query_params) - self.allowed_query_parameters:
            raise ValidationError({"detail": "Query parameters are not supported here."})
        if any(len(request.query_params.getlist(key)) != 1 for key in request.query_params):
            raise ValidationError({"detail": "Repeated query parameters are not supported."})
        super().initial(request, *args, **kwargs)

    def finalize_response(self, request: Request, response: Any, *args: Any, **kwargs: Any) -> Any:
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        return response


class CSRFView(BrowserAPIView):
    permission_classes = [AllowAny]

    @extend_schema(responses=CSRFSerializer, tags=["Authentication"])
    def get(self, request: Request) -> Response:
        return Response({"csrf_token": get_token(request._request)})


class LoginView(BrowserAPIView):
    permission_classes = [AllowAny]

    @extend_schema(
        request=LoginSerializer,
        responses={
            200: UserSerializer,
            400: DetailSerializer,
            403: DetailSerializer,
            429: DetailSerializer,
        },
        tags=["Authentication"],
    )
    @sensitive_variables("serializer", "request")
    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.login_user(request._request, **serializer.validated_data)
        return Response(UserSerializer(user).data)


class MeView(BrowserAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=UserSerializer, tags=["Authentication"])
    def get(self, request: Request) -> Response:
        return Response(UserSerializer(services.authenticated_user(request._request)).data)


class LogoutView(BrowserAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=EmptySerializer, responses={204: None}, tags=["Authentication"])
    def post(self, request: Request) -> Response:
        serializer = EmptySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.logout_user(request._request)
        return Response(status=204)


class PasswordChangeView(BrowserAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=PasswordChangeSerializer,
        responses={204: None, 400: DetailSerializer, 403: DetailSerializer, 429: DetailSerializer},
        tags=["Authentication"],
    )
    @sensitive_variables("serializer", "request")
    def post(self, request: Request) -> Response:
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.change_password(request._request, **serializer.validated_data)
        return Response(status=204)
