"use client";

import { useCallback, useState } from "react";
import {
  ApiErrorState,
  FormField,
  LoadingState,
  StatusBadge,
  secondaryButton,
} from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { errorMessage } from "@/lib/api/client";
import { useApiQuery } from "@/lib/api/use-api-query";
import { sellerManagementApi, type SellerDocument } from "./api";
import {
  ManagedForm,
  MutationStatus,
  panel,
  selectStyle,
  useMutation,
} from "./forms";

export function DocumentPanel({
  sellerId,
  platform,
  canUpload,
  canReview,
}: {
  sellerId: string;
  platform: boolean;
  canUpload: boolean;
  canReview: boolean;
}) {
  const [page, setPage] = useState(1);
  const [review, setReview] = useState<{
    document: SellerDocument;
    approve: boolean;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const mutation = useMutation();
  const downloadMutation = useMutation();
  const load = useCallback(
    (signal: AbortSignal) =>
      sellerManagementApi.documents(sellerId, platform, page, signal),
    [sellerId, platform, page],
  );
  const query = useApiQuery(`${sellerId}:${platform}:${page}`, load);
  async function download(document: SellerDocument) {
    const blob = await sellerManagementApi.download(
      sellerId,
      platform,
      document.id,
    );
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `verification-${document.id}.${document.content_type === "image/png" ? "png" : "jpg"}`;
    anchor.click();
    // Let the browser start the download before releasing the ephemeral object URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="space-y-5" aria-label="Verification documents">
      <div className={panel}>
        <h2 className="mb-4 text-xl font-semibold">Verification documents</h2>
        <p className="mb-5 text-sm text-ui-secondary">
          Business registration must be verified before seller approval.
          Downloads are private and recorded in the audit history.
        </p>
        {query.kind === "loading" && (
          <LoadingState label="Loading documents…" />
        )}
        {query.kind === "error" && (
          <ApiErrorState error={query.error} onRetry={query.retry} />
        )}
        {query.kind === "ready" && (
          <>
            {query.data.results.length === 0 && <p>No documents submitted.</p>}
            <ul className="divide-y divide-ui-border">
              {query.data.results.map((document) => (
                <li key={document.id} className="space-y-3 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-medium">
                      {document.document_type === "registration"
                        ? "Business registration"
                        : "Tax registration"}
                    </h3>
                    <StatusBadge status={document.status} />
                  </div>
                  <p className="text-sm text-ui-secondary">
                    Expires: {document.expires_at ?? "No expiry supplied"}
                  </p>
                  {document.rejection_reason && (
                    <p className="text-sm text-red-800">
                      Review reason: {document.rejection_reason}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={secondaryButton}
                      disabled={downloadMutation.busy}
                      onClick={() =>
                        void downloadMutation.run(() => download(document))
                      }
                    >
                      Download scan
                    </button>
                    {canReview && document.status === "pending" && (
                      <>
                        <button
                          className={secondaryButton}
                          onClick={() => {
                            setReview({ document, approve: true });
                            setReason("");
                            setConfirm(true);
                          }}
                        >
                          Verify document
                        </button>
                        <button
                          className={secondaryButton}
                          onClick={() => {
                            setReview({ document, approve: false });
                            setReason("");
                          }}
                        >
                          Reject document
                        </button>
                      </>
                    )}
                  </div>
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
        <MutationStatus error={downloadMutation.error} success={false} />
      </div>
      {canUpload && (
        <ManagedForm
          title="Submit a document"
          submitLabel="Upload scan"
          onSave={async (data) => {
            if (!data.get("expires_at")) data.delete("expires_at");
            await sellerManagementApi.upload(sellerId, data);
            query.retry();
          }}
        >
          <label className="block text-sm font-medium">
            Document type
            <select name="document_type" className={`${selectStyle} mt-2`}>
              <option value="registration">Business registration</option>
              <option value="tax">Tax registration</option>
            </select>
          </label>
          <FormField
            name="file"
            label="Document scan"
            type="file"
            accept="image/png,image/jpeg"
            required
            hint="JPEG or PNG only; at most 5 MiB and 12 megapixels. One page per document. PDFs are not accepted."
          />
          <FormField
            name="expires_at"
            label="Expiry date (if applicable)"
            type="date"
          />
        </ManagedForm>
      )}
      {review && !review.approve && (
        <div className={panel}>
          <FormField
            label="Document rejection reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            required
          />
          <p className="mt-2 text-sm">
            Enter a reason, then confirm rejection below.
          </p>
          <button
            className={`${secondaryButton} mt-3`}
            disabled={!reason.trim()}
            onClick={() => setConfirm(true)}
          >
            Review rejection
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        title={
          review?.approve ? "Verify this document?" : "Reject this document?"
        }
        description={
          review?.approve
            ? "Confirm that you inspected the scan and it supports this seller’s registered identity."
            : `Reason: ${reason}`
        }
        confirmLabel={review?.approve ? "Verify document" : "Reject document"}
        busy={mutation.busy}
        error={mutation.error ? errorMessage(mutation.error) : undefined}
        onCancel={() => setConfirm(false)}
        onConfirm={() =>
          void mutation.run(async () => {
            if (!review) return;
            await sellerManagementApi.review(
              sellerId,
              review.document.id,
              review.approve,
              reason,
            );
            setConfirm(false);
            setReview(null);
            query.retry();
          })
        }
      />
    </section>
  );
}
