"use client";

import { useCallback, useState } from "react";
import { ManagedForm } from "@/features/sellers/forms";
import { FormSection } from "@/components/ui/layout";
import { confirmUnsavedNavigation } from "@/components/ui/unsaved-changes";
import { DataTable } from "@/components/ui/data-table";
import { DateDisplay, Money } from "@/components/ui/displays";
import { Pagination } from "@/components/ui/pagination";
import {
  ApiErrorState,
  FormField,
  LoadingState,
  StatusBadge,
  primaryButton,
  secondaryButton,
} from "@/components/ui/primitives";
import {
  panel,
  selectStyle,
  useMutation,
  MutationStatus,
  values,
} from "@/features/sellers/forms";
import { useApiQuery } from "@/lib/api/use-api-query";
import {
  catalogApi,
  type AttributeValue,
  type CategoryLink,
  type Context,
  type Option,
  type Product,
  type ProductImage,
  type Variant,
} from "./api";

export function Variants({
  context,
  product,
  canEdit,
}: {
  context: Context;
  product: Product;
  canEdit: boolean;
}) {
  const sellerId = "sellerId" in context ? context.sellerId : undefined;
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Variant | null | "new">(null);
  const load = useCallback(
    (signal: AbortSignal) =>
      catalogApi.variants(context, product.id, page, signal),
    [context, product.id, page],
  );
  const query = useApiQuery(
    `${sellerId ?? "platform"}:${product.id}:variants:${page}`,
    load,
  );

  if (query.kind === "loading") return <LoadingState />;
  if (query.kind === "error")
    return <ApiErrorState error={query.error} onRetry={query.retry} />;

  const variants = query.data.results;

  return (
    <section className={panel}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Variants</h2>
          <p className="text-sm text-slate-600">
            Manage SKUs, prices, dimensions, and variant-specific attributes.
          </p>
        </div>
        {canEdit && !editing && (
          <button
            className={primaryButton}
            onClick={() => setEditing("new")}
            type="button"
          >
            Add variant
          </button>
        )}
      </div>

      {editing && sellerId ? (
        <VariantEditor
          sellerId={sellerId}
          product={product}
          context={context}
          variant={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            query.retry();
          }}
        />
      ) : (
        <>
          <DataTable
            caption="Product variants"
            rows={variants}
            rowKey={(r) => r.id}
            columns={[
              {
                id: "sku",
                heading: "SKU",
                cell: (r) => <span className="font-mono">{r.sku}</span>,
              },
              {
                id: "barcode",
                heading: "Barcode",
                cell: (r) => r.barcode || "—",
              },
              {
                id: "price",
                align: "right" as const,
                heading: "Price",
                cell: (r) => (
                  <Money amount={r.price} currency={product.currency} />
                ),
              },
              {
                id: "compare",
                heading: "Compare at",
                cell: (r) =>
                  r.compare_at_price ? (
                    <Money
                      amount={r.compare_at_price}
                      currency={product.currency}
                    />
                  ) : (
                    "—"
                  ),
              },
              {
                id: "dimensions",
                heading: "Dimensions (L×W×H)",
                cell: (r) =>
                  r.length && r.width && r.height
                    ? `${r.length} × ${r.width} × ${r.height} cm`
                    : "—",
              },
              {
                id: "weight",
                heading: "Weight",
                cell: (r) => (r.weight ? `${r.weight} kg` : "—"),
              },
              {
                id: "status",
                heading: "Status",
                cell: (r) => <StatusBadge status={r.status} />,
              },
              ...(canEdit
                ? [
                    {
                      id: "actions",
                      heading: "Actions",
                      cell: (r: Variant) => (
                        <button
                          className={secondaryButton}
                          onClick={() => setEditing(r)}
                          type="button"
                        >
                          Edit
                        </button>
                      ),
                    },
                  ]
                : []),
            ]}
          />
          {query.data.count > 25 && (
            <Pagination
              page={page}
              count={query.data.count}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </section>
  );
}

function VariantEditor({
  sellerId,
  product,
  context,
  variant,
  onClose,
  onSaved,
}: {
  sellerId: string;
  product: Product;
  context: Context;
  variant?: Variant;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <div className="space-y-6">
      <ManagedForm
        title={variant ? `Edit variant (${variant.sku})` : "New variant"}
        submitLabel="Save variant"
        warnUnsaved
        stickyActions
        onSave={async (data) => {
          const v = values(data);
          await catalogApi.saveVariant(
            sellerId,
            product.id,
            {
              sku: v.sku,
              barcode: v.barcode || "",
              price: v.price,
              compare_at_price: v.compare_at_price || null,
              cost_price: v.cost_price || null,
              weight: v.weight || null,
              length: v.length || null,
              width: v.width || null,
              height: v.height || null,
              status: v.status || "active",
            },
            variant?.id,
          );
          onSaved();
        }}
      >
        <FormSection
          title="Identification"
          description="The SKU identifies this variant in orders and inventory."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="SKU"
              name="sku"
              required
              maxLength={80}
              defaultValue={variant?.sku ?? ""}
            />
            <FormField
              label="Barcode"
              name="barcode"
              maxLength={80}
              defaultValue={variant?.barcode ?? ""}
            />
          </div>
        </FormSection>
        <FormSection
          title="Pricing and availability"
          description="Enter amounts in the product currency. Saving a variant does not publish the product."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label={`Price (${product.currency})`}
              name="price"
              required
              placeholder="0.00"
              defaultValue={variant?.price ?? ""}
            />
            <FormField
              label={`Compare at price (${product.currency})`}
              name="compare_at_price"
              placeholder="0.00"
              defaultValue={variant?.compare_at_price ?? ""}
            />
            <FormField
              label={`Cost price (${product.currency})`}
              name="cost_price"
              placeholder="0.00"
              defaultValue={variant?.cost_price ?? ""}
            />
            <label className="block text-sm font-medium">
              Status
              <select
                name="status"
                className={`${selectStyle} mt-2`}
                defaultValue={variant?.status ?? "active"}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
        </FormSection>
        <FormSection
          title="Shipping dimensions"
          description="Optional measurements support shipping and fulfillment."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              label="Weight (kg)"
              name="weight"
              placeholder="0.000"
              defaultValue={variant?.weight ?? ""}
            />
            <FormField
              label="Length (cm)"
              name="length"
              placeholder="0.000"
              defaultValue={variant?.length ?? ""}
            />
            <FormField
              label="Width (cm)"
              name="width"
              placeholder="0.000"
              defaultValue={variant?.width ?? ""}
            />
            <FormField
              label="Height (cm)"
              name="height"
              placeholder="0.000"
              defaultValue={variant?.height ?? ""}
            />
          </div>
        </FormSection>
        <button
          className={secondaryButton}
          type="button"
          onClick={() => {
            if (confirmUnsavedNavigation()) onClose();
          }}
        >
          Cancel
        </button>
      </ManagedForm>

      {variant && (
        <div className="mt-6 border-t border-slate-200 pt-6">
          <VariantAttributeValues
            context={context}
            product={product}
            variant={variant}
            canEdit={true}
          />
        </div>
      )}
    </div>
  );
}

function VariantAttributeValues({
  context,
  product,
  variant,
  canEdit,
}: {
  context: Context;
  product: Product;
  variant: Variant;
  canEdit: boolean;
}) {
  const sellerId = "sellerId" in context ? context.sellerId : undefined;
  const [page] = useState(1);
  const loadValues = useCallback(
    (signal: AbortSignal) =>
      catalogApi.values(context, product.id, page, variant.id, signal),
    [context, product.id, page, variant.id],
  );
  const query = useApiQuery(
    `${sellerId ?? "platform"}:${product.id}:${variant.id}:attributes:${page}`,
    loadValues,
  );

  const loadLinks = useCallback(
    (signal: AbortSignal) =>
      catalogApi.taxonomy(
        context,
        "category-attributes",
        { category_id: product.category.id },
        signal,
      ),
    [context, product.category.id],
  );
  const linksQuery = useApiQuery(
    `${sellerId ?? "platform"}:links:${product.category.id}`,
    loadLinks,
  );

  const mutation = useMutation();
  const [selectedAttrId, setSelectedAttrId] = useState("");
  const [textVal, setTextVal] = useState("");
  const [selectedOptionId, setSelectedOptionId] = useState("");

  if (query.kind === "loading" || linksQuery.kind === "loading")
    return <LoadingState label="Loading variant attributes…" />;
  if (query.kind === "error")
    return <ApiErrorState error={query.error} onRetry={query.retry} />;
  if (linksQuery.kind === "error")
    return (
      <ApiErrorState error={linksQuery.error} onRetry={linksQuery.retry} />
    );

  const variantLinks = (linksQuery.data.results as CategoryLink[]).filter(
    (l) => l.attribute.scope === "variant",
  );
  const activeLink = variantLinks.find(
    (l) => l.attribute.id === selectedAttrId,
  );

  return (
    <div className="space-y-4">
      <h4 className="text-base font-semibold">Variant attributes</h4>
      <DataTable
        caption="Variant attribute values"
        rows={query.data.results}
        rowKey={(r) => r.id}
        columns={[
          {
            id: "attribute",
            heading: "Attribute",
            cell: (r) => r.attribute.name,
          },
          {
            id: "value",
            heading: "Value",
            cell: (r) => r.option?.name ?? r.value,
          },
          ...(canEdit && sellerId
            ? [
                {
                  id: "delete",
                  heading: "Actions",
                  cell: (r: AttributeValue) => (
                    <button
                      className={secondaryButton}
                      type="button"
                      disabled={mutation.busy}
                      onClick={() => {
                        void mutation.run(async () => {
                          await catalogApi.removeValue(
                            sellerId,
                            product.id,
                            r.id,
                            variant.id,
                          );
                          query.retry();
                        });
                      }}
                    >
                      Remove
                    </button>
                  ),
                },
              ]
            : []),
        ]}
      />

      {canEdit && sellerId && variantLinks.length > 0 && (
        <form
          className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedAttrId) return;
            void mutation.run(async () => {
              await catalogApi.saveValue(
                sellerId,
                product.id,
                {
                  attribute_id: selectedAttrId,
                  option_id: selectedOptionId || null,
                  value: textVal,
                },
                variant.id,
              );
              setTextVal("");
              setSelectedOptionId("");
              query.retry();
            });
          }}
        >
          <label className="block text-sm font-medium">
            Attribute
            <select
              className={`${selectStyle} mt-1`}
              value={selectedAttrId}
              onChange={(e) => {
                setSelectedAttrId(e.target.value);
                setSelectedOptionId("");
                setTextVal("");
              }}
            >
              <option value="">Select attribute</option>
              {variantLinks.map((l) => (
                <option key={l.id} value={l.attribute.id}>
                  {l.attribute.name} {l.is_required ? "(Required)" : ""}
                </option>
              ))}
            </select>
          </label>

          {activeLink?.attribute.value_type === "choice" ? (
            <OptionSelect
              context={context}
              attributeId={activeLink.attribute.id}
              value={selectedOptionId}
              onChange={setSelectedOptionId}
            />
          ) : activeLink?.attribute.value_type === "boolean" ? (
            <label className="block text-sm font-medium">
              Value
              <select
                className={`${selectStyle} mt-1`}
                value={textVal}
                onChange={(e) => setTextVal(e.target.value)}
              >
                <option value="">Choose</option>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            </label>
          ) : (
            <FormField
              label="Value"
              value={textVal}
              onChange={(e) => setTextVal(e.target.value)}
              required
            />
          )}

          <button
            className={primaryButton}
            type="submit"
            disabled={mutation.busy || !selectedAttrId}
          >
            {mutation.busy ? "Setting…" : "Set value"}
          </button>
        </form>
      )}
      <MutationStatus error={mutation.error} success={mutation.success} />
    </div>
  );
}

