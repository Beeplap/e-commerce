from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F, Sum
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.request import Request

from apps.catalog.models import ProductVariant
from apps.inventory.models import Inventory
from apps.sellers.models import Seller

from .models import Cart, CartItem

User = get_user_model()


def get_variant_available_stock(variant: ProductVariant) -> int:
    """
    Computes real-time available inventory (quantity_on_hand - quantity_reserved)
    across all active warehouses for the variant's seller.
    Returns 0 if seller, product, or variant is inactive.
    """
    if (
        variant.status != ProductVariant.Status.ACTIVE
        or variant.product.status != "active"
        or variant.product.seller.status != Seller.Status.ACTIVE
    ):
        return 0

    agg = Inventory.objects.filter(
        variant=variant,
        warehouse__is_active=True,
        warehouse__seller_id=variant.product.seller_id,
    ).aggregate(available=Sum(F("quantity_on_hand") - F("quantity_reserved"), default=0))
    return max(0, int(agg["available"] or 0))


def get_or_create_cart(request: Request) -> Cart:
    """
    Resolves the authorized cart for the current request.
    If authenticated, returns the user's cart.
    If guest, assigns or reuses session_key and returns the session cart.
    """
    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        cart, _ = Cart.objects.get_or_create(user=user)
        return cart

    session = request._request.session
    if not session.session_key:
        session.save()
    session_key = session.session_key
    cart, _ = Cart.objects.get_or_create(session_key=session_key)
    return cart


@transaction.atomic
def add_item_to_cart(cart: Cart, *, variant_id: UUID, quantity: int = 1) -> CartItem:
    """
    Adds a product variant to the cart or increments existing quantity.
    Validates variant and seller active state and caps requested quantity at available stock.
    """
    if quantity <= 0:
        raise ValidationError({"quantity": "Quantity must be greater than zero."})

    try:
        variant = ProductVariant.objects.select_related("product__seller").get(id=variant_id)
    except ProductVariant.DoesNotExist:
        raise ValidationError({"variant_id": "Product variant does not exist."}) from None

    if (
        variant.status != ProductVariant.Status.ACTIVE
        or variant.product.status != "active"
        or variant.product.seller.status != Seller.Status.ACTIVE
    ):
        raise ValidationError({"variant_id": "This product variant is currently unavailable."})

    available = get_variant_available_stock(variant)
    if available <= 0:
        raise ValidationError({"quantity": "This item is currently out of stock."})

    existing_item = cart.items.filter(variant=variant).first()
    if existing_item:
        target_qty = existing_item.quantity + quantity
        existing_item.quantity = min(target_qty, available)
        existing_item.save(update_fields=["quantity", "updated_at"])
        return existing_item

    initial_qty = min(quantity, available)
    return CartItem.objects.create(cart=cart, variant=variant, quantity=initial_qty)


@transaction.atomic
def update_item_quantity(cart: Cart, *, item_id: UUID, quantity: int) -> CartItem | None:
    """
    Updates the quantity of a cart item, capping at real-time available stock.
    If quantity is 0, removes the item.
    Enforces strict cart ownership: throws 404 if item does not belong to this cart.
    """
    item = cart.items.select_related("variant__product__seller").filter(id=item_id).first()
    if not item:
        raise NotFound("Cart item not found.")

    if quantity <= 0:
        item.delete()
        return None

    available = get_variant_available_stock(item.variant)
    capped_quantity = min(quantity, max(1, available))
    item.quantity = capped_quantity
    item.save(update_fields=["quantity", "updated_at"])
    return item


@transaction.atomic
def remove_item_from_cart(cart: Cart, *, item_id: UUID) -> bool:
    """
    Removes a specific item from the cart.
    Enforces strict cart ownership: throws 404 if item does not belong to this cart.
    """
    item = cart.items.filter(id=item_id).first()
    if not item:
        raise NotFound("Cart item not found.")

    item.delete()
    return True


@transaction.atomic
def clear_cart(cart: Cart) -> None:
    """
    Empties all items from the cart.
    """
    cart.items.all().delete()


@transaction.atomic
def merge_guest_cart_into_user_cart(*, guest_session_key: str, user: Any) -> Cart:
    """
    Merges an anonymous guest session cart into an authenticated user's cart on login.
    Caps merged quantities at current available stock without exceeding limits.
    Deletes the guest cart upon completion.
    """
    user_cart, _ = Cart.objects.get_or_create(user=user)
    guest_cart = Cart.objects.filter(session_key=guest_session_key).first()
    if not guest_cart:
        return user_cart

    guest_items = list(guest_cart.items.select_related("variant__product__seller").all())
    for g_item in guest_items:
        available = get_variant_available_stock(g_item.variant)
        existing_u_item = user_cart.items.filter(variant=g_item.variant).first()
        if existing_u_item:
            target_qty = existing_u_item.quantity + g_item.quantity
            existing_u_item.quantity = (
                min(target_qty, available) if available > 0 else existing_u_item.quantity
            )
            existing_u_item.save(update_fields=["quantity", "updated_at"])
        else:
            qty = min(g_item.quantity, available) if available > 0 else 1
            CartItem.objects.create(cart=user_cart, variant=g_item.variant, quantity=qty)

    guest_cart.delete()
    return user_cart


