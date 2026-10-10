"use client";

import React, { useState } from "react";
import { customerApi } from "@/lib/api/client";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderItemId: string;
  productTitle: string;
  onSuccess?: () => void;
}

export function ReviewModal({
  isOpen,
  onClose,
  orderItemId,
  productTitle,
  onSuccess,
}: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError("Please provide both a title and review content.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await customerApi.submitReview({
        order_item_id: orderItemId,
        rating,
        title: title.trim(),
        body: body.trim(),
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to submit review. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-ui-surface p-6 shadow-xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2
            id="review-modal-title"
            className="text-base font-bold text-slate-900"
          >
            Write a Product Review
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            ✕
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          Reviewing:{" "}
          <span className="font-semibold text-slate-800">{productTitle}</span>
        </p>

        {error && (
          <div
            role="alert"
            data-testid="review-error-banner"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Rating (1 to 5 Stars) *
            </label>
            <div
              className="flex items-center gap-1.5"
              data-testid="star-rating-picker"
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  aria-label={`${star} star`}
                  onClick={() => setRating(star)}
                  className={`text-2xl transition hover:scale-110 ${
                    star <= rating ? "text-amber-400" : "text-slate-200"
                  }`}
                >
                  ★
                </button>
              ))}
              <span className="ml-2 text-xs font-bold text-slate-600">
                {rating} out of 5
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="reviewTitle"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Headline / Title *
            </label>
            <input
              id="reviewTitle"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Great sound quality, very comfortable!"
              data-testid="review-title-input"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 focus:border-orange-700 focus:outline-none focus:ring-1 focus:ring-ui-focus"
            />
          </div>

          <div>
            <label
              htmlFor="reviewBody"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Written Review *
            </label>
            <textarea
              id="reviewBody"
              rows={4}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe your experience with the item, build quality, performance, etc."
              data-testid="review-body-input"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 focus:border-orange-700 focus:outline-none focus:ring-1 focus:ring-ui-focus"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              data-testid="submit-review-button"
              className="rounded-xl bg-orange-800 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-orange-900 disabled:opacity-50 transition"
            >
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
