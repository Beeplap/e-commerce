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
import {
  catalogApi,
  type Attribute,
  type CategoryLink,
  type Option,
} from "./api";
import { CatalogPicker } from "./picker";

export function PlatformAttributes() {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;
  const canRead = hasPlatformPermission(user, "platform.catalog.read");
  const canManage = hasPlatformPermission(user, "platform.catalog.manage");

  if (!canRead) return <ForbiddenScreen />;
  return <AttributesManager key={user?.id} canManage={canManage} />;
}

function AttributesManager({ canManage }: { canManage: boolean }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Attribute | null | "new">(null);
  const [managingOptions, setManagingOptions] = useState<Attribute | null>(
    null,
  );

  const load = useCallback(
    (signal: AbortSignal) =>
      catalogApi.taxonomy(
        { platform: true },
        "attributes",
        { page, ...(search ? { search } : {}) },
        signal,
      ),
    [page, search],
  );

  const query = useApiQuery(`platform:attributes:${page}:${search}`, load);

  return (
    <>
      <PageHeader
        title="Attributes"
        description="Configure dynamic product specifications and variant axes."
        actions={
          canManage &&
          !editing &&
          !managingOptions && (
            <button
              className={primaryButton}
              type="button"
              onClick={() => setEditing("new")}
            >
              Add attribute
            </button>
          )
        }
      />

      {editing && canManage ? (
        <AttributeEditor
          attribute={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            query.retry();
          }}
        />
      ) : managingOptions ? (
        <AttributeOptionsManager
          attribute={managingOptions}
          canManage={canManage}
          onClose={() => setManagingOptions(null)}
        />
      ) : (
        <div className="space-y-8">
          <div>
            <div className="mb-6 max-w-sm">
              <FormField
                label="Search attributes"
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
                  caption="Platform attributes"
                  rows={query.data.results as Attribute[]}
                  rowKey={(r) => r.id}
                  columns={[
                    { id: "name", heading: "Name", cell: (r) => r.name },
                    {
                      id: "code",
                      heading: "Code",
                      cell: (r) => <span className="font-mono">{r.code}</span>,
                    },
                    { id: "type", heading: "Type", cell: (r) => r.value_type },
                    { id: "scope", heading: "Scope", cell: (r) => r.scope },
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
                    {
                      id: "actions",
                      heading: "Actions",
                      cell: (r: Attribute) => (
                        <div className="flex gap-2">
                          {r.value_type === "choice" && (
                            <button
                              className={secondaryButton}
                              type="button"
                              onClick={() => setManagingOptions(r)}
                            >
                              Options
                            </button>
                          )}
                          {canManage && (
                            <button
                              className={secondaryButton}
                              type="button"
                              onClick={() => setEditing(r)}
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      ),
                    },
                  ]}
                />
                <Pagination
                  page={page}
                  count={query.data.count}
                  onPageChange={setPage}
                />
              </>
            )}
          </div>

          {canManage && <CategoryLinkManager />}
        </div>
      )}
    </>
  );
}

function AttributeEditor({
  attribute,
  onClose,
  onSaved,
}: {
  attribute?: Attribute;
  onClose: () => void;
  onSaved: () => void;
}) {
  const mutation = useMutation();
  return (
    <div className={panel}>
      <h2 className="mb-4 text-xl font-semibold">
        {attribute ? `Edit attribute: ${attribute.name}` : "Create attribute"}
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const v = values(form);
          void mutation.run(async () => {
            await catalogApi.saveTaxonomy(
              "attributes",
              {
                name: v.name,
                code: v.code,
                value_type: v.value_type,
                scope: v.scope,
                is_active: v.is_active === "true",
              },
              attribute?.id,
            );
            onSaved();
          });
        }}
        className="space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Attribute name"
            name="name"
            required
            maxLength={120}
            defaultValue={attribute?.name ?? ""}
          />
          <FormField
            label="Code (unique slug)"
            name="code"
            required
            maxLength={80}
            defaultValue={attribute?.code ?? ""}
          />
          <label className="block text-sm font-medium">
            Value type
            <select
              name="value_type"
              className={`${selectStyle} mt-2`}
              defaultValue={attribute?.value_type ?? "text"}
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="choice">Choice (predefined options)</option>
              <option value="boolean">Boolean (Yes/No)</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Scope
            <select
              name="scope"
              className={`${selectStyle} mt-2`}
              defaultValue={attribute?.scope ?? "product"}
            >
              <option value="product">Product specification</option>
              <option value="variant">Variant variation axis</option>
            </select>
          </label>
        </div>

        <label className="block text-sm font-medium">
          Active status
          <select
            name="is_active"
            className={`${selectStyle} mt-2`}
            defaultValue={attribute?.is_active ? "true" : "false"}
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
            {mutation.busy ? "Saving…" : "Save attribute"}
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

