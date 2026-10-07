"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { DetailSection } from "@/components/ui/detail-layout";
import { Pagination } from "@/components/ui/pagination";
import { Money } from "@/components/ui/displays";
import {
  ApiErrorState,
  LoadingState,
  StatusBadge,
} from "@/components/ui/primitives";
import { useApiQuery } from "@/lib/api/use-api-query";
import type { Page } from "@/lib/api/types";
import {
  sellerListShipments,
  sellerListReturns,
  sellerListRefunds,
} from "@/features/fulfillment/api";

function RelatedRecords<T extends { id: string }>({
  title,
  queryKey,
  loadPage,
  renderRow,
  href,
}: {
  title: string;
  queryKey: string;
  loadPage: (page: number, signal: AbortSignal) => Promise<Page<T>>;
  renderRow: (row: T) => ReactNode;
  href: string;
}) {
  const [page, setPage] = useState(1);
  const load = useCallback(
    (signal: AbortSignal) => loadPage(page, signal),
    [loadPage, page],
  );
  const query = useApiQuery(`${queryKey}:${page}`, load);
  return (
    <DetailSection
      title={title}
      actions={
        <Link
          href={href}
          className="inline-flex min-h-11 items-center text-ui-body text-ui-accent hover:underline"
        >
          Open {title.toLowerCase()}
        </Link>
      }
    >
      {query.kind === "loading" && (
        <LoadingState label={`Loading ${title.toLowerCase()}\u2026`} />
      )}
      {query.kind === "error" && (
        <ApiErrorState error={query.error} onRetry={query.retry} />
      )}
      {query.kind === "ready" && (
        <>
          {query.data.results.length ? (
            <ul className="divide-y divide-ui-border">
              {query.data.results.map((row) => (
                <li key={row.id} className="min-w-0 py-3 text-ui-body">
                  {renderRow(row)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ui-body text-ui-secondary">
              No {title.toLowerCase()} recorded for this order.
            </p>
          )}
          <Pagination
            page={page}
            count={query.data.count}
            onPageChange={setPage}
          />
        </>
      )}
    </DetailSection>
  );
}

export function RelatedOrderWork({
  sellerId,
  orderId,
  canReadShipments,
  canReadReturns,
}: {
  sellerId: string;
  orderId: string;
  canReadShipments: boolean;
  canReadReturns: boolean;
}) {
  const [open, setOpen] = useState(false);
  const shipments = useCallback(
    (page: number, signal: AbortSignal) =>
      sellerListShipments(sellerId, { seller_order_id: orderId, page }, signal),
    [sellerId, orderId],
  );
  const returns = useCallback(
    (page: number, signal: AbortSignal) =>
      sellerListReturns(sellerId, { seller_order_id: orderId, page }, signal),
    [sellerId, orderId],
  );
  const refunds = useCallback(
    (page: number, signal: AbortSignal) =>
      sellerListRefunds(sellerId, { seller_order_id: orderId, page }, signal),
    [sellerId, orderId],
  );
  return (
    <details
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="min-w-0 border-t border-ui-border pt-4"
    >
      <summary className="min-h-11 cursor-pointer text-ui-body font-semibold">
        Related fulfillment and after-sales records
      </summary>
      {open && (
        <div className="mt-4 space-y-6">
          {canReadShipments && (
            <RelatedRecords
              title="Shipments"
              queryKey={`${sellerId}:${orderId}:shipments`}
              loadPage={shipments}
              href="/seller/shipments"
              renderRow={(shipment) => (
                <>
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">
                      {shipment.shipment_number}
                    </span>
                    <StatusBadge status={shipment.status} />
                  </div>
                  <p className="mt-1 text-ui-secondary">
                    {shipment.carrier}
                    {shipment.tracking_number &&
                      ` · ${shipment.tracking_number}`}
                  </p>
                </>
              )}
            />
          )}
          {canReadReturns && (
            <>
              <RelatedRecords
                title="Returns"
                queryKey={`${sellerId}:${orderId}:returns`}
                loadPage={returns}
                href="/seller/returns"
                renderRow={(request) => (
                  <>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium">
                        {request.return_number}
                      </span>
                      <StatusBadge status={request.status} />
                    </div>
                    <p className="mt-1 text-ui-secondary">
                      {request.reason.replaceAll("_", " ")}
                    </p>
                  </>
                )}
              />
              <RelatedRecords
                title="Refunds"
                queryKey={`${sellerId}:${orderId}:refunds`}
                loadPage={refunds}
                href="/seller/refunds"
                renderRow={(refund) => (
                  <>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium">
                        {refund.refund_number}
                      </span>
                      <StatusBadge status={refund.status} />
                    </div>
                    <p className="mt-1">
                      <Money
                        amount={refund.amount}
                        currency={refund.currency}
                      />
                    </p>
                    <p className="text-ui-secondary">{refund.reason}</p>
                  </>
                )}
              />
            </>
          )}
        </div>
      )}
    </details>
  );
}
