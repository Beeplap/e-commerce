"use client";

import React, { useEffect, useState } from "react";
import { WorkspaceFrame } from "@/features/workspaces/workspace-frame";
import { authApi, customerApi } from "@/lib/api/client";
import type { CustomerProfile } from "@/lib/api/types";

export default function CustomerProfilePage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Profile Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    customerApi
      .getProfile(abort.signal)
      .then((data) => {
        setProfile(data);
        setFirstName(data.first_name || "");
        setLastName(data.last_name || "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setError("Failed to load your profile details.");
      })
      .finally(() => setLoading(false));

    return () => abort.abort();
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSubmitting(true);
    setError(null);
    setProfileSuccess(null);

    try {
      const updated = await customerApi.updateProfile({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
      });
      setProfile(updated);
      setProfileSuccess("Your profile has been updated successfully.");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to update profile. Please verify your input.");
      }
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    setPasswordSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setPasswordSuccess("Your password has been changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setPasswordError(err.message);
      } else {
        setPasswordError(
          "Failed to change password. Verify your current password.",
        );
      }
    } finally {
      setPasswordSubmitting(false);
    }
  };

  return (
    <WorkspaceFrame mode="account">
      <div className="mb-6">
        <h1 className="text-xl font-black text-slate-900 sm:text-2xl">
          Profile & Security
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Manage your personal details, contact information, and account
          security.
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">
          Loading profile...
        </div>
      ) : (
        <div className="space-y-8 max-w-3xl">
          {/* Personal Details Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4 mb-6">
              <h2 className="text-base font-bold text-slate-900">
                Personal Information
              </h2>
              <p className="text-xs text-slate-500">
                Your contact information used for orders and receipts.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
              >
                {error}
              </div>
            )}

            {profileSuccess && (
              <div
                role="status"
                className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"
              >
                {profileSuccess}
              </div>
            )}

            <form
              onSubmit={handleProfileSubmit}
              className="space-y-4"
              data-testid="profile-form"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    data-testid="profile-input-firstname"
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    data-testid="profile-input-lastname"
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      Email Address *
                    </label>
                    {profile?.is_email_verified && (
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Verified
                      </span>
                    )}
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="profile-input-email"
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                    placeholder="jane@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    data-testid="profile-input-phone"
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                    placeholder="+1 555-0100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">
                  Member since:{" "}
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString()
                    : "—"}
                </span>
                <button
                  type="submit"
                  disabled={profileSubmitting}
                  data-testid="profile-save-button"
                  className="rounded-xl bg-teal-800 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-900 disabled:opacity-50 transition"
                >
                  {profileSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4 mb-6">
              <h2 className="text-base font-bold text-slate-900">
                Account Security
              </h2>
              <p className="text-xs text-slate-500">
                Update your login password regularly to protect your account.
              </p>
            </div>

            {passwordError && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
              >
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div
                role="status"
                className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"
              >
                {passwordSuccess}
              </div>
            )}

            <form
              onSubmit={handlePasswordSubmit}
              className="space-y-4 max-w-md"
              data-testid="password-form"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Current Password *
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  data-testid="password-input-current"
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  data-testid="password-input-new"
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                  placeholder="••••••••"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Must be at least 8 characters.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  data-testid="password-input-confirm"
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={passwordSubmitting}
                  data-testid="password-save-button"
                  className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 transition"
                >
                  {passwordSubmitting ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </WorkspaceFrame>
  );
}
