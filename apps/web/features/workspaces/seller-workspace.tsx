"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  ApiErrorState,
  LoadingState,
  secondaryButton,
} from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/pagination";
import { SelectField } from "@/components/ui/form-fields";
import { sellerApi } from "@/lib/api/client";
import type { SellerMembership } from "@/lib/api/types";
import { useApiQuery } from "@/lib/api/use-api-query";
import { useAuth } from "@/features/auth/auth-provider";
import { ForbiddenScreen } from "./forbidden-screen";
import { WorkspaceFrame } from "./workspace-frame";

const SellerContext = createContext<SellerMembership | null>(null);

export function useSeller(): SellerMembership {
  const value = useContext(SellerContext);
  if (value === null)
    throw new Error("useSeller requires an authorized SellerWorkspace.");
  return value;
}

export function SellerWorkspace({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const pathname = usePathname();
  const userId = state.kind === "authenticated" ? state.user.id : null;
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const loadMemberships = useCallback(
    (signal: AbortSignal) => sellerApi.memberships(page, signal),
    [page],
  );
  const memberships = useApiQuery(
    userId ? `${userId}:memberships:${page}` : null,
    loadMemberships,
  );
  const sellerId =
    selectedId ??
    (memberships.kind === "ready"
      ? memberships.data.results[0]?.seller.id
      : null) ??
    null;
  const loadAccess = useCallback(
    (signal: AbortSignal) => sellerApi.access(sellerId ?? "", signal),
    [sellerId],
  );
  const access = useApiQuery(
    userId && sellerId ? `${userId}:${sellerId}:${pathname}` : null,
    loadAccess,
  );
  if (memberships.kind === "error")
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <ApiErrorState error={memberships.error} onRetry={memberships.retry} />
      </div>
    );
  if (!sellerId && memberships.kind === "ready")
    return (
      <ForbiddenScreen message="You don’t have an available seller membership. Contact the seller owner or platform support." />
    );
  if (access.kind === "error") {
    if ([403, 404].includes(access.error.status))
      return (
        <div>
          <ForbiddenScreen message="This seller workspace is no longer available to your account." />
          <div className="mx-auto max-w-xl px-6">
            <button
              type="button"
              className={secondaryButton}
              onClick={() => {
                setSelectedId(null);
                memberships.retry();
                access.retry();
              }}
            >
              Refresh seller access
            </button>
          </div>
        </div>
      );
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <ApiErrorState error={access.error} onRetry={access.retry} />
      </div>
    );
  }
  if (access.kind !== "ready") return <LoadingState />;
  const current = access.data;
  const options = memberships.kind === "ready" ? memberships.data.results : [];
  const picker = (
    <div>
      <SelectField
        label="Seller workspace"
        value={current.seller.id}
        onChange={(event) => setSelectedId(event.target.value)}
        disabled={memberships.kind === "loading"}
      >
        {!options.some((item) => item.seller.id === current.seller.id) && (
          <option value={current.seller.id}>
            {current.seller.display_name}
          </option>
        )}
        {options.map((item) => (
          <option key={item.id} value={item.seller.id}>
            {item.seller.display_name}
          </option>
        ))}
      </SelectField>
      {memberships.kind === "loading" && (
        <p role="status" className="mt-2 text-xs text-slate-600">
          Loading sellers…
        </p>
      )}
      {memberships.kind === "ready" && memberships.data.count > 25 && (
        <Pagination
          page={page}
          count={memberships.data.count}
          onPageChange={(next) => {
            setSelectedId(current.seller.id);
            setPage(next);
          }}
        />
      )}
    </div>
  );
  return (
    <SellerContext value={current}>
      <WorkspaceFrame
        mode="seller"
        sellerPicker={picker}
        sellerCanReadSettings={current.permissions.includes(
          "seller.settings.read",
        )}
        sellerCanReadProducts={current.permissions.includes(
          "catalog.product.read",
        )}
        sellerCanReadInventory={current.permissions.includes("inventory.read")}
        sellerCanReadOrders={current.permissions.includes("orders.read")}
        sellerCanReadFulfillment={current.permissions.includes(
          "fulfillment.read",
        )}
        sellerCanReadReturns={current.permissions.includes("returns.read")}
        sellerCanReadFinance={current.permissions.includes("finance.read")}
        sellerCanReadStaff={
          current.permissions.includes("seller.staff.read") ||
          current.permissions.includes("seller.staff.manage")
        }
        sellerCanReadPromotions={current.permissions.includes(
          "promotions.read",
        )}
        sellerCanReadReviews={current.permissions.includes("reviews.read")}
      >
        {children}
      </WorkspaceFrame>
    </SellerContext>
  );
}
