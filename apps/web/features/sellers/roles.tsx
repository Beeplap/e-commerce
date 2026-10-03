"use client";

import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormSection } from "@/components/ui/layout";

import { useCallback, useRef, useState } from "react";
import {
  ApiErrorState,
  LoadingState,
  primaryButton,
  secondaryButton,
  FormField,
} from "@/components/ui/primitives";
import { errorMessage, sellerApi } from "@/lib/api/client";
import type { SellerRole } from "@/lib/api/types";
import { useApiQuery } from "@/lib/api/use-api-query";
import { useSeller } from "@/features/workspaces/seller-workspace";

export function SellerRoles() {
  const access = useSeller();
  const sellerId = access.seller.id;
  const canManage = access.permissions.includes("seller.staff.manage");

  const [showCreate, setShowCreate] = useState(false);
  const [editingRole, setEditingRole] = useState<SellerRole | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SellerRole | null>(null);
  const actionInFlight = useRef(false);

  const [roleName, setRoleName] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  const loadRoles = useCallback(
    (signal: AbortSignal) => sellerApi.roles(sellerId, signal),
    [sellerId],
  );
  const rolesQuery = useApiQuery(`${sellerId}:roles`, loadRoles);

  const loadPerms = useCallback(
    (signal: AbortSignal) => sellerApi.assignablePermissions(sellerId, signal),
    [sellerId],
  );
  const permsQuery = useApiQuery(
    `${sellerId}:assignable-permissions`,
    loadPerms,
  );

  function resetForm() {
    setRoleName("");
    setSelectedPerms([]);
    setActionError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setSubmitting(true);
    setActionError(null);
    try {
      await sellerApi.createRole(sellerId, {
        name: roleName,
        permissions: selectedPerms,
      });
      resetForm();
      setShowCreate(false);
      rolesQuery.retry?.();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      actionInFlight.current = false;
      setSubmitting(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRole) return;
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setSubmitting(true);
    setActionError(null);
    try {
      await sellerApi.updateRole(sellerId, editingRole.id, {
        name: roleName,
        permissions: selectedPerms,
      });
      resetForm();
      setEditingRole(null);
      rolesQuery.retry?.();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      actionInFlight.current = false;
      setSubmitting(false);
    }
  }

  async function handleDelete(role: SellerRole) {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setSubmitting(true);
    setActionError(null);
    try {
      await sellerApi.deleteRole(sellerId, role.id);
      setDeleteTarget(null);
      rolesQuery.retry?.();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      actionInFlight.current = false;
      setSubmitting(false);
    }
  }

  function openEdit(role: SellerRole) {
    setEditingRole(role);
    setRoleName(role.name);
    setSelectedPerms([...role.permissions]);
    setActionError(null);
  }

  function togglePerm(perm: string) {
    setSelectedPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  }

  const availablePerms: string[] =
    permsQuery.kind === "ready" ? permsQuery.data.permissions : [];

  if (rolesQuery.kind === "error")
    return (
      <div className="mx-auto max-w-2xl py-12">
        <ApiErrorState error={rolesQuery.error} onRetry={rolesQuery.retry} />
      </div>
    );
  if (rolesQuery.kind === "loading") return <LoadingState />;

  const roles: SellerRole[] = rolesQuery.data;

  return (
    <section>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-950">Roles</h1>
          <p className="mt-1 text-sm text-slate-600">
            Define custom roles and their permission sets.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowCreate(true);
            }}
            className={primaryButton}
          >
            New role
          </button>
        )}
      </div>

      {actionError && !showCreate && !editingRole && !deleteTarget && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {actionError}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {roles.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">
            No custom roles yet.
          </p>
        )}
        {roles.map((role) => (
          <div key={role.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">
                    {role.name}
                  </span>
                  {role.is_system && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      System
                    </span>
                  )}
                  {role.is_owner && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                      Owner
                    </span>
                  )}
                </div>
                {role.permissions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {role.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="rounded bg-teal-50 px-1.5 py-0.5 font-mono text-xs text-teal-700"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {canManage && !role.is_system && !role.is_owner && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(role)}
                    className={secondaryButton}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setActionError(null);
                      setDeleteTarget(role);
                    }}
                    className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete custom role"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.name} from ${access.seller.display_name}? This role can no longer be assigned. Django rejects deletion while members are assigned, and system or owner roles remain protected.`
            : ""
        }
        confirmLabel="Delete role"
        busy={submitting}
        error={actionError ?? undefined}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void handleDelete(deleteTarget);
        }}
      />
      {showCreate && (
        <RoleFormModal
          title="Create role"
          roleName={roleName}
          setRoleName={setRoleName}
          availablePerms={availablePerms}
          selectedPerms={selectedPerms}
          togglePerm={togglePerm}
          actionError={actionError}
          submitting={submitting}
          onSubmit={handleCreate}
          onClose={() => {
            setShowCreate(false);
            resetForm();
          }}
        />
      )}

      {editingRole && (
        <RoleFormModal
          title={`Edit role: ${editingRole.name}`}
          roleName={roleName}
          setRoleName={setRoleName}
          availablePerms={availablePerms}
          selectedPerms={selectedPerms}
          togglePerm={togglePerm}
          actionError={actionError}
          submitting={submitting}
          onSubmit={handleUpdate}
          onClose={() => {
            setEditingRole(null);
            resetForm();
          }}
        />
      )}
    </section>
  );
}

interface RoleFormModalProps {
  title: string;
  roleName: string;
  setRoleName: (name: string) => void;
  availablePerms: string[];
  selectedPerms: string[];
  togglePerm: (perm: string) => void;
  actionError: string | null;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

function RoleFormModal({
  title,
  roleName,
  setRoleName,
  availablePerms,
  selectedPerms,
  togglePerm,
  actionError,
  submitting,
  onSubmit,
  onClose,
}: RoleFormModalProps) {
  const permissionGroups = availablePerms.reduce<Map<string, string[]>>(
    (groups, permission) => {
      const area = permission.split(".")[0] ?? "Other";
      const permissions = groups.get(area) ?? [];
      permissions.push(permission);
      groups.set(area, permissions);
      return groups;
    },
    new Map(),
  );
  return (
    <Dialog
      open
      title={<>{title}</>}
      description="Choose only the permissions this role needs. The backend revalidates your authority to delegate each permission."
      onClose={onClose}
      busy={submitting}
      error={actionError}
    >
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <FormField
          label="Role name"
          value={roleName}
          onChange={(e) => setRoleName(e.target.value)}
          placeholder="e.g. Inventory Manager"
          required
        />
        {availablePerms.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-slate-700">
              Permissions
            </p>
            <div className="space-y-5">
              {[...permissionGroups].map(([area, permissions]) => (
                <FormSection key={area} title={area.replaceAll("_", " ")}>
                  {permissions.map((perm) => (
                    <label
                      key={perm}
                      className="flex min-h-11 items-center gap-3 text-ui-body cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPerms.includes(perm)}
                        onChange={() => togglePerm(perm)}
                        className="h-4 w-4 rounded border-slate-300 text-teal-600"
                      />
                      <span className="font-mono text-slate-700">{perm}</span>
                    </label>
                  ))}
                </FormSection>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={secondaryButton}
            data-dialog-cancel
          >
            Cancel
          </button>
          <button type="submit" disabled={submitting} className={primaryButton}>
            {submitting ? "Saving…" : "Save role"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
