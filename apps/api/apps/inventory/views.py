from uuid import UUID

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.security import client_ip
from apps.accounts.views import BrowserAPIView
from apps.inventory import selectors, services
from apps.inventory import serializers as schemas
from apps.platform_access.permissions import PlatformCapabilityRequired
from apps.sellers.permissions import SellerCapabilityRequired
from apps.sellers.selectors import SellerAccess
from config.pagination import paginated_response

HEADER = OpenApiParameter("X-Seller-ID", OpenApiTypes.UUID, OpenApiParameter.HEADER, required=True)


class SellerInventoryBase(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "inventory.read"
    seller_access: SellerAccess


@extend_schema(parameters=[HEADER], tags=["Seller warehouses"])
class SellerWarehousesView(SellerInventoryBase):
    allowed_query_parameters = frozenset({"page", "is_active"})

    @extend_schema(
        responses=schemas.WarehousePage,
        parameters=[schemas.WarehouseFilter],
        operation_id="seller_warehouses_list",
    )
    def get(self, request: Request) -> Response:
        filter_serializer = schemas.WarehouseFilter(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)
        is_active = filter_serializer.validated_data.get("is_active")
        warehouses = selectors.list_warehouses(
            request.user,
            self.seller_access.seller.pk,
            is_active=is_active,
        )
        return paginated_response(self, request, warehouses, schemas.WarehouseOutput)

    @extend_schema(
        request=schemas.WarehouseInput,
        responses={201: schemas.WarehouseOutput},
        operation_id="seller_warehouses_create",
    )
    def post(self, request: Request) -> Response:
        serializer = schemas.WarehouseInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        warehouse = services.create_warehouse(
            self.seller_access.seller.pk,
            request.user,
            serializer.validated_data,
            remote_ip=client_ip(request._request),
        )
        return Response(schemas.WarehouseOutput(warehouse).data, status=status.HTTP_201_CREATED)


@extend_schema(parameters=[HEADER], tags=["Seller warehouses"])
class SellerWarehouseDetailView(SellerInventoryBase):
    @extend_schema(
        responses=schemas.WarehouseOutput,
        operation_id="seller_warehouse_get",
    )
    def get(self, request: Request, warehouse_id: UUID) -> Response:
        warehouse = selectors.get_warehouse(
            request.user,
            self.seller_access.seller.pk,
            warehouse_id,
        )
        return Response(schemas.WarehouseOutput(warehouse).data)

    @extend_schema(
        request=schemas.WarehouseUpdateInput,
        responses=schemas.WarehouseOutput,
        operation_id="seller_warehouse_update",
    )
    def put(self, request: Request, warehouse_id: UUID) -> Response:
        serializer = schemas.WarehouseUpdateInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        warehouse = services.update_warehouse(
            self.seller_access.seller.pk,
            request.user,
            warehouse_id,
            serializer.validated_data,
            remote_ip=client_ip(request._request),
        )
        return Response(schemas.WarehouseOutput(warehouse).data)


@extend_schema(parameters=[HEADER], tags=["Seller inventory"])
class SellerInventoryView(SellerInventoryBase):
    allowed_query_parameters = frozenset(
        {"page", "warehouse_id", "variant_id", "search", "low_stock"}
    )

    @extend_schema(
        responses=schemas.InventoryPage,
        parameters=[schemas.InventoryFilter],
        operation_id="seller_inventory_list",
    )
    def get(self, request: Request) -> Response:
        filter_serializer = schemas.InventoryFilter(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)
        data = filter_serializer.validated_data
        inventory = selectors.list_inventory(
            request.user,
            self.seller_access.seller.pk,
            warehouse_id=data.get("warehouse_id"),
            variant_id=data.get("variant_id"),
            search=data.get("search"),
            low_stock=data.get("low_stock"),
        )
        return paginated_response(self, request, inventory, schemas.InventoryOutput)

    @extend_schema(
        request=schemas.InventoryCreateInput,
        responses={201: schemas.InventoryOutput},
        operation_id="seller_inventory_create",
    )
    def post(self, request: Request) -> Response:
        serializer = schemas.InventoryCreateInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        item = services.get_or_create_inventory(
            self.seller_access.seller.pk,
            request.user,
            warehouse_id=data["warehouse_id"],
            variant_id=data["variant_id"],
            reorder_level=data.get("reorder_level", 0),
            remote_ip=client_ip(request._request),
        )
        return Response(schemas.InventoryOutput(item).data, status=status.HTTP_201_CREATED)


@extend_schema(parameters=[HEADER], tags=["Seller inventory"])
class SellerInventoryDetailView(SellerInventoryBase):
    @extend_schema(
        responses=schemas.InventoryOutput,
        operation_id="seller_inventory_get",
    )
    def get(self, request: Request, inventory_id: UUID) -> Response:
        item = selectors.get_inventory(
            request.user,
            self.seller_access.seller.pk,
            inventory_id,
        )
        return Response(schemas.InventoryOutput(item).data)


@extend_schema(parameters=[HEADER], tags=["Seller inventory"])
class SellerInventoryAdjustView(SellerInventoryBase):
    seller_capability = "inventory.adjust"

    @extend_schema(
        request=schemas.InventoryAdjustInput,
        responses=schemas.InventoryOutput,
        operation_id="seller_inventory_adjust",
    )
    def post(self, request: Request, inventory_id: UUID) -> Response:
        serializer = schemas.InventoryAdjustInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        item = services.adjust_inventory(
            self.seller_access.seller.pk,
            request.user,
            inventory_id,
            quantity_delta=data["quantity_delta"],
            reason=data["reason"],
            reference_type=data.get("reference_type", ""),
            reference_id=data.get("reference_id", ""),
            remote_ip=client_ip(request._request),
        )
        return Response(schemas.InventoryOutput(item).data)


@extend_schema(parameters=[HEADER], tags=["Seller inventory"])
class SellerInventoryReserveView(SellerInventoryBase):
    seller_capability = "inventory.adjust"

    @extend_schema(
        request=schemas.InventoryReserveInput,
        responses=schemas.InventoryOutput,
        operation_id="seller_inventory_reserve",
    )
    def post(self, request: Request, inventory_id: UUID) -> Response:
        serializer = schemas.InventoryReserveInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        item = services.reserve_inventory(
            self.seller_access.seller.pk,
            request.user,
            inventory_id,
            quantity=data["quantity"],
            reason=data.get("reason", ""),
            reference_type=data.get("reference_type", ""),
            reference_id=data.get("reference_id", ""),
            remote_ip=client_ip(request._request),
        )
        return Response(schemas.InventoryOutput(item).data)


@extend_schema(parameters=[HEADER], tags=["Seller inventory"])
class SellerInventoryReleaseView(SellerInventoryBase):
    seller_capability = "inventory.adjust"

    @extend_schema(
        request=schemas.InventoryReleaseInput,
        responses=schemas.InventoryOutput,
        operation_id="seller_inventory_release",
    )
    def post(self, request: Request, inventory_id: UUID) -> Response:
        serializer = schemas.InventoryReleaseInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        item = services.release_inventory(
            self.seller_access.seller.pk,
            request.user,
            inventory_id,
            quantity=data["quantity"],
            reason=data.get("reason", ""),
            reference_type=data.get("reference_type", ""),
            reference_id=data.get("reference_id", ""),
            remote_ip=client_ip(request._request),
        )
        return Response(schemas.InventoryOutput(item).data)


@extend_schema(parameters=[HEADER], tags=["Seller inventory"])
class SellerInventoryTransactionsView(SellerInventoryBase):
    allowed_query_parameters = frozenset({"page", "inventory_id", "type"})

    @extend_schema(
        responses=schemas.InventoryTransactionPage,
        parameters=[schemas.TransactionFilter],
        operation_id="seller_inventory_transactions_list",
    )
    def get(self, request: Request) -> Response:
        filter_serializer = schemas.TransactionFilter(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)
        data = filter_serializer.validated_data
        transactions = selectors.list_transactions(
            request.user,
            self.seller_access.seller.pk,
            inventory_id=data.get("inventory_id"),
            transaction_type=data.get("type"),
        )
        return paginated_response(self, request, transactions, schemas.InventoryTransactionOutput)


@extend_schema(parameters=[HEADER], tags=["Seller inventory"])
class SellerInventoryItemTransactionsView(SellerInventoryBase):
    allowed_query_parameters = frozenset({"page", "type"})

    @extend_schema(
        responses=schemas.InventoryTransactionPage,
        parameters=[schemas.TransactionFilter],
        operation_id="seller_inventory_item_transactions_list",
    )
    def get(self, request: Request, inventory_id: UUID) -> Response:
        filter_serializer = schemas.TransactionFilter(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)
        data = filter_serializer.validated_data
        transactions = selectors.list_transactions(
            request.user,
            self.seller_access.seller.pk,
            inventory_id=inventory_id,
            transaction_type=data.get("type"),
        )
        return paginated_response(self, request, transactions, schemas.InventoryTransactionOutput)


@extend_schema(tags=["Platform inventory"])
class PlatformInventoryView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.inventory.read"
    allowed_query_parameters = frozenset(
        {"page", "seller_id", "warehouse_id", "search", "low_stock"}
    )

    @extend_schema(
        responses=schemas.InventoryPage,
        parameters=[schemas.InventoryFilter],
        operation_id="platform_inventory_list",
    )
    def get(self, request: Request) -> Response:
        filter_serializer = schemas.InventoryFilter(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)
        data = filter_serializer.validated_data
        inventory = selectors.list_platform_inventory(
            request.user,
            seller_id=data.get("seller_id"),
            warehouse_id=data.get("warehouse_id"),
            search=data.get("search"),
            low_stock=data.get("low_stock"),
        )
        return paginated_response(self, request, inventory, schemas.InventoryOutput)


@extend_schema(tags=["Platform inventory"])
class PlatformInventoryDetailView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.inventory.read"

    @extend_schema(
        responses=schemas.InventoryOutput,
        operation_id="platform_inventory_get",
    )
    def get(self, request: Request, inventory_id: UUID) -> Response:
        item = selectors.get_platform_inventory(request.user, inventory_id)
        return Response(schemas.InventoryOutput(item).data)


@extend_schema(tags=["Platform inventory"])
class PlatformInventoryTransactionsView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.inventory.read"
    allowed_query_parameters = frozenset({"page", "inventory_id", "seller_id", "type"})

    @extend_schema(
        responses=schemas.InventoryTransactionPage,
        parameters=[schemas.TransactionFilter],
        operation_id="platform_inventory_transactions_list",
    )
    def get(self, request: Request) -> Response:
        filter_serializer = schemas.TransactionFilter(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)
        data = filter_serializer.validated_data
        transactions = selectors.list_platform_transactions(
            request.user,
            inventory_id=data.get("inventory_id"),
            seller_id=data.get("seller_id"),
            transaction_type=data.get("type"),
        )
        return paginated_response(self, request, transactions, schemas.InventoryTransactionOutput)
