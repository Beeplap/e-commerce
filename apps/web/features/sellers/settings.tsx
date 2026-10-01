"use client";

import { useCallback } from "react";
import {
  ApiErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { useSeller } from "@/features/workspaces/seller-workspace";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { useApiQuery } from "@/lib/api/use-api-query";
import { sellerManagementApi, type SellerDetail } from "./api";
import { ManagedForm, TextFields, values } from "./forms";
import { DocumentPanel } from "./documents";

export function SellerSettings() {
  const access = useSeller();
  if (!access.permissions.includes("seller.settings.read"))
    return <ForbiddenScreen />;
  return (
    <SettingsContent
      key={access.id}
      sellerId={access.seller.id}
      canEdit={access.permissions.includes("seller.settings.update")}
    />
  );
}
function SettingsContent({
  sellerId,
  canEdit,
}: {
  sellerId: string;
  canEdit: boolean;
}) {
  const load = useCallback(
    (signal: AbortSignal) =>
      sellerManagementApi.detail(sellerId, false, signal),
    [sellerId],
  );
  const query = useApiQuery(sellerId, load);
  if (query.kind === "loading") return <LoadingState />;
  if (query.kind === "error")
    return <ApiErrorState error={query.error} onRetry={query.retry} />;
  const seller = query.data;
  return (
    <>
      <PageHeader
        title="Seller settings"
        description={`${seller.legal_name} · ${seller.default_currency}`}
      />
      <div className="mb-6 flex gap-3">
        <StatusBadge status={seller.status} />
        <StatusBadge status={seller.verification_status} />
      </div>
      <div className="space-y-6">
        <ManagedForm
          title="Profile and contact"
          disabled={!canEdit}
          onSave={async (data) => {
            await sellerManagementApi.update(sellerId, values(data));
          }}
        >
          <TextFields
            fields={[
              {
                name: "display_name",
                label: "Display name",
                required: true,
                maxLength: 120,
              },
              {
                name: "email",
                label: "Business email",
                type: "email",
                required: true,
                maxLength: 254,
              },
              { name: "phone", label: "Business phone", maxLength: 32 },
              {
                name: "timezone",
                label: "Timezone",
                required: true,
                maxLength: 64,
              },
              {
                name: "website",
                label: "Website (HTTPS)",
                type: "url",
                maxLength: 200,
              },
              {
                name: "support_email",
                label: "Support email",
                type: "email",
                maxLength: 254,
              },
              {
                name: "description",
                label: "Business description",
                maxLength: 2000,
              },
            ]}
            defaults={{
              display_name: seller.display_name,
              email: seller.email,
              phone: seller.phone,
              timezone: seller.timezone,
              ...seller.profile,
              ...seller.settings,
            }}
          />
        </ManagedForm>
        <AddressForms seller={seller} canEdit={canEdit} onSaved={query.retry} />
        <DocumentPanel
          sellerId={sellerId}
          platform={false}
          canUpload={canEdit && seller.status === "pending"}
          canReview={false}
        />
      </div>
    </>
  );
}
function AddressForms({
  seller,
  canEdit,
  onSaved,
}: {
  seller: SellerDetail;
  canEdit: boolean;
  onSaved: () => void;
}) {
  return (
    <>
      {(["registered", "returns"] as const).map((kind) => {
        const address = seller.addresses.find((item) => item.kind === kind);
        return (
          <ManagedForm
            key={`${kind}:${address?.id ?? "new"}`}
            title={
              kind === "registered" ? "Registered address" : "Returns address"
            }
            disabled={
              !canEdit || (kind === "registered" && seller.status !== "pending")
            }
            onSave={async (data) => {
              await sellerManagementApi.address(
                seller.id,
                values(data),
                address?.id,
              );
              onSaved();
            }}
          >
            <input type="hidden" name="kind" value={kind} />
            <TextFields
              fields={[
                {
                  name: "line1",
                  label: "Address line 1",
                  required: true,
                  maxLength: 200,
                },
                { name: "line2", label: "Address line 2", maxLength: 200 },
                { name: "city", label: "City", required: true, maxLength: 100 },
                { name: "region", label: "Region", maxLength: 100 },
                { name: "postal_code", label: "Postal code", maxLength: 20 },
                {
                  name: "country",
                  label: "Country code (two uppercase letters)",
                  required: true,
                  maxLength: 2,
                },
              ]}
              defaults={address ? { ...address } : {}}
            />
            {kind === "registered" && (
              <p className="text-sm text-slate-600">
                Registered address becomes locked after document verification.
              </p>
            )}
          </ManagedForm>
        );
      })}
    </>
  );
}
