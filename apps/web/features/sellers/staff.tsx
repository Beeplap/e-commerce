"use client";

import { Dialog } from "@/components/ui/dialog";

import { useCallback, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ApiErrorState,
  SelectField,
  LoadingState,
  primaryButton,
  secondaryButton,
  FormField,
} from "@/components/ui/primitives";
import { errorMessage, sellerApi } from "@/lib/api/client";
import type { StaffMember, SellerRole } from "@/lib/api/types";
import { useApiQuery } from "@/lib/api/use-api-query";
import { useSeller } from "@/features/workspaces/seller-workspace";

export function SellerStaff() {
  const access = useSeller();
  const sellerId = access.seller.id;
  const canManage = access.permissions.includes("seller.staff.manage");

  const [page, setPage] = useState(1);
  const [showInvite, setShowInvite] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<StaffMember | null>(null);
  const actionInFlight = useRef(false);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");

  // Role change state
  const [changingMemberId, setChangingMemberId] = useState<string | null>(null);
  const [newRoleId, setNewRoleId] = useState("");

  const loadStaff = useCallback(
    (signal: AbortSignal) => sellerApi.staff(sellerId, page, signal),
    [sellerId, page],
  );
  const staffQuery = useApiQuery(`${sellerId}:staff:${page}`, loadStaff);

  const loadRoles = useCallback(
    (signal: AbortSignal) => sellerApi.roles(sellerId, signal),
    [sellerId],
  );
  const rolesQuery = useApiQuery(`${sellerId}:roles`, loadRoles);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail || !inviteRoleId) return;
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setSubmitting(true);
    setActionError(null);
    try {
      await sellerApi.inviteStaff(sellerId, {
        email: inviteEmail,
        role_id: inviteRoleId,
      });
      setInviteEmail("");
      setInviteRoleId("");
      setShowInvite(false);
      staffQuery.retry?.();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      actionInFlight.current = false;
      setSubmitting(false);
    }
  }

  async function handleRoleChange(membershipId: string) {
    if (!newRoleId) return;
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setSubmitting(true);
    setActionError(null);
    try {
      await sellerApi.updateStaffRole(sellerId, membershipId, {
        role_id: newRoleId,
      });
      setChangingMemberId(null);
      setNewRoleId("");
      staffQuery.retry?.();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      actionInFlight.current = false;
      setSubmitting(false);
    }
  }

  async function handleRevoke(membershipId: string) {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setSubmitting(true);
    setActionError(null);
    try {
      await sellerApi.revokeStaff(sellerId, membershipId);
      setRevokeTarget(null);
      staffQuery.retry?.();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      actionInFlight.current = false;
      setSubmitting(false);
    }
  }

  const roles: SellerRole[] =
    rolesQuery.kind === "ready" ? rolesQuery.data : [];

  if (staffQuery.kind === "error")
    return (
      <div className="mx-auto max-w-2xl py-12">
        <ApiErrorState error={staffQuery.error} onRetry={staffQuery.retry} />
      </div>
    );

  if (staffQuery.kind === "loading") return <LoadingState />;

  const staff: StaffMember[] = staffQuery.data.results;

  function statusBadge(status: StaffMember["status"]) {
    const cls =
      status === "active"
        ? "bg-emerald-50 text-emerald-700"
        : status === "invited"
          ? "bg-amber-50 text-amber-700"
          : "bg-slate-100 text-slate-600";
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
      >
        {status}
      </span>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-950">Staff</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage team members and their roles for this seller.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className={primaryButton}
          >
            Invite member
          </button>
        )}
      </div>

      {actionError && !showInvite && !revokeTarget && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {actionError}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                Member
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                Status
              </th>
              {canManage && (
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff.length === 0 && (
              <tr>
                <td
                  colSpan={canManage ? 4 : 3}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  No staff members yet.
                </td>
              </tr>
            )}
            {staff.map((member) => (
              <tr key={member.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">
                    {member.user.first_name} {member.user.last_name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {member.user.email}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {changingMemberId === member.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label={`Role for ${member.user.email}`}
                        value={newRoleId}
                        onChange={(e) => setNewRoleId(e.target.value)}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      >
                        <option value="">Select role…</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={submitting || !newRoleId}
                        onClick={() => handleRoleChange(member.id)}
                        className="rounded-lg bg-teal-700 px-2 py-1 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setChangingMemberId(null);
                          setNewRoleId("");
                        }}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span>
                      {member.role.name}
                      {member.role.is_owner && (
                        <span className="ml-1 text-xs text-amber-600">
                          (owner)
                        </span>
                      )}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{statusBadge(member.status)}</td>
                {canManage && !member.role.is_owner && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {changingMemberId !== member.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setChangingMemberId(member.id);
                            setNewRoleId(member.role.id);
                          }}
                          className={secondaryButton}
                        >
                          Change role
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => {
                          setActionError(null);
                          setRevokeTarget(member);
                        }}
                        className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        Revoke
                      </button>
                    </div>
                  </td>
                )}
                {canManage && member.role.is_owner && (
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-ui-muted">Protected</span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {staffQuery.data.count > 25 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className={secondaryButton}
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.ceil(staffQuery.data.count / 25)}
          </span>
          <button
            type="button"
            disabled={page * 25 >= staffQuery.data.count}
            onClick={() => setPage((p) => p + 1)}
            className={secondaryButton}
          >
            Next
          </button>
        </div>
      )}

      {/* Invite Modal */}
      <ConfirmDialog
        open={revokeTarget !== null}
        title="Revoke staff access"
        description={
          revokeTarget
            ? `Revoke ${revokeTarget.user.email}'s access to ${access.seller.display_name}? This member will lose access to this seller workspace. Their other seller memberships are unaffected.`
            : ""
        }
        confirmLabel="Revoke access"
        busy={submitting}
        error={actionError ?? undefined}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => {
          if (revokeTarget) void handleRevoke(revokeTarget.id);
        }}
      />
      {showInvite && (
        <Dialog
          open
          title={<>Invite Team Member</>}
          description={<>Send an invitation to a user by email.</>}
          onClose={() => setShowInvite(false)}
          busy={submitting}
          error={actionError}
        >
          <form onSubmit={handleInvite} className="mt-4 space-y-3">
            <FormField
              label="Email address"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              required
            />
            <SelectField
              label="Role"
              value={inviteRoleId}
              onChange={(e) => setInviteRoleId(e.target.value)}
              required
            >
              <option value="">Select a role…</option>
              {roles
                .filter((r) => !r.is_owner)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </SelectField>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className={secondaryButton}
                data-dialog-cancel
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={primaryButton}
              >
                {submitting ? "Inviting…" : "Send invitation"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
