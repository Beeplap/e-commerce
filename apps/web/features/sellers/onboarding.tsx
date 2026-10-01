"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader, primaryButton } from "@/components/ui/primitives";
import { WorkspaceFrame } from "@/features/workspaces/workspace-frame";
import { sellerManagementApi } from "./api";
import { ManagedForm, selectStyle, TextFields, values } from "./forms";

export function SellerOnboarding() {
  const [created, setCreated] = useState(false);
  return (
    <WorkspaceFrame mode="workspaces">
      <PageHeader
        title="Register your business"
        description="Create a seller workspace, add your registered address, and submit a business-registration scan for platform review."
      />
      {created ? (
        <section className="space-y-4" role="status">
          <h2 className="text-xl font-semibold">
            Your seller workspace is ready for onboarding
          </h2>
          <p>
            Open seller settings and choose your new business in the seller
            selector to complete verification.
          </p>
          <Link href="/seller/settings" className={primaryButton}>
            Continue to seller settings
          </Link>
        </section>
      ) : (
        <ManagedForm
          title="Business details"
          submitLabel="Create seller workspace"
          onSave={async (data) => {
            await sellerManagementApi.create(values(data));
            setCreated(true);
          }}
        >
          <TextFields
            fields={[
              {
                name: "legal_name",
                label: "Registered legal name",
                required: true,
                maxLength: 200,
              },
              {
                name: "display_name",
                label: "Store display name",
                required: true,
                maxLength: 120,
              },
              {
                name: "email",
                label: "Business email",
                required: true,
                type: "email",
                maxLength: 254,
              },
              { name: "phone", label: "Business phone", maxLength: 32 },
              {
                name: "timezone",
                label: "Timezone",
                required: true,
                maxLength: 64,
              },
            ]}
            defaults={{ timezone: "UTC" }}
          />
          <label className="block text-sm font-medium">
            Business currency
            <select
              className={`${selectStyle} mt-2`}
              name="default_currency"
              defaultValue="NPR"
            >
              {["NPR", "USD", "INR", "EUR", "GBP"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <p className="text-sm text-slate-600">
            Legal name and currency are fixed when the workspace is created. Use
            an IANA timezone such as Asia/Kathmandu.
          </p>
        </ManagedForm>
      )}
    </WorkspaceFrame>
  );
}
