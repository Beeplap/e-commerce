"use client";

import React, { useEffect, useState } from "react";
import { WorkspaceFrame } from "@/features/workspaces/workspace-frame";
import { customerApi } from "@/lib/api/client";
import type { CustomerAddress } from "@/lib/api/types";

interface AddressFormData {
  full_name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}

const emptyFormData: AddressFormData = {
  full_name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "US",
  is_default: false,
};

export default function CustomerAddressesPage() {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AddressFormData>(emptyFormData);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadAddresses = (signal?: AbortSignal) => {
    setLoading(true);
    customerApi
      .getAddresses(signal)
      .then((data) => {
        setAddresses(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setError("Failed to load your addresses.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const abort = new AbortController();
    customerApi
      .getAddresses(abort.signal)
      .then((data) => {
        setAddresses(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setError("Failed to load your addresses.");
      })
      .finally(() => setLoading(false));

    return () => abort.abort();
  }, []);

  const openAddModal = () => {
    setEditingAddressId(null);
    setFormData(emptyFormData);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (addr: CustomerAddress) => {
    setEditingAddressId(addr.id);
    setFormData({
      full_name: addr.full_name,
      phone: addr.phone,
      line1: addr.line1,
      line2: addr.line2 || "",
      city: addr.city,
      state: addr.state,
      postal_code: addr.postal_code,
      country: addr.country,
      is_default: addr.is_default,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAddressId(null);
    setFormData(emptyFormData);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    try {
      if (editingAddressId) {
        await customerApi.updateAddress(editingAddressId, formData);
        setSuccessMessage("Address updated successfully.");
      } else {
        await customerApi.createAddress(formData);
        setSuccessMessage("Address added successfully.");
      }
      closeModal();
      loadAddresses();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError("Failed to save address. Please check your input.");
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (addressId: string) => {
    if (!window.confirm("Are you sure you want to delete this address?"))
      return;
    try {
      await customerApi.deleteAddress(addressId);
      setSuccessMessage("Address removed.");
      loadAddresses();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to delete address.");
      }
    }
  };

  const handleSetDefault = async (addressId: string) => {
    try {
      await customerApi.updateAddress(addressId, { is_default: true });
      setSuccessMessage("Default address updated.");
      loadAddresses();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to set default address.");
      }
    }
  };

  return (
    <WorkspaceFrame mode="account">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 sm:text-2xl">
            Saved Addresses
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Manage your delivery and billing locations for faster checkout.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          data-testid="add-address-button"
          className="inline-flex items-center justify-center rounded-xl bg-teal-800 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-teal-900 transition"
        >
          + Add New Address
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800"
        >
          {error}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800"
        >
          {successMessage}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">
          Loading addresses...
        </div>
      ) : addresses.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <h2 className="text-base font-bold text-slate-900">
            No saved addresses
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Add your primary shipping and billing addresses for one-click
            checkout.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={openAddModal}
              className="rounded-xl bg-teal-800 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-teal-900 transition"
            >
              Add First Address
            </button>
          </div>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          data-testid="addresses-list"
        >
          {addresses.map((addr) => (
            <div
              key={addr.id}
              data-testid={`address-card-${addr.id}`}
              className={`rounded-2xl border bg-white p-6 shadow-sm flex flex-col justify-between transition ${
                addr.is_default
                  ? "border-teal-700 ring-1 ring-teal-700"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-900 text-sm">
                    {addr.full_name}
                  </h3>
                  {addr.is_default && (
                    <span
                      data-testid="default-badge"
                      className="inline-flex rounded-full bg-teal-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-800"
                    >
                      Default
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <p>{addr.line1}</p>
                  {addr.line2 && <p>{addr.line2}</p>}
                  <p>
                    {addr.city}, {addr.state} {addr.postal_code}
                  </p>
                  <p className="text-slate-400">{addr.country}</p>
                  <p className="pt-2 text-slate-500 font-mono text-[11px]">
                    Phone: {addr.phone}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openEditModal(addr)}
                    data-testid={`edit-address-${addr.id}`}
                    className="font-semibold text-teal-800 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(addr.id)}
                    data-testid={`delete-address-${addr.id}`}
                    className="font-semibold text-rose-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>

                {!addr.is_default && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(addr.id)}
                    data-testid={`set-default-${addr.id}`}
                    className="text-slate-500 hover:text-slate-900 font-medium"
                  >
                    Set as default
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Address Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            <h2 className="text-lg font-black text-slate-900">
              {editingAddressId ? "Edit Address" : "Add New Address"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Enter recipient and delivery location details.
            </p>

            {formError && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
              >
                {formError}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="mt-5 space-y-4"
              data-testid="address-form"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Recipient Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    data-testid="address-input-fullname"
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    data-testid="address-input-phone"
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                    placeholder="+1 555-0100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Street Address (Line 1) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.line1}
                  onChange={(e) =>
                    setFormData({ ...formData, line1: e.target.value })
                  }
                  data-testid="address-input-line1"
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                  placeholder="123 Market St"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Apt, Suite, Unit (Line 2)
                </label>
                <input
                  type="text"
                  value={formData.line2}
                  onChange={(e) =>
                    setFormData({ ...formData, line2: e.target.value })
                  }
                  data-testid="address-input-line2"
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                  placeholder="Suite 400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    data-testid="address-input-city"
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                    placeholder="San Francisco"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    State / Prov *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) =>
                      setFormData({ ...formData, state: e.target.value })
                    }
                    data-testid="address-input-state"
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                    placeholder="CA"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Postal Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.postal_code}
                    onChange={(e) =>
                      setFormData({ ...formData, postal_code: e.target.value })
                    }
                    data-testid="address-input-postal"
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                    placeholder="94105"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Country Code *
                </label>
                <input
                  type="text"
                  required
                  value={formData.country}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      country: e.target.value.toUpperCase(),
                    })
                  }
                  data-testid="address-input-country"
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                  placeholder="US"
                  maxLength={2}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={(e) =>
                    setFormData({ ...formData, is_default: e.target.checked })
                  }
                  data-testid="address-input-isdefault"
                  className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
                />
                <label
                  htmlFor="is_default"
                  className="text-xs font-medium text-slate-700 cursor-pointer"
                >
                  Make this my default shipping address
                </label>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  data-testid="save-address-submit"
                  className="rounded-xl bg-teal-800 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-900 disabled:opacity-50 transition"
                >
                  {formSubmitting
                    ? "Saving..."
                    : editingAddressId
                      ? "Update Address"
                      : "Save Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </WorkspaceFrame>
  );
}
