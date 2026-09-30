import type { CurrentUser, SellerMembership } from "../api/types";

export function hasPlatformPermission(
  user: CurrentUser | null,
  capability: string,
): boolean {
  return user?.platform_permissions.includes(capability) ?? false;
}

export function hasSellerPermission(
  membership: SellerMembership | null,
  capability: string,
  allowPending = false,
): boolean {
  return (
    membership?.status === "active" &&
    (membership.seller.status === "active" ||
      (allowPending && membership.seller.status === "pending")) &&
    membership.permissions.includes(capability)
  );
}
