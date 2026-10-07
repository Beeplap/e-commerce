"use client";

import { useCallback, useState, type FormEvent } from "react";
import {
  StorefrontButton,
  StorefrontInput,
} from "@/components/storefront/controls";
import { StorefrontNotice } from "@/components/storefront/feedback";
import { DateDisplay } from "@/components/ui/displays";
import { useAuth } from "@/features/auth/auth-provider";
import { ApiError, authApi, customerApi } from "@/lib/api/client";
import type { CustomerProfile } from "@/lib/api/types";
import { useApiQuery } from "@/lib/api/use-api-query";
import { profileEvidence } from "./evidence";
import { AccountFrame } from "./frame";
import {
  AccountError,
  AccountLoading,
  AccountStatus,
  asAccountError,
  fieldError,
  useAccountCommand,
} from "./shared";

export function CustomerProfilePage() {
  const [notice, setNotice] = useState<{
    userId: string;
    message: string;
  } | null>(null);
  return (
    <AccountFrame
      title="Profile & Security"
      description="Personal details and your sign-in password."
    >
      {(user) => (
        <ProfileRead
          userId={user.id}
          notice={notice?.userId === user.id ? notice.message : null}
          onSaved={() =>
            setNotice({
              userId: user.id,
              message: "Your profile has been updated successfully.",
            })
          }
        />
      )}
    </AccountFrame>
  );
}
function ProfileRead({
  userId,
  notice,
  onSaved,
}: {
  userId: string;
  notice: string | null;
  onSaved: () => void;
}) {
  const load = useCallback(
    async (signal: AbortSignal) =>
      profileEvidence(await customerApi.getProfile(signal), userId),
    [userId],
  );
  const query = useApiQuery(userId + ":profile", load);
  if (query.kind === "loading")
    return <AccountLoading label="Loading profile" />;
  if (query.kind === "error")
    return <AccountError error={query.error} onRetry={query.retry} />;
  return (
    <ProfileEditor profile={query.data} notice={notice} onSaved={onSaved} />
  );
}
function ProfileEditor({
  profile,
  notice,
  onSaved,
}: {
  profile: CustomerProfile;
  notice: string | null;
  onSaved: () => void;
}) {
  const { refresh } = useAuth();
  const command = useAccountCommand();
  const [values, setValues] = useState({
    first_name: profile.first_name,
    last_name: profile.last_name,
    email: profile.email,
    phone: profile.phone,
  });
  const [error, setError] = useState<ApiError | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    await command.run(
      async (signal) => {
        // Blank names are omitted when unchanged: the existing serializer disallows explicit blanks.
        const body = Object.fromEntries(
          Object.entries(values).filter(
            ([key, value]) => value !== profile[key as keyof typeof values],
          ),
        );
        profileEvidence(
          await customerApi.updateProfile(body, signal),
          profile.id,
        );
        if (!command.active()) return;
        onSaved();
        await refresh();
      },
      (reason) => setError(asAccountError(reason)),
    );
  }
  return (
    <>
      <section
        className="sf-account-section"
        aria-labelledby="personal-heading"
      >
        <h2 id="personal-heading">Personal information</h2>
        <p>Your contact details for orders and receipts.</p>
        <div className="sf-account-verification">
          <span>Email verification</span>
          <AccountStatus
            status={profile.is_email_verified ? "verified" : "unverified"}
          />
        </div>
        {!profile.is_email_verified && (
          <p className="sf-account-help">
            Your email is not verified. Email verification requests are not
            available here yet.
          </p>
        )}
        {notice && <StorefrontNotice tone="success">{notice}</StorefrontNotice>}
        {error && <AccountError error={error} />}
        <form
          onSubmit={submit}
          data-testid="profile-form"
          aria-busy={command.busy}
        >
          <fieldset disabled={command.busy} className="sf-account-fields">
            {(
              [
                {
                  key: "first_name",
                  label: "First Name",
                  autocomplete: "given-name",
                  maximum: 150,
                  test: "firstname",
                },
                {
                  key: "last_name",
                  label: "Last Name",
                  autocomplete: "family-name",
                  maximum: 150,
                  test: "lastname",
                },
                {
                  key: "email",
                  label: "Email Address",
                  autocomplete: "email",
                  maximum: 254,
                  test: "email",
                },
                {
                  key: "phone",
                  label: "Phone Number",
                  autocomplete: "tel",
                  maximum: 32,
                  test: "phone",
                },
              ] as const
            ).map((field) => (
              <StorefrontInput
                key={field.key}
                name={field.key}
                label={field.label}
                type={
                  field.key === "email"
                    ? "email"
                    : field.key === "phone"
                      ? "tel"
                      : "text"
                }
                autoComplete={field.autocomplete}
                maxLength={field.maximum}
                required={field.key === "email"}
                value={values[field.key]}
                onChange={(event) =>
                  setValues({ ...values, [field.key]: event.target.value })
                }
                error={fieldError(error, field.key)}
                data-testid={`profile-input-${field.test}`}
              />
            ))}
          </fieldset>
          <div className="sf-account-form-footer">
            <small>
              Member since <DateDisplay value={profile.created_at} />
            </small>
            <StorefrontButton
              type="submit"
              busy={command.busy}
              data-testid="profile-save-button"
            >
              {command.busy ? "Saving..." : "Save Changes"}
            </StorefrontButton>
          </div>
        </form>
      </section>
      <PasswordForm />
    </>
  );
}
function PasswordForm() {
  const command = useAccountCommand();
  const [error, setError] = useState<ApiError | null>(null);
  const [success, setSuccess] = useState(false);
  const [validation, setValidation] = useState<Record<string, string>>({});
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (command.busy) return;
    const form = event.currentTarget,
      values = new FormData(form);
    const current = String(values.get("old_password") ?? ""),
      next = String(values.get("new_password") ?? ""),
      confirm = String(values.get("confirm_password") ?? "");
    setError(null);
    setSuccess(false);
    const errors: Record<string, string> = {};
    if (next.length < 12) errors.new_password = "Use at least 12 characters.";
    if (next !== confirm)
      errors.confirm_password = "New password and confirmation do not match.";
    setValidation(errors);
    if (Object.keys(errors).length) {
      form.reset();
      return;
    }
    await command.run(
      async () => {
        await authApi.changePassword(current, next);
        if (command.active()) setSuccess(true);
      },
      (reason) => setError(asAccountError(reason)),
    );
    // Clear all raw password fields after accepted or rejected commands, including unmounted forms.
    form.reset();
  }
  return (
    <section className="sf-account-section" aria-labelledby="security-heading">
      <h2 id="security-heading">Account Security</h2>
      <p>
        Change your password. Your current session stays signed in; other
        sessions are signed out.
      </p>
      {error && <AccountError error={error} />}
      {success && (
        <StorefrontNotice tone="success">
          Your password has been changed successfully.
        </StorefrontNotice>
      )}
      <form
        onSubmit={submit}
        data-testid="password-form"
        aria-busy={command.busy}
      >
        <fieldset
          disabled={command.busy}
          className="sf-account-password-fields"
        >
          {(
            [
              {
                name: "old_password",
                label: "Current Password",
                test: "current",
              },
              { name: "new_password", label: "New Password", test: "new" },
              {
                name: "confirm_password",
                label: "Confirm New Password",
                test: "confirm",
              },
            ] as const
          ).map((field) => (
            <StorefrontInput
              key={field.name}
              type="password"
              name={field.name}
              label={field.label}
              autoComplete={
                field.name === "old_password"
                  ? "current-password"
                  : "new-password"
              }
              required
              maxLength={1024}
              hint={
                field.name === "new_password"
                  ? "At least 12 characters. Avoid common passwords and personal details."
                  : undefined
              }
              error={validation[field.name] ?? fieldError(error, field.name)}
              data-testid={`password-input-${field.test}`}
            />
          ))}
        </fieldset>
        <div className="sf-account-actions">
          <StorefrontButton
            type="submit"
            busy={command.busy}
            data-testid="password-save-button"
          >
            {command.busy ? "Changing password..." : "Change password"}
          </StorefrontButton>
        </div>
        {Object.keys(validation).length > 0 && (
          <AccountError message="Check the highlighted password fields." />
        )}
      </form>
    </section>
  );
}
