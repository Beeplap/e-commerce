"use client";

import { Dialog } from "@/components/ui/dialog";

import { useCallback, useRef, useState } from "react";
import { useSeller } from "@/features/workspaces/seller-workspace";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { useApiQuery } from "@/lib/api/use-api-query";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import {
  ApiErrorState,
  FormField,
  LoadingState,
  PageHeader,
  StatusBadge,
  primaryButton,
  secondaryButton,
} from "@/components/ui/primitives";
import { inventoryApi, type Warehouse } from "./api";

const textareaStyle =
  "min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none";

export function SellerWarehouses() {
  const access = useSeller();
  const sellerId = access.seller.id;
  const canRead = access.permissions.includes("inventory.read");
  const canAdjust = access.permissions.includes("inventory.adjust");

  if (!canRead || access.seller.status !== "active") {
    return <ForbiddenScreen />;
  }

  return (
    <WarehousesList key={access.id} sellerId={sellerId} canAdjust={canAdjust} />
  );
}

function WarehousesList({
  sellerId,
  canAdjust,
}: {
  sellerId: string;
  canAdjust: boolean;
}) {
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(
    null,
  );

  const load = useCallback(
    (signal: AbortSignal) =>
      inventoryApi.warehouses(sellerId, { page }, signal),
    [sellerId, page],
  );

  const query = useApiQuery(`${sellerId}:warehouses:${page}`, load);

  if (query.kind === "loading")
    return <LoadingState label="Loading warehouses…" />;
  if (query.kind === "error")
    return <ApiErrorState error={query.error} onRetry={query.retry} />;

  const warehouses = query.data.results;

  const columns: Column<Warehouse>[] = [
    {
      id: "code",
      heading: "Code",
      cell: (wh) => (
        <span className="font-mono text-xs font-semibold text-slate-900">
          {wh.code}
        </span>
      ),
    },
    {
      id: "name",
      heading: "Name",
      cell: (wh) => (
        <span className="font-medium text-slate-900">{wh.name}</span>
      ),
    },
    {
      id: "address",
      heading: "Address",
      cell: (wh) => <span className="text-slate-600">{wh.address || "—"}</span>,
    },
    {
      id: "status",
      heading: "Status",
      cell: (wh) => (
        <StatusBadge status={wh.is_active ? "active" : "inactive"} />
      ),
    },
    {
      id: "actions",
      heading: "Actions",
      cell: (wh) =>
        canAdjust ? (
          <button
            type="button"
            onClick={() => setEditingWarehouse(wh)}
            className="text-xs font-medium text-teal-800 hover:text-teal-950 underline"
          >
            Edit
          </button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        description="Manage storage locations and fulfillment facilities for your inventory."
        actions={
          canAdjust && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className={primaryButton}
            >
              Add warehouse
            </button>
          )
        }
      />

      {showCreate && (
        <WarehouseForm
          sellerId={sellerId}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            query.retry();
          }}
        />
      )}

      {editingWarehouse && (
        <WarehouseForm
          sellerId={sellerId}
          warehouse={editingWarehouse}
          onClose={() => setEditingWarehouse(null)}
          onSuccess={() => {
            setEditingWarehouse(null);
            query.retry();
          }}
        />
      )}

      <DataTable
        caption="Warehouses"
        rows={warehouses}
        rowKey={(wh) => wh.id}
        columns={columns}
      />

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

function WarehouseForm({
  sellerId,
  warehouse,
  onClose,
  onSuccess,
}: {
  sellerId: string;
  warehouse?: Warehouse;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEditing = Boolean(warehouse);
  const [name, setName] = useState(warehouse?.name ?? "");
  const [code, setCode] = useState(warehouse?.code ?? "");
  const [address, setAddress] = useState(warehouse?.address ?? "");
  const [isActive, setIsActive] = useState(warehouse?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setError(null);
    setSubmitting(true);

    try {
      if (isEditing && warehouse) {
        await inventoryApi.updateWarehouse(sellerId, warehouse.id, {
          name: name.trim(),
          address: address.trim(),
          is_active: isActive,
        });
      } else {
        await inventoryApi.createWarehouse(sellerId, {
          name: name.trim(),
          code: code.trim().toLowerCase(),
          address: address.trim(),
          is_active: isActive,
        });
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save warehouse");
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      title={isEditing ? "Edit Warehouse" : "Create Warehouse"}
      onClose={onClose}
      busy={submitting}
      error={error}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <FormField
            label="Warehouse name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kathmandu Hub"
          />
        </div>

        <div>
          <FormField
            label="Warehouse code"
            required
            disabled={isEditing}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="font-mono"
            placeholder="e.g. ktm-hub"
            hint={
              isEditing
                ? "Warehouse code is permanent and cannot be modified."
                : "Unique identifier for this warehouse within your account (letters, digits, dashes)."
            }
          />
        </div>

        <div>
          <label
            htmlFor="warehouse-address"
            className="mb-2 block text-sm font-medium text-slate-800"
          >
            Physical address
          </label>
          <textarea
            id="warehouse-address"
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={textareaStyle}
            placeholder="Street address, city, region"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="warehouse-is-active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
          />
          <label
            htmlFor="warehouse-is-active"
            className="text-sm font-medium text-slate-800"
          >
            Active location for stocking and order fulfillment
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            data-dialog-cancel
            className={secondaryButton}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={primaryButton}
            disabled={
              submitting || !name.trim() || (!isEditing && !code.trim())
            }
          >
            {submitting
              ? "Saving…"
              : isEditing
                ? "Save changes"
                : "Create warehouse"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
