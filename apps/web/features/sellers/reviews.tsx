"use client";

import { Dialog } from "@/components/ui/dialog";
import { ReviewDetail } from "./review-detail";
import { Button } from "@/components/ui/button";
import { DateDisplay } from "@/components/ui/displays";

import { useCallback, useState } from "react";
import {
  ApiErrorState,
  LoadingState,
  primaryButton,
  secondaryButton,
  FormField,
} from "@/components/ui/primitives";
import { errorMessage, sellerApi } from "@/lib/api/client";
import type { ProductReview } from "@/lib/api/types";
import { useApiQuery } from "@/lib/api/use-api-query";
import { useSeller } from "@/features/workspaces/seller-workspace";

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

export function SellerReviews() {
  const access = useSeller();
  const sellerId = access.seller.id;
  const canRespond = access.permissions.includes("reviews.respond");
  const canReport = access.permissions.includes("reviews.report");

  const [page, setPage] = useState(1);
  const [inspecting, setInspecting] = useState<{
    scope: string | undefined;
    review: ProductReview;
  } | null>(null);
  const [selectedReview, setSelectedReview] = useState<ProductReview | null>(
    null,
  );
  const [responseText, setResponseText] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [showResponse, setShowResponse] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadReviews = useCallback(
    (signal: AbortSignal) => sellerApi.reviews(sellerId, page, signal),
    [sellerId, page],
  );
  const reviewsQuery = useApiQuery(`${sellerId}:reviews:${page}`, loadReviews);

  async function handleRespond(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReview || !responseText.trim()) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await sellerApi.respondToReview(
        sellerId,
        selectedReview.id,
        responseText,
      );
      setShowResponse(false);
      setResponseText("");
      setSelectedReview(null);
      reviewsQuery.retry?.();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReport(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReview || !reportReason.trim()) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await sellerApi.reportReview(sellerId, selectedReview.id, reportReason);
      setShowReport(false);
      setReportReason("");
      setSelectedReview(null);
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
      <div>
        <h1 className="text-xl font-semibold text-slate-950">
          Product Reviews
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          View, respond to, and report customer product reviews.
        </p>
      </div>

      {actionError && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {actionError}
        </p>
      )}

      {inspecting && inspecting.scope === access.id && (
        <ReviewDetail
          review={inspecting.review}
          onClose={() => setInspecting(null)}
        />
      )}
      <div className="mt-6 space-y-4">
        {reviews.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">
            No reviews yet.
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
                      Verified purchase
                    </span>
                  )}
                </div>
                <Button
                  variant="quiet"
                  onClick={() => setInspecting({ scope: access.id, review })}
                >
                  View review
                </Button>
                <div className="mt-1 font-semibold text-slate-900">
                  {review.title}
                </div>
                <p className="mt-1 text-sm text-slate-700">{review.body}</p>
                <div className="mt-2 text-xs text-slate-500">
                  By {review.customer.email} · {review.product.name} ·{" "}
                  <DateDisplay value={review.created_at} />
                </div>

                {review.seller_response && (
                  <div className="mt-3 rounded-lg bg-teal-50 p-3">
                    <p className="text-xs font-semibold text-teal-800 mb-1">
                      Your response
                    </p>
                    <p className="text-sm text-teal-900">
                      {review.seller_response}
                    </p>
                    {review.seller_response_at && (
                      <p className="mt-1 text-xs text-teal-600">
                        {new Date(
                          review.seller_response_at,
                        ).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                {canRespond && !review.seller_response && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReview(review);
                      setShowResponse(true);
                    }}
                    className={secondaryButton}
                  >
                    Respond
                  </button>
                )}
                {canReport && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReview(review);
                      setShowReport(true);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Report
                  </button>
                )}
              </div>
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

      {/* Respond Modal */}
      {showResponse && selectedReview && (
        <Dialog
          open
          title={<>Respond to Review</>}
          onClose={() => {
            setShowResponse(false);
            setSelectedReview(null);
            setResponseText("");
          }}
          busy={submitting}
          error={actionError}
        >
          <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <StarRating rating={selectedReview.rating} />
            <p className="mt-1 font-semibold">{selectedReview.title}</p>
            <p className="mt-1">{selectedReview.body}</p>
          </div>
          <form onSubmit={handleRespond} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Your response
              </label>
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={4}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                placeholder="Thank you for your feedback…"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowResponse(false);
                  setSelectedReview(null);
                  setResponseText("");
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
                {submitting ? "Submitting…" : "Submit response"}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Report Modal */}
      {showReport && selectedReview && (
        <Dialog
          open
          title={<>Report Review</>}
          description={
            <>
              Flag this review for platform moderation. You cannot directly
              delete reviews.
            </>
          }
          onClose={() => {
            setShowReport(false);
            setSelectedReview(null);
            setReportReason("");
          }}
          busy={submitting}
          error={actionError}
        >
          <form onSubmit={handleReport} className="mt-4 space-y-3">
            <FormField
              label="Reason"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="e.g. Fake review, contains personal information"
              required
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowReport(false);
                  setSelectedReview(null);
                  setReportReason("");
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
                {submitting ? "Reporting…" : "Submit report"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