function OptionSelect({
  context,
  attributeId,
  value,
  onChange,
}: {
  context: Context;
  attributeId: string;
  value: string;
  onChange: (val: string) => void;
}) {
  const sellerId = "sellerId" in context ? context.sellerId : undefined;
  const load = useCallback(
    (signal: AbortSignal) =>
      catalogApi.taxonomy(
        context,
        "options",
        { attribute_id: attributeId },
        signal,
      ),
    [context, attributeId],
  );
  const query = useApiQuery(
    `${sellerId ?? "platform"}:options:${attributeId}`,
    load,
  );

  return (
    <label className="block text-sm font-medium">
      Option
      <select
        className={`${selectStyle} mt-1`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={query.kind !== "ready"}
      >
        <option value="">Choose option</option>
        {query.kind === "ready" &&
          (query.data.results as Option[]).map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
      </select>
    </label>
  );
}

export function AttributeValues({
  context,
  product,
  canEdit,
}: {
  context: Context;
  product: Product;
  canEdit: boolean;
}) {
  const sellerId = "sellerId" in context ? context.sellerId : undefined;
  const [page] = useState(1);
  const loadValues = useCallback(
    (signal: AbortSignal) =>
      catalogApi.values(context, product.id, page, undefined, signal),
    [context, product.id, page],
  );
  const query = useApiQuery(
    `${sellerId ?? "platform"}:${product.id}:attributes:${page}`,
    loadValues,
  );

  const loadLinks = useCallback(
    (signal: AbortSignal) =>
      catalogApi.taxonomy(
        context,
        "category-attributes",
        { category_id: product.category.id },
        signal,
      ),
    [context, product.category.id],
  );
  const linksQuery = useApiQuery(
    `${sellerId ?? "platform"}:links:${product.category.id}`,
    loadLinks,
  );

  const mutation = useMutation();
  const [selectedAttrId, setSelectedAttrId] = useState("");
  const [textVal, setTextVal] = useState("");
  const [selectedOptionId, setSelectedOptionId] = useState("");

  if (query.kind === "loading" || linksQuery.kind === "loading")
    return <LoadingState label="Loading product attributes…" />;
  if (query.kind === "error")
    return <ApiErrorState error={query.error} onRetry={query.retry} />;
  if (linksQuery.kind === "error")
    return (
      <ApiErrorState error={linksQuery.error} onRetry={linksQuery.retry} />
    );

  const productLinks = (linksQuery.data.results as CategoryLink[]).filter(
    (l) => l.attribute.scope === "product",
  );
  const activeLink = productLinks.find(
    (l) => l.attribute.id === selectedAttrId,
  );

  return (
    <section className={panel}>
      <h2 className="mb-2 text-xl font-semibold">Product attributes</h2>
      <p className="mb-4 text-sm text-slate-600">
        Configurable specifications tied to the category (
        {product.category.name}).
      </p>

      <DataTable
        caption="Product attribute values"
        rows={query.data.results}
        rowKey={(r) => r.id}
        columns={[
          {
            id: "attribute",
            heading: "Attribute",
            cell: (r) => r.attribute.name,
          },
          { id: "type", heading: "Type", cell: (r) => r.attribute.value_type },
          {
            id: "value",
            heading: "Value",
            cell: (r) => r.option?.name ?? r.value,
          },
          ...(canEdit && sellerId
            ? [
                {
                  id: "actions",
                  heading: "Actions",
                  cell: (r: AttributeValue) => (
                    <button
                      className={secondaryButton}
                      type="button"
                      disabled={mutation.busy}
                      onClick={() => {
                        void mutation.run(async () => {
                          await catalogApi.removeValue(
                            sellerId,
                            product.id,
                            r.id,
                          );
                          query.retry();
                        });
                      }}
                    >
                      Remove
                    </button>
                  ),
                },
              ]
            : []),
        ]}
      />

      {canEdit && sellerId && productLinks.length > 0 && (
        <form
          className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedAttrId) return;
            void mutation.run(async () => {
              await catalogApi.saveValue(sellerId, product.id, {
                attribute_id: selectedAttrId,
                option_id: selectedOptionId || null,
                value: textVal,
              });
              setTextVal("");
              setSelectedOptionId("");
              query.retry();
            });
          }}
        >
          <label className="block text-sm font-medium">
            Attribute
            <select
              className={`${selectStyle} mt-1`}
              value={selectedAttrId}
              onChange={(e) => {
                setSelectedAttrId(e.target.value);
                setSelectedOptionId("");
                setTextVal("");
              }}
            >
              <option value="">Select category attribute</option>
              {productLinks.map((l) => (
                <option key={l.id} value={l.attribute.id}>
                  {l.attribute.name} {l.is_required ? "(Required)" : ""}
                </option>
              ))}
            </select>
          </label>

          {activeLink?.attribute.value_type === "choice" ? (
            <OptionSelect
              context={context}
              attributeId={activeLink.attribute.id}
              value={selectedOptionId}
              onChange={setSelectedOptionId}
            />
          ) : activeLink?.attribute.value_type === "boolean" ? (
            <label className="block text-sm font-medium">
              Value
              <select
                className={`${selectStyle} mt-1`}
                value={textVal}
                onChange={(e) => setTextVal(e.target.value)}
              >
                <option value="">Choose</option>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            </label>
          ) : (
            <FormField
              label="Value"
              value={textVal}
              onChange={(e) => setTextVal(e.target.value)}
              required
            />
          )}

          <button
            className={primaryButton}
            type="submit"
            disabled={mutation.busy || !selectedAttrId}
          >
            {mutation.busy ? "Setting…" : "Set value"}
          </button>
        </form>
      )}
      <MutationStatus error={mutation.error} success={mutation.success} />
    </section>
  );
}

