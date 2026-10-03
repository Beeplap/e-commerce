"use client";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DetailGrid, DetailSection } from "@/components/ui/detail-layout";
import { Timeline, type TimelineEntry } from "@/components/ui/timeline";
import { StatusBadge } from "@/components/ui/primitives";
import type { ProductReview } from "@/lib/api/types";

export function ReviewDetail({
  review,
  onClose,
}: {
  review: ProductReview;
  onClose: () => void;
}) {
  const events: TimelineEntry[] = [
    {
      id: "submitted",
      title: "Customer review submitted",
      occurredAt: review.created_at,
      actor: review.customer.email,
    },
  ];
  if (review.seller_response)
    events.push({
      id: "response",
      title: "Seller response",
      occurredAt: review.seller_response_at,
      description: review.seller_response,
    });
  return (
    <Dialog
      open
      size="wide"
      title={review.title || "Product review"}
      description={review.product.name}
      onClose={onClose}
    >
      <div className="mb-4">
        <StatusBadge status={review.status} />
      </div>
      <DetailGrid
        items={[
          { label: "Customer", value: review.customer.email },
          { label: "Rating", value: `${review.rating} out of 5` },
          {
            label: "Verified purchase",
            value: review.verified_purchase ? "Yes" : "No",
          },
        ]}
      />
      <div className="mt-5">
        <DetailSection title="Review">
          <p className="whitespace-pre-wrap break-words text-ui-body">
            {review.body}
          </p>
        </DetailSection>
      </div>
      <div className="mt-5">
        <DetailSection title="Review history">
          <Timeline label="Recorded review events" entries={events} />
        </DetailSection>
      </div>
      <div className="mt-6 flex justify-end">
        <Button variant="secondary" data-dialog-cancel onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}
