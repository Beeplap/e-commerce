"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  DetailSection,
  DetailGrid,
  SplitLayout,
} from "@/components/ui/detail-layout";
import { Timeline, type TimelineEntry } from "@/components/ui/timeline";
import { RecordDetails } from "@/components/ui/record-details";
import { DateDisplay, Money } from "@/components/ui/displays";
import { Identifier } from "@/components/ui/identifier";
import { getAdminSellerBalance } from "@/features/finance/api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import {
  ApiErrorState,
  FormField,
  LoadingState,
  PageHeader,
  StatusBadge,
  secondaryButton,
} from "@/components/ui/primitives";
import { useAuth } from "@/features/auth/auth-provider";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { errorMessage } from "@/lib/api/client";
import type { Page } from "@/lib/api/types";
import { useApiQuery } from "@/lib/api/use-api-query";
import { sellerManagementApi, type SellerDetail } from "./api";
import { DocumentPanel } from "./documents";
import { panel, useMutation } from "./forms";

type Action = "approve" | "reject" | "suspend" | "reactivate";
export function PlatformSellerDetail({ sellerId }: { sellerId: string }) {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;
  const allowed = (permission: string) =>
    user?.platform_permissions.includes(permission) ?? false;
  const load = useCallback(
    (signal: AbortSignal) => sellerManagementApi.detail(sellerId, true, signal),
    [sellerId],
  );
  const query = useApiQuery(
    allowed("platform.sellers.read") ? `${user?.id}:${sellerId}` : null,
    load,
  );
  if (!allowed("platform.sellers.read")) return <ForbiddenScreen />;
  if (query.kind === "loading") return <LoadingState variant="detail" />;
  if (query.kind === "error")
    return <ApiErrorState error={query.error} onRetry={query.retry} />;
  const seller = query.data;
  return (
    <>
      <PageHeader
        title={seller.display_name}
        description={seller.legal_name}
        actions={
          <>
            <StatusBadge status={seller.status} />
            <StatusBadge status={seller.verification_status} />
          </>
        }
      />
      <DetailGrid
        items={[
          { label: "Currency", value: seller.default_currency },
          {
            label: "Registered",
            value: (
              <DateDisplay
                value={seller.created_at}
                timezone={seller.timezone}
              />
            ),
          },
        ]}
      />
      {allowed("platform.sellers.manage") && (
        <div className="my-6">
          <SellerActions
            key={`${sellerId}:${seller.status}`}
            seller={seller}
            onSaved={query.retry}
          />
        </div>
      )}
      <div className="mt-6">
        <SplitLayout
          asideLabel="Seller financial summary and metadata"
          aside={
            <>
              {allowed("platform.finance.read") && (
                <SellerFinancialSummary
                  key={`${user?.id}:${sellerId}`}
                  sellerId={sellerId}
                />
              )}
              {(allowed("platform.products.read") ||
                allowed("platform.orders.read") ||
                allowed("platform.finance.read")) && (
                <DetailSection title="Related workspaces">
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {allowed("platform.products.read") && (
                      <Link
                        href="/admin/products"
                        className="inline-flex min-h-11 items-center text-ui-body text-ui-accent hover:underline"
                      >
                        Platform catalog
                      </Link>
                    )}
                    {allowed("platform.orders.read") && (
                      <Link
                        href="/admin/orders"
                        className="inline-flex min-h-11 items-center text-ui-body text-ui-accent hover:underline"
                      >
                        Platform orders
                      </Link>
                    )}
                    {allowed("platform.finance.read") && (
                      <Link
                        href={`/admin/finance/payouts?seller_id=${sellerId}`}
                        className="inline-flex min-h-11 items-center text-ui-body text-ui-accent hover:underline"
                      >
                        Seller payouts
                      </Link>
                    )}
                  </div>
                </DetailSection>
              )}
              <DetailSection title="Seller metadata">
                <DetailGrid
                  items={[
                    {
                      label: "Seller ID",
                      value: <Identifier value={seller.id} copyable />,
                    },
                    { label: "Timezone", value: seller.timezone },
                    {
                      label: "Last updated",
                      value: (
                        <DateDisplay
                          value={seller.updated_at}
                          timezone={seller.timezone}
                        />
                      ),
                    },
                    {
                      label: "Approved",
                      value: seller.approved_at ? (
                        <DateDisplay
                          value={seller.approved_at}
                          timezone={seller.timezone}
                        />
                      ) : (
                        "Not approved"
                      ),
                    },
                  ]}
                />
              </DetailSection>
            </>
          }
        >
          {allowed("platform.sellers.documents.read") && (
            <DocumentPanel
              key={sellerId}
              sellerId={sellerId}
              platform
              canUpload={false}
              canReview={
                seller.status === "pending" &&
                allowed("platform.sellers.documents.review")
              }
            />
          )}
          <DetailSection title="Business profile">
            <DetailGrid
              items={[
                { label: "Email", value: seller.email },
                { label: "Phone", value: seller.phone || "Not supplied" },
                {
                  label: "Description",
                  value: seller.profile.description || "Not supplied",
                },
                {
                  label: "Website",
                  value: seller.profile.website || "Not supplied",
                },
                {
                  label: "Support email",
                  value: seller.settings.support_email || "Not supplied",
                },
              ]}
            />
            <h3 className="text-sm font-semibold">Addresses</h3>
            {!seller.addresses.length && (
              <p className="text-ui-body text-ui-secondary">
                No addresses supplied.
              </p>
            )}
            {seller.addresses.map((address) => (
              <div key={address.id}>
                <h4 className="mb-1 text-ui-body font-medium capitalize">
                  {address.kind} address
                </h4>
                <p className="text-ui-body text-ui-secondary">
                  {[
                    address.line1,
                    address.line2,
                    address.city,
                    address.region,
                    address.postal_code,
                    address.country,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            ))}
          </DetailSection>
          <RelatedHistory
            key={`${user?.id}:${sellerId}:related`}
            sellerId={sellerId}
            canAudit={allowed("platform.sellers.audit.read")}
            timezone={seller.timezone}
          />
        </SplitLayout>
      </div>
    </>
  );
}
function SellerFinancialSummary({ sellerId }: { sellerId: string }) {
  const load = useCallback(
    (signal: AbortSignal) => getAdminSellerBalance(sellerId, signal),
    [sellerId],
  );
  const query = useApiQuery(`${sellerId}:platform-balance`, load);
  return (
    <DetailSection title="Financial summary">
      {query.kind === "loading" && (
        <LoadingState label="Loading seller balance…" />
      )}
      {query.kind === "error" && (
        <ApiErrorState error={query.error} onRetry={query.retry} />
      )}
      {query.kind === "ready" && (
        <DetailGrid
          items={[
            {
              label: "Current balance",
              value: (
                <Money
                  amount={query.data.current_balance}
                  currency={query.data.currency}
                />
              ),
            },
            {
              label: "Pending balance",
              value: (
                <Money
                  amount={query.data.pending_balance}
                  currency={query.data.currency}
                />
              ),
            },
            {
              label: "Paid out",
              value: (
                <Money
                  amount={query.data.total_paid_out}
                  currency={query.data.currency}
                />
              ),
            },
            {
              label: "Balance updated",
              value: <DateDisplay value={query.data.updated_at} />,
            },
          ]}
        />
      )}
    </DetailSection>
  );
}

function SellerActions({
  seller,
  onSaved,
}: {
  seller: SellerDetail;
  onSaved: () => void;
}) {
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const mutation = useMutation();
  const actions: Action[] =
    seller.status === "pending"
      ? ["approve", "reject"]
      : seller.status === "active"
        ? ["suspend"]
        : seller.status === "suspended"
          ? ["reactivate"]
          : [];
  const needsReason = action === "reject" || action === "suspend";
  return (
    <section className={panel}>
      <h2 className="mb-4 text-xl font-semibold">Seller lifecycle</h2>
      <p className="mb-4 text-sm text-ui-secondary">
        Approval requires a verified registration document and registered
        address. Members of this seller cannot perform these platform actions.
      </p>
      <div className="flex flex-wrap gap-3">
        {actions.map((value) => (
          <button
            key={value}
            className={`${secondaryButton} capitalize`}
            onClick={() => {
              setAction(value);
              setReason("");
              if (value === "approve" || value === "reactivate")
                setConfirm(true);
            }}
          >
            {value} seller
          </button>
        ))}
      </div>
      {actions.length === 0 && (
        <p>No lifecycle action is available for this status.</p>
      )}
      {needsReason && (
        <div className="mt-5 space-y-3">
          <FormField
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            maxLength={500}
          />
          <button
            className={secondaryButton}
            disabled={!reason.trim()}
            onClick={() => setConfirm(true)}
          >
            Review action
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        title={`${action ?? "Update"} seller?`}
        description={`${seller.display_name}: ${action ? { approve: "Activate this verified seller so its members can use seller operations.", reject: "Reject this registration. The seller workspace will become unavailable.", suspend: "Suspend this seller. Its members will lose access to seller operations.", reactivate: "Reactivate this seller after verifying its registration is valid." }[action] : "Review the selected action."} ${needsReason ? `Reason: ${reason}. ` : ""}This change is recorded in the seller's history.`}
        confirmLabel="Confirm action"
        busy={mutation.busy}
        error={mutation.error ? errorMessage(mutation.error) : undefined}
        onCancel={() => setConfirm(false)}
        onConfirm={() =>
          void mutation.run(async () => {
            if (!action) return;
            await sellerManagementApi.action(seller.id, action, reason);
            setConfirm(false);
            onSaved();
          })
        }
      />
    </section>
  );
}
function PagedSection<T extends { id: string }>({
  title,
  queryKey,
  load,
  render,
  timeline,
  timezone,
}: {
  title: string;
  queryKey: string;
  load: (page: number, signal: AbortSignal) => Promise<Page<T>>;
  render?: (value: T) => ReactNode;
  timeline?: (value: T) => TimelineEntry;
  timezone?: string;
}) {
  const [page, setPage] = useState(1);
  const fetchPage = useCallback(
    (signal: AbortSignal) => load(page, signal),
    [load, page],
  );
  const query = useApiQuery(`${queryKey}:${page}`, fetchPage);
  return (
    <DetailSection title={title}>
      {query.kind === "loading" && (
        <LoadingState label={`Loading ${title.toLowerCase()}…`} />
      )}
      {query.kind === "error" && (
        <ApiErrorState error={query.error} onRetry={query.retry} />
      )}
      {query.kind === "ready" && (
        <>
          <p className="text-ui-caption text-ui-secondary">
            {query.data.count} records
          </p>
          {timeline ? (
            <Timeline
              label={title}
              timezone={timezone}
              entries={query.data.results.map(timeline)}
            />
          ) : query.data.results.length ? (
            <ul className="divide-y divide-ui-border">
              {query.data.results.map((value) => (
                <li key={value.id} className="py-3">
                  {render?.(value)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ui-body text-ui-secondary">No records yet.</p>
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
function RelatedHistory({
  sellerId,
  canAudit,
  timezone,
}: {
  sellerId: string;
  canAudit: boolean;
  timezone: string;
}) {
  const members = useCallback(
    (page: number, signal: AbortSignal) =>
      sellerManagementApi.members(sellerId, page, signal),
    [sellerId],
  );
  const history = useCallback(
    (page: number, signal: AbortSignal) =>
      sellerManagementApi.history(sellerId, page, signal),
    [sellerId],
  );
  const audit = useCallback(
    (page: number, signal: AbortSignal) =>
      sellerManagementApi.audit(sellerId, page, signal),
    [sellerId],
  );
  return (
    <>
      <PagedSection
        title="Membership overview"
        queryKey={`${sellerId}:members`}
        load={members}
        render={(member) => (
          <DetailGrid
            items={[
              { label: "Member", value: member.email },
              { label: "Role", value: member.role_name },
              {
                label: "Status",
                value: <StatusBadge status={member.status} />,
              },
              {
                label: "Joined",
                value: member.joined_at ? (
                  <DateDisplay value={member.joined_at} timezone={timezone} />
                ) : (
                  "Not joined"
                ),
              },
            ]}
          />
        )}
      />
      <PagedSection
        title="Status history"
        queryKey={`${sellerId}:history`}
        load={history}
        timezone={timezone}
        timeline={(entry) => ({
          id: entry.id,
          title: `${entry.from_status || "New"} → ${entry.to_status}`,
          occurredAt: entry.created_at,
          description: entry.reason,
          actor: (
            <>
              Actor <Identifier value={entry.actor_id} />
            </>
          ),
        })}
      />
      {canAudit && (
        <PagedSection
          title="Audit history"
          queryKey={`${sellerId}:audit`}
          load={audit}
          timezone={timezone}
          timeline={(entry) => ({
            id: entry.id,
            title: entry.action.replaceAll(".", " ").replaceAll("_", " "),
            occurredAt: entry.created_at,
            description: (
              <>
                <p className="mb-2 text-ui-caption">
                  {entry.target_type.replaceAll("_", " ")}{" "}
                  <Identifier value={entry.target_id} />
                </p>
                <RecordDetails
                  value={entry.changes}
                  emptyMessage="No field changes recorded."
                />
              </>
            ),
            actor: (
              <>
                Actor <Identifier value={entry.actor_id} />
              </>
            ),
          })}
        />
      )}
    </>
  );
}
