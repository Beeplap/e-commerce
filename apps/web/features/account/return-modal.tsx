"use client";
import { useState, type FormEvent } from "react";
import {
  StorefrontButton,
  StorefrontInput,
  StorefrontSelect,
} from "@/components/storefront/controls";
import { StorefrontOverlay } from "@/components/storefront/feedback";
import { isUuid } from "@/features/storefront/catalog-evidence";
import { ApiError, customerApi } from "@/lib/api/client";
import { asAccountError, fieldError, useAccountCommand } from "./shared";
interface Props {
  isOpen: boolean;
  onClose: () => void;
  orderItemId: string;
  productTitle: string;
  maxQuantity: number;
  onSuccess?: () => void;
}
export function ReturnModal(props: Props) {
  return props.isOpen ? (
    <ReturnForm key={props.orderItemId} {...props} />
  ) : null;
}
function ReturnForm({
  onClose,
  orderItemId,
  productTitle,
  maxQuantity,
  onSuccess,
}: Props) {
  const command = useAccountCommand();
  const [quantity, setQuantity] = useState(1),
    [reason, setReason] = useState("defective"),
    [notes, setNotes] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const reasons = {
    defective: "Defective / Does not work",
    damaged: "Damaged during shipping",
    wrong_item: "Wrong item delivered",
    not_as_described: "Not as described",
    changed_mind: "Changed mind",
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (
      !isUuid(orderItemId) ||
      !Number.isSafeInteger(maxQuantity) ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > maxQuantity ||
      !(reason in reasons)
    ) {
      setError(new ApiError("Choose a valid quantity and return reason.", 0));
      return;
    }
    await command.run(
      async (signal) => {
        await customerApi.submitReturn(
          {
            order_item_id: orderItemId,
            quantity,
            reason,
            customer_notes: notes.trim(),
          },
          signal,
        );
        if (command.active()) {
          onSuccess?.();
          onClose();
        }
      },
      (failure) => setError(asAccountError(failure)),
    );
  }
  return (
    <StorefrontOverlay
      open
      title="Request an item return"
      description={productTitle}
      busy={command.busy}
      error={error?.message}
      onClose={onClose}
    >
      <form onSubmit={submit} className="sf-account-modal-form">
        <StorefrontInput
          label="Quantity to return"
          type="number"
          min={1}
          max={maxQuantity}
          step={1}
          required
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
          error={fieldError(error, "quantity")}
          data-testid="return-quantity-select"
        />
        <StorefrontSelect
          label="Reason for return"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          error={fieldError(error, "reason")}
          data-testid="return-reason-select"
        >
          {Object.entries(reasons).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </StorefrontSelect>
        <div className="sf-field">
          <label htmlFor="account-return-notes" className="sf-field-label">
            Additional notes (optional)
          </label>
          <textarea
            id="account-return-notes"
            className="sf-control"
            rows={4}
            maxLength={1000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            data-testid="return-notes-input"
            aria-invalid={Boolean(fieldError(error, "customer_notes"))}
            aria-describedby={
              fieldError(error, "customer_notes")
                ? "account-return-notes-error"
                : undefined
            }
          />
          {fieldError(error, "customer_notes") && (
            <p id="account-return-notes-error" className="sf-field-error">
              {fieldError(error, "customer_notes")}
            </p>
          )}
        </div>
        <p className="sf-account-help">
          Submitting a request does not confirm a return or refund. The seller
          reviews eligibility.
        </p>
        <div className="sf-account-actions">
          <StorefrontButton variant="secondary" onClick={onClose}>
            Cancel
          </StorefrontButton>
          <StorefrontButton
            type="submit"
            busy={command.busy}
            data-testid="submit-return-button"
          >
            {command.busy ? "Requesting..." : "Submit Return Request"}
          </StorefrontButton>
        </div>
      </form>
    </StorefrontOverlay>
  );
}
