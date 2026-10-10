"use client";

import React, { useState } from "react";
import { customerApi } from "@/lib/api/client";

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderItemId: string;
  productTitle: string;
  maxQuantity: number;
  onSuccess?: () => void;
}

export function ReturnModal({
  isOpen,
  onClose,
  orderItemId,
  productTitle,
  maxQuantity,
  onSuccess,
}: ReturnModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("defective");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity < 1 || quantity > maxQuantity) {
      setError(`Quantity must be between 1 and ${maxQuantity}.`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await customerApi.submitReturn({
        order_item_id: orderItemId,
        quantity,
        reason,
        customer_notes: notes.trim(),
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to create return request. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="return-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-ui-surface p-6 shadow-xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2
            id="return-modal-title"
            className="text-base font-bold text-slate-900"
          >
            Request Item Return (RMA)
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
          Item:{" "}
          <span className="font-semibold text-slate-800">{productTitle}</span>
        </p>

        {error && (
          <div
            role="alert"
            data-testid="return-error-banner"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="returnQuantity"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Quantity to Return *
              </label>
              <select
                id="returnQuantity"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                data-testid="return-quantity-select"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-700 focus:outline-none focus:ring-1 focus:ring-ui-focus bg-ui-surface"
              >
                {Array.from({ length: maxQuantity }, (_, i) => i + 1).map(
                  (num) => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? "unit" : "units"}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div>
              <label
                htmlFor="returnReason"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Reason for Return *
              </label>
              <select
                id="returnReason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                data-testid="return-reason-select"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-700 focus:outline-none focus:ring-1 focus:ring-ui-focus bg-ui-surface"
              >
                <option value="defective">Defective / Does not work</option>
                <option value="damaged">Damaged during shipping</option>
                <option value="wrong_item">Wrong item delivered</option>
                <option value="not_as_described">Not as described</option>
                <option value="changed_mind">Changed mind</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="returnNotes"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Additional Notes (optional)
            </label>
            <textarea
              id="returnNotes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide any additional details or serial numbers to expedite return approval."
              data-testid="return-notes-input"
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
              data-testid="submit-return-button"
              className="rounded-xl bg-orange-800 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-orange-900 disabled:opacity-50 transition"
            >
              {submitting ? "Requesting..." : "Submit Return Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
