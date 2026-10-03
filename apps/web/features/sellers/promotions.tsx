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
import { errorMessage, sellerApi } from "@/lib/api/client";
import type { Promotion, Coupon } from "@/lib/api/types";
import { useApiQuery } from "@/lib/api/use-api-query";
import { useSeller } from "@/features/workspaces/seller-workspace";

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${active ? "bg-emerald-50 text-ui-success" : "bg-ui-surface-muted text-ui-muted"}`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function SellerPromotions() {
  const access = useSeller();
  const sellerId = access.seller.id;
  const canManage = access.permissions.includes("promotions.manage");

  const [page, setPage] = useState(1);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(
    null,
  );
  const [showCoupons, setShowCoupons] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddCoupon, setShowAddCoupon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Create promotion form
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

  // Add coupon form
  const [couponCode, setCouponCode] = useState("");
  const [couponLimit, setCouponLimit] = useState("");
  const [couponPerCustomer, setCouponPerCustomer] = useState("");

  const couponPage = 1;
  const loadCoupons = useCallback(
    (signal: AbortSignal) =>
      selectedPromotion
        ? sellerApi.coupons(sellerId, selectedPromotion.id, couponPage, signal)
        : Promise.resolve({ count: 0, results: [] as Coupon[] }),
    [sellerId, selectedPromotion, couponPage],
  );
  const couponsQuery = useApiQuery(
    selectedPromotion && showCoupons
      ? `${sellerId}:coupons:${selectedPromotion.id}:${couponPage}`
      : null,
    loadCoupons,
  );

  const loadPromotions = useCallback(
    (signal: AbortSignal) => sellerApi.promotions(sellerId, page, signal),
    [sellerId, page],
  );
  const promotionsQuery = useApiQuery(
    `${sellerId}:promotions:${page}`,
    loadPromotions,
  );

  function resetCreateForm() {
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
      await sellerApi.createPromotion(sellerId, {
        name: promoName,
        description: promoDescription,
        discount_type: discountType,
        discount_value: discountValue,
        minimum_order_amount: minOrder || null,
        maximum_discount_amount: maxDiscount || null,
        starts_at: startsAt,
        ends_at: endsAt || null,
        usage_limit: usageLimit ? parseInt(usageLimit) : null,
      });
      resetCreateForm();
      setShowCreate(false);
      promotionsQuery.retry?.();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPromotion) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await sellerApi.createCoupon(sellerId, selectedPromotion.id, {
        code: couponCode,
        usage_limit: couponLimit ? parseInt(couponLimit) : null,
        per_customer_limit: couponPerCustomer
          ? parseInt(couponPerCustomer)
          : null,
      });
      setCouponCode("");
      setCouponLimit("");
      setCouponPerCustomer("");
      setShowAddCoupon(false);
      couponsQuery.retry?.();
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
        title="Promotions"
        description="Manage discounts and coupon codes for your store."
        actions={
          canManage && (
            <button
              type="button"
              onClick={() => {
                resetCreateForm();
                setShowCreate(true);
              }}
              className={primaryButton}
            >
              New promotion
            </button>
          )
        }
      />

      {actionError && !showCreate && !showAddCoupon && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {actionError}
        </p>
      )}

      <div className="mt-6">
        <DataTable
          caption="Seller promotions"
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
              heading: "Status",
              cell: (promo) => (
                <>
                  <StatusBadge active={promo.is_active} />
                </>
              ),
            },
            {
              id: "actions",
              heading: "Actions",
              cell: (promo) => (
                <>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPromotion(promo);
                        setShowCoupons(true);
                      }}
                      className={secondaryButton}
                    >
                      Coupons
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await sellerApi.updatePromotion(
                              sellerId,
                              promo.id,
                              { is_active: !promo.is_active },
                            );
                            promotionsQuery.retry?.();
                          } catch (err) {
                            setActionError(errorMessage(err));
                          }
                        }}
                        className={secondaryButton}
                      >
                        {promo.is_active ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </div>
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

      {/* Coupons drawer/modal */}
      {showCoupons && selectedPromotion && (
        <Dialog
          open
          title={<>Coupons — {selectedPromotion.name}</>}
          onClose={() => {
            setShowCoupons(false);
            setSelectedPromotion(null);
          }}
          busy={submitting}
          size="wide"
          error={actionError}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setShowCoupons(false);
                setSelectedPromotion(null);
              }}
              className="text-sm text-ui-muted hover:text-ui-secondary"
              data-dialog-cancel
            >
              Close
            </button>
          </div>

          {canManage && (
            <div className="mt-3">
              {showAddCoupon ? (
                <form
                  onSubmit={handleAddCoupon}
                  className="space-y-3 rounded-lg bg-ui-surface-muted p-4"
                >
                  <FormField
                    label="Coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="SUMMER20"
                    required
                  />
                  <FormField
                    label="Total usage limit (leave blank for unlimited)"
                    type="number"
                    value={couponLimit}
                    onChange={(e) => setCouponLimit(e.target.value)}
                    placeholder=""
                  />
                  <FormField
                    label="Per-customer limit (leave blank for unlimited)"
                    type="number"
                    value={couponPerCustomer}
                    onChange={(e) => setCouponPerCustomer(e.target.value)}
                    placeholder=""
                  />

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className={primaryButton}
                    >
                      {submitting ? "Adding…" : "Add coupon"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddCoupon(false)}
                      className={secondaryButton}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddCoupon(true)}
                  className={secondaryButton}
                >
                  + Add coupon
                </button>
              )}
            </div>
          )}

          <div className="mt-4">
            {couponsQuery.kind === "loading" && <LoadingState />}
            {couponsQuery.kind === "error" && (
              <ApiErrorState
                error={couponsQuery.error}
                onRetry={couponsQuery.retry}
              />
            )}
            {couponsQuery.kind === "ready" && (
              <div className="space-y-2">
                {couponsQuery.data.results.length === 0 && (
                  <p className="py-6 text-center text-sm text-ui-muted">
                    No coupons yet.
                  </p>
                )}
                {couponsQuery.data.results.map((coupon) => (
                  <div
                    key={coupon.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ui-border p-3"
                  >
                    <div>
                      <span className="font-mono font-semibold text-ui-foreground">
                        {coupon.code}
                      </span>
                      <div className="mt-0.5 text-xs text-ui-muted">
                        Used: {coupon.usage_count}
                        {coupon.usage_limit ? ` / ${coupon.usage_limit}` : ""}
                        {coupon.per_customer_limit
                          ? ` · ${coupon.per_customer_limit}/customer`
                          : ""}
                      </div>
                    </div>
                    <StatusBadge active={coupon.is_active} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Dialog>
      )}

      {/* Create Promotion Modal */}
      {showCreate && (
        <Dialog
          open
          title={<>Create Promotion</>}
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
                placeholder="Summer Sale"
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
              {discountType === "PERCENTAGE" && (
                <FormField
                  label="Maximum discount cap (optional)"
                  type="number"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                  placeholder="0.00"
                />
              )}
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
