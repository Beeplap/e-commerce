"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { hasPlatformPermission } from "@/lib/permissions";
import { useApiQuery } from "@/lib/api/use-api-query";
import { DateDisplay } from "@/components/ui/displays";
import { Identifier } from "@/components/ui/identifier";
import {
  DetailSection,
  DetailGrid,
  SplitLayout,
} from "@/components/ui/detail-layout";
import { Timeline } from "@/components/ui/timeline";
import { RecordDetails } from "@/components/ui/record-details";
import {
  ApiErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { getPlatformOrder } from "./api";
import { OrderItems, OrderTotals } from "./order-sections";

export function AdminOrderDetailView({ orderId }: { orderId: string }) {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;
  if (!hasPlatformPermission(user, "platform.orders.read"))
    return <ForbiddenScreen />;
  return (
    <AdminOrderDetailContent
      key={`${user?.id}:${orderId}`}
      orderId={orderId}
      canReadSeller={hasPlatformPermission(user, "platform.sellers.read")}
    />
  );
}

function AdminOrderDetailContent({
  orderId,
  canReadSeller,
}: {
  orderId: string;
  canReadSeller: boolean;
}) {
  const load = useCallback(
    (signal: AbortSignal) => getPlatformOrder(orderId, signal),
    [orderId],
  );
  const query = useApiQuery(`admin:order:${orderId}`, load);
  if (query.kind === "loading")
    return <LoadingState label="Loading order details…" />;
  if (query.kind === "error")
    return <ApiErrorState error={query.error} onRetry={query.retry} />;
  const order = query.data;
  return (
    <div className="space-y-6">
      <Link
        href="/admin/orders"
        className="inline-flex min-h-11 items-center text-ui-body font-medium text-ui-accent hover:underline"
      >
        Back to platform orders
      </Link>
      <PageHeader
        title={`Order ${order.order_number}`}
        description={order.customer_email}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-ui-caption">
              Payment: <StatusBadge status={order.payment_status} />
            </span>
            <span className="text-ui-caption">
              Fulfillment: <StatusBadge status={order.fulfillment_status} />
            </span>
          </div>
        }
      />
      <DetailGrid
        items={[
          { label: "Created", value: <DateDisplay value={order.created_at} /> },
          { label: "Seller orders", value: order.seller_orders_count },
        ]}
      />
      <SplitLayout
        asideLabel="Order totals and customer information"
        aside={
          <>
            <DetailSection title="Grand Financial Totals">
              <OrderTotals
                values={order}
                currency={order.currency}
                total={order.grand_total}
                totalLabel="Grand Total"
              />
            </DetailSection>
            <DetailSection title="Shipping Address">
              <RecordDetails
                value={order.shipping_address_snapshot}
                emptyMessage="No shipping address recorded."
              />
            </DetailSection>
            <DetailSection title="Billing Address">
              <RecordDetails
                value={order.billing_address_snapshot}
                emptyMessage="No billing address recorded."
              />
            </DetailSection>
            <DetailSection title="Order metadata">
              <DetailGrid
                items={[
                  {
                    label: "Order ID",
                    value: <Identifier value={order.id} copyable />,
                  },
                  {
                    label: "Updated",
                    value: <DateDisplay value={order.updated_at} />,
                  },
                ]}
              />
            </DetailSection>
          </>
        }
      >
        <DetailSection
          title="Seller Orders Breakdown"
          description="Each seller order retains its own fulfillment state, financial snapshots and history."
        >
          {order.seller_orders.map((so) => (
            <DetailSection
              key={so.id}
              title={`${so.seller_name} (${so.seller_order_number})`}
              actions={<StatusBadge status={so.status} />}
            >
              {canReadSeller && (
                <Link
                  href={`/admin/sellers/${so.seller_id}`}
                  className="inline-flex min-h-11 items-center text-ui-body text-ui-accent hover:underline"
                >
                  Inspect seller workspace
                </Link>
              )}
              <OrderItems items={so.items} currency={order.currency} platform />
              <OrderTotals
                values={so}
                currency={order.currency}
                total={so.seller_net_total}
                totalLabel="Seller Net Total"
              />
              <h3 className="text-sm font-semibold">Timeline</h3>
              <Timeline
                label={`History for ${so.seller_order_number}`}
                entries={so.status_history.map((h) => ({
                  id: h.id,
                  title: `${h.from_status.replaceAll("_", " ")} → ${h.to_status.replaceAll("_", " ")}`,
                  occurredAt: h.created_at,
                  description: h.notes,
                  actor: h.actor_id ? (
                    <>
                      Actor <Identifier value={h.actor_id} />
                    </>
                  ) : undefined,
                }))}
              />
            </DetailSection>
          ))}
        </DetailSection>
      </SplitLayout>
    </div>
  );
}
