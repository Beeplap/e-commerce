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

// Phase 10: Staff management
export interface StaffMember {
  id: string;
  user: { id: string; email: string; first_name: string; last_name: string };
  role: { id: string; name: string; is_owner: boolean };
  status: "invited" | "active" | "suspended";
  permissions: string[];
  joined_at: string | null;
  invited_at: string;
}

export interface SellerRole {
  id: string;
  name: string;
  is_system: boolean;
  is_owner: boolean;
  permissions: string[];
}

// Phase 10: Promotions
export interface Promotion {
  id: string;
  name: string;
  description: string;
  scope: "PLATFORM" | "SELLER";
  discount_type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
  discount_value: string;
  minimum_order_amount: string | null;
  maximum_discount_amount: string | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  usage_limit: number | null;
  usage_count: number;
  created_at: string;
}

export interface Coupon {
  id: string;
  promotion: { id: string; name: string };
  code: string;
  usage_limit: number | null;
  usage_count: number;
  per_customer_limit: number | null;
  is_active: boolean;
  created_at: string;
}

// Phase 10: Reviews
export interface ProductReview {
  id: string;
  product: { id: string; name: string };
  customer: { id: string; email: string };
  rating: number;
  title: string;
  body: string;
  status: "pending" | "published" | "rejected" | "removed";
  verified_purchase: boolean;
  seller_response: string | null;
  seller_response_at: string | null;
  created_at: string;
}

// Phase 10: Notifications
export interface Notification {
  id: string;
  title: string;
  body: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export interface NotificationUnreadCount {
  count: number;
}
