from __future__ import annotations

from typing import Any

from rest_framework import serializers


class DateRangeSerializer(serializers.Serializer[Any]):
    start_date = serializers.CharField()
    end_date = serializers.CharField()


class SalesOverTimePointSerializer(serializers.Serializer[Any]):
    date = serializers.CharField()
    gross_sales = serializers.CharField()
    net_sales = serializers.CharField()
    orders_count = serializers.IntegerField()


class TopProductSerializer(serializers.Serializer[Any]):
    id = serializers.CharField()
    name = serializers.CharField()
    units_sold = serializers.IntegerField()
    revenue = serializers.CharField()


class PayoutInfoSerializer(serializers.Serializer[Any]):
    total_paid_out = serializers.CharField()
    last_payout_amount = serializers.CharField(allow_null=True)
    last_payout_status = serializers.CharField(allow_null=True)
    last_payout_date = serializers.CharField(allow_null=True)


class SellerDashboardMetricsSerializer(serializers.Serializer[Any]):
    date_range = DateRangeSerializer()
    gross_sales = serializers.CharField()
    net_sales = serializers.CharField()
    orders_count = serializers.IntegerField()
    average_order_value = serializers.CharField()
    units_sold = serializers.IntegerField()
    pending_orders = serializers.IntegerField()
    low_stock_variants = serializers.IntegerField()
    returns_count = serializers.IntegerField()
    platform_fees = serializers.CharField()
    available_balance = serializers.CharField()
    pending_balance = serializers.CharField()
    payout_info = PayoutInfoSerializer()
    top_products = TopProductSerializer(many=True)
    sales_over_time = SalesOverTimePointSerializer(many=True)


class PlatformSalesOverTimePointSerializer(serializers.Serializer[Any]):
    date = serializers.CharField()
    gmv = serializers.CharField()
    platform_revenue = serializers.CharField()
    orders_count = serializers.IntegerField()


class TopCategorySerializer(serializers.Serializer[Any]):
    id = serializers.CharField()
    name = serializers.CharField()
    units_sold = serializers.IntegerField()
    revenue = serializers.CharField()


class TopSellerSerializer(serializers.Serializer[Any]):
    id = serializers.CharField()
    name = serializers.CharField()
    gross_sales = serializers.CharField()
    orders_count = serializers.IntegerField()


class PlatformDashboardMetricsSerializer(serializers.Serializer[Any]):
    date_range = DateRangeSerializer()
    gmv = serializers.CharField()
    platform_revenue = serializers.CharField()
    commission_revenue = serializers.CharField()
    orders_count = serializers.IntegerField()
    active_sellers = serializers.IntegerField()
    pending_seller_approvals = serializers.IntegerField()
    customers_count = serializers.IntegerField()
    refund_rate = serializers.FloatField()
    return_rate = serializers.FloatField()
    average_order_value = serializers.CharField()
    outstanding_seller_balances = serializers.CharField()
    upcoming_payouts = serializers.CharField()
    new_seller_registrations = serializers.IntegerField()
    top_categories = TopCategorySerializer(many=True)
    top_sellers = TopSellerSerializer(many=True)
    sales_over_time = PlatformSalesOverTimePointSerializer(many=True)