def validate_cart_stock(cart: Cart) -> tuple[bool, list[dict[str, Any]]]:
    """
    Validates that each item in the cart has sufficient available stock.
    Returns (is_valid, issues).
    """
    issues: list[dict[str, Any]] = []
    is_valid = True

    items = cart.items.select_related("variant__product__seller").all()
    for item in items:
        available = get_variant_available_stock(item.variant)
        if available <= 0:
            is_valid = False
            issues.append(
                {
                    "item_id": str(item.id),
                    "variant_id": str(item.variant_id),
                    "sku": item.variant.sku,
                    "requested_quantity": item.quantity,
                    "available_stock": 0,
                    "issue": "out_of_stock",
                    "message": (
                        f"'{item.variant.product.name} ({item.variant.sku})' "
                        "is currently out of stock."
                    ),
                }
            )
        elif item.quantity > available:
            is_valid = False
            issues.append(
                {
                    "item_id": str(item.id),
                    "variant_id": str(item.variant_id),
                    "sku": item.variant.sku,
                    "requested_quantity": item.quantity,
                    "available_stock": available,
                    "issue": "insufficient_stock",
                    "message": (
                        f"Only {available} units available for "
                        f"'{item.variant.product.name} ({item.variant.sku})'."
                    ),
                }
            )

    return is_valid, issues


def format_cart_response(cart: Cart) -> dict[str, Any]:
    """
    Constructs a complete cart dictionary grouped neatly by seller with line subtotals,
    seller subtotals, and real-time stock availability warnings.
    """
    items = list(
        cart.items.select_related("variant__product__seller")
        .prefetch_related("variant__product__images")
        .order_by("created_at")
    )

    total_items = 0
    subtotal_acc = Decimal("0.00")
    has_out_of_stock = False

    # Group by seller
    sellers_map: dict[str, dict[str, Any]] = {}

    for item in items:
        variant = item.variant
        product = variant.product
        seller = product.seller

        seller_id_str = str(seller.id)
        if seller_id_str not in sellers_map:
            sellers_map[seller_id_str] = {
                "seller_id": seller.id,
                "seller_name": seller.display_name,
                "seller_slug": seller.slug,
                "subtotal": Decimal("0.00"),
                "item_count": 0,
                "items": [],
            }

        unit_price = Decimal(str(variant.price))
        compare_at = Decimal(str(variant.compare_at_price)) if variant.compare_at_price else None
        line_subtotal = unit_price * item.quantity

        available = get_variant_available_stock(variant)
        is_available = available >= item.quantity and available > 0

        if not is_available:
            has_out_of_stock = True

        stock_warning = None
        if available <= 0:
            stock_warning = "Out of stock"
        elif item.quantity > available:
            stock_warning = f"Only {available} available"
        elif available <= 5:
            stock_warning = f"Only {available} left in stock"

        images = list(product.images.all())
        thumbnail_url = (
            f"/api/v1/storefront/products/{product.id}/images/{images[0].id}" if images else None
        )

        sellers_map[seller_id_str]["items"].append(
            {
                "id": item.id,
                "variant_id": variant.id,
                "product_id": product.id,
                "product_title": product.name,
                "product_slug": product.slug,
                "variant_name": variant.sku,
                "sku": variant.sku,
                "thumbnail_url": thumbnail_url,
                "unit_price": f"{unit_price:.2f}",
                "compare_at_price": f"{compare_at:.2f}" if compare_at else None,
                "quantity": item.quantity,
                "line_subtotal": f"{line_subtotal:.2f}",
                "available_stock": available,
                "is_available": is_available,
                "stock_warning": stock_warning,
            }
        )

        sellers_map[seller_id_str]["subtotal"] += line_subtotal
        sellers_map[seller_id_str]["item_count"] += item.quantity
        total_items += item.quantity
        subtotal_acc += line_subtotal

    sellers_list = []
    for s_data in sellers_map.values():
        s_data["subtotal"] = f"{s_data['subtotal']:.2f}"
        sellers_list.append(s_data)

    return {
        "id": cart.id,
        "total_items": total_items,
        "total_unique_items": len(items),
        "subtotal": f"{subtotal_acc:.2f}",
        "currency": "USD",
        "has_out_of_stock_items": has_out_of_stock,
        "sellers": sellers_list,
    }
