"use client";

import { useRouter } from "next/navigation";
import {
  FormField,
  PageHeader,
  TextareaField,
} from "@/components/ui/primitives";
import { useSeller } from "@/features/workspaces/seller-workspace";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { ManagedForm, values } from "@/features/sellers/forms";
import { catalogApi, type Product } from "./api";
import { CatalogPicker } from "./picker";
import { FormSection } from "@/components/ui/layout";

export function CreateProduct() {
  const access = useSeller();
  if (
    access.seller.status !== "active" ||
    !access.permissions.includes("catalog.product.create")
  )
    return <ForbiddenScreen />;
  return (
    <div key={access.id}>
      <PageHeader
        title="Create product"
        description="Start with a draft, then add variants and attributes before submitting for review."
      />
      <ProductForm sellerId={access.seller.id} canEdit />
    </div>
  );
}
export function ProductForm({
  sellerId,
  product,
  canEdit,
  onSaved,
}: {
  sellerId: string;
  product?: Product;
  canEdit: boolean;
  onSaved?: () => void;
}) {
  const router = useRouter();
  return (
    <ManagedForm
      title="Product details"
      warnUnsaved
      stickyActions
      disabled={!canEdit}
      submitLabel={product ? "Save product" : "Create draft"}
      onSave={async (data) => {
        const v = values(data);
        const saved = await catalogApi.saveProduct(
          sellerId,
          {
            name: v.name,
            category_id: v.category_id,
            brand_id: v.brand_id || null,
            description: v.description,
            short_description: v.short_description,
          },
          product?.id,
        );
        if (product) onSaved?.();
        else router.push(`/seller/products/${saved.id}`);
      }}
    >
      <FormSection
        title="General"
        description="Name and category identify the draft. Saving does not publish the product."
      >
        <FormField
          label="Product name"
          name="name"
          required
          maxLength={200}
          defaultValue={product?.name ?? ""}
        />
        <CatalogPicker
          context={{ sellerId }}
          kind="categories"
          name="category_id"
          label="Category"
          required
          initial={product?.category}
        />
        <CatalogPicker
          context={{ sellerId }}
          kind="brands"
          name="brand_id"
          label="Brand"
          initial={product?.brand}
        />
      </FormSection>
      <FormSection
        title="Descriptions"
        description="Describe what customers receive. Pricing and stock are managed through variants and inventory."
      >
        <FormField
          label="Short description"
          name="short_description"
          maxLength={500}
          defaultValue={product?.short_description ?? ""}
        />
        <TextareaField
          label="Description"
          name="description"
          maxLength={10000}
          defaultValue={product?.description ?? ""}
          rows={5}
        />
      </FormSection>
    </ManagedForm>
  );
}
