"use client";

import { useCallback, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import {
  ApiErrorState,
  FormField,
  LoadingState,
  PageHeader,
  primaryButton,
  secondaryButton,
} from "@/components/ui/primitives";
import { useAuth } from "@/features/auth/auth-provider";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import {
  panel,
  selectStyle,
  useMutation,
  MutationStatus,
  values,
} from "@/features/sellers/forms";
import { hasPlatformPermission } from "@/lib/permissions";
import { useApiQuery } from "@/lib/api/use-api-query";
import { catalogApi, type Brand } from "./api";

export function PlatformBrands() {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;
  const canRead = hasPlatformPermission(user, "platform.catalog.read");
  const canManage = hasPlatformPermission(user, "platform.catalog.manage");

  if (!canRead) return <ForbiddenScreen />;
  return <BrandsList key={user?.id} canManage={canManage} />;
}

function BrandsList({ canManage }: { canManage: boolean }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Brand | null | "new">(null);

  const load = useCallback(
    (signal: AbortSignal) =>
      catalogApi.taxonomy(
        { platform: true },
        "brands",
        { page, ...(search ? { search } : {}) },
        signal,
      ),
    [page, search],
  );

  const query = useApiQuery(`platform:brands:${page}:${search}`, load);

  return (
    <>
      <PageHeader
        title="Brands"
        description="Manage catalog brands for products."
        actions={
          canManage &&
          !editing && (
            <button
              className={primaryButton}
              type="button"
              onClick={() => setEditing("new")}
            >
              Add brand
            </button>
          )
        }
      />

      {editing && canManage ? (
        <BrandEditor
          brand={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            query.retry();
          }}
        />
      ) : (
        <>
          <div className="mb-6 max-w-sm">
            <FormField
              label="Search brands"
              value={search}
              maxLength={100}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {query.kind === "loading" && <LoadingState />}
          {query.kind === "error" && (
            <ApiErrorState error={query.error} onRetry={query.retry} />
          )}
          {query.kind === "ready" && (
            <>
              <DataTable
                caption="Platform brands"
                rows={query.data.results as Brand[]}
                rowKey={(r) => r.id}
                columns={[
                  { id: "name", heading: "Brand name", cell: (r) => r.name },
                  {
                    id: "slug",
                    heading: "Slug",
                    cell: (r) => <span className="font-mono">{r.slug}</span>,
                  },
                  {
                    id: "status",
                    heading: "Status",
                    cell: (r) => (
                      <span
                        className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          r.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {r.is_active ? "Active" : "Inactive"}
                      </span>
                    ),
                  },
                  ...(canManage
                    ? [
                        {
                          id: "actions",
                          heading: "Actions",
                          cell: (r: Brand) => (
                            <button
                              className={secondaryButton}
                              type="button"
                              onClick={() => setEditing(r)}
                            >
                              Edit
                            </button>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
              <Pagination
                page={page}
                count={query.data.count}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}
    </>
  );
}

function BrandEditor({
  brand,
  onClose,
  onSaved,
}: {
  brand?: Brand;
  onClose: () => void;
  onSaved: () => void;
}) {
  const mutation = useMutation();

  return (
    <div className={panel}>
      <h2 className="mb-4 text-xl font-semibold">
        {brand ? `Edit brand: ${brand.name}` : "Create brand"}
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const v = values(form);
          void mutation.run(async () => {
            await catalogApi.saveTaxonomy(
              "brands",
              {
                name: v.name,
                slug: v.slug,
                is_active: v.is_active === "true",
              },
              brand?.id,
            );
            onSaved();
          });
        }}
        className="space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Brand name"
            name="name"
            required
            maxLength={120}
            defaultValue={brand?.name ?? ""}
          />
          <FormField
            label="Slug"
            name="slug"
            required
            maxLength={140}
            defaultValue={brand?.slug ?? ""}
          />
        </div>

        <label className="block text-sm font-medium">
          Active status
          <select
            name="is_active"
            className={`${selectStyle} mt-2`}
            defaultValue={brand?.is_active ? "true" : "false"}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>

        <div className="flex gap-3">
          <button
            className={primaryButton}
            type="submit"
            disabled={mutation.busy}
          >
            {mutation.busy ? "Saving…" : "Save brand"}
          </button>
          <button
            className={secondaryButton}
            type="button"
            onClick={onClose}
            disabled={mutation.busy}
          >
            Cancel
          </button>
        </div>
        <MutationStatus error={mutation.error} success={mutation.success} />
      </form>
    </div>
  );
}
