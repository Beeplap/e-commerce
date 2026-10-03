from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F, Q, Sum
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.request import Request

from apps.cart.models import Cart, CartItem
from apps.cart.services import get_or_create_cart
from apps.catalog.models import ProductVariant
from apps.checkout.models import CustomerAddress
from apps.events.services import publish_outbox_event
from apps.finance.services import calculate_commission
from apps.fulfillment.models import ShippingMethod, ShippingRate
from apps.inventory.models import Inventory
from apps.inventory.services import reserve_order_inventory
from apps.orders.models import Order, OrderItem, OrderStatusHistory, SellerOrder
from apps.promotions.models import Coupon
from apps.promotions.services import evaluate_coupon_discount, record_coupon_redemption
from apps.sellers.models import Seller

User = get_user_model()


# ---------------------------------------------------------------------------
# Customer Addresses
# ---------------------------------------------------------------------------


def list_customer_addresses(user: Any) -> list[CustomerAddress]:
    if not user or not user.is_authenticated:
        return []
    return list(CustomerAddress.objects.filter(user=user))


def get_customer_address(user: Any, address_id: UUID) -> CustomerAddress:
    if not user or not user.is_authenticated:
        raise NotFound("Address not found.")
    try:
        return CustomerAddress.objects.get(pk=address_id, user=user)
    except CustomerAddress.DoesNotExist:
        raise NotFound("Address not found.") from None


@transaction.atomic
def create_customer_address(user: Any, data: dict[str, Any]) -> CustomerAddress:
    if not user or not user.is_authenticated:
        raise ValidationError({"detail": "Authentication required to save addresses."})

    full_name = str(data.get("full_name", "")).strip()
    phone = str(data.get("phone", "")).strip()
    line1 = str(data.get("line1", "")).strip()
    line2 = str(data.get("line2", "")).strip()
    city = str(data.get("city", "")).strip()
    state = str(data.get("state", "")).strip()
    postal_code = str(data.get("postal_code", "")).strip()
    country = str(data.get("country", "US")).strip().upper()
    is_default = bool(data.get("is_default", False))

    if not full_name:
        raise ValidationError({"full_name": "Full name is required."})
    if not phone:
        raise ValidationError({"phone": "Phone number is required."})
    if not line1:
        raise ValidationError({"line1": "Street address is required."})
    if not city:
        raise ValidationError({"city": "City is required."})
    if not state:
        raise ValidationError({"state": "State is required."})
    if not postal_code:
        raise ValidationError({"postal_code": "Postal code is required."})
    if len(country) != 2:
        raise ValidationError({"country": "Country must be a 2-letter ISO code."})

    address = CustomerAddress(
        user=user,
        full_name=full_name,
        phone=phone,
        line1=line1,
        line2=line2,
        city=city,
        state=state,
        postal_code=postal_code,
        country=country,
        is_default=is_default,
    )
    address.save()
    return address


@transaction.atomic
def update_customer_address(user: Any, address_id: UUID, data: dict[str, Any]) -> CustomerAddress:
    address = get_customer_address(user, address_id)

    if "full_name" in data:
        name = str(data["full_name"]).strip()
        if not name:
            raise ValidationError({"full_name": "Full name cannot be empty."})
        address.full_name = name

    if "phone" in data:
        phone = str(data["phone"]).strip()
        if not phone:
            raise ValidationError({"phone": "Phone cannot be empty."})
        address.phone = phone

    if "line1" in data:
        line1 = str(data["line1"]).strip()
        if not line1:
            raise ValidationError({"line1": "Street address cannot be empty."})
        address.line1 = line1

    if "line2" in data:
        address.line2 = str(data["line2"]).strip()

    if "city" in data:
        city = str(data["city"]).strip()
        if not city:
            raise ValidationError({"city": "City cannot be empty."})
        address.city = city

    if "state" in data:
        state = str(data["state"]).strip()
        if not state:
            raise ValidationError({"state": "State cannot be empty."})
        address.state = state

    if "postal_code" in data:
        pc = str(data["postal_code"]).strip()
        if not pc:
            raise ValidationError({"postal_code": "Postal code cannot be empty."})
        address.postal_code = pc

    if "country" in data:
        c = str(data["country"]).strip().upper()
        if len(c) != 2:
            raise ValidationError({"country": "Country must be a 2-letter ISO code."})
        address.country = c

    if "is_default" in data:
        address.is_default = bool(data["is_default"])

    address.save()
    return address


