"use client";

import { DetailGrid } from "@/components/ui/detail-layout";
import { PageHeader, StatusBadge } from "@/components/ui/primitives";
import { useAuth } from "@/features/auth/auth-provider";
import { WorkspaceFrame } from "./workspace-frame";

export function AccountOverview() {
  const { state } = useAuth();
  if (state.kind !== "authenticated") return null;
  const user = state.user;
  return (
    <WorkspaceFrame mode="account">
      <PageHeader
        title="My account"
        description="Your account identity and email verification status."
      />
      <section className="border-t border-ui-border py-5">
        <DetailGrid
          items={[
            {
              label: "Name",
              value:
                [user.first_name, user.last_name].filter(Boolean).join(" ") ||
                "Not set",
            },
            { label: "Email address", value: user.email },
            {
              label: "Email verification",
              value: (
                <StatusBadge
                  status={user.is_email_verified ? "verified" : "pending"}
                />
              ),
            },
          ]}
        />
      </section>
    </WorkspaceFrame>
  );
}