export function ProductImages({
  context,
  product,
  canEdit,
}: {
  context: Context;
  product: Product;
  canEdit: boolean;
}) {
  const sellerId = "sellerId" in context ? context.sellerId : undefined;
  const [page] = useState(1);
  const load = useCallback(
    (signal: AbortSignal) =>
      catalogApi.images(context, product.id, page, signal),
    [context, product.id, page],
  );
  const query = useApiQuery(
    `${sellerId ?? "platform"}:${product.id}:images:${page}`,
    load,
  );
  const mutation = useMutation();

  if (query.kind === "loading") return <LoadingState />;
  if (query.kind === "error")
    return <ApiErrorState error={query.error} onRetry={query.retry} />;

  const images = query.data.results;

  async function handleDownload(img: ProductImage) {
    try {
      const blob = await catalogApi.download(context, product.id, img.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `product-image-${img.id}.${img.content_type.split("/")[1] ?? "bin"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Handled via toast / feedback
    }
  }

  return (
    <section className={panel}>
      <h2 className="mb-2 text-xl font-semibold">Images</h2>
      <p className="mb-4 text-sm text-slate-600">
        Private product images. Only JPEG and PNG formats are accepted.
      </p>

      <DataTable
        caption="Product images"
        rows={images}
        rowKey={(r) => r.id}
        columns={[
          {
            id: "sort_order",
            heading: "Order",
            cell: (r) => r.sort_order,
          },
          {
            id: "alt_text",
            heading: "Alt text",
            cell: (r) => r.alt_text || "—",
          },
          {
            id: "format",
            heading: "Type",
            cell: (r) => r.content_type,
          },
          {
            id: "size",
            heading: "Size",
            cell: (r) => `${(r.size / 1024).toFixed(1)} KB`,
          },
          {
            id: "actions",
            heading: "Actions",
            cell: (r: ProductImage) => (
              <div className="flex gap-2">
                <button
                  className={secondaryButton}
                  type="button"
                  onClick={() => void handleDownload(r)}
                >
                  Download
                </button>
                {canEdit && sellerId && (
                  <button
                    className={secondaryButton}
                    type="button"
                    disabled={mutation.busy}
                    onClick={() => {
                      void mutation.run(async () => {
                        await catalogApi.removeImage(
                          sellerId,
                          product.id,
                          r.id,
                        );
                        query.retry();
                      });
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />

      {canEdit && sellerId && (
        <form
          className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            void mutation.run(async () => {
              await catalogApi.upload(sellerId, product.id, formData);
              e.currentTarget.reset();
              query.retry();
            });
          }}
        >
          <h3 className="text-base font-semibold">Upload product image</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-medium">
              Image file (PNG or JPEG)
              <input
                type="file"
                name="file"
                accept="image/png, image/jpeg"
                required
                className={`${selectStyle} mt-1 pt-2`}
              />
            </label>
            <FormField
              label="Alt text"
              name="alt_text"
              maxLength={200}
              placeholder="Descriptive image text"
            />
            <FormField
              label="Sort order"
              name="sort_order"
              type="number"
              min={0}
              defaultValue="0"
            />
          </div>
          <button
            className={primaryButton}
            type="submit"
            disabled={mutation.busy}
          >
            {mutation.busy ? "Uploading…" : "Upload image"}
          </button>
          <MutationStatus error={mutation.error} success={mutation.success} />
        </form>
      )}
    </section>
  );
}

export function ProductHistory({
  context,
  productId,
  timezone = "UTC",
}: {
  context: Context;
  productId: string;
  timezone?: string;
}) {
  const sellerId = "sellerId" in context ? context.sellerId : undefined;
  const [page, setPage] = useState(1);
  const load = useCallback(
    (signal: AbortSignal) =>
      catalogApi.history(context, productId, page, signal),
    [context, productId, page],
  );
  const query = useApiQuery(
    `${sellerId ?? "platform"}:${productId}:history:${page}`,
    load,
  );

  if (query.kind === "loading") return <LoadingState />;
  if (query.kind === "error")
    return <ApiErrorState error={query.error} onRetry={query.retry} />;

  return (
    <section className={panel}>
      <h2 className="mb-2 text-xl font-semibold">Status history</h2>
      <p className="mb-4 text-sm text-slate-600">
        Audit trail of all review, approval, rejection, and revision
        transitions.
      </p>

      <DataTable
        caption="Product status history"
        rows={query.data.results}
        rowKey={(r) => r.id}
        columns={[
          {
            id: "from",
            heading: "From",
            cell: (r) =>
              r.from_status ? <StatusBadge status={r.from_status} /> : "Draft",
          },
          {
            id: "to",
            heading: "To",
            cell: (r) => <StatusBadge status={r.to_status} />,
          },
          {
            id: "reason",
            heading: "Reason / Notes",
            cell: (r) => r.reason || "—",
          },
          {
            id: "date",
            heading: "Date",
            cell: (r) => (
              <DateDisplay value={r.created_at} timezone={timezone} />
            ),
          },
        ]}
      />
      {query.data.count > 25 && (
        <Pagination
          page={page}
          count={query.data.count}
          onPageChange={setPage}
        />
      )}
    </section>
  );
}
