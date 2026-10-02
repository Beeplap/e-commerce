import { apiRequest } from "@/lib/api/client";
import { isUuid, record } from "@/lib/api/validation";
import { pageParser } from "@/features/sellers/api";
import type { Page } from "@/lib/api/types";

export type LedgerEntryType =
  "SALE" | "COMMISSION" | "REFUND" | "PAYOUT" | "ADJUSTMENT";

export type PayoutStatus = "PENDING" | "APPROVED" | "PROCESSED" | "REJECTED";

export interface SellerBalance {
  seller_id: string;
  currency: string;
  current_balance: string;
  pending_balance: string;
  total_paid_out: string;
  updated_at: string;
}

export interface SellerLedgerEntry {
  id: string;
  seller_id: string;
  entry_type: LedgerEntryType;
  amount: string;
  balance_after: string;
  currency: string;
  seller_order_id: string | null;
  seller_order_number: string | null;
  payout_id: string | null;
  payout_number: string | null;
  payment_reference: string;
  payout_reference: string;
  description: string;
  created_at: string;
}

export interface Payout {
  id: string;
  payout_number: string;
  seller_id: string;
  seller_name: string;
  amount: string;
  currency: string;
  status: PayoutStatus;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  approved_at: string | null;
  processed_at: string | null;
  created_by_email: string | null;
  approved_by_email: string | null;
  processed_by_email: string | null;
  notes: string;
  rejection_reason: string;
}

