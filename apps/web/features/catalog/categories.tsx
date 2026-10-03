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
import { catalogApi, type Category } from "./api";
import { CatalogPicker } from "./picker";

export function PlatformCategories() {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;
  const canRead = hasPlatformPermission(user, "platform.catalog.read");
  const canManage = hasPlatformPermission(user, "platform.catalog.manage");

  if (!canRead) return <ForbiddenScreen />;
  return <CategoriesList key={user?.id} canManage={canManage} />;
}

function CategoriesList({ canManage }: { canManage: boolean }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Category | null | "new">(null);

  const load = useCallback(
    (signal: AbortSignal) =>
      catalogApi.taxonomy(
        { platform: true },
        "categories",
        { page, ...(search ? { search } : {}) },
        signal,
      ),
    [page, search],
  );

  const query = useApiQuery(`platform:categories:${page}:${search}`, load);

  return (
    <>
      <PageHeader
        title="Categories"
        description="Manage hierarchical platform categories and taxonomies."
        actions={
          canManage &&
          !editing && (
            <button
              className={primaryButton}
              type="button"
              onClick={() => setEditing("new")}
            >
              Add category
            </button>
          )
        }
      />

      {editing && canManage ? (
        <CategoryEditor
          category={editing === "new" ? undefined : editing}
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
              label="Search categories"
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
                caption="Platform categories"
                rows={query.data.results as Category[]}
                rowKey={(r) => r.id}
                columns={[
                  { id: "name", heading: "Category name", cell: (r) => r.name },
                  {
                    id: "slug",
                    heading: "Slug",
                    cell: (r) => <span className="font-mono">{r.slug}</span>,
                  },
                  {
                    id: "description",
                    heading: "Description",
                    cell: (r) => r.description || "—",
                  },
                  {
                    id: "sort",
                    align: "right" as const,
                    heading: "Sort order",
                    cell: (r) => r.sort_order,
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
                          cell: (r: Category) => (
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

function CategoryEditor({
  category,
  onClose,
  onSaved,
}: {
  category?: Category;
  onClose: () => void;
  onSaved: () => void;
}) {
  const mutation = useMutation();
  const [parentId, setParentId] = useState<string | null>(
    category?.parent_id ?? null,
  );

  return (
    <div className={panel}>
      <h2 className="mb-4 text-xl font-semibold">
        {category ? `Edit category: ${category.name}` : "Create category"}
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const v = values(form);
          void mutation.run(async () => {
            await catalogApi.saveTaxonomy(
              "categories",
              {
                name: v.name,
                slug: v.slug,
                description: v.description || "",
                parent_id: parentId,
                sort_order: parseInt(v.sort_order || "0", 10),
                is_active: v.is_active === "true",
              },
              category?.id,
            );
            onSaved();
          });
        }}
        className="space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Category name"
            name="name"
            required
            maxLength={120}
            defaultValue={category?.name ?? ""}
          />
          <FormField
            label="Slug"
            name="slug"
            required
            maxLength={140}
            defaultValue={category?.slug ?? ""}
          />
        </div>

        <CatalogPicker
          context={{ platform: true }}
          kind="categories"
          label="Parent category"
          name="parent_id"
          initial={
            category?.parent_id
              ? { id: category.parent_id, name: "Current parent" }
              : null
          }
          onSelect={(rec) => setParentId(rec?.id ?? null)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Sort order"
            name="sort_order"
            type="number"
            min={0}
            defaultValue={category?.sort_order ?? 0}
          />
          <label className="block text-sm font-medium">
            Active status
            <select
              name="is_active"
              className={`${selectStyle} mt-2`}
              defaultValue={category?.is_active ? "true" : "false"}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
        </div>

        <label className="block text-sm font-medium">
          Description
          <textarea
            name="description"
            rows={3}
            maxLength={2000}
            defaultValue={category?.description ?? ""}
            className={`${selectStyle} mt-2 py-2`}
          />
        </label>

        <div className="flex gap-3">
          <button
            className={primaryButton}
            type="submit"
            disabled={mutation.busy}
          >
            {mutation.busy ? "Saving…" : "Save category"}
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
