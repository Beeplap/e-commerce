"use client";

import { useCallback, useState } from "react";
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
  if (query.kind === "loading") return <LoadingState />;
  if (query.kind === "error")
    return <ApiErrorState error={query.error} onRetry={query.retry} />;
  const seller = query.data;
  return (
    <>
      <PageHeader title={seller.display_name} description={seller.legal_name} />
      <div className="mb-6 flex gap-3">
        <StatusBadge status={seller.status} />
        <StatusBadge status={seller.verification_status} />
      </div>
      <div className="space-y-6">
        <section className={panel}>
          <h2 className="mb-4 text-xl font-semibold">Business profile</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            {Object.entries({
              Email: seller.email,
              Phone: seller.phone || "Not supplied",
              Currency: seller.default_currency,
              Timezone: seller.timezone,
              Description: seller.profile.description || "Not supplied",
              Website: seller.profile.website || "Not supplied",
              "Support email": seller.settings.support_email || "Not supplied",
            }).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="mt-1 break-words text-sm">{value}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-6 font-semibold">Addresses</h3>
          {seller.addresses.length === 0 && (
            <p className="mt-2 text-sm">No addresses supplied.</p>
          )}
          {seller.addresses.map((address) => (
            <p key={address.id} className="mt-3 text-sm">
              <strong className="capitalize">{address.kind}: </strong>
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
          ))}
        </section>
        {allowed("platform.sellers.manage") && (
          <SellerActions
            key={`${sellerId}:${seller.status}`}
            seller={seller}
            onSaved={query.retry}
          />
        )}
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
        <RelatedHistory
          key={`related:${sellerId}`}
          sellerId={sellerId}
          canAudit={allowed("platform.sellers.audit.read")}
        />
      </div>
    </>
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
      <p className="mb-4 text-sm text-slate-600">
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
function PagedSection<T>({
  title,
  queryKey,
  load,
  render,
}: {
  title: string;
  queryKey: string;
  load: (page: number, signal: AbortSignal) => Promise<Page<T>>;
  render: (value: T) => React.ReactNode;
}) {
  const [page, setPage] = useState(1);
  const fetchPage = useCallback(
    (signal: AbortSignal) => load(page, signal),
    [load, page],
  );
  const query = useApiQuery(`${queryKey}:${page}`, fetchPage);
  return (
    <section className={panel}>
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      {query.kind === "loading" && (
        <LoadingState label={`Loading ${title.toLowerCase()}…`} />
      )}
      {query.kind === "error" && (
        <ApiErrorState error={query.error} onRetry={query.retry} />
      )}
      {query.kind === "ready" && (
        <>
          {query.data.results.length === 0 && <p>No records yet.</p>}
          <ul className="divide-y divide-slate-200">
            {query.data.results.map((value, index) => (
              <li key={index} className="py-3 text-sm">
                {render(value)}
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            count={query.data.count}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}
function RelatedHistory({
  sellerId,
  canAudit,
}: {
  sellerId: string;
  canAudit: boolean;
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
          <>
            {member.email} · {member.role_name} · {member.status}
          </>
        )}
      />
      <PagedSection
        title="Status history"
        queryKey={`${sellerId}:history`}
        load={history}
        render={(entry) => (
          <>
            <p>
              {entry.from_status || "New"} → {entry.to_status}
            </p>
            {entry.reason && <p>{entry.reason}</p>}
            <p className="mt-1 text-xs text-slate-500">
              {entry.created_at} · Actor {entry.actor_id}
            </p>
          </>
        )}
      />
      {canAudit && (
        <PagedSection
          title="Audit history"
          queryKey={`${sellerId}:audit`}
          load={audit}
          render={(entry) => (
            <>
              <p>
                {entry.action} · {entry.target_type}
              </p>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs">
                {JSON.stringify(entry.changes, null, 2)}
              </pre>
              <p className="mt-1 text-xs text-slate-500">
                {entry.created_at} · Actor {entry.actor_id}
              </p>
            </>
          )}
        />
      )}
    </>
  );
}
