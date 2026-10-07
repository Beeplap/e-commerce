"use client";

import { useCallback, useState, type FormEvent } from "react";
import {
  StorefrontButton,
  StorefrontInput,
} from "@/components/storefront/controls";
import {
  StorefrontNotice,
  StorefrontOverlay,
} from "@/components/storefront/feedback";
import {
  addressFields,
  addressErrors,
  emptyAddress,
  type Address,
} from "@/features/checkout/address-fields";
import { addressesEvidence } from "@/features/checkout/evidence";
import { ApiError, customerApi } from "@/lib/api/client";
import type { CustomerAddress } from "@/lib/api/types";
import { useApiQuery } from "@/lib/api/use-api-query";
import { AccountFrame } from "./frame";
import {
  AccountError,
  AccountLoading,
  AccountStatus,
  asAccountError,
  fieldError,
  useAccountCommand,
} from "./shared";

export function CustomerAddressesPage() {
  return (
    <AccountFrame
      title="Address book"
      description="Saved delivery addresses for your next checkout."
    >
      {(user) => <AddressBook userId={user.id} />}
    </AccountFrame>
  );
}
function AddressBook({ userId }: { userId: string }) {
  const load = useCallback(
    async (signal: AbortSignal) =>
      addressesEvidence(await customerApi.getAddresses(signal)),
    [],
  );
  const query = useApiQuery(userId + ":addresses", load);
  const command = useAccountCommand();
  const [editor, setEditor] = useState<CustomerAddress | "new" | null>(null);
  const [remove, setRemove] = useState<CustomerAddress | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  function accepted(message: string) {
    setNotice(message);
    setError(null);
    query.retry();
  }
  return (
    <>
      <div className="sf-account-toolbar">
        <p>
          {query.kind === "ready"
            ? `${query.data.length} saved ${query.data.length === 1 ? "address" : "addresses"}`
            : "Your saved addresses"}
        </p>
        <StorefrontButton
          data-testid="add-address-button"
          disabled={query.kind !== "ready" || command.busy}
          onClick={() => setEditor("new")}
        >
          Add address
        </StorefrontButton>
      </div>
      {notice && <StorefrontNotice tone="success">{notice}</StorefrontNotice>}
      {error && !remove && <AccountError error={error} />}
      {query.kind === "loading" && <AccountLoading label="Loading addresses" />}
      {query.kind === "error" && (
        <AccountError error={query.error} onRetry={query.retry} />
      )}
      {query.kind === "ready" &&
        (!query.data.length ? (
          <div className="sf-account-empty">
            <h2>No saved addresses</h2>
            <p>Add a delivery address when you are ready.</p>
          </div>
        ) : (
          <ul className="sf-account-addresses">
            {query.data.map((address) => (
              <li key={address.id}>
                <div className="sf-account-address-heading">
                  <h2>{address.full_name}</h2>
                  {address.is_default && <AccountStatus status="Default" />}
                </div>
                <AddressDisplay address={address} includeName={false} />
                <div className="sf-account-address-actions">
                  <StorefrontButton
                    variant="quiet"
                    disabled={command.busy}
                    data-testid={`edit-address-${address.id}`}
                    aria-label={`Edit address for ${address.full_name}`}
                    onClick={() => setEditor(address)}
                  >
                    Edit
                  </StorefrontButton>
                  <StorefrontButton
                    variant="quiet"
                    disabled={command.busy}
                    data-testid={`delete-address-${address.id}`}
                    aria-label={`Delete address for ${address.full_name}`}
                    onClick={() => {
                      setError(null);
                      setRemove(address);
                    }}
                  >
                    Delete
                  </StorefrontButton>
                  {!address.is_default && (
                    <StorefrontButton
                      variant="secondary"
                      disabled={command.busy}
                      data-testid={`set-default-${address.id}`}
                      onClick={() =>
                        void command.run(
                          async (signal) => {
                            const updated = addressesEvidence([
                              await customerApi.updateAddress(
                                address.id,
                                addressBody(address, true),
                                signal,
                              ),
                            ])[0];
                            if (
                              updated?.id !== address.id ||
                              !updated.is_default
                            )
                              throw new ApiError(
                                "The default address could not be verified. Reload your addresses.",
                                0,
                              );
                            if (command.active())
                              accepted("Default address updated.");
                          },
                          (reason) => setError(asAccountError(reason)),
                        )
                      }
                    >
                      Set as default
                    </StorefrontButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ))}
      {editor && (
        <AddressEditor
          key={editor === "new" ? "new" : editor.id}
          address={editor === "new" ? null : editor}
          onClose={() => setEditor(null)}
          onSaved={(message) => {
            setEditor(null);
            accepted(message);
          }}
        />
      )}
      <StorefrontOverlay
        open={Boolean(remove)}
        title="Delete this address?"
        description="This removes the saved address. Past order addresses stay on your receipts."
        busy={command.busy}
        error={remove ? error?.message : null}
        onClose={() => {
          setRemove(null);
          setError(null);
        }}
      >
        {remove && (
          <>
            <p>
              {remove.full_name} · {remove.line1}
            </p>
            <div className="sf-account-actions">
              <StorefrontButton
                variant="secondary"
                onClick={() => setRemove(null)}
              >
                Keep address
              </StorefrontButton>
              <StorefrontButton
                variant="danger"
                busy={command.busy}
                onClick={() =>
                  void command.run(
                    async (signal) => {
                      await customerApi.deleteAddress(remove.id, signal);
                      if (command.active()) {
                        setRemove(null);
                        accepted("Address removed.");
                      }
                    },
                    (reason) => setError(asAccountError(reason)),
                  )
                }
              >
                Delete address
              </StorefrontButton>
            </div>
          </>
        )}
      </StorefrontOverlay>
    </>
  );
}
export function AddressDisplay({
  address,
  includeName = true,
}: {
  includeName?: boolean;
  address: Partial<CustomerAddress> | Record<string, unknown>;
}) {
  return (
    <address className="sf-account-address-text">
      {[
        includeName ? address.full_name : null,
        address.line1,
        address.line2,
        [address.city, address.state, address.postal_code]
          .filter(Boolean)
          .join(", "),
        address.country,
        address.phone,
      ]
        .filter((value) => typeof value === "string" && value)
        .map((value, index) => (
          <p key={index}>{String(value)}</p>
        ))}
    </address>
  );
}
function addressBody(address: CustomerAddress, isDefault = address.is_default) {
  return {
    ...Object.fromEntries(
      Object.keys(addressFields).map((key) => [
        key,
        address[key as keyof Address],
      ]),
    ),
    is_default: isDefault,
  };
}
function AddressEditor({
  address,
  onClose,
  onSaved,
}: {
  address: CustomerAddress | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const command = useAccountCommand();
  const [values, setValues] = useState<Address>(
    address ? { ...emptyAddress, ...address } : emptyAddress,
  );
  const [isDefault, setIsDefault] = useState(address?.is_default ?? false);
  const [error, setError] = useState<ApiError | null>(null);
  const [validation, setValidation] = useState<Record<string, string>>({});
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const body = Object.fromEntries(
      Object.entries(addressFields).map(([key]) => [
        key,
        values[key as keyof Address].trim(),
      ]),
    ) as Address;
    const errors = addressErrors(body);
    setValidation(errors);
    if (Object.keys(errors).length) {
      setError(new ApiError("Check the highlighted address fields.", 0));
      return;
    }
    await command.run(
      async (signal) => {
        const result = addressesEvidence([
          await (address
            ? customerApi.updateAddress(
                address.id,
                { ...body, is_default: isDefault },
                signal,
              )
            : customerApi.createAddress(
                { ...body, is_default: isDefault },
                signal,
              )),
        ])[0];
        if (!result || (address && result.id !== address.id))
          throw new ApiError(
            "The saved address could not be verified. Reload your addresses.",
            0,
          );
        if (command.active())
          onSaved(
            address
              ? "Address updated successfully."
              : "Address added successfully.",
          );
      },
      (reason) => setError(asAccountError(reason)),
    );
  }
  const testNames = {
    full_name: "fullname",
    phone: "phone",
    line1: "line1",
    line2: "line2",
    city: "city",
    state: "state",
    postal_code: "postal",
    country: "country",
  };
  return (
    <StorefrontOverlay
      open
      title={address ? "Edit address" : "Add new address"}
      description="Recipient and delivery details."
      busy={command.busy}
      error={error?.message}
      onClose={onClose}
    >
      <form onSubmit={submit} data-testid="address-form">
        <div className="sf-account-fields">
          {Object.entries(addressFields).map(([key, field]) => (
            <StorefrontInput
              key={key}
              name={key}
              label={field.label}
              type={key === "phone" ? "tel" : "text"}
              autoComplete={field.autocomplete}
              required={key !== "line2"}
              maxLength={field.maximum}
              hint={
                key === "country"
                  ? "Two-letter country code, e.g. US or NP."
                  : undefined
              }
              value={values[key as keyof Address]}
              data-testid={`address-input-${testNames[key as keyof Address]}`}
              error={validation[key] ?? fieldError(error, key)}
              onChange={(event) =>
                setValues({
                  ...values,
                  [key]:
                    key === "country"
                      ? event.target.value.toUpperCase()
                      : event.target.value,
                })
              }
            />
          ))}
        </div>
        <label className="sf-account-check">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(event) => setIsDefault(event.target.checked)}
          />
          Use as my default address
        </label>
        <div className="sf-account-actions">
          <StorefrontButton variant="secondary" onClick={onClose}>
            Cancel
          </StorefrontButton>
          <StorefrontButton
            type="submit"
            busy={command.busy}
            data-testid="save-address-submit"
          >
            {command.busy ? "Saving..." : "Save address"}
          </StorefrontButton>
        </div>
      </form>
    </StorefrontOverlay>
  );
}