@transaction.atomic
def delete_customer_address(user: Any, address_id: UUID) -> None:
    address = get_customer_address(user, address_id)
    was_default = address.is_default
    address.delete()

    # If the deleted address was default, make the most recent remaining address default
    if was_default:
        next_default = CustomerAddress.objects.filter(user=user).first()
        if next_default:
            next_default.is_default = True
            next_default.save()


# ---------------------------------------------------------------------------
# Shipping Method & Rate Resolution
# ---------------------------------------------------------------------------


def resolve_shipping_options_for_seller(
    seller: Seller,
    country: str,
    seller_subtotal: Decimal,
) -> list[dict[str, Any]]:
    """
    Finds available active shipping methods and rates for the seller and country.
    Returns a list of available shipping option dicts.
    """
    # 1. Look for shipping methods for this seller or platform default
    methods = list(
        ShippingMethod.objects.filter(
            Q(seller=seller) | Q(seller__isnull=True),
            is_active=True,
        ).order_by("name")
    )

    options: list[dict[str, Any]] = []

    for method in methods:
        # Find rate matching destination country in shipping zones
        rate_obj = (
            ShippingRate.objects.filter(
                method=method,
                zone__is_active=True,
                zone__countries__contains=country,
                min_order_amount__lte=seller_subtotal,
            )
            .filter(Q(max_order_amount__isnull=True) | Q(max_order_amount__gte=seller_subtotal))
            .order_by("rate")
            .first()
        )

        # Fallback to any active rate for this method if no country-specific zone matched
        if not rate_obj:
            rate_obj = (
                ShippingRate.objects.filter(
                    method=method,
                    zone__is_active=True,
                    min_order_amount__lte=seller_subtotal,
                )
                .filter(Q(max_order_amount__isnull=True) | Q(max_order_amount__gte=seller_subtotal))
                .order_by("rate")
                .first()
            )

        rate_val = rate_obj.rate if rate_obj else Decimal("0.00")
        options.append(
            {
                "method_id": str(method.pk),
                "name": method.name,
                "carrier": method.carrier,
                "code": method.code,
                "min_days": method.estimated_delivery_days_min,
                "max_days": method.estimated_delivery_days_max,
                "rate": str(rate_val),
            }
        )

    # If no methods configured, provide a default Free Standard Shipping option
    if not options:
        options.append(
            {
                "method_id": "00000000-0000-0000-0000-000000000001",
                "name": "Standard Delivery",
                "carrier": "Marketplace Logistics",
                "code": "standard",
                "min_days": 2,
                "max_days": 5,
                "rate": "0.00",
            }
        )

    options.sort(key=lambda x: (Decimal(x["rate"]), x["min_days"]))
    return options


# ---------------------------------------------------------------------------
# Checkout Quote Calculation
# ---------------------------------------------------------------------------


