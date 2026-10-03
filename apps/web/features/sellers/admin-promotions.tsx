"use client";

import { DataTable } from "@/components/ui/data-table";

import { FormSection } from "@/components/ui/layout";

import { Dialog } from "@/components/ui/dialog";

import { useCallback, useState } from "react";
import {
  ApiErrorState,
  PageHeader,
  SelectField,
  LoadingState,
  primaryButton,
  secondaryButton,
  FormField,
} from "@/components/ui/primitives";
import { errorMessage, adminApi } from "@/lib/api/client";
import type { Promotion } from "@/lib/api/types";
import { useApiQuery } from "@/lib/api/use-api-query";
import { hasPlatformPermission } from "@/lib/permissions";
import { useAuth } from "@/features/auth/auth-provider";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";

function ScopeBadge({ scope }: { scope: "PLATFORM" | "SELLER" }) {
  return (
    <span className="text-ui-caption capitalize text-ui-secondary">
      {scope.toLowerCase()}
    </span>
  );
}

export function AdminPromotions() {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;
  const canRead = hasPlatformPermission(user, "platform.promotions.read");
  const canManage = hasPlatformPermission(user, "platform.promotions.manage");

  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form state
  const [promoName, setPromoName] = useState("");
  const [promoDescription, setPromoDescription] = useState("");
  const [discountType, setDiscountType] =
    useState<Promotion["discount_type"]>("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [usageLimit, setUsageLimit] = useState("");

  const loadPromotions = useCallback(
    (signal: AbortSignal) => adminApi.promotions(page, signal),
    [page],
  );
  const promotionsQuery = useApiQuery(
    canRead ? `admin:promotions:${page}` : null,
    loadPromotions,
  );

  if (!canRead)
    return <ForbiddenScreen message="Insufficient platform access." />;

  function resetForm() {
    setPromoName("");
    setPromoDescription("");
    setDiscountType("PERCENTAGE");
    setDiscountValue("");
    setMinOrder("");
    setMaxDiscount("");
    setStartsAt("");
    setEndsAt("");
    setUsageLimit("");
    setActionError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);
    try {
      await adminApi.createPromotion({
        name: promoName,
        description: promoDescription,
        discount_type: discountType,
        discount_value: discountValue,
        minimum_order_amount: minOrder || null,
        maximum_discount_amount: maxDiscount || null,
        starts_at: startsAt,
        ends_at: endsAt || null,
        usage_limit: usageLimit ? parseInt(usageLimit) : null,
        scope: "PLATFORM",
      });
      resetForm();
      setShowCreate(false);
      promotionsQuery.retry?.();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (promotionsQuery.kind === "error")
    return (
      <div className="mx-auto max-w-2xl py-12">
        <ApiErrorState
          error={promotionsQuery.error}
          onRetry={promotionsQuery.retry}
        />
      </div>
    );
  if (promotionsQuery.kind === "loading") return <LoadingState />;

  const promotions: Promotion[] = promotionsQuery.data.results;

  return (
    <section>
      <PageHeader
        title="Platform Promotions"
        description="Manage platform-wide promotions and seller-scoped discounts."
        actions={
          canManage && (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowCreate(true);
              }}
              className={primaryButton}
            >
              New platform promotion
            </button>
          )
        }
      />

      {actionError && !showCreate && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {actionError}
        </p>
      )}

      <div className="mt-6">
        <DataTable
          caption="Platform promotions"
          rows={promotions}
          rowKey={(promo) => promo.id}
          columns={[
            {
              id: "promotion",
              heading: "Promotion",
              cell: (promo) => (
                <>
                  <div className="font-medium text-ui-foreground">
                    {promo.name}
                  </div>
                  <div className="text-xs text-ui-muted">
                    {promo.description}
                  </div>
                </>
              ),
            },
            {
              id: "scope",
              heading: "Scope",
              cell: (promo) => (
                <>
                  <ScopeBadge scope={promo.scope} />
                </>
              ),
            },
            {
              id: "discount",
              heading: "Discount",
              cell: (promo) => (
                <>
                  <div className="mt-0.5 text-xs text-ui-secondary">
                    {promo.discount_type === "PERCENTAGE"
                      ? `${promo.discount_value}%`
                      : promo.discount_type === "FIXED_AMOUNT"
                        ? `${promo.discount_value} off`
                        : "Free shipping"}
                  </div>
                </>
              ),
            },
            {
              id: "usage",
              heading: "Usage",
              align: "right",
              cell: (promo) => (
                <>
                  {promo.usage_count}
                  {promo.usage_limit ? ` / ${promo.usage_limit}` : ""}
                </>
              ),
            },
            {
              id: "status",
              heading: "Active",
              cell: (promo) => (
                <>
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${promo.is_active ? "bg-emerald-500" : "bg-slate-300"}`}
                  />
                </>
              ),
            },
          ]}
        />
      </div>

      {promotionsQuery.data.count > 25 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ui-secondary">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className={secondaryButton}
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.ceil(promotionsQuery.data.count / 25)}
          </span>
          <button
            type="button"
            disabled={page * 25 >= promotionsQuery.data.count}
            onClick={() => setPage((p) => p + 1)}
            className={secondaryButton}
          >
            Next
          </button>
        </div>
      )}

      {showCreate && (
        <Dialog
          open
          title={<>Create Platform Promotion</>}
          onClose={() => setShowCreate(false)}
          busy={submitting}
          size="wide"
          error={actionError}
        >
          <form onSubmit={handleCreate} className="mt-4 space-y-3">
            <FormSection
              title="Promotion details"
              description="Give this promotion a recognizable name and optional description."
            >
              <FormField
                label="Name"
                value={promoName}
                onChange={(e) => setPromoName(e.target.value)}
                placeholder="Platform-wide sale"
                required
              />
              <FormField
                label="Description"
                value={promoDescription}
                onChange={(e) => setPromoDescription(e.target.value)}
                placeholder="Optional description"
              />
            </FormSection>
            <FormSection
              title="Discount and eligibility"
              description="Choose the discount and any order thresholds. Rules are validated by the backend."
            >
              <SelectField
                label="Discount type"
                value={discountType}
                onChange={(e) =>
                  setDiscountType(e.target.value as Promotion["discount_type"])
                }
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED_AMOUNT">Fixed amount</option>
                <option value="FREE_SHIPPING">Free shipping</option>
              </SelectField>
              {discountType !== "FREE_SHIPPING" && (
                <FormField
                  label="Discount value"
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={
                    discountType === "PERCENTAGE" ? "10 (for 10%)" : "5.00"
                  }
                  required
                />
              )}
              <FormField
                label="Minimum order amount (optional)"
                type="number"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                placeholder="0.00"
              />
            </FormSection>
            <FormSection
              title="Schedule and usage"
              description="Set when the promotion applies and optional usage limits."
            >
              <FormField
                label="Starts at"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
              <FormField
                label="Ends at (optional)"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
              <FormField
                label="Total usage limit (optional)"
                type="number"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                placeholder="0 = unlimited"
              />
            </FormSection>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className={secondaryButton}
                data-dialog-cancel
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={primaryButton}
              >
                {submitting ? "Creating…" : "Create promotion"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
