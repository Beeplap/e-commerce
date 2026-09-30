from typing import TYPE_CHECKING

from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.request import Request

if TYPE_CHECKING:
    from django.core.paginator import Paginator
    from django.db.models import Model


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
