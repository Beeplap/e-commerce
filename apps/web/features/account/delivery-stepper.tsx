"use client";

import React from "react";
import type { TrackingEventRecord } from "@/lib/api/types";

interface DeliveryStepperProps {
  status: string;
  trackingEvents?: TrackingEventRecord[];
  carrier?: string;
  trackingNumber?: string;
}

const STEPS = [
  { key: "pending", label: "Order Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Dispatched / Shipped" },
  { key: "delivered", label: "Delivered" },
];

export function DeliveryStepper({
  status,
  trackingEvents = [],
  carrier,
  trackingNumber,
}: DeliveryStepperProps) {
  const normalizedStatus = status.toLowerCase();
  const isCancelled = normalizedStatus === "cancelled";

  const getStepIndex = (st: string): number => {
    switch (st) {
      case "pending":
        return 0;
      case "confirmed":
        return 1;
      case "processing":
      case "preparing":
        return 2;
      case "shipped":
      case "in_transit":
        return 3;
      case "delivered":
        return 4;
      default:
        return 0;
    }
  };

  const currentIndex = isCancelled ? -1 : getStepIndex(normalizedStatus);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Fulfillment & Delivery Progress
          </h3>
          {carrier && trackingNumber && (
            <p className="mt-0.5 text-xs text-slate-500">
              Carrier:{" "}
              <span className="font-semibold text-slate-800">{carrier}</span> ·
              Tracking:{" "}
              <span
                className="font-mono font-semibold text-teal-800"
                data-testid="carrier-tracking-number"
              >
                {trackingNumber}
              </span>
            </p>
          )}
        </div>
        <div>
          <span
            data-testid="delivery-status-badge"
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
              isCancelled
                ? "bg-rose-100 text-rose-800"
                : normalizedStatus === "delivered"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-teal-100 text-teal-800"
            }`}
          >
            {status}
          </span>
        </div>
      </div>

      {isCancelled ? (
        <div
          data-testid="order-cancelled-notice"
          className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800"
        >
          ⚠️ This item/order has been cancelled. Any held stock reservations
          have been released.
        </div>
      ) : (
        <div className="mt-6" data-testid="delivery-progress-stepper">
          <div className="relative flex items-center justify-between">
            <div className="absolute left-0 top-1/2 -z-0 h-0.5 w-full -translate-y-1/2 bg-slate-200" />
            <div
              className="absolute left-0 top-1/2 -z-0 h-0.5 -translate-y-1/2 bg-teal-700 transition-all duration-500"
              style={{
                width: `${(Math.max(0, currentIndex) / (STEPS.length - 1)) * 100}%`,
              }}
            />

            {STEPS.map((step, idx) => {
              const isCompleted = idx <= currentIndex;
              const isCurrent = idx === currentIndex;
              return (
                <div
                  key={step.key}
                  className="relative z-10 flex flex-col items-center"
                >
                  <div
                    data-testid={`step-indicator-${step.key}`}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                      isCompleted
                        ? "bg-teal-800 text-white ring-4 ring-teal-50"
                        : "bg-white border-2 border-slate-300 text-slate-400"
                    } ${isCurrent ? "scale-110 shadow-md ring-teal-200" : ""}`}
                  >
                    {isCompleted ? "✓" : idx + 1}
                  </div>
                  <span
                    className={`mt-2 text-[11px] font-semibold text-center max-w-[70px] ${
                      isCompleted ? "text-slate-900" : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Carrier Live Tracking Events Timeline */}
      {trackingEvents.length > 0 && (
        <div className="mt-8 border-t border-slate-100 pt-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
            Live Carrier Milestones
          </h4>
          <div className="space-y-4" data-testid="tracking-events-timeline">
            {trackingEvents.map((evt) => (
              <div
                key={evt.id}
                data-testid={`tracking-event-${evt.id}`}
                className="flex items-start gap-3 text-xs"
              >
                <div className="mt-1 h-2 w-2 rounded-full bg-teal-700" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      {evt.status}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {new Date(evt.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {evt.location && (
                    <p className="text-slate-500">📍 {evt.location}</p>
                  )}
                  {evt.description && (
                    <p className="text-slate-600 mt-0.5">{evt.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
