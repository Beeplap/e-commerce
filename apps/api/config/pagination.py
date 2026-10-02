from typing import TYPE_CHECKING, Any

from django.db.models import Model, QuerySet
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

if TYPE_CHECKING:
    from django.core.paginator import Paginator


class BoundedPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = None

    def get_page_number(self, request: Request, paginator: Paginator[Model]) -> int:
        raw = request.query_params.get(self.page_query_param, "1")
        if not raw.isascii() or not raw.isdecimal() or len(raw) > 5:
            raise ValidationError({"page": "Use a page number between 1 and 10000."})
        number = int(raw)
        if not 1 <= number <= 10000:
            raise ValidationError({"page": "Use a page number between 1 and 10000."})
        return number


def paginated_response(
    view: APIView, request: Request, query: QuerySet[Model], serializer: Any
) -> Response:
    pagination = BoundedPagination()
    page = pagination.paginate_queryset(query, request, view)
    return pagination.get_paginated_response(serializer(page, many=True).data)
