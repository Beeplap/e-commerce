export interface CurrentUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_email_verified: boolean;
  platform_permissions: string[];
}

export interface SellerSummary {
  id: string;
  display_name: string;
  slug: string;
  status: "pending" | "active" | "suspended" | "rejected" | "closed";
  verification_status: "pending" | "verified" | "rejected";
  default_currency: string;
  timezone: string;
}

export interface SellerMembership {
  id: string;
  seller: SellerSummary;
  role: { id: string; name: string; is_owner: boolean };
  status: "invited" | "active" | "suspended";
  permissions: string[];
}

export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type FieldErrors = Record<string, string[]>;
