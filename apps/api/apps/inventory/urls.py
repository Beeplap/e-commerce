from django.urls import path

from apps.inventory import views

urlpatterns = [
    path("seller/warehouses", views.SellerWarehousesView.as_view()),
    path("seller/warehouses/<uuid:warehouse_id>", views.SellerWarehouseDetailView.as_view()),
    path("seller/inventory", views.SellerInventoryView.as_view()),
    path("seller/inventory/transactions", views.SellerInventoryTransactionsView.as_view()),
    path("seller/inventory/<uuid:inventory_id>", views.SellerInventoryDetailView.as_view()),
    path("seller/inventory/<uuid:inventory_id>/adjust", views.SellerInventoryAdjustView.as_view()),
    path(
        "seller/inventory/<uuid:inventory_id>/reserve", views.SellerInventoryReserveView.as_view()
    ),
    path(
        "seller/inventory/<uuid:inventory_id>/release", views.SellerInventoryReleaseView.as_view()
    ),
    path(
        "seller/inventory/<uuid:inventory_id>/transactions",
        views.SellerInventoryItemTransactionsView.as_view(),
    ),
    path("admin/inventory", views.PlatformInventoryView.as_view()),
    path("admin/inventory/transactions", views.PlatformInventoryTransactionsView.as_view()),
    path("admin/inventory/<uuid:inventory_id>", views.PlatformInventoryDetailView.as_view()),
]
