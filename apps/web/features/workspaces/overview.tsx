"use client";

import { PageHeader, StatusBadge } from "@/components/ui/primitives";
import { useAuth } from "@/features/auth/auth-provider";
import { useSeller } from "./seller-workspace";
import { WorkspaceFrame } from "./workspace-frame";

export function SellerOverview() {
  const membership = useSeller();
  const seller = membership.seller;
  return (
    <>
      <PageHeader
        title={seller.display_name}
        description="Your selected seller workspace."
      />
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-5 text-lg font-semibold">Workspace details</h2>
        <dl className="grid gap-6 sm:grid-cols-2">
          <Detail label="Seller status">
            <StatusBadge status={seller.status} />
          </Detail>
          <Detail label="Verification">
            <StatusBadge status={seller.verification_status} />
          </Detail>
          <Detail label="Your role">
            <span className="capitalize">
              {membership.role.name.toLowerCase().replaceAll("_", " ")}
            </span>
          </Detail>
          <Detail label="Default currency">{seller.default_currency}</Detail>
          <Detail label="Timezone">{seller.timezone}</Detail>
        </dl>
      </section>
    </>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="mb-2 text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}

export function AdminOverview() {
  const { state } = useAuth();
  if (state.kind !== "authenticated") return null;
  return (
    <>
      <PageHeader
        title="Platform workspace"
        description="Your platform administration account."
      />
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-5 text-lg font-semibold">Account details</h2>
        <dl className="grid gap-6 sm:grid-cols-2">
          <Detail label="Signed in as">{state.user.email}</Detail>
          <Detail label="Email verification">
            <StatusBadge
              status={state.user.is_email_verified ? "verified" : "pending"}
            />
          </Detail>
        </dl>
      </section>
    </>
  );
}

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
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <dl className="grid gap-6 sm:grid-cols-2">
          <Detail label="Name">
            {[user.first_name, user.last_name].filter(Boolean).join(" ") ||
              "Not set"}
          </Detail>
          <Detail label="Email address">{user.email}</Detail>
          <Detail label="Email verification">
            <StatusBadge
              status={user.is_email_verified ? "verified" : "pending"}
            />
          </Detail>
        </dl>
      </section>
    </WorkspaceFrame>
  );
}
