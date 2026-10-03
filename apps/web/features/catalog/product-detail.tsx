"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { useSeller } from "@/features/workspaces/seller-workspace";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { hasPlatformPermission } from "@/lib/permissions";
import { useApiQuery } from "@/lib/api/use-api-query";
import { errorMessage } from "@/lib/api/client";
import {
  ApiErrorState,
  FormField,
  LoadingState,
  PageHeader,
  StatusBadge,
  secondaryButton,
} from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DateDisplay } from "@/components/ui/displays";
import {
  DetailSection,
  DetailGrid,
  SplitLayout,
} from "@/components/ui/detail-layout";
import { Identifier } from "@/components/ui/identifier";
import { panel, useMutation, MutationStatus } from "@/features/sellers/forms";
import { catalogApi, type Context, type Product } from "./api";
import { ProductForm } from "./product-form";
import {
  Variants,
  ProductImages,
  ProductHistory,
  AttributeValues,
} from "./product-panels";

export function SellerProductDetail({ productId }: { productId: string }) {
  const access = useSeller();
  if (
    access.seller.status !== "active" ||
    !access.permissions.includes("catalog.product.read")
  )
    return <ForbiddenScreen />;
  return (
    <Detail
      key={`${access.id}:${productId}`}
      productId={productId}
      context={{ sellerId: access.seller.id }}
      canEdit={access.permissions.includes("catalog.product.update")}
      canArchive={access.permissions.includes("catalog.product.archive")}
      timezone={access.seller.timezone}
    />
  );
}
export function PlatformProductDetail({ productId }: { productId: string }) {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;
  if (!hasPlatformPermission(user, "platform.products.read"))
    return <ForbiddenScreen />;
  return (
    <Detail
      key={`${user?.id}:${productId}`}
      productId={productId}
      context={{ platform: true }}
      canModerate={hasPlatformPermission(user, "platform.products.moderate")}
    />
  );
}
function Detail({
  context,
  productId,
  canEdit = false,
  canArchive = false,
  canModerate = false,
  timezone = "UTC",
}: {
  context: Context;
  productId: string;
  canEdit?: boolean;
  canArchive?: boolean;
  canModerate?: boolean;
  timezone?: string;
}) {
  const sellerId = "sellerId" in context ? context.sellerId : undefined;
  const load = useCallback(
    (signal: AbortSignal) =>
      catalogApi.product(
        sellerId ? { sellerId } : { platform: true },
        productId,
        signal,
      ),
    [sellerId, productId],
  );
  const query = useApiQuery(`${sellerId ?? "platform"}:${productId}`, load);
  if (query.kind === "loading") return <LoadingState />;
  if (query.kind === "error")
    return <ApiErrorState error={query.error} onRetry={query.retry} />;
  const product = query.data,
    editable = canEdit && product.status === "draft";
  return (
    <>
      <PageHeader
        title={product.name}
        description={`${product.category.name} · ${product.currency}`}
      />
      <div className="mb-6 flex flex-wrap gap-3">
        <StatusBadge status={product.status} />
        <span className="text-sm text-slate-600">
          Updated <DateDisplay value={product.updated_at} timezone={timezone} />
        </span>
      </div>
      <nav
        aria-label="Product sections"
        className="mb-6 flex flex-wrap gap-4 border-b border-ui-border"
      >
        {[
          ["general", "General"],
          ["variants", "Variants and pricing"],
          ["attributes", "Attributes"],
          ["media", "Media"],
          ["history", "History"],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#product-${id}`}
            className="inline-flex min-h-11 items-center text-ui-body font-medium text-ui-accent hover:underline"
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="mb-6">
        {" "}
        <ProductActions
          context={context}
          product={product}
          canEdit={canEdit}
          canArchive={canArchive}
          canModerate={canModerate}
          onSaved={query.retry}
        />
      </div>
      <SplitLayout
        asideLabel="Product metadata"
        aside={
          <>
            <DetailSection title="Product metadata">
              <DetailGrid
                items={[
                  {
                    label: "Product ID",
                    value: <Identifier value={product.id} copyable />,
                  },
                  { label: "Category", value: product.category.name },
                  { label: "Brand", value: product.brand?.name ?? "None" },
                  { label: "Currency", value: product.currency },
                  {
                    label: "Created",
                    value: (
                      <DateDisplay
                        value={product.created_at}
                        timezone={timezone}
                      />
                    ),
                  },
                  {
                    label: "Approved",
                    value: product.approved_at ? (
                      <DateDisplay
                        value={product.approved_at}
                        timezone={timezone}
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
        <div id="product-general" className="scroll-mt-6">
          {sellerId ? (
            <ProductForm
              key={product.updated_at}
              sellerId={sellerId}
              product={product}
              canEdit={editable}
              onSaved={query.retry}
            />
          ) : (
            <DetailSection title="Product details">
              <p className="text-ui-body">{product.short_description}</p>
              <p className="whitespace-pre-wrap text-ui-body">
                {product.description || "No description supplied."}
              </p>
            </DetailSection>
          )}
        </div>
        <div id="product-variants" className="scroll-mt-6">
          <Variants context={context} product={product} canEdit={editable} />
        </div>
        <div id="product-attributes" className="scroll-mt-6">
          <AttributeValues
            context={context}
            product={product}
            canEdit={editable}
          />
        </div>
        <div id="product-media" className="scroll-mt-6">
          <ProductImages
            context={context}
            product={product}
            canEdit={editable}
          />
        </div>
        <div id="product-history" className="scroll-mt-6">
          <ProductHistory
            context={context}
            productId={productId}
            timezone={timezone}
          />
        </div>
      </SplitLayout>
    </>
  );
}
type Action = "archive" | "revise" | "submit-for-review" | "approve" | "reject";
export function ProductActions({
  context,
  product,
  canEdit,
  canArchive,
  canModerate,
  onSaved,
}: {
  context: Context;
  product: Product;
  canEdit: boolean;
  canArchive: boolean;
  canModerate: boolean;
  onSaved: () => void;
}) {
  const [action, setAction] = useState<Action | null>(null),
    [reason, setReason] = useState("");
  const mutation = useMutation();
  const actions: Action[] = [];
  if ("sellerId" in context) {
    if (canEdit && product.status === "draft")
      actions.push("submit-for-review");
    if (
      canEdit &&
      ["pending_review", "active", "rejected"].includes(product.status)
    )
      actions.push("revise");
    if (canArchive && product.status !== "archived") actions.push("archive");
  } else if (canModerate && product.status === "pending_review")
    actions.push("approve", "reject");
  const label = (action: Action) =>
    ({
      archive: "Archive product",
      revise: "Return to draft",
      "submit-for-review": "Submit for review",
      approve: "Approve product",
      reject: "Reject product",
    })[action];
  return (
    <section className={panel}>
      <h2 className="mb-4 text-xl font-semibold">Review and publication</h2>
      <p className="mb-4 text-sm text-slate-600">
        Content can be edited while in draft. Returning a product to draft
        removes its approval and requires a new review.
      </p>
      <div className="flex flex-wrap gap-3">
        {actions.map((action) => (
          <button
            key={action}
            className={secondaryButton}
            onClick={() => setAction(action)}
            disabled={mutation.busy || (action === "reject" && !reason.trim())}
          >
            {label(action)}
          </button>
        ))}
      </div>
      {actions.includes("reject") && (
        <div className="mt-4">
          <FormField
            label="Rejection reason"
            required
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      )}
      <MutationStatus error={mutation.error} success={mutation.success} />
      <ConfirmDialog
        open={action !== null}
        title={action ? label(action) : "Product action"}
        description={`${product.name}: ${action ? { archive: "Archive this product and remove it from active publication.", revise: "Return this product to draft. Its approval will be removed and a new review will be required.", "submit-for-review": "Submit this draft for platform review. Content editing is locked until it returns to draft.", approve: "Approve this reviewed product for active publication.", reject: `Reject this product submission. Reason: ${reason}` }[action] : "Review the selected action."}`}
        busy={mutation.busy}
        error={mutation.error ? errorMessage(mutation.error) : undefined}
        onCancel={() => setAction(null)}
        onConfirm={() => {
          if (!action) return;
          void mutation.run(async () => {
            await catalogApi.action(context, product.id, action, reason);
            setAction(null);
            onSaved();
          });
        }}
      />
    </section>
  );
}
