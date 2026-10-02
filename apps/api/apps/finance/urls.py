from django.urls import path

from apps.finance import views

urlpatterns = [
    # Seller Finance
    path(
        "seller/finance/balance", views.SellerBalanceView.as_view(), name="seller-finance-balance"
    ),
    path(
        "seller/finance/transactions",
        views.SellerLedgerView.as_view(),
        name="seller-finance-transactions",
    ),
    path(
        "seller/finance/payouts", views.SellerPayoutsView.as_view(), name="seller-finance-payouts"
    ),
    path(
        "seller/finance/payouts/<uuid:id>",
        views.SellerPayoutDetailView.as_view(),
        name="seller-finance-payout-detail",
    ),
    # Platform Admin Finance
    path(
        "admin/finance/summary",
        views.AdminFinanceSummaryView.as_view(),
        name="admin-finance-summary",
    ),
    path(
        "admin/finance/commissions/plans",
        views.AdminCommissionPlansView.as_view(),
        name="admin-finance-commission-plans",
    ),
    path(
        "admin/finance/commissions/plans/<uuid:id>",
        views.AdminCommissionPlanDetailView.as_view(),
        name="admin-finance-commission-plan-detail",
    ),
    path(
        "admin/finance/commissions/plans/<uuid:id>/rules",
        views.AdminCommissionRuleCreateView.as_view(),
        name="admin-finance-commission-rule-create",
    ),
    path(
        "admin/finance/commissions/rules/<uuid:id>",
        views.AdminCommissionRuleDetailView.as_view(),
        name="admin-finance-commission-rule-detail",
    ),
    path(
        "admin/finance/commissions/preview",
        views.AdminCommissionPreviewView.as_view(),
        name="admin-finance-commission-preview",
    ),
    path(
        "admin/finance/seller-balances",
        views.AdminSellerBalancesView.as_view(),
        name="admin-finance-seller-balances",
    ),
    path(
        "admin/finance/seller-balances/<uuid:seller_id>",
        views.AdminSellerBalanceDetailView.as_view(),
        name="admin-finance-seller-balance-detail",
    ),
    path(
        "admin/finance/seller-balances/<uuid:seller_id>/adjust",
        views.AdminSellerBalanceAdjustmentView.as_view(),
        name="admin-finance-seller-balance-adjust",
    ),
    path("admin/finance/payouts", views.AdminPayoutsView.as_view(), name="admin-finance-payouts"),
    path(
        "admin/finance/payouts/<uuid:id>",
        views.AdminPayoutDetailView.as_view(),
        name="admin-finance-payout-detail",
    ),
    path(
        "admin/finance/payouts/<uuid:id>/approve",
        views.AdminPayoutApproveView.as_view(),
        name="admin-finance-payout-approve",
    ),
    path(
        "admin/finance/payouts/<uuid:id>/process",
        views.AdminPayoutProcessView.as_view(),
        name="admin-finance-payout-process",
    ),
    path(
        "admin/finance/payouts/<uuid:id>/reject",
        views.AdminPayoutRejectView.as_view(),
        name="admin-finance-payout-reject",
    ),
]
