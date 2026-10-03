"use client";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DetailGrid, DetailSection } from "@/components/ui/detail-layout";
import { DateDisplay, Money } from "@/components/ui/displays";
import { Identifier } from "@/components/ui/identifier";
import { StatusBadge } from "@/components/ui/primitives";
import { Timeline, type TimelineEntry } from "@/components/ui/timeline";
import type { Payout } from "./api";

export function PayoutDetail({
  payout,
  onClose,
}: {
  payout: Payout;
  onClose: () => void;
}) {
  const events: TimelineEntry[] = [
    {
      id: "requested",
      title: "Payout requested",
      occurredAt: payout.created_at,
      actor: payout.created_by_email ?? undefined,
    },
  ];
  if (payout.approved_at)
    events.push({
      id: "approved",
      title: "Payout approved",
      occurredAt: payout.approved_at,
      actor: payout.approved_by_email ?? undefined,
    });
  if (payout.processed_at)
    events.push({
      id: "processed",
      title: "Disbursement recorded",
      occurredAt: payout.processed_at,
      actor: payout.processed_by_email ?? undefined,
    });
  return (
    <Dialog
      open
      size="wide"
      title={payout.payout_number}
      description={payout.seller_name}
      onClose={onClose}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-ui-kpi font-semibold">
          <Money amount={payout.amount} currency={payout.currency} />
        </p>
        <StatusBadge status={payout.status} />
      </div>
      <DetailGrid
        items={[
          {
            label: "Period starts",
            value: payout.period_start ? (
              <DateDisplay value={payout.period_start} />
            ) : (
              "Not specified"
            ),
          },
          {
            label: "Period ends",
            value: payout.period_end ? (
              <DateDisplay value={payout.period_end} />
            ) : (
              "Not specified"
            ),
          },
        ]}
      />
      {payout.notes && (
        <DetailSection title="Request notes">
          <p className="whitespace-pre-wrap break-words text-ui-body">
            {payout.notes}
          </p>
        </DetailSection>
      )}
      {payout.rejection_reason && (
        <DetailSection title="Rejection reason">
          <p className="whitespace-pre-wrap break-words text-ui-body text-ui-danger">
            {payout.rejection_reason}
          </p>
        </DetailSection>
      )}
      <div className="mt-5">
        <DetailSection title="Payout history">
          <Timeline label="Recorded payout events" entries={events} />
        </DetailSection>
      </div>
      <div className="mt-5">
        <DetailSection title="Identifiers">
          <DetailGrid
            items={[
              {
                label: "Payout ID",
                value: <Identifier value={payout.id} copyable />,
              },
              {
                label: "Seller ID",
                value: <Identifier value={payout.seller_id} copyable />,
              },
            ]}
          />
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