def calculate_checkout_quote(
    *,
    cart: Cart,
    shipping_address: dict[str, Any],
    shipping_selections: dict[str, str] | None = None,
    coupon_code: str | None = None,
    customer: Any = None,
) -> dict[str, Any]:
    """
    Computes real-time checkout quote with multi-seller shipping options,
    coupon discount evaluation, taxes, and grand totals.
    """
    items = list(
        cart.items.select_related(
            "variant",
            "variant__product",
            "variant__product__seller",
            "variant__product__category",
        ).all()
    )

    if not items:
        raise ValidationError({"cart": "Shopping cart is empty."})

    country = str(shipping_address.get("country", "US")).strip().upper()
    if len(country) != 2:
        country = "US"

    selections = shipping_selections or {}

    # Group items by seller
    seller_items_map: dict[Seller, list[CartItem]] = {}
    for item in items:
        seller = item.variant.product.seller
        seller_items_map.setdefault(seller, []).append(item)

    sellers_quote: list[dict[str, Any]] = []
    grand_subtotal = Decimal("0.00")
    grand_shipping = Decimal("0.00")
    grand_discount = Decimal("0.00")
    grand_tax = Decimal("0.00")

    clean_code = (coupon_code or "").strip().upper()
    coupon_eval_summary: dict[str, Any] = {
        "code": clean_code or None,
        "valid": False,
        "is_valid": False,
        "discount_amount": "0.00",
        "error_message": None,
    }

    total_coupon_discount = Decimal("0.00")

    for seller, seller_cart_items in seller_items_map.items():
        seller_subtotal = Decimal("0.00")
        item_quote_list: list[dict[str, Any]] = []

        for c_item in seller_cart_items:
            unit_price = c_item.variant.price
            line_subtotal = unit_price * c_item.quantity
            seller_subtotal += line_subtotal

            # Stock check
            avail_stock = (
                Inventory.objects.filter(
                    variant=c_item.variant,
                    warehouse__is_active=True,
                    warehouse__seller=seller,
                ).aggregate(avail=Sum(F("quantity_on_hand") - F("quantity_reserved"), default=0))[
                    "avail"
                ]
                or 0
            )

            item_quote_list.append(
                {
                    "item_id": str(c_item.pk),
                    "variant_id": str(c_item.variant.pk),
                    "product_id": str(c_item.variant.product.pk),
                    "product_title": c_item.variant.product.name,
                    "sku": c_item.variant.sku,
                    "quantity": c_item.quantity,
                    "unit_price": str(unit_price),
                    "line_subtotal": str(line_subtotal),
                    "available_stock": int(avail_stock),
                    "is_in_stock": int(avail_stock) >= c_item.quantity,
                }
            )

        # Shipping options for seller
        shipping_options = resolve_shipping_options_for_seller(seller, country, seller_subtotal)
        chosen_method_id = selections.get(str(seller.pk))

        selected_opt = None
        if chosen_method_id:
            for opt in shipping_options:
                if opt["method_id"] == chosen_method_id:
                    selected_opt = opt
                    break

        if not selected_opt:
            selected_opt = shipping_options[0]

        seller_shipping_fee = Decimal(selected_opt["rate"])

        # Coupon evaluation per seller
        seller_discount = Decimal("0.00")
        if clean_code:
            eval_res = evaluate_coupon_discount(
                code=clean_code,
                seller_id=seller.pk,
                order_subtotal=seller_subtotal,
                customer=customer if (customer and customer.is_authenticated) else None,
            )
            if eval_res.is_valid:
                seller_discount = eval_res.discount_amount
                total_coupon_discount += seller_discount
                coupon_eval_summary["valid"] = True
                coupon_eval_summary["is_valid"] = True
            elif not coupon_eval_summary["valid"]:
                coupon_eval_summary["error_message"] = eval_res.error_message

        seller_tax = Decimal("0.00")
        seller_total = max(
            Decimal("0.00"),
            seller_subtotal - seller_discount + seller_shipping_fee + seller_tax,
        )

        grand_subtotal += seller_subtotal
        grand_shipping += seller_shipping_fee
        grand_discount += seller_discount
        grand_tax += seller_tax

        cents = Decimal("0.01")
        sellers_quote.append(
            {
                "seller_id": str(seller.pk),
                "seller_name": seller.display_name,
                "seller_slug": seller.slug,
                "subtotal": str(seller_subtotal.quantize(cents)),
                "shipping_fee": str(seller_shipping_fee.quantize(cents)),
                "discount_amount": str(seller_discount.quantize(cents)),
                "tax_amount": str(seller_tax.quantize(cents)),
                "total": str(seller_total.quantize(cents)),
                "available_shipping_methods": shipping_options,
                "selected_shipping_method": selected_opt,
                "items": item_quote_list,
            }
        )

    cents = Decimal("0.01")
    if coupon_eval_summary["is_valid"]:
        coupon_eval_summary["discount_amount"] = str(total_coupon_discount.quantize(cents))

    grand_total = max(
        Decimal("0.00"),
        grand_subtotal - grand_discount + grand_shipping + grand_tax,
    )

    return {
        "total_items": sum(i.quantity for i in items),
        "subtotal": str(grand_subtotal.quantize(cents)),
        "shipping_total": str(grand_shipping.quantize(cents)),
        "discount_total": str(grand_discount.quantize(cents)),
        "tax_total": str(grand_tax.quantize(cents)),
        "grand_total": str(grand_total.quantize(cents)),
        "currency": "USD",
        "coupon": coupon_eval_summary,
        "sellers": sellers_quote,
    }


