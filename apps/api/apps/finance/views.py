from __future__ import annotations

from typing import Any
from uuid import UUID

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.views import BrowserAPIView
from apps.finance import selectors, services
from apps.finance import serializers as schemas
from apps.platform_access.permissions import PlatformCapabilityRequired
from apps.sellers.permissions import SellerCapabilityRequired
from apps.sellers.selectors import SellerAccess
from config.pagination import paginated_response

HEADER = OpenApiParameter("X-Seller-ID", OpenApiTypes.UUID, OpenApiParameter.HEADER, required=True)


class SellerFinanceBase(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "finance.read"
    seller_access: SellerAccess


class SellerPayoutBase(BrowserAPIView):
    permission_classes = [SellerCapabilityRequired]
    seller_capability = "payouts.read"
    seller_access: SellerAccess


class AdminFinanceReadBase(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.finance.read"


class AdminFinanceManageBase(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]
    platform_capability = "platform.finance.manage"


# --- Seller Views ---


@extend_schema(parameters=[HEADER], tags=["Seller finance"])
class SellerBalanceView(SellerFinanceBase):
    @extend_schema(responses=schemas.SellerBalanceSerializer, operation_id="seller_finance_balance")
    def get(self, request: Request) -> Response:
        balance = selectors.seller_balance(request.user, self.seller_access.seller.pk)
        return Response(schemas.SellerBalanceSerializer(balance).data)


@extend_schema(parameters=[HEADER], tags=["Seller finance"])
class SellerLedgerView(SellerFinanceBase):
    allowed_query_parameters = frozenset({"page", "entry_type"})

    @extend_schema(
        responses=schemas.SellerLedgerEntryPage,
        parameters=[schemas.SellerLedgerFilterSerializer],
        operation_id="seller_finance_ledger_list",
    )
    def get(self, request: Request) -> Response:
        filter_serializer = schemas.SellerLedgerFilterSerializer(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)
        entries = selectors.seller_ledger_entries(
            actor=request.user,
            seller_id=self.seller_access.seller.pk,
            entry_type=filter_serializer.validated_data.get("entry_type"),
        )
        return paginated_response(self, request, entries, schemas.SellerLedgerEntrySerializer)


@extend_schema(parameters=[HEADER], tags=["Seller finance"])
class SellerPayoutsView(SellerPayoutBase):
    allowed_query_parameters = frozenset({"page", "status"})

    @extend_schema(
        responses=schemas.PayoutPage,
        parameters=[schemas.SellerPayoutFilterSerializer],
        operation_id="seller_finance_payouts_list",
    )
    def get(self, request: Request) -> Response:
        filter_serializer = schemas.SellerPayoutFilterSerializer(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)
        payouts = selectors.seller_payouts(
            actor=request.user,
            seller_id=self.seller_access.seller.pk,
            status=filter_serializer.validated_data.get("status"),
        )
        return paginated_response(self, request, payouts, schemas.PayoutSerializer)

    @extend_schema(
        request=schemas.PayoutRequestSerializer,
        responses={201: schemas.PayoutSerializer},
        operation_id="seller_finance_payout_request",
    )
    def post(self, request: Request) -> Response:
        serializer = schemas.PayoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payout = services.request_payout(
            actor=request.user,
            seller_id=self.seller_access.seller.pk,
            amount=serializer.validated_data["amount"],
            notes=serializer.validated_data.get("notes", ""),
            period_start=serializer.validated_data.get("period_start"),
            period_end=serializer.validated_data.get("period_end"),
        )
        return Response(schemas.PayoutSerializer(payout).data, status=status.HTTP_201_CREATED)


@extend_schema(parameters=[HEADER], tags=["Seller finance"])
class SellerPayoutDetailView(SellerPayoutBase):
    @extend_schema(responses=schemas.PayoutSerializer, operation_id="seller_finance_payout_detail")
    def get(self, request: Request, id: UUID) -> Response:
        payout = selectors.seller_payout_detail(
            actor=request.user,
            seller_id=self.seller_access.seller.pk,
            payout_id=id,
        )
        return Response(schemas.PayoutSerializer(payout).data)


# --- Platform Admin Views ---


@extend_schema(tags=["Platform finance"])
class AdminFinanceSummaryView(AdminFinanceReadBase):
    @extend_schema(
        responses=schemas.AdminFinanceSummarySerializer, operation_id="admin_finance_summary"
    )
    def get(self, request: Request) -> Response:
        summary = selectors.admin_finance_summary(request.user)
        return Response(schemas.AdminFinanceSummarySerializer(summary).data)


@extend_schema(tags=["Platform finance"])
class AdminCommissionPlansView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]

    def get_permissions(self) -> list[Any]:
        if self.request.method == "POST":
            self.platform_capability = "platform.finance.manage"
        else:
            self.platform_capability = "platform.finance.read"
        return list(super().get_permissions())

    @extend_schema(
        responses=schemas.CommissionPlanPage, operation_id="admin_finance_commission_plans_list"
    )
    def get(self, request: Request) -> Response:
        plans = selectors.admin_commission_plans(request.user)
        return paginated_response(self, request, plans, schemas.CommissionPlanSerializer)

    @extend_schema(
        request=schemas.CommissionPlanCreateSerializer,
        responses={201: schemas.CommissionPlanSerializer},
        operation_id="admin_finance_commission_plan_create",
    )
    def post(self, request: Request) -> Response:
        serializer = schemas.CommissionPlanCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan = services.create_commission_plan(
            actor=request.user,
            name=serializer.validated_data["name"],
            default_percentage=serializer.validated_data["default_percentage"],
            description=serializer.validated_data.get("description", ""),
            is_default=serializer.validated_data.get("is_default", False),
        )
        return Response(schemas.CommissionPlanSerializer(plan).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Platform finance"])
class AdminCommissionPlanDetailView(BrowserAPIView):
    permission_classes = [PlatformCapabilityRequired]

    def get_permissions(self) -> list[Any]:
        if self.request.method in ["PUT", "PATCH", "DELETE"]:
            self.platform_capability = "platform.finance.manage"
        else:
            self.platform_capability = "platform.finance.read"
        return list(super().get_permissions())

    @extend_schema(
        responses=schemas.CommissionPlanSerializer,
        operation_id="admin_finance_commission_plan_detail",
    )
    def get(self, request: Request, id: UUID) -> Response:
        plan = selectors.admin_commission_plan_detail(request.user, id)
        return Response(schemas.CommissionPlanSerializer(plan).data)

    @extend_schema(
        request=schemas.CommissionPlanUpdateSerializer,
        responses=schemas.CommissionPlanSerializer,
        operation_id="admin_finance_commission_plan_update",
    )
    def put(self, request: Request, id: UUID) -> Response:
        serializer = schemas.CommissionPlanUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan = services.update_commission_plan(
            actor=request.user,
            plan_id=id,
            name=serializer.validated_data["name"],
            default_percentage=serializer.validated_data["default_percentage"],
            description=serializer.validated_data.get("description", ""),
            is_active=serializer.validated_data.get("is_active", True),
            is_default=serializer.validated_data.get("is_default", False),
        )
        return Response(schemas.CommissionPlanSerializer(plan).data)


@extend_schema(tags=["Platform finance"])
class AdminCommissionRuleCreateView(AdminFinanceManageBase):
    @extend_schema(
        request=schemas.CommissionRuleCreateSerializer,
        responses={201: schemas.CommissionRuleSerializer},
        operation_id="admin_finance_commission_rule_create",
    )
    def post(self, request: Request, id: UUID) -> Response:
        serializer = schemas.CommissionRuleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rule = services.create_commission_rule(
            actor=request.user,
            plan_id=id,
            percentage=serializer.validated_data["percentage"],
            fixed_fee=serializer.validated_data.get("fixed_fee", 0),
            seller_id=serializer.validated_data.get("seller_id"),
            category_id=serializer.validated_data.get("category_id"),
            priority=serializer.validated_data.get("priority", 0),
        )
        return Response(schemas.CommissionRuleSerializer(rule).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Platform finance"])
class AdminCommissionRuleDetailView(AdminFinanceManageBase):
    @extend_schema(
        request=schemas.CommissionRuleUpdateSerializer,
        responses=schemas.CommissionRuleSerializer,
        operation_id="admin_finance_commission_rule_update",
    )
    def put(self, request: Request, id: UUID) -> Response:
        serializer = schemas.CommissionRuleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rule = services.update_commission_rule(
            actor=request.user,
            rule_id=id,
            percentage=serializer.validated_data["percentage"],
            fixed_fee=serializer.validated_data["fixed_fee"],
            priority=serializer.validated_data["priority"],
            is_active=serializer.validated_data["is_active"],
        )
        return Response(schemas.CommissionRuleSerializer(rule).data)

    @extend_schema(
        responses={204: None},
        operation_id="admin_finance_commission_rule_delete",
    )
    def delete(self, request: Request, id: UUID) -> Response:
        services.delete_commission_rule(actor=request.user, rule_id=id)
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Platform finance"])
class AdminSellerBalancesView(AdminFinanceReadBase):
    allowed_query_parameters = frozenset({"page", "search"})

    @extend_schema(
        responses=schemas.AdminSellerBalancePage,
        parameters=[schemas.AdminSellerBalanceFilterSerializer],
        operation_id="admin_finance_seller_balances_list",
    )
    def get(self, request: Request) -> Response:
        filter_serializer = schemas.AdminSellerBalanceFilterSerializer(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)
        balances = selectors.admin_seller_balances(
            actor=request.user,
            search=filter_serializer.validated_data.get("search"),
        )
        return paginated_response(self, request, balances, schemas.AdminSellerBalanceSerializer)


@extend_schema(tags=["Platform finance"])
class AdminSellerBalanceDetailView(AdminFinanceReadBase):
    @extend_schema(
        responses=schemas.AdminSellerBalanceSerializer,
        operation_id="admin_finance_seller_balance_detail",
    )
    def get(self, request: Request, seller_id: UUID) -> Response:
        balance = selectors.admin_seller_balance_detail(request.user, seller_id)
        return Response(schemas.AdminSellerBalanceSerializer(balance).data)


@extend_schema(tags=["Platform finance"])
class AdminSellerBalanceAdjustmentView(AdminFinanceManageBase):
    @extend_schema(
        request=schemas.AdminBalanceAdjustmentSerializer,
        responses={201: schemas.SellerLedgerEntrySerializer},
        operation_id="admin_finance_seller_balance_adjust",
    )
    def post(self, request: Request, seller_id: UUID) -> Response:
        serializer = schemas.AdminBalanceAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = services.create_ledger_adjustment(
            actor=request.user,
            seller_id=seller_id,
            amount=serializer.validated_data["amount"],
            description=serializer.validated_data["description"],
        )
        return Response(
            schemas.SellerLedgerEntrySerializer(entry).data, status=status.HTTP_201_CREATED
        )


@extend_schema(tags=["Platform finance"])
class AdminPayoutsView(AdminFinanceReadBase):
    allowed_query_parameters = frozenset({"page", "status", "seller_id"})

    @extend_schema(
        responses=schemas.PayoutPage,
        parameters=[schemas.AdminPayoutFilterSerializer],
        operation_id="admin_finance_payouts_list",
    )
    def get(self, request: Request) -> Response:
        filter_serializer = schemas.AdminPayoutFilterSerializer(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)
        payouts = selectors.admin_payouts(
            actor=request.user,
            status=filter_serializer.validated_data.get("status"),
            seller_id=filter_serializer.validated_data.get("seller_id"),
        )
        return paginated_response(self, request, payouts, schemas.PayoutSerializer)


@extend_schema(tags=["Platform finance"])
class AdminPayoutDetailView(AdminFinanceReadBase):
    @extend_schema(responses=schemas.PayoutSerializer, operation_id="admin_finance_payout_detail")
    def get(self, request: Request, id: UUID) -> Response:
        payout = selectors.admin_payout_detail(request.user, id)
        return Response(schemas.PayoutSerializer(payout).data)


@extend_schema(tags=["Platform finance"])
class AdminPayoutApproveView(AdminFinanceManageBase):
    @extend_schema(
        request=None,
        responses=schemas.PayoutSerializer,
        operation_id="admin_finance_payout_approve",
    )
    def post(self, request: Request, id: UUID) -> Response:
        payout = services.approve_payout(actor=request.user, payout_id=id)
        return Response(schemas.PayoutSerializer(payout).data)


@extend_schema(tags=["Platform finance"])
class AdminPayoutProcessView(AdminFinanceManageBase):
    @extend_schema(
        request=schemas.PayoutProcessSerializer,
        responses=schemas.PayoutSerializer,
        operation_id="admin_finance_payout_process",
    )
    def post(self, request: Request, id: UUID) -> Response:
        serializer = schemas.PayoutProcessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payout = services.process_payout(
            actor=request.user,
            payout_id=id,
            payout_reference=serializer.validated_data.get("payout_reference", ""),
        )
        return Response(schemas.PayoutSerializer(payout).data)


@extend_schema(tags=["Platform finance"])
class AdminPayoutRejectView(AdminFinanceManageBase):
    @extend_schema(
        request=schemas.PayoutRejectSerializer,
        responses=schemas.PayoutSerializer,
        operation_id="admin_finance_payout_reject",
    )
    def post(self, request: Request, id: UUID) -> Response:
        serializer = schemas.PayoutRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payout = services.reject_payout(
            actor=request.user,
            payout_id=id,
            rejection_reason=serializer.validated_data["reason"],
        )
        return Response(schemas.PayoutSerializer(payout).data)


@extend_schema(tags=["Platform finance"])
class AdminCommissionPreviewView(AdminFinanceReadBase):
    @extend_schema(
        request=schemas.CommissionCalculationPreviewSerializer,
        responses=schemas.CommissionCalculationResultSerializer,
        operation_id="admin_finance_commission_preview",
    )
    def post(self, request: Request) -> Response:
        serializer = schemas.CommissionCalculationPreviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = services.calculate_commission(
            amount=serializer.validated_data["amount"],
            seller=serializer.validated_data.get("seller_id"),
            category=serializer.validated_data.get("category_id"),
            plan=serializer.validated_data.get("plan_id"),
        )
        return Response(
            schemas.CommissionCalculationResultSerializer(
                {
                    "plan_id": result.plan_id,
                    "rule_id": result.rule_id,
                    "percentage": result.percentage,
                    "fixed_fee": result.fixed_fee,
                    "commission_amount": result.commission_amount,
                    "seller_net_amount": result.seller_net_amount,
                }
            ).data
        )
