"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { hasPlatformPermission } from "@/lib/permissions";
import { useApiQuery } from "@/lib/api/use-api-query";
import { Pagination } from "@/components/ui/pagination";
import {
  ApiErrorState,
  EmptyState,
  LoadingState,
  PageHeader,
  StatusBadge,
  primaryButton,
  secondaryButton,
} from "@/components/ui/primitives";
import {
  getAdminCommissionPlans,
  createCommissionPlan,
  updateCommissionPlan,
  createCommissionRule,
  deleteCommissionRule,
  type CommissionPlan,
  type CommissionRule,
} from "./api";

const inputStyle =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none";

export function AdminCommissions() {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;

  if (!hasPlatformPermission(user, "platform.finance.read")) {
    return <ForbiddenScreen />;
  }

  const canManage = hasPlatformPermission(user, "platform.finance.manage");

  return <CommissionsList canManage={canManage} />;
}

function CommissionsList({ canManage }: { canManage: boolean }) {
  const [page, setPage] = useState(1);
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<CommissionPlan | null>(null);
  const [activeRuleModalPlan, setActiveRuleModalPlan] =
    useState<CommissionPlan | null>(null);

  const loadPlans = useCallback(
    (signal: AbortSignal) => getAdminCommissionPlans({ page }, signal),
    [page],
  );

  const query = useApiQuery(
    `admin:finance:commission-plans:${page}`,
    loadPlans,
  );

  if (query.kind === "loading") {
    return <LoadingState />;
  }

  if (query.kind === "error") {
    return <ApiErrorState error={query.error} onRetry={query.retry} />;
  }

  const plansPage = query.data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4">
        <Link
          href="/admin/finance"
          className="text-sm font-medium text-teal-800 hover:underline"
        >
          &larr; Back to Finance Overview
        </Link>
      </div>

      <PageHeader
        title="Commission Plans & Rules"
        description="Configure tiered, seller-specific, and category-level fee rules. Rules evaluate with priority: Seller+Category &gt; Seller &gt; Category &gt; Plan Default."
        actions={
          canManage ? (
            <button
              type="button"
              className={primaryButton}
              onClick={() => setShowCreatePlanModal(true)}
            >
              New Commission Plan
            </button>
          ) : undefined
        }
      />

      {plansPage.results.length === 0 ? (
        <EmptyState
          title="No commission plans configured"
          description="Commission plans specify default percentage deductions and custom category/seller rules."
          action={
            canManage ? (
              <button
                type="button"
                className={primaryButton}
                onClick={() => setShowCreatePlanModal(true)}
              >
                Create First Plan
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          {plansPage.results.map((plan) => (
            <div
              key={plan.id}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900">
                      {plan.name}
                    </h2>
                    {plan.is_default && (
                      <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
                        Default Plan
                      </span>
                    )}
                    <StatusBadge
                      status={plan.is_active ? "ACTIVE" : "INACTIVE"}
                    />
                  </div>
                  {plan.description && (
                    <p className="mt-1 text-sm text-slate-600">
                      {plan.description}
                    </p>
                  )}
                  <p className="mt-2 text-sm font-semibold text-slate-800">
                    Default Rate:{" "}
                    <span className="text-teal-700">
                      {plan.default_percentage}%
                    </span>
                  </p>
                </div>

                {canManage && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={secondaryButton}
                      onClick={() => setEditingPlan(plan)}
                    >
                      Edit Plan
                    </button>
                    <button
                      type="button"
                      className={primaryButton}
                      onClick={() => setActiveRuleModalPlan(plan)}
                    >
                      Add Rule
                    </button>
                  </div>
                )}
              </div>

              {/* Rules List */}
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-slate-700">
                  Rules ({plan.rules.length})
                </h3>
                {plan.rules.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500 italic">
                    No custom rules attached. All orders calculate using the
                    plan default of {plan.default_percentage}%.
                  </p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                        <tr>
                          <th className="px-3 py-2">Scope</th>
                          <th className="px-3 py-2">Percentage</th>
                          <th className="px-3 py-2">Fixed Fee</th>
                          <th className="px-3 py-2">Priority</th>
                          <th className="px-3 py-2">Status</th>
                          {canManage && (
                            <th className="px-3 py-2 text-right">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {plan.rules.map((rule) => (
                          <RuleRow
                            key={rule.id}
                            rule={rule}
                            canManage={canManage}
                            onDeleted={() => query.retry()}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ))}

          {plansPage.count > 25 && (
            <Pagination
              page={page}
              count={plansPage.count}
              onPageChange={(p) => setPage(p)}
            />
          )}
        </div>
      )}

      {/* Create Plan Modal */}
      {showCreatePlanModal && (
        <CreatePlanModal
          onClose={() => setShowCreatePlanModal(false)}
          onSuccess={() => {
            setShowCreatePlanModal(false);
            query.retry();
          }}
        />
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <EditPlanModal
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSuccess={() => {
            setEditingPlan(null);
            query.retry();
          }}
        />
      )}

      {/* Add Rule Modal */}
      {activeRuleModalPlan && (
        <AddRuleModal
          plan={activeRuleModalPlan}
          onClose={() => setActiveRuleModalPlan(null)}
          onSuccess={() => {
            setActiveRuleModalPlan(null);
            query.retry();
          }}
        />
      )}
    </div>
  );
}

function RuleRow({
  rule,
  canManage,
  onDeleted,
}: {
  rule: CommissionRule;
  canManage: boolean;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this commission rule?"))
      return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCommissionRule(rule.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete rule");
      setDeleting(false);
    }
  };

  let scopeLabel = "General";
  if (rule.seller_name && rule.category_name) {
    scopeLabel = `Seller: ${rule.seller_name} / Category: ${rule.category_name}`;
  } else if (rule.seller_name) {
    scopeLabel = `Seller: ${rule.seller_name}`;
  } else if (rule.category_name) {
    scopeLabel = `Category: ${rule.category_name}`;
  } else if (rule.seller_id) {
    scopeLabel = `Seller ID: ${rule.seller_id}`;
  } else if (rule.category_id) {
    scopeLabel = `Category ID: ${rule.category_id}`;
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-3 py-3 font-medium text-slate-900">{scopeLabel}</td>
      <td className="px-3 py-3 text-teal-700 font-semibold">
        {rule.percentage}%
      </td>
      <td className="px-3 py-3 text-slate-700">${rule.fixed_fee}</td>
      <td className="px-3 py-3 text-slate-600">{rule.priority}</td>
      <td className="px-3 py-3">
        <StatusBadge status={rule.is_active ? "ACTIVE" : "INACTIVE"} />
      </td>
      {canManage && (
        <td className="px-3 py-3 text-right">
          {error && <span className="mr-2 text-xs text-rose-600">{error}</span>}
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </td>
      )}
    </tr>
  );
}

function CreatePlanModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [defaultPercentage, setDefaultPercentage] = useState("10.00");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createCommissionPlan({
        name,
        default_percentage: defaultPercentage,
        description: description || undefined,
        is_default: isDefault,
      });
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create commission plan",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-plan-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="create-plan-title" className="text-lg font-bold text-slate-900">
          Create Commission Plan
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="plan-name"
              className="block text-xs font-semibold text-slate-700"
            >
              Plan Name *
            </label>
            <input
              id="plan-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard Marketplace 2026"
              className={`mt-1 ${inputStyle}`}
            />
          </div>

          <div>
            <label
              htmlFor="plan-percentage"
              className="block text-xs font-semibold text-slate-700"
            >
              Default Percentage (%) *
            </label>
            <input
              id="plan-percentage"
              type="text"
              required
              pattern="^\d+(\.\d{1,2})?$"
              value={defaultPercentage}
              onChange={(e) => setDefaultPercentage(e.target.value)}
              placeholder="10.00"
              className={`mt-1 ${inputStyle}`}
            />
          </div>

          <div>
            <label
              htmlFor="plan-description"
              className="block text-xs font-semibold text-slate-700"
            >
              Description (Optional)
            </label>
            <textarea
              id="plan-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details on eligible sellers or contract tiers"
              className={`mt-1 ${inputStyle}`}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="plan-is-default"
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
            />
            <label htmlFor="plan-is-default" className="text-sm text-slate-700">
              Set as marketplace default plan
            </label>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800"
            >
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className={secondaryButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={primaryButton}
            >
              {submitting ? "Creating…" : "Create Plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditPlanModal({
  plan,
  onClose,
  onSuccess,
}: {
  plan: CommissionPlan;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(plan.name);
  const [defaultPercentage, setDefaultPercentage] = useState(
    plan.default_percentage,
  );
  const [description, setDescription] = useState(plan.description);
  const [isActive, setIsActive] = useState(plan.is_active);
  const [isDefault, setIsDefault] = useState(plan.is_default);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await updateCommissionPlan(plan.id, {
        name,
        default_percentage: defaultPercentage,
        description: description || undefined,
        is_active: isActive,
        is_default: isDefault,
      });
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update commission plan",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-plan-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="edit-plan-title" className="text-lg font-bold text-slate-900">
          Edit Commission Plan
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="edit-plan-name"
              className="block text-xs font-semibold text-slate-700"
            >
              Plan Name *
            </label>
            <input
              id="edit-plan-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`mt-1 ${inputStyle}`}
            />
          </div>

          <div>
            <label
              htmlFor="edit-plan-percentage"
              className="block text-xs font-semibold text-slate-700"
            >
              Default Percentage (%) *
            </label>
            <input
              id="edit-plan-percentage"
              type="text"
              required
              pattern="^\d+(\.\d{1,2})?$"
              value={defaultPercentage}
              onChange={(e) => setDefaultPercentage(e.target.value)}
              className={`mt-1 ${inputStyle}`}
            />
          </div>

          <div>
            <label
              htmlFor="edit-plan-description"
              className="block text-xs font-semibold text-slate-700"
            >
              Description
            </label>
            <textarea
              id="edit-plan-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`mt-1 ${inputStyle}`}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="edit-plan-is-active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
            />
            <label
              htmlFor="edit-plan-is-active"
              className="text-sm text-slate-700"
            >
              Active plan
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="edit-plan-is-default"
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
            />
            <label
              htmlFor="edit-plan-is-default"
              className="text-sm text-slate-700"
            >
              Marketplace default plan
            </label>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800"
            >
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className={secondaryButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={primaryButton}
            >
              {submitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddRuleModal({
  plan,
  onClose,
  onSuccess,
}: {
  plan: CommissionPlan;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [percentage, setPercentage] = useState("8.00");
  const [fixedFee, setFixedFee] = useState("0.00");
  const [priority, setPriority] = useState("10");
  const [sellerId, setSellerId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createCommissionRule(plan.id, {
        percentage,
        fixed_fee: fixedFee || "0.00",
        priority: parseInt(priority, 10) || 0,
        seller_id: sellerId.trim() || null,
        category_id: categoryId.trim() || null,
      });
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add commission rule",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-rule-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="add-rule-title" className="text-lg font-bold text-slate-900">
          Add Commission Rule to {plan.name}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="rule-percentage"
              className="block text-xs font-semibold text-slate-700"
            >
              Percentage (%) *
            </label>
            <input
              id="rule-percentage"
              type="text"
              required
              pattern="^\d+(\.\d{1,2})?$"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              placeholder="8.00"
              className={`mt-1 ${inputStyle}`}
            />
          </div>

          <div>
            <label
              htmlFor="rule-fixed-fee"
              className="block text-xs font-semibold text-slate-700"
            >
              Fixed Fee ($)
            </label>
            <input
              id="rule-fixed-fee"
              type="text"
              pattern="^\d+(\.\d{1,2})?$"
              value={fixedFee}
              onChange={(e) => setFixedFee(e.target.value)}
              placeholder="0.00"
              className={`mt-1 ${inputStyle}`}
            />
          </div>

          <div>
            <label
              htmlFor="rule-priority"
              className="block text-xs font-semibold text-slate-700"
            >
              Priority (Higher number = evaluated first)
            </label>
            <input
              id="rule-priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={`mt-1 ${inputStyle}`}
            />
          </div>

          <div>
            <label
              htmlFor="rule-seller-id"
              className="block text-xs font-semibold text-slate-700"
            >
              Seller UUID (Optional)
            </label>
            <input
              id="rule-seller-id"
              type="text"
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              placeholder="Leave blank for all sellers"
              className={`mt-1 ${inputStyle}`}
            />
          </div>

          <div>
            <label
              htmlFor="rule-category-id"
              className="block text-xs font-semibold text-slate-700"
            >
              Category UUID (Optional)
            </label>
            <input
              id="rule-category-id"
              type="text"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              placeholder="Leave blank for all categories"
              className={`mt-1 ${inputStyle}`}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800"
            >
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className={secondaryButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={primaryButton}
            >
              {submitting ? "Adding…" : "Add Rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