function AttributeOptionsManager({
  attribute,
  canManage,
  onClose,
}: {
  attribute: Attribute;
  canManage: boolean;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const load = useCallback(
    (signal: AbortSignal) =>
      catalogApi.taxonomy(
        { platform: true },
        "options",
        { page, attribute_id: attribute.id },
        signal,
      ),
    [attribute.id, page],
  );

  const query = useApiQuery(`platform:options:${attribute.id}:${page}`, load);
  const mutation = useMutation();

  return (
    <div className={panel}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            Options for {attribute.name}
          </h2>
          <p className="text-sm text-slate-600">
            Predefined choices available for selection on products or variants.
          </p>
        </div>
        <button className={secondaryButton} type="button" onClick={onClose}>
          Back to attributes
        </button>
      </div>

      {query.kind === "loading" && <LoadingState />}
      {query.kind === "error" && (
        <ApiErrorState error={query.error} onRetry={query.retry} />
      )}
      {query.kind === "ready" && (
        <>
          <DataTable
            caption="Attribute options"
            rows={query.data.results as Option[]}
            rowKey={(r) => r.id}
            columns={[
              { id: "name", heading: "Label / Name", cell: (r) => r.name },
              {
                id: "value",
                heading: "Slug / Value",
                cell: (r) => <span className="font-mono">{r.value}</span>,
              },
              {
                id: "status",
                heading: "Status",
                cell: (r) => (r.is_active ? "Active" : "Inactive"),
              },
            ]}
          />
          <Pagination
            page={page}
            count={query.data.count}
            onPageChange={setPage}
          />
        </>
      )}

      {canManage && (
        <form
          className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const v = values(form);
            void mutation.run(async () => {
              await catalogApi.saveTaxonomy("options", {
                attribute_id: attribute.id,
                name: v.name,
                value: v.value,
                is_active: true,
              });
              e.currentTarget.reset();
              query.retry();
            });
          }}
        >
          <FormField
            label="Option label"
            name="name"
            required
            maxLength={120}
          />
          <FormField
            label="Option value (slug)"
            name="value"
            required
            maxLength={80}
          />
          <button
            className={primaryButton}
            type="submit"
            disabled={mutation.busy}
          >
            {mutation.busy ? "Adding…" : "Add option"}
          </button>
        </form>
      )}
      <MutationStatus error={mutation.error} success={mutation.success} />
    </div>
  );
}

function CategoryLinkManager() {
  const [selectedCatId, setSelectedCatId] = useState("");
  const [selectedAttrId, setSelectedAttrId] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(
    (signal: AbortSignal) =>
      selectedCatId
        ? catalogApi.taxonomy(
            { platform: true },
            "category-attributes",
            { page, category_id: selectedCatId },
            signal,
          )
        : Promise.resolve({
            count: 0,
            next: null,
            previous: null,
            results: [],
          }),
    [selectedCatId, page],
  );

  const query = useApiQuery(
    `platform:cat-links:${selectedCatId}:${page}`,
    load,
  );
  const mutation = useMutation();

  return (
    <section className={panel}>
      <h3 className="mb-2 text-xl font-semibold">
        Category attributes assignment
      </h3>
      <p className="mb-4 text-sm text-slate-600">
        Assign configurable attributes to specific categories and enforce
        requirement rules.
      </p>

      <div className="mb-4 max-w-md">
        <CatalogPicker
          context={{ platform: true }}
          kind="categories"
          label="Select category to view/link attributes"
          name="category_filter"
          onSelect={(rec) => {
            setSelectedCatId(rec?.id ?? "");
            setPage(1);
          }}
        />
      </div>

      {selectedCatId && (
        <>
          {query.kind === "loading" && <LoadingState />}
          {query.kind === "error" && (
            <ApiErrorState error={query.error} onRetry={query.retry} />
          )}
          {query.kind === "ready" && (
            <>
              <DataTable
                caption="Assigned attributes"
                rows={query.data.results as CategoryLink[]}
                rowKey={(r) => r.id}
                columns={[
                  {
                    id: "name",
                    heading: "Attribute",
                    cell: (r) => r.attribute.name,
                  },
                  {
                    id: "code",
                    heading: "Code",
                    cell: (r) => (
                      <span className="font-mono">{r.attribute.code}</span>
                    ),
                  },
                  {
                    id: "scope",
                    heading: "Scope",
                    cell: (r) => r.attribute.scope,
                  },
                  {
                    id: "type",
                    heading: "Type",
                    cell: (r) => r.attribute.value_type,
                  },
                  {
                    id: "required",
                    heading: "Required",
                    cell: (r) =>
                      r.is_required ? "Yes (Mandatory)" : "Optional",
                  },
                ]}
              />
              <Pagination
                page={page}
                count={query.data.count}
                onPageChange={setPage}
              />
            </>
          )}

          <form
            className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedAttrId) return;
              void mutation.run(async () => {
                await catalogApi.saveTaxonomy("category-attributes", {
                  category_id: selectedCatId,
                  attribute_id: selectedAttrId,
                  is_required: isRequired,
                });
                query.retry();
              });
            }}
          >
            <div className="min-w-64">
              <CatalogPicker
                context={{ platform: true }}
                kind="attributes"
                label="Attribute to link"
                name="attr_to_link"
                required
                onSelect={(rec) => setSelectedAttrId(rec?.id ?? "")}
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium pb-3">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-800"
              />
              Is required for products in this category
            </label>
            <button
              className={primaryButton}
              type="submit"
              disabled={mutation.busy || !selectedAttrId}
            >
              {mutation.busy ? "Linking…" : "Link attribute"}
            </button>
          </form>
          <MutationStatus error={mutation.error} success={mutation.success} />
        </>
      )}
    </section>
  );
}
