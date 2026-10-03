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

// Phase 11: Analytics & Dashboards
export interface DateRange {
  start_date: string;
  end_date: string;
}

export interface SalesOverTimePoint {
  date: string;
  gross_sales: string;
  net_sales: string;
  orders_count: number;
}

export interface TopProduct {
  id: string;
  name: string;
  units_sold: number;
  revenue: string;
}

export interface PayoutInfo {
  total_paid_out: string;
  last_payout_amount: string | null;
  last_payout_status: string | null;
  last_payout_date: string | null;
}

export interface SellerDashboardMetrics {
  date_range: DateRange;
  gross_sales: string;
  net_sales: string;
  orders_count: number;
  average_order_value: string;
  units_sold: number;
  pending_orders: number;
  low_stock_variants: number;
  returns_count: number;
  platform_fees: string;
  available_balance: string;
  pending_balance: string;
  payout_info: PayoutInfo;
  top_products: TopProduct[];
  sales_over_time: SalesOverTimePoint[];
}

export interface PlatformSalesOverTimePoint {
  date: string;
  gmv: string;
  platform_revenue: string;
  orders_count: number;
}

export interface TopCategory {
  id: string;
  name: string;
  units_sold: number;
  revenue: string;
}

export interface TopSeller {
  id: string;
  name: string;
  gross_sales: string;
  orders_count: number;
}

export interface PlatformDashboardMetrics {
  date_range: DateRange;
  gmv: string;
  platform_revenue: string;
  commission_revenue: string;
  orders_count: number;
  active_sellers: number;
  pending_seller_approvals: number;
  customers_count: number;
  refund_rate: number;
  return_rate: number;
  average_order_value: string;
  outstanding_seller_balances: string;
  upcoming_payouts: string;
  new_seller_registrations: number;
  top_categories: TopCategory[];
  top_sellers: TopSeller[];
  sales_over_time: PlatformSalesOverTimePoint[];
}

// Phase 17: Storefront Interfaces
export interface StorefrontCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  parent_id: string | null;
  product_count: number;
}

export interface StorefrontBrand {
  id: string;
  name: string;
  slug: string;
  product_count: number;
}

export interface StorefrontSellerBadge {
  id: string;
  name: string;
  store_name: string;
  rating: number | null;
}

export interface StorefrontProductCard {
  id: string;
  title: string;
  slug: string;
  short_description: string;
  category_id: string;
  category_name: string;
  brand_id: string | null;
  brand_name: string | null;
  starting_price: string;
  compare_at_price: string | null;
  currency: string;
  thumbnail_url: string | null;
  in_stock: boolean;
  average_rating: number | null;
  review_count: number;
  seller: StorefrontSellerBadge;
}

export interface StorefrontVariant {
  id: string;
  sku: string;
  price: string;
  compare_at_price: string | null;
  in_stock: boolean;
  available_quantity: number;
  attributes: Record<string, string>;
}

export interface StorefrontImage {
  id: string;
  url: string;
  alt_text: string;
  sort_order: number;
}

export interface StorefrontReview {
  id: string;
  customer_name: string;
  rating: number;
  title: string;
  body: string;
  verified_purchase: boolean;
  created_at: string;
  seller_response: string | null;
  seller_response_at: string | null;
}

export interface StorefrontProductDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  short_description: string;
  category: StorefrontCategory;
  brand: StorefrontBrand | null;
  seller: StorefrontSellerBadge;
  starting_price: string;
  compare_at_price: string | null;
  currency: string;
  in_stock: boolean;
  total_available_stock: number;
  average_rating: number | null;
  review_count: number;
  rating_breakdown: Record<string, number>;
  images: StorefrontImage[];
  variants: StorefrontVariant[];
  recent_reviews: StorefrontReview[];
}

export interface StorefrontSellerDetail {
  id: string;
  name: string;
  store_name: string;
  description: string;
  contact_email: string;
  city: string | null;
  state: string | null;
  country: string | null;
  average_rating: number | null;
  total_products: number;
}