export interface CommissionRule {
  id: string;
  plan_id: string;
  seller_id: string | null;
  seller_name: string | null;
  category_id: string | null;
  category_name: string | null;
  percentage: string;
  fixed_fee: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommissionPlan {
  id: string;
  name: string;
  description: string;
  default_percentage: string;
  is_active: boolean;
  is_default: boolean;
  rules_count: number;
  rules: CommissionRule[];
  created_at: string;
  updated_at: string;
}

export interface AdminFinanceSummary {
  total_gross_sales: string;
  total_commissions: string;
  total_available_balances: string;
  total_pending_balances: string;
  total_paid_out: string;
  pending_payouts_count: number;
  active_plans_count: number;
}

export interface AdminSellerBalance {
  seller_id: string;
  seller_name: string;
  seller_slug: string;
  currency: string;
  current_balance: string;
  pending_balance: string;
  total_paid_out: string;
  updated_at: string;
}

function object(value: unknown): Record<string, unknown> {
  if (!record(value)) throw new Error("A valid JSON object is required.");
  return value;
}

export function parseSellerBalance(value: unknown): SellerBalance {
  const row = object(value);
  if (!isUuid(row.seller_id)) throw new Error("A valid seller_id is required.");
  return {
    seller_id: String(row.seller_id),
    currency: String(row.currency ?? "USD"),
    current_balance: String(row.current_balance ?? "0.00"),
    pending_balance: String(row.pending_balance ?? "0.00"),
    total_paid_out: String(row.total_paid_out ?? "0.00"),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function parseSellerLedgerEntry(value: unknown): SellerLedgerEntry {
  const row = object(value);
  if (!isUuid(row.id)) throw new Error("A valid id is required.");
  return {
    id: String(row.id),
    seller_id: String(row.seller_id),
    entry_type: row.entry_type as LedgerEntryType,
    amount: String(row.amount ?? "0.00"),
    balance_after: String(row.balance_after ?? "0.00"),
    currency: String(row.currency ?? "USD"),
    seller_order_id: row.seller_order_id ? String(row.seller_order_id) : null,
    seller_order_number: row.seller_order_number
      ? String(row.seller_order_number)
      : null,
    payout_id: row.payout_id ? String(row.payout_id) : null,
    payout_number: row.payout_number ? String(row.payout_number) : null,
    payment_reference: String(row.payment_reference ?? ""),
    payout_reference: String(row.payout_reference ?? ""),
    description: String(row.description ?? ""),
    created_at: String(row.created_at ?? ""),
  };
}

export function parsePayout(value: unknown): Payout {
  const row = object(value);
  if (!isUuid(row.id)) throw new Error("A valid id is required.");
  return {
    id: String(row.id),
    payout_number: String(row.payout_number),
    seller_id: String(row.seller_id),
    seller_name: String(row.seller_name ?? ""),
    amount: String(row.amount ?? "0.00"),
    currency: String(row.currency ?? "USD"),
    status: row.status as PayoutStatus,
    period_start: row.period_start ? String(row.period_start) : null,
    period_end: row.period_end ? String(row.period_end) : null,
    created_at: String(row.created_at ?? ""),
    approved_at: row.approved_at ? String(row.approved_at) : null,
    processed_at: row.processed_at ? String(row.processed_at) : null,
    created_by_email: row.created_by_email
      ? String(row.created_by_email)
      : null,
    approved_by_email: row.approved_by_email
      ? String(row.approved_by_email)
      : null,
    processed_by_email: row.processed_by_email
      ? String(row.processed_by_email)
      : null,
    notes: String(row.notes ?? ""),
    rejection_reason: String(row.rejection_reason ?? ""),
  };
}

export function parseCommissionRule(value: unknown): CommissionRule {
  const row = object(value);
  if (!isUuid(row.id)) throw new Error("A valid id is required.");
  return {
    id: String(row.id),
    plan_id: String(row.plan_id),
    seller_id: row.seller_id ? String(row.seller_id) : null,
    seller_name: row.seller_name ? String(row.seller_name) : null,
    category_id: row.category_id ? String(row.category_id) : null,
    category_name: row.category_name ? String(row.category_name) : null,
    percentage: String(row.percentage ?? "0.00"),
    fixed_fee: String(row.fixed_fee ?? "0.00"),
    priority: Number(row.priority ?? 0),
    is_active: Boolean(row.is_active ?? true),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function parseCommissionPlan(value: unknown): CommissionPlan {
  const row = object(value);
  if (!isUuid(row.id)) throw new Error("A valid id is required.");
  const rawRules = Array.isArray(row.rules) ? row.rules : [];
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    default_percentage: String(row.default_percentage ?? "10.00"),
    is_active: Boolean(row.is_active ?? true),
    is_default: Boolean(row.is_default ?? false),
    rules_count: Number(row.rules_count ?? rawRules.length),
    rules: rawRules.map(parseCommissionRule),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function parseAdminFinanceSummary(value: unknown): AdminFinanceSummary {
  const row = object(value);
  return {
    total_gross_sales: String(row.total_gross_sales ?? "0.00"),
    total_commissions: String(row.total_commissions ?? "0.00"),
    total_available_balances: String(row.total_available_balances ?? "0.00"),
    total_pending_balances: String(row.total_pending_balances ?? "0.00"),
    total_paid_out: String(row.total_paid_out ?? "0.00"),
    pending_payouts_count: Number(row.pending_payouts_count ?? 0),
    active_plans_count: Number(row.active_plans_count ?? 0),
  };
}

export function parseAdminSellerBalance(value: unknown): AdminSellerBalance {
  const row = object(value);
  if (!isUuid(row.seller_id)) throw new Error("A valid seller_id is required.");
  return {
    seller_id: String(row.seller_id),
    seller_name: String(row.seller_name ?? ""),
    seller_slug: String(row.seller_slug ?? ""),
    currency: String(row.currency ?? "USD"),
    current_balance: String(row.current_balance ?? "0.00"),
    pending_balance: String(row.pending_balance ?? "0.00"),
    total_paid_out: String(row.total_paid_out ?? "0.00"),
    updated_at: String(row.updated_at ?? ""),
  };
}

export const sellerLedgerPageParser = pageParser(parseSellerLedgerEntry);
export const payoutPageParser = pageParser(parsePayout);
export const commissionPlanPageParser = pageParser(parseCommissionPlan);
export const adminSellerBalancePageParser = pageParser(parseAdminSellerBalance);

// --- Seller Finance API ---

export async function getSellerBalance(
  sellerId: string,
  signal?: AbortSignal,
): Promise<SellerBalance> {
  return apiRequest("/api/v1/seller/finance/balance", {
    method: "GET",
    sellerId,
    signal,
    parse: parseSellerBalance,
  });
}

export async function getSellerLedger(
  sellerId: string,
  options?: { page?: number; entry_type?: string },
  signal?: AbortSignal,
): Promise<Page<SellerLedgerEntry>> {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.entry_type) params.set("entry_type", options.entry_type);

  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/api/v1/seller/finance/transactions${query}`, {
    method: "GET",
    sellerId,
    signal,
    parse: sellerLedgerPageParser,
  });
}

export async function getSellerPayouts(
  sellerId: string,
  options?: { page?: number; status?: string },
  signal?: AbortSignal,
): Promise<Page<Payout>> {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.status) params.set("status", options.status);

  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/api/v1/seller/finance/payouts${query}`, {
    method: "GET",
    sellerId,
    signal,
    parse: payoutPageParser,
  });
}

export async function requestPayout(
  sellerId: string,
  data: { amount: string; notes?: string },
): Promise<Payout> {
  return apiRequest("/api/v1/seller/finance/payouts", {
    method: "POST",
    expectedStatus: 201,
    sellerId,
    body: data,
    parse: parsePayout,
  });
}

// --- Platform Admin Finance API ---

export async function getAdminFinanceSummary(
  signal?: AbortSignal,
): Promise<AdminFinanceSummary> {
  return apiRequest("/api/v1/admin/finance/summary", {
    method: "GET",
    signal,
    parse: parseAdminFinanceSummary,
  });
}

export async function getAdminCommissionPlans(
  options?: { page?: number },
  signal?: AbortSignal,
): Promise<Page<CommissionPlan>> {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));

  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/api/v1/admin/finance/commissions/plans${query}`, {
    method: "GET",
    signal,
    parse: commissionPlanPageParser,
  });
}

export async function getAdminCommissionPlan(
  id: string,
  signal?: AbortSignal,
): Promise<CommissionPlan> {
  return apiRequest(`/api/v1/admin/finance/commissions/plans/${id}`, {
    method: "GET",
    signal,
    parse: parseCommissionPlan,
  });
}

export async function createCommissionPlan(data: {
  name: string;
  default_percentage: string;
  description?: string;
  is_default?: boolean;
}): Promise<CommissionPlan> {
  return apiRequest("/api/v1/admin/finance/commissions/plans", {
    method: "POST",
    expectedStatus: 201,
    body: data,
    parse: parseCommissionPlan,
  });
}

export async function updateCommissionPlan(
  id: string,
  data: {
    name: string;
    default_percentage: string;
    description?: string;
    is_active?: boolean;
    is_default?: boolean;
  },
): Promise<CommissionPlan> {
  return apiRequest(`/api/v1/admin/finance/commissions/plans/${id}`, {
    method: "PUT",
    body: data,
    parse: parseCommissionPlan,
  });
}

export async function createCommissionRule(
  planId: string,
  data: {
    percentage: string;
    fixed_fee?: string;
    priority?: number;
    seller_id?: string | null;
    category_id?: string | null;
  },
): Promise<CommissionRule> {
  return apiRequest(`/api/v1/admin/finance/commissions/plans/${planId}/rules`, {
    method: "POST",
    expectedStatus: 201,
    body: data,
    parse: parseCommissionRule,
  });
}

export async function updateCommissionRule(
  ruleId: string,
  data: {
    percentage: string;
    fixed_fee: string;
    priority: number;
    is_active: boolean;
  },
): Promise<CommissionRule> {
  return apiRequest(`/api/v1/admin/finance/commissions/rules/${ruleId}`, {
    method: "PUT",
    body: data,
    parse: parseCommissionRule,
  });
}

export async function deleteCommissionRule(ruleId: string): Promise<void> {
  await apiRequest(`/api/v1/admin/finance/commissions/rules/${ruleId}`, {
    method: "DELETE",
    expectedStatus: 204,
    parse: () => undefined,
  });
}

export async function getAdminSellerBalances(
  options?: { page?: number; search?: string },
  signal?: AbortSignal,
): Promise<Page<AdminSellerBalance>> {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.search) params.set("search", options.search);

  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/api/v1/admin/finance/seller-balances${query}`, {
    method: "GET",
    signal,
    parse: adminSellerBalancePageParser,
  });
}

export async function getAdminSellerBalance(
  sellerId: string,
  signal?: AbortSignal,
): Promise<AdminSellerBalance> {
  return apiRequest(`/api/v1/admin/finance/seller-balances/${sellerId}`, {
    method: "GET",
    signal,
    parse: parseAdminSellerBalance,
  });
}

export async function adjustSellerBalance(
  sellerId: string,
  data: { amount: string; description: string },
): Promise<SellerLedgerEntry> {
  return apiRequest(
    `/api/v1/admin/finance/seller-balances/${sellerId}/adjust`,
    {
      method: "POST",
      expectedStatus: 201,
      body: data,
      parse: parseSellerLedgerEntry,
    },
  );
}

export async function getAdminPayouts(
  options?: { page?: number; status?: string; seller_id?: string },
  signal?: AbortSignal,
): Promise<Page<Payout>> {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.status) params.set("status", options.status);
  if (options?.seller_id) params.set("seller_id", options.seller_id);

  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/api/v1/admin/finance/payouts${query}`, {
    method: "GET",
    signal,
    parse: payoutPageParser,
  });
}

export async function getAdminPayout(
  id: string,
  signal?: AbortSignal,
): Promise<Payout> {
  return apiRequest(`/api/v1/admin/finance/payouts/${id}`, {
    method: "GET",
    signal,
    parse: parsePayout,
  });
}

export async function approvePayout(id: string): Promise<Payout> {
  return apiRequest(`/api/v1/admin/finance/payouts/${id}/approve`, {
    method: "POST",
    parse: parsePayout,
  });
}

export async function processPayout(
  id: string,
  data?: { payout_reference?: string },
): Promise<Payout> {
  return apiRequest(`/api/v1/admin/finance/payouts/${id}/process`, {
    method: "POST",
    body: data ?? {},
    parse: parsePayout,
  });
}

export async function rejectPayout(
  id: string,
  data: { reason: string },
): Promise<Payout> {
  return apiRequest(`/api/v1/admin/finance/payouts/${id}/reject`, {
    method: "POST",
    body: data,
    parse: parsePayout,
  });
}