# ---------------------------------------------------------------------------
# Atomic Order Placement
# ---------------------------------------------------------------------------


@transaction.atomic
def place_order(
    *,
    request: Request,
    shipping_address_data: dict[str, Any] | None = None,
    address_id: UUID | None = None,
    billing_address_data: dict[str, Any] | None = None,
    customer_email: str | None = None,
    shipping_selections: dict[str, str] | None = None,
    coupon_code: str | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    """
    Atomically places customer order across multiple sellers:
    1. Selects and locks required variant inventory across warehouses (select_for_update).
    2. Validates zero overselling.
    3. Reserves inventory using Phase 6 InventoryTransaction.
    4. Creates master Order and splits into SellerOrder records per seller.
    5. Snapshots line items (OrderItem) with title, SKU, variant, price, currency, and commissions.
    6. Emits order.created transactional outbox event.
    7. Clears items from the customer's cart atomically.
    """
    user = getattr(request, "user", None)
    is_authenticated = bool(user and user.is_authenticated)

    cart = get_or_create_cart(request)
    cart_items = list(
        cart.items.select_related(
            "variant",
            "variant__product",
            "variant__product__seller",
            "variant__product__category",
        ).all()
    )

    if not cart_items:
        raise ValidationError({"cart": "Shopping cart is empty."})

    # Resolve shipping address
    if address_id:
        if not is_authenticated:
            raise ValidationError(
                {"address_id": "Authentication required to use saved address ID."}
            )
        address_obj = get_customer_address(user, address_id)
        shipping_address = {
            "full_name": address_obj.full_name,
            "phone": address_obj.phone,
            "line1": address_obj.line1,
            "line2": address_obj.line2,
            "city": address_obj.city,
            "state": address_obj.state,
            "postal_code": address_obj.postal_code,
            "country": address_obj.country,
        }
    elif shipping_address_data:
        full_name = str(shipping_address_data.get("full_name", "")).strip()
        phone = str(shipping_address_data.get("phone", "")).strip()
        line1 = str(shipping_address_data.get("line1", "")).strip()
        line2 = str(shipping_address_data.get("line2", "")).strip()
        city = str(shipping_address_data.get("city", "")).strip()
        state = str(shipping_address_data.get("state", "")).strip()
        postal_code = str(shipping_address_data.get("postal_code", "")).strip()
        country = str(shipping_address_data.get("country", "US")).strip().upper()

        if not full_name:
            raise ValidationError({"shipping_address.full_name": "Full name is required."})
        if not phone:
            raise ValidationError({"shipping_address.phone": "Phone number is required."})
        if not line1:
            raise ValidationError({"shipping_address.line1": "Street address is required."})
        if not city:
            raise ValidationError({"shipping_address.city": "City is required."})
        if not state:
            raise ValidationError({"shipping_address.state": "State is required."})
        if not postal_code:
            raise ValidationError({"shipping_address.postal_code": "Postal code is required."})
        if len(country) != 2:
            raise ValidationError(
                {"shipping_address.country": "Country must be a 2-letter ISO code."}
            )

        shipping_address = {
            "full_name": full_name,
            "phone": phone,
            "line1": line1,
            "line2": line2,
            "city": city,
            "state": state,
            "postal_code": postal_code,
            "country": country,
        }
    else:
        raise ValidationError(
            {"shipping_address": "Either address_id or shipping_address is required."}
        )

    billing_address = billing_address_data or shipping_address

    # Customer email
    final_email = ""
    if is_authenticated and user is not None:
        final_email = user.email
    elif customer_email and "@" in customer_email:
        final_email = customer_email.strip().lower()
    else:
        raise ValidationError({"customer_email": "A valid customer email is required."})

    # Group items by seller
    seller_items_map: dict[Seller, list[CartItem]] = {}
    for item in cart_items:
        seller = item.variant.product.seller
        if seller.status != Seller.Status.ACTIVE:
            raise ValidationError(
                {"seller": f"Seller {seller.display_name} is currently inactive."}
            )
        if item.variant.status != ProductVariant.Status.ACTIVE:
            raise ValidationError(
                {"variant": f"Variant {item.variant.sku} is not active for sale."}
            )
        seller_items_map.setdefault(seller, []).append(item)

    # 1. Zero Overselling check with select_for_update locking
    # Map (item, inventory_record)
    item_inventory_assignments: dict[UUID, Inventory] = {}

    for item in cart_items:
        variant = item.variant
        inventories = list(
            Inventory.objects.select_for_update().filter(
                variant=variant,
                warehouse__seller=variant.product.seller,
                warehouse__is_active=True,
            )
        )

        total_available = sum(inv.quantity_on_hand - inv.quantity_reserved for inv in inventories)
        if total_available < item.quantity:
            raise ValidationError(
                {
                    "stock": (
                        f"Stock for '{variant.product.name} ({variant.sku})' is insufficient. "
                        f"Requested {item.quantity}, available {max(0, total_available)}."
                    )
                }
            )

        # Pick warehouse with largest available stock that can fulfill or partially fulfill
        chosen_inv = None
        for inv in sorted(
            inventories,
            key=lambda x: x.quantity_on_hand - x.quantity_reserved,
            reverse=True,
        ):
            if (inv.quantity_on_hand - inv.quantity_reserved) >= item.quantity:
                chosen_inv = inv
                break

        if not chosen_inv and inventories:
            chosen_inv = inventories[0]

        if not chosen_inv:
            raise ValidationError(
                {"stock": f"No active warehouse inventory found for variant {variant.sku}."}
            )

        item_inventory_assignments[item.pk] = chosen_inv

    # 2. Compute quote amounts
    quote = calculate_checkout_quote(
        cart=cart,
        shipping_address=shipping_address,
        shipping_selections=shipping_selections,
        coupon_code=coupon_code,
        customer=user,
    )

    clean_code = (coupon_code or "").strip().upper()
    valid_coupon_obj: Coupon | None = None
    if clean_code and quote["coupon"]["is_valid"]:
        valid_coupon_obj = Coupon.objects.filter(code=clean_code, is_active=True).first()

    # 3. Create master Order
    generated_order_number = f"ORD-{uuid.uuid4().hex[:8].upper()}"

    master_order = Order.objects.create(
        order_number=generated_order_number,
        customer=user if is_authenticated else None,
        customer_email=final_email,
        currency="USD",
        subtotal=Decimal(quote["subtotal"]),
        discount_total=Decimal(quote["discount_total"]),
        tax_total=Decimal(quote["tax_total"]),
        shipping_total=Decimal(quote["shipping_total"]),
        grand_total=Decimal(quote["grand_total"]),
        payment_status=Order.PaymentStatus.PENDING,
        fulfillment_status=Order.FulfillmentStatus.UNFULFILLED,
        shipping_address_snapshot=shipping_address,
        billing_address_snapshot=billing_address,
    )

    created_seller_orders: list[dict[str, Any]] = []

    # 4. Partition into SellerOrders & OrderItems
    for seller_quote in quote["sellers"]:
        seller_id_str = seller_quote["seller_id"]
        seller = Seller.objects.get(pk=UUID(seller_id_str))

        so_subtotal = Decimal(seller_quote["subtotal"])
        so_discount = Decimal(seller_quote["discount_amount"])
        so_shipping = Decimal(seller_quote["shipping_fee"])
        so_tax = Decimal(seller_quote["tax_amount"])

        # Calculate commission for each item in this seller order
        seller_order_items = seller_items_map[seller]
        so_commission_total = Decimal("0.00")

        # Seller order number
        so_number = f"SO-{master_order.order_number}-{seller.slug[:6].upper()}"
        if SellerOrder.objects.filter(seller_order_number=so_number).exists():
            so_number = f"SO-{master_order.order_number}-{uuid.uuid4().hex[:4].upper()}"

        seller_order = SellerOrder.objects.create(
            order=master_order,
            seller=seller,
            seller_order_number=so_number,
            subtotal=so_subtotal,
            discount_total=so_discount,
            tax_total=so_tax,
            shipping_total=so_shipping,
            commission_total=Decimal("0.00"),  # updated after items
            seller_net_total=Decimal("0.00"),  # updated after items
            status=SellerOrder.Status.PENDING,
        )

        for c_item in seller_order_items:
            assigned_inv = item_inventory_assignments[c_item.pk]
            line_gross = c_item.variant.price * c_item.quantity

            # Proportional discount allocation if any
            line_discount = Decimal("0.00")
            if so_subtotal > Decimal("0.00") and so_discount > Decimal("0.00"):
                line_discount = ((line_gross / so_subtotal) * so_discount).quantize(Decimal("0.01"))

            line_tax = Decimal("0.00")
            line_total = max(Decimal("0.00"), line_gross - line_discount + line_tax)

            comm_res = calculate_commission(
                amount=line_total,
                seller=seller,
                category=c_item.variant.product.category,
            )
            line_commission = comm_res.commission_amount
            line_net = max(Decimal("0.00"), line_total - line_commission)
            so_commission_total += line_commission

            variant_snapshot = {
                "sku": c_item.variant.sku,
                "barcode": c_item.variant.barcode,
            }

            OrderItem.objects.create(
                seller_order=seller_order,
                product=c_item.variant.product,
                variant=c_item.variant,
                warehouse=assigned_inv.warehouse,
                product_name_snapshot=c_item.variant.product.name,
                sku_snapshot=c_item.variant.sku,
                variant_snapshot=variant_snapshot,
                quantity=c_item.quantity,
                unit_price=c_item.variant.price,
                discount_amount=line_discount,
                tax_amount=line_tax,
                total=line_total,
                commission_amount=line_commission,
                seller_net_amount=line_net,
            )

            # Atomic Inventory Reservation
            reserve_order_inventory(
                inventory_id=assigned_inv.pk,
                quantity=c_item.quantity,
                reference_id=str(seller_order.pk),
                reason=f"Checkout reservation for {seller_order.seller_order_number}",
                actor=user if is_authenticated else None,
            )

        # Update seller order commission and net totals
        so_net_total = max(
            Decimal("0.00"),
            so_subtotal - so_discount + so_shipping - so_commission_total,
        )
        seller_order.commission_total = so_commission_total
        seller_order.seller_net_total = so_net_total
        seller_order.save(update_fields=["commission_total", "seller_net_total", "updated_at"])

        # Initial OrderStatusHistory
        OrderStatusHistory.objects.create(
            seller_order=seller_order,
            actor_id=user.id if (user is not None and is_authenticated) else None,
            from_status="none",
            to_status=SellerOrder.Status.PENDING,
            notes="Order placed and inventory reserved via customer checkout.",
        )

        created_seller_orders.append(
            {
                "id": str(seller_order.pk),
                "seller_order_number": seller_order.seller_order_number,
                "seller_name": seller.display_name,
                "subtotal": str(seller_order.subtotal),
                "shipping_total": str(seller_order.shipping_total),
                "seller_net_total": str(seller_order.seller_net_total),
            }
        )

    # 5. Coupon Redemption Record
    if (
        valid_coupon_obj
        and is_authenticated
        and isinstance(user, User)
        and quote["discount_total"] != "0.00"
    ):
        record_coupon_redemption(
            coupon_id=valid_coupon_obj.pk,
            customer=user,
            order_id=master_order.pk,
            discount_amount=Decimal(quote["discount_total"]),
        )

    # 6. Emit Outbox Event (Phase 14)
    publish_outbox_event(
        topic="orders.order.created",
        event_key=str(master_order.pk),
        payload={
            "order_id": str(master_order.pk),
            "order_number": master_order.order_number,
            "currency": master_order.currency,
            "grand_total": str(master_order.grand_total),
            "customer_email": master_order.customer_email,
            "seller_orders_count": len(created_seller_orders),
        },
    )

    # 7. Atomically clear items from customer's cart
    cart.items.all().delete()

    return {
        "order_id": str(master_order.pk),
        "order_number": master_order.order_number,
        "customer_email": master_order.customer_email,
        "grand_total": str(master_order.grand_total),
        "currency": master_order.currency,
        "payment_status": master_order.payment_status,
        "seller_orders": created_seller_orders,
        "payment_instructions": {
            "type": "standard",
            "order_id": str(master_order.pk),
            "status": "pending_payment",
        },
    }
