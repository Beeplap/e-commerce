"use client";

import { Dialog } from "@/components/ui/dialog";
import { FormSection } from "@/components/ui/layout";

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
  FilterBar,
  FilterSummary,
  SearchInput,
} from "@/components/ui/filter-bar";
import { Identifier } from "@/components/ui/identifier";
import {
  useTableQuery,
  useDebouncedValue,
} from "@/components/ui/use-table-query";
import {
  ApiErrorState,
  FormField,
  PageHeader,
  primaryButton,
  secondaryButton,
} from "@/components/ui/primitives";
import { selectStyle } from "@/features/sellers/forms";
import { inventoryApi, type InventoryItem } from "./api";

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
  const table = useTableQuery({ search: 100, low_stock: ["true"] });
  const { page, setPage } = table;
  const search = useDebouncedValue(table.values.search);
  const lowStockOnly = table.values.low_stock === "true";
  const activeFilters = [
    table.values.search ? `Search: ${table.values.search}` : "",
    lowStockOnly ? "Low stock only" : "",
  ].filter(Boolean);
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

  const items = query.kind === "ready" ? query.data.results : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={platform ? "Platform Inventory" : "Inventory Ledger"}
        description={
          platform
            ? "Stock and reservations across seller warehouses."
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

      <div>
        <FilterBar>
          <SearchInput
            label="Search inventory"
            placeholder="SKU, product or warehouse"
            value={table.values.search}
            onChange={(value) => table.setFilters({ search: value }, true)}
          />
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 accent-ui-accent"
              checked={lowStockOnly}
              onChange={(event) =>
                table.setFilters({
                  low_stock: event.target.checked ? "true" : "",
                })
              }
            />
            Low stock only
          </label>
        </FilterBar>
        <FilterSummary filters={activeFilters} onClear={table.clear} />
      </div>
      {query.kind === "error" && (
        <ApiErrorState error={query.error} onRetry={query.retry} />
      )}

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
                <div className="text-sm font-medium text-ui-foreground">
                  {item.variant.product_name}
                </div>
                <Identifier value={item.variant.sku} label="SKU" copyable />
              </div>
            ),
          },
          {
            id: "warehouse",
            heading: "Warehouse",
            cell: (item) => (
              <div>
                <div className="font-medium text-ui-foreground">
                  {item.warehouse.name}
                </div>
                <div className="font-mono text-xs text-ui-muted">
                  {item.warehouse.code}
                </div>
              </div>
            ),
          },
          {
            id: "on_hand",
            align: "right" as const,
            heading: "On Hand",
            cell: (item) => (
              <span className="font-semibold text-ui-foreground">
                {item.quantity_on_hand}
              </span>
            ),
          },
          {
            id: "reserved",
            align: "right" as const,
            heading: "Reserved",
            cell: (item) => (
              <span className="text-ui-secondary">
                {item.quantity_reserved}
              </span>
            ),
          },
          {
            id: "available",
            align: "right" as const,
            heading: "Available",
            cell: (item) => (
              <span className="inline-flex items-center gap-1.5 font-bold text-ui-accent">
                {item.available_quantity}
                {item.is_low_stock && (
                  <span className="rounded bg-ui-warning-surface px-2 py-1 text-ui-caption font-medium text-ui-warning">
                    Low Stock
                  </span>
                )}
              </span>
            ),
          },
          {
            id: "reorder",
            align: "right" as const,
            heading: "Reorder At",
            cell: (item) => (
              <span className="text-xs text-ui-muted">
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
                  className="text-xs font-semibold text-ui-accent hover:text-ui-accent underline"
                >
                  Adjust stock
                </button>
              ) : null,
          },
        ];
        return query.kind === "error" ? null : (
          <DataTable
            loading={query.kind === "loading"}
            filtered={activeFilters.length > 0}
            caption="Inventory items"
            rows={items}
            rowKey={(item) => item.id}
            columns={columns}
          />
        );
      })()}

      {query.kind === "ready" && query.data.count > 25 && (
        <Pagination
          page={page}
          busy={query.kind !== "ready"}
          count={query.kind === "ready" ? query.data.count : 0}
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
    <Dialog
      open
      title={<>Adjust Stock: {item.variant.sku}</>}
      description={
        <>
          Warehouse: {item.warehouse.name} ({item.warehouse.code}) | On hand:{" "}
          {item.quantity_on_hand} | Reserved: {item.quantity_reserved} |
          Available: {item.available_quantity}
        </>
      }
      onClose={onClose}
      busy={submitting}
      error={error}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="stock-action-type"
            className="mb-2 block text-xs font-semibold text-ui-secondary"
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

        <FormSection
          title="Transaction reference"
          description="Optional references connect this ledger entry to a purchase order, return or audit."
        >
          <div className="grid gap-3 sm:grid-cols-2">
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
        </FormSection>
        <div className="flex justify-end gap-3 pt-3">
          <button
            type="button"
            onClick={onClose}
            className={secondaryButton}
            disabled={submitting}
            data-dialog-cancel
          >
            Cancel
          </button>
          <button
            type="submit"
            className={primaryButton}
            disabled={
              submitting || (mode === "adjust" && delta === 0) || !reason.trim()
            }
          >
            {submitting ? "Processing…" : "Submit adjustment"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
