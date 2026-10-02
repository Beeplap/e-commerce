"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { useSeller } from "@/features/workspaces/seller-workspace";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { hasPlatformPermission } from "@/lib/permissions";
import { useApiQuery } from "@/lib/api/use-api-query";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import {
  ApiErrorState,
  FormField,
  LoadingState,
  PageHeader,
  primaryButton,
  secondaryButton,
} from "@/components/ui/primitives";
import { selectStyle } from "@/features/sellers/forms";
import { inventoryApi, type InventoryItem } from "./api";

const searchInputStyle =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none";

export function SellerInventory() {
  const access = useSeller();
  const sellerId = access.seller.id;
  const canRead = access.permissions.includes("inventory.read");
  const canAdjust = access.permissions.includes("inventory.adjust");

  if (!canRead || access.seller.status !== "active") {
    return <ForbiddenScreen />;
  }

  return (
    <InventoryList key={access.id} sellerId={sellerId} canAdjust={canAdjust} />
  );
}

export function PlatformInventory() {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;

  if (!hasPlatformPermission(user, "platform.inventory.read")) {
    return <ForbiddenScreen />;
  }

  return <InventoryList key={user?.id} platform />;
}

function InventoryList({
  sellerId,
  canAdjust = false,
  platform = false,
}: {
  sellerId?: string;
  canAdjust?: boolean;
  platform?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(
    null,
  );

  const load = useCallback(
    (signal: AbortSignal) => {
      const filters = {
        page,
        search: search.trim() || undefined,
        low_stock: lowStockOnly || undefined,
      };
      if (platform) {
        return inventoryApi.platformInventory(filters, signal);
      }
      return inventoryApi.inventory(sellerId ?? "", filters, signal);
    },
    [sellerId, platform, page, search, lowStockOnly],
  );

  const queryKey = platform
    ? `platform:inventory:${page}:${search}:${lowStockOnly}`
    : `${sellerId}:inventory:${page}:${search}:${lowStockOnly}`;

  const query = useApiQuery(queryKey, load);

  if (query.kind === "loading")
    return <LoadingState label="Loading inventory…" />;
  if (query.kind === "error")
    return <ApiErrorState error={query.error} onRetry={query.retry} />;

  const items = query.data.results;

  return (
    <div className="space-y-6">
      <PageHeader
        title={platform ? "Platform Inventory" : "Inventory Ledger"}
        description={
          platform
            ? "Authoritative multi-seller warehouse stock levels, reservations, and availability."
            : "Live stock ledger, reservations, available quantities, and reorder alerts."
        }
        actions={
          !platform && (
            <div className="flex gap-2">
              <Link
                href="/seller/inventory/adjustments"
                className={secondaryButton}
              >
                Ledger adjustments
              </Link>
            </div>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="inventory-search" className="sr-only">
            Search inventory
          </label>
          <input
            id="inventory-search"
            type="search"
            placeholder="Search by SKU, barcode, product, or warehouse…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={searchInputStyle}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="filter-low-stock"
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => {
              setLowStockOnly(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
          />
          <label
            htmlFor="filter-low-stock"
            className="text-sm font-medium text-slate-700"
          >
            Low stock only
          </label>
        </div>
      </div>

      {adjustingItem && sellerId && (
        <StockAdjustModal
          sellerId={sellerId}
          item={adjustingItem}
          onClose={() => setAdjustingItem(null)}
          onSuccess={() => {
            setAdjustingItem(null);
            query.retry();
          }}
        />
      )}

      {(() => {
        const columns: Column<InventoryItem>[] = [
          {
            id: "sku",
            heading: "SKU / Product",
            cell: (item) => (
              <div>
                <div className="font-mono text-xs font-semibold text-slate-900">
                  {item.variant.sku}
                </div>
                <div className="text-xs text-slate-600">
                  {item.variant.product_name}
                </div>
              </div>
            ),
          },
          {
            id: "warehouse",
            heading: "Warehouse",
            cell: (item) => (
              <div>
                <div className="font-medium text-slate-900">
                  {item.warehouse.name}
                </div>
                <div className="font-mono text-xs text-slate-500">
                  {item.warehouse.code}
                </div>
              </div>
            ),
          },
          {
            id: "on_hand",
            heading: "On Hand",
            cell: (item) => (
              <span className="font-semibold text-slate-900">
                {item.quantity_on_hand}
              </span>
            ),
          },
          {
            id: "reserved",
            heading: "Reserved",
            cell: (item) => (
              <span className="text-slate-600">{item.quantity_reserved}</span>
            ),
          },
          {
            id: "available",
            heading: "Available",
            cell: (item) => (
              <span className="inline-flex items-center gap-1.5 font-bold text-teal-900">
                {item.available_quantity}
                {item.is_low_stock && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-900">
                    Low Stock
                  </span>
                )}
              </span>
            ),
          },
          {
            id: "reorder",
            heading: "Reorder At",
            cell: (item) => (
              <span className="text-xs text-slate-500">
                {item.reorder_level}
              </span>
            ),
          },
          {
            id: "actions",
            heading: "Actions",
            cell: (item) =>
              canAdjust && !platform ? (
                <button
                  type="button"
                  onClick={() => setAdjustingItem(item)}
                  className="text-xs font-semibold text-teal-800 hover:text-teal-950 underline"
                >
                  Adjust stock
                </button>
              ) : null,
          },
        ];
        return (
          <DataTable
            caption="Inventory items"
            rows={items}
            rowKey={(item) => item.id}
            columns={columns}
          />
        );
      })()}

      {query.data.count > 25 && (
        <Pagination
          page={page}
          count={query.data.count}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

function StockAdjustModal({
  sellerId,
  item,
  onClose,
  onSuccess,
}: {
  sellerId: string;
  item: InventoryItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<"adjust" | "reserve" | "release">("adjust");
  const [delta, setDelta] = useState(0);
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  const [refType, setRefType] = useState("");
  const [refId, setRefId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === "adjust") {
        if (delta === 0) throw new Error("Delta cannot be 0");
        if (!reason.trim()) throw new Error("Reason is required");
        await inventoryApi.adjustInventory(sellerId, item.id, {
          quantity_delta: delta,
          reason: reason.trim(),
          reference_type: refType.trim(),
          reference_id: refId.trim(),
        });
      } else if (mode === "reserve") {
        if (qty <= 0) throw new Error("Quantity must be positive");
        await inventoryApi.reserveInventory(sellerId, item.id, {
          quantity: qty,
          reason: reason.trim(),
          reference_type: refType.trim(),
          reference_id: refId.trim(),
        });
      } else if (mode === "release") {
        if (qty <= 0) throw new Error("Quantity must be positive");
        await inventoryApi.releaseInventory(sellerId, item.id, {
          quantity: qty,
          reason: reason.trim(),
          reference_type: refType.trim(),
          reference_id: refId.trim(),
        });
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Stock update failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-labelledby="stock-adjust-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <h2
          id="stock-adjust-title"
          className="text-lg font-semibold text-slate-900"
        >
          Adjust Stock: {item.variant.sku}
        </h2>
        <p className="text-xs text-slate-500">
          Warehouse: {item.warehouse.name} ({item.warehouse.code}) | On hand:{" "}
          {item.quantity_on_hand} | Reserved: {item.quantity_reserved} |
          Available: {item.available_quantity}
        </p>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="stock-action-type"
              className="mb-2 block text-xs font-semibold text-slate-700"
            >
              Action type
            </label>
            <select
              id="stock-action-type"
              value={mode}
              onChange={(e) =>
                setMode(e.target.value as "adjust" | "reserve" | "release")
              }
              className={`${selectStyle} w-full`}
            >
              <option value="adjust">Stock Count Adjustment (+ / -)</option>
              <option value="reserve">Hold / Reserve Quantity</option>
              <option value="release">Release Reserved Quantity</option>
            </select>
          </div>

          {mode === "adjust" ? (
            <div>
              <FormField
                label="Adjustment delta (+ or - quantity)"
                type="number"
                required
                value={delta || ""}
                onChange={(e) => setDelta(parseInt(e.target.value, 10) || 0)}
                hint="Use positive numbers to add stock, negative to write off."
              />
            </div>
          ) : (
            <div>
              <FormField
                label={
                  mode === "reserve"
                    ? "Quantity to reserve"
                    : "Quantity to release"
                }
                type="number"
                min={1}
                required
                value={qty}
                onChange={(e) =>
                  setQty(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
                hint={
                  mode === "reserve"
                    ? `Max available to reserve: ${item.available_quantity}`
                    : `Max reserved to release: ${item.quantity_reserved}`
                }
              />
            </div>
          )}

          <div>
            <FormField
              label="Reason for adjustment"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Audit variance, damage, stock arrival"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Reference type (optional)"
              value={refType}
              onChange={(e) => setRefType(e.target.value)}
              placeholder="e.g. po, return, audit"
            />
            <FormField
              label="Reference ID (optional)"
              value={refId}
              onChange={(e) => setRefId(e.target.value)}
              placeholder="e.g. PO-8921"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className={secondaryButton}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={primaryButton}
              disabled={
                submitting ||
                (mode === "adjust" && delta === 0) ||
                !reason.trim()
              }
            >
              {submitting ? "Processing…" : "Submit adjustment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
