"use client";
import { DateDisplay } from "@/components/ui/displays";
import type { TrackingEventRecord } from "@/lib/api/types";
import { AccountStatus } from "./shared";
const steps = ["pending", "confirmed", "processing", "shipped", "delivered"];
const labels = [
  "Order placed",
  "Confirmed",
  "Processing",
  "Dispatched / Shipped",
  "Delivered",
];
export function DeliveryStepper({
  status,
  trackingEvents = [],
  carrier,
  trackingNumber,
}: {
  status: string;
  trackingEvents?: TrackingEventRecord[];
  carrier?: string;
  trackingNumber?: string;
}) {
  const normalized = status.toLowerCase();
  const index = steps.indexOf(normalized);
  return (
    <div className="sf-account-delivery">
      <div className="sf-account-delivery-heading">
        <h3>Delivery progress</h3>
        <AccountStatus status={status} testId="delivery-status-badge" />
      </div>
      {(carrier || trackingNumber) && (
        <p className="sf-account-carrier">
          {carrier && <span>{carrier}</span>}
          {trackingNumber && (
            <span>
              Tracking:{" "}
              <strong data-testid="carrier-tracking-number">
                {trackingNumber}
              </strong>
            </span>
          )}
        </p>
      )}
      {normalized === "cancelled" ? (
        <p data-testid="order-cancelled-notice">
          This package has been cancelled.
        </p>
      ) : index < 0 ? (
        <p className="sf-account-help">
          Delivery progress is not available for this status.
        </p>
      ) : (
        <ol
          data-testid="delivery-progress-stepper"
          className="sf-account-progress"
        >
          {steps.map((step, position) => (
            <li
              key={step}
              aria-current={position === index ? "step" : undefined}
              data-complete={position <= index}
            >
              <span data-testid={`step-indicator-${step}`} aria-hidden="true">
                {position + 1}
              </span>
              {labels[position]}
            </li>
          ))}
        </ol>
      )}
      {trackingEvents.length > 0 && (
        <div className="sf-account-timeline">
          <h4>Carrier milestones</h4>
          <ol data-testid="tracking-events-timeline">
            {[...trackingEvents]
              .sort(
                (a, b) =>
                  new Date(b.timestamp).getTime() -
                  new Date(a.timestamp).getTime(),
              )
              .map((event) => (
                <li key={event.id} data-testid={`tracking-event-${event.id}`}>
                  <div>
                    <strong>{event.status.replaceAll("_", " ")}</strong>
                    <DateDisplay value={event.timestamp} />
                  </div>
                  {event.location && <p>{event.location}</p>}
                  {event.description && <p>{event.description}</p>}
                </li>
              ))}
          </ol>
        </div>
      )}
    </div>
  );
}