export interface StorefrontFacetCategory {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export interface StorefrontFacetBrand {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export interface StorefrontFacetPriceBracket {
  label: string;
  min_price: string;
  max_price: string | null;
  count: number;
}

export interface StorefrontFacetRatingBracket {
  label: string;
  min_rating: number;
  count: number;
}

export interface StorefrontSearchFacets {
  categories: StorefrontFacetCategory[];
  brands: StorefrontFacetBrand[];
  price_brackets: StorefrontFacetPriceBracket[];
  rating_brackets: StorefrontFacetRatingBracket[];
  in_stock_count: number;
}

export interface StorefrontSearchResultPage {
  count: number;
  next: string | null;
  previous: string | null;
  facets: StorefrontSearchFacets;
  results: StorefrontProductCard[];
}

export interface StorefrontSuggestProduct {
  id: string;
  title: string;
  slug: string;
  starting_price: string;
  currency: string;
  thumbnail_url: string | null;
  category_name: string;
}

export interface StorefrontSuggestResponse {
  query: string;
  suggestions: string[];
  categories: StorefrontCategory[];
  brands: StorefrontBrand[];
  products: StorefrontSuggestProduct[];
}

export interface CartItem {
  id: string;
  variant_id: string;
  product_id: string;
  product_title: string;
  product_slug: string;
  variant_name: string;
  sku: string;
  thumbnail_url: string | null;
  unit_price: string;
  compare_at_price: string | null;
  quantity: number;
  line_subtotal: string;
  available_stock: number;
  is_available: boolean;
  stock_warning: string | null;
}

export interface SellerCartGroup {
  seller_id: string;
  seller_name: string;
  seller_slug: string;
  subtotal: string;
  item_count: number;
  items: CartItem[];
}

export interface CartResponse {
  id: string;
  total_items: number;
  total_unique_items: number;
  subtotal: string;
  currency: string;
  has_out_of_stock_items: boolean;
  sellers: SellerCartGroup[];
}

export interface CartStockIssue {
  item_id: string;
  variant_id: string;
  sku: string;
  requested_quantity: number;
  available_stock: number;
  issue: string;
  message: string;
}

export interface CartStockValidationResponse {
  valid: boolean;
  issues: CartStockIssue[];
}

export interface AddToCartInput {
  variant_id: string;
  quantity?: number;
}

export interface CouponValidationResult {
  valid: boolean;
  discount_amount: string;
  error_message: string | null;
  coupon: Coupon | null;
  promotion: Promotion | null;
}

export interface CustomerAddress {
  id: string;
  full_name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShippingOption {
  method_id: string;
  name: string;
  carrier: string;
  code: string;
  min_days: number;
  max_days: number;
  rate: string;
}

export interface CheckoutQuoteItem {
  item_id: string;
  variant_id: string;
  product_id: string;
  product_title: string;
  sku: string;
  quantity: number;
  unit_price: string;
  line_subtotal: string;
  available_stock: number;
  is_in_stock: boolean;
}

export interface CheckoutQuoteSeller {
  seller_id: string;
  seller_name: string;
  seller_slug: string;
  subtotal: string;
  shipping_fee: string;
  discount_amount: string;
  tax_amount: string;
  total: string;
  available_shipping_methods: ShippingOption[];
  selected_shipping_method: ShippingOption | null;
  items: CheckoutQuoteItem[];
}

export interface CheckoutQuote {
  total_items: number;
  subtotal: string;
  shipping_total: string;
  discount_total: string;
  tax_total: string;
  grand_total: string;
  currency: string;
  coupon: {
    code: string | null;
    is_valid: boolean;
    discount_amount: string;
    error_message: string | null;
  };
  sellers: CheckoutQuoteSeller[];
}

export interface PlacedSellerOrder {
  id: string;
  seller_order_number: string;
  seller_name: string;
  subtotal: string;
  shipping_total: string;
  seller_net_total: string;
}

export interface PlacedOrderResult {
  order_id: string;
  order_number: string;
  customer_email: string;
  grand_total: string;
  currency: string;
  payment_status: string;
  seller_orders: PlacedSellerOrder[];
  payment_instructions: {
    type?: string;
    order_id?: string;
    status?: string;
    client_secret?: string;
    [key: string]: unknown;
  };
}

export interface CheckoutQuoteInput {
  shipping_address?: Partial<CustomerAddress>;
  address_id?: string | null;
  shipping_selections?: Record<string, string>;
  coupon_code?: string | null;
}

export interface PlaceOrderInput {
  shipping_address?: Partial<CustomerAddress>;
  address_id?: string | null;
  billing_address?: Partial<CustomerAddress> | null;
  customer_email?: string | null;
  shipping_selections?: Record<string, string>;
  coupon_code?: string | null;
  idempotency_key?: string | null;
}
