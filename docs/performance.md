# Performance Architecture and Query Budgeting

## Overview

This document analyzes the database access patterns, query budgeting, N+1 query elimination, indexing strategy, and pagination limits across the quick-commerce platform as evaluated in Phase 13.

## Query Budgeting & N+1 Prevention

Django's ORM generates separate database queries for related foreign keys and reverse relations when not explicitly instructed to perform SQL JOINs or batched prefetching. Uncontrolled queries cause $O(N)$ database round-trips ("N+1 queries"), which degrade database throughput under load.

The platform enforces strict query budgets verified through automated tests (`apps/api/tests/test_phase13_performance.py`):

| Endpoint / Workflow                      | Dataset Size         | Measured Query Count | Budget   | Optimization Strategy                                        |
| :--------------------------------------- | :------------------- | :------------------- | :------- | :----------------------------------------------------------- |
| `GET /api/v1/seller/products`            | 20 products          | 6 queries            | $\le 12$ | `select_related("category", "seller")`                       |
| `GET /api/v1/seller/inventory`           | 20 inventory rows    | 6 queries            | $\le 12$ | `select_related("warehouse", "variant", "variant__product")` |
| `GET /api/v1/seller/orders/`             | 15 orders            | 6 queries            | $\le 12$ | `select_related("order", "seller")`                          |
| `GET /api/v1/seller/analytics/dashboard` | 15 orders, 30 items  | 9 queries            | $\le 15$ | Single-pass SQL aggregations (`Sum`, `Count`, `Avg`)         |
| `GET /api/v1/admin/analytics/dashboard`  | All marketplace data | 16 queries           | $\le 18$ | SQL marketplace aggregations across sellers                  |

### Key Query Optimizations

1. **Catalog Lists & Details**:
   - `Product` selectors use `select_related("category", "brand", "seller")` to fetch category and brand names in the initial `SELECT` using an `INNER JOIN` / `LEFT OUTER JOIN`.
   - `ProductVariant` output bundles product name and SKU without reverse relation traversal.

2. **Inventory Management**:
   - `Inventory` selectors join `Warehouse` and `ProductVariant` via `select_related("warehouse", "variant")`.
   - Calculated fields (`available_quantity`, `is_low_stock`) are evaluated at the database query level or model property level without initiating separate queries.

3. **Orders & Fulfillment**:
   - `SellerOrder` lists fetch parent `Order` fields (`order_number`, `currency`, `customer`) via `select_related("order")`.
   - Order detail views prefetch items using `prefetch_related("items", "items__variant", "items__warehouse")` to prevent per-item lookups.

4. **Analytics Dashboards**:
   - Rather than loading Order models into memory and iterating in Python, `apps.analytics.selectors` issues targeted SQL aggregation queries (`Sum("subtotal")`, `Count("id")`, `Avg("subtotal")`).
   - Query count is $O(1)$ constant time with respect to the total number of orders, items, or sellers.

## Indexing Strategy

Critical foreign keys and query filters are backed by authoritative PostgreSQL B-Tree indexes:

1. **Multi-Tenant Filtering**:
   - All tenant-owned tables (`catalog_product`, `inventory_warehouse`, `inventory_inventory`, `orders_sellerorder`, `finance_sellerbalance`, `fulfillment_shipment`, `fulfillment_returnrequest`) index `seller_id`.
   - Composite indexes cover common query patterns (e.g., `(seller_id, status)` on `orders_sellerorder` and `catalog_product`).

2. **Lookup Identifiers**:
   - `slug` fields across categories, brands, products, and sellers have unique indexes.
   - Public reference codes (`order_number`, `seller_order_number`, `payout_number`, `tracking_number`, `sku`, `barcode`) have unique indexes.

3. **Status Histories & Ledgers**:
   - Append-only tables index `(target_id, created_at)` to support timeline reconstruction in chronological order.

## Bounded Pagination & Payloads

To prevent denial-of-service via memory exhaustion or unbounded queries:

- All list endpoints enforce bounded pagination (`PageSerializer`).
- Default page size is 25 items; maximum allowable page size is capped at 100.
- Page index query parameters (`page`) are strictly validated as positive integers between 1 and 10,000; non-numeric, negative, or excessive values are clamped or rejected with HTTP 400.
- Query parameters are strictly allowlisted; unknown query arguments are rejected.
