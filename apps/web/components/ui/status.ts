export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";
const statusTones: Record<string, StatusTone> = {
  active: "success",
  verified: "success",
  approved: "success",
  delivered: "success",
  processed: "success",
  paid: "success",
  refunded: "success",
  completed: "success",
  pending: "warning",
  pending_review: "warning",
  requested: "warning",
  invited: "warning",
  refund_pending: "warning",
  on_hold: "warning",
  rejected: "danger",
  suspended: "danger",
  failed: "danger",
  cancelled: "danger",
  canceled: "danger",
  processing: "info",
  shipped: "info",
  in_transit: "info",
  confirmed: "info",
};
export function statusTone(status: string): StatusTone {
  return statusTones[status.toLowerCase()] ?? "neutral";
}
export const statusStyles: Record<StatusTone, string> = {
  neutral: "bg-ui-surface-muted text-ui-secondary",
  success: "bg-ui-success-surface text-ui-success",
  warning: "bg-ui-warning-surface text-ui-warning",
  danger: "bg-ui-danger-surface text-ui-danger",
  info: "bg-ui-info-surface text-ui-info",
};
