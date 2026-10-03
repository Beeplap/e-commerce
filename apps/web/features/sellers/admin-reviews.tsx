"use client";

import { Dialog } from "@/components/ui/dialog";

import { useCallback, useState } from "react";
import {
  ApiErrorState,
  LoadingState,
  primaryButton,
  secondaryButton,
  FormField,
} from "@/components/ui/primitives";
import { errorMessage, adminApi } from "@/lib/api/client";
import type { ProductReview } from "@/lib/api/types";
import { useApiQuery } from "@/lib/api/use-api-query";
import { hasPlatformPermission } from "@/lib/permissions";
import { useAuth } from "@/features/auth/auth-provider";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";

function StarRating({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5 stars`} className="text-amber-500">
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </span>
  );
}

function StatusBadge({ status }: { status: ProductReview["status"] }) {
  const cls =
    status === "published"
      ? "bg-emerald-50 text-emerald-700"
      : status === "pending"
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  );
}

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
  { value: "removed", label: "Removed" },
];

export function AdminReviews() {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;
  const canRead = hasPlatformPermission(user, "platform.reviews.read");
  const canModerate = hasPlatformPermission(user, "platform.reviews.moderate");

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedReview, setSelectedReview] = useState<ProductReview | null>(
    null,
  );
  const [action, setAction] = useState<"publish" | "reject" | "remove" | null>(
    null,
  );
  const [moderationNotes, setModerationNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadReviews = useCallback(
    (signal: AbortSignal) =>
      adminApi.reviews(page, statusFilter || undefined, signal),
    [page, statusFilter],
  );
  const reviewsQuery = useApiQuery(
    canRead ? `admin:reviews:${page}:${statusFilter}` : null,
    loadReviews,
  );

  if (!canRead)
    return <ForbiddenScreen message="Insufficient platform access." />;

  async function handleModerate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReview || !action) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await adminApi.moderateReview(selectedReview.id, action, moderationNotes);
      setSelectedReview(null);
      setAction(null);
      setModerationNotes("");
      reviewsQuery.retry?.();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (reviewsQuery.kind === "error")
    return (
      <div className="mx-auto max-w-2xl py-12">
        <ApiErrorState
          error={reviewsQuery.error}
          onRetry={reviewsQuery.retry}
        />
      </div>
    );
  if (reviewsQuery.kind === "loading") return <LoadingState />;

  const reviews: ProductReview[] = reviewsQuery.data.results;

  return (
    <section>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-950">
            Review Moderation
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Moderate product reviews across the platform.
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              setStatusFilter(f.value);
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === f.value
                ? "bg-teal-700 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {actionError && !selectedReview && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {actionError}
        </p>
      )}

      <div className="mt-4 space-y-4">
        {reviews.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">
            No reviews match the current filter.
          </p>
        )}
        {reviews.map((review) => (
          <div
            key={review.id}
            className="rounded-xl border border-slate-200 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <StarRating rating={review.rating} />
                  <StatusBadge status={review.status} />
                  {review.verified_purchase && (
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700">
                      Verified
                    </span>
                  )}
                </div>
                <div className="mt-1 font-semibold text-slate-900">
                  {review.title}
                </div>
                <p className="mt-1 text-sm text-slate-700">{review.body}</p>
                <div className="mt-2 text-xs text-slate-500">
                  By {review.customer.email} · {review.product.name} ·{" "}
                  {new Date(review.created_at).toLocaleDateString()}
                </div>
                {review.seller_response && (
                  <div className="mt-2 rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-700 mb-1">
                      Seller response
                    </p>
                    <p className="text-xs text-slate-600">
                      {review.seller_response}
                    </p>
                  </div>
                )}
              </div>
              {canModerate && (
                <div className="flex flex-col gap-2 shrink-0">
                  {review.status !== "published" && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReview(review);
                        setAction("publish");
                      }}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Publish
                    </button>
                  )}
                  {review.status !== "rejected" && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReview(review);
                        setAction("reject");
                      }}
                      className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                    >
                      Reject
                    </button>
                  )}
                  {review.status !== "removed" && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReview(review);
                        setAction("remove");
                      }}
                      className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {reviewsQuery.data.count > 25 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className={secondaryButton}
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.ceil(reviewsQuery.data.count / 25)}
          </span>
          <button
            type="button"
            disabled={page * 25 >= reviewsQuery.data.count}
            onClick={() => setPage((p) => p + 1)}
            className={secondaryButton}
          >
            Next
          </button>
        </div>
      )}

      {/* Moderation confirmation modal */}
      {selectedReview && action && (
        <Dialog
          open
          title={<>{action} Review</>}
          onClose={() => {
            setSelectedReview(null);
            setAction(null);
            setModerationNotes("");
          }}
          busy={submitting}
          error={actionError}
        >
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <StarRating rating={selectedReview.rating} />
            <p className="mt-1 font-semibold">{selectedReview.title}</p>
            <p className="mt-1">{selectedReview.body}</p>
          </div>
          <form onSubmit={handleModerate} className="mt-4 space-y-3">
            <FormField
              label="Moderation notes (optional)"
              value={moderationNotes}
              onChange={(e) => setModerationNotes(e.target.value)}
              placeholder="Internal moderation reason…"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedReview(null);
                  setAction(null);
                  setModerationNotes("");
                }}
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
                {submitting ? "Submitting…" : `Confirm ${action}`}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
