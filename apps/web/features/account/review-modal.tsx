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
  onSuccess?: () => void;
}
export function ReviewModal(props: Props) {
  return props.isOpen ? (
    <ReviewForm key={props.orderItemId} {...props} />
  ) : null;
}
function ReviewForm({ onClose, orderItemId, productTitle, onSuccess }: Props) {
  const command = useAccountCommand();
  const [rating, setRating] = useState(5),
    [title, setTitle] = useState(""),
    [body, setBody] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (
      !isUuid(orderItemId) ||
      !title.trim() ||
      !body.trim() ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      setError(
        new ApiError(
          "Choose a rating and provide a title and review content.",
          0,
        ),
      );
      return;
    }
    await command.run(
      async (signal) => {
        await customerApi.submitReview(
          {
            order_item_id: orderItemId,
            rating,
            title: title.trim(),
            body: body.trim(),
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
      title="Write a product review"
      description={productTitle}
      busy={command.busy}
      error={error?.message}
      onClose={onClose}
    >
      <form onSubmit={submit} className="sf-account-modal-form">
        <StorefrontSelect
          label="Rating (1 to 5 stars)"
          value={rating}
          onChange={(event) => setRating(Number(event.target.value))}
          error={fieldError(error, "rating")}
          data-testid="star-rating-picker"
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} {value === 1 ? "star" : "stars"}
            </option>
          ))}
        </StorefrontSelect>
        <StorefrontInput
          label="Headline / Title"
          required
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          error={fieldError(error, "title")}
          data-testid="review-title-input"
        />
        <div className="sf-field">
          <label htmlFor="account-review-body" className="sf-field-label">
            Written review
          </label>
          <textarea
            id="account-review-body"
            className="sf-control"
            rows={5}
            required
            maxLength={5000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            data-testid="review-body-input"
            aria-invalid={Boolean(fieldError(error, "body"))}
            aria-describedby={
              fieldError(error, "body")
                ? "account-review-body-error"
                : undefined
            }
          />
          {fieldError(error, "body") && (
            <p id="account-review-body-error" className="sf-field-error">
              {fieldError(error, "body")}
            </p>
          )}
        </div>
        <p className="sf-account-help">
          Your review may be moderated before publication.
        </p>
        <div className="sf-account-actions">
          <StorefrontButton variant="secondary" onClick={onClose}>
            Cancel
          </StorefrontButton>
          <StorefrontButton
            type="submit"
            busy={command.busy}
            data-testid="submit-review-button"
          >
            {command.busy ? "Submitting..." : "Submit Review"}
          </StorefrontButton>
        </div>
      </form>
    </StorefrontOverlay>
  );
}
