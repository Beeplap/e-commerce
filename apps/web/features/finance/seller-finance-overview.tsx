"use client";

import { ContentSection, StatGroup } from "@/components/ui/layout";
import { Dialog } from "@/components/ui/dialog";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useSeller } from "@/features/workspaces/seller-workspace";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { useApiQuery } from "@/lib/api/use-api-query";
import { Money, DateDisplay } from "@/components/ui/displays";
import {
  ApiErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
  primaryButton,
  secondaryButton,
} from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  getSellerBalance,
  getSellerLedger,
  getSellerPayouts,
  requestPayout,
  type SellerBalance,
  type SellerLedgerEntry,
  type Payout,
} from "./api";

export function SellerFinanceOverview() {
  const access = useSeller();
  const sellerId = access.seller.id;
  const canRead = access.permissions.includes("finance.read");

  if (!canRead || access.seller.status !== "active") {
    return <ForbiddenScreen />;
  }

  return (
    <FinanceDashboard
      key={access.id}
      sellerId={sellerId}
      canReadPayouts={access.permissions.includes("payouts.read")}
    />
  );
}

function FinanceDashboard({
  sellerId,
  canReadPayouts,
}: {
  sellerId: string;
  canReadPayouts: boolean;
}) {
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadBalance = useCallback(
    (signal: AbortSignal) => getSellerBalance(sellerId, signal),
    [sellerId],
  );
  const loadLedger = useCallback(
    (signal: AbortSignal) => getSellerLedger(sellerId, { page: 1 }, signal),
    [sellerId],
  );
  const loadPayouts = useCallback(
    (signal: AbortSignal) => getSellerPayouts(sellerId, { page: 1 }, signal),
    [sellerId],
  );

  const balanceQuery = useApiQuery(`${sellerId}:finance:balance`, loadBalance);
  const ledgerQuery = useApiQuery(
    `${sellerId}:finance:recent-ledger`,
    loadLedger,
  );
  const payoutsQuery = useApiQuery(
    canReadPayouts ? `${sellerId}:finance:recent-payouts` : null,
    loadPayouts,
  );

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutError(null);
    setSubmitting(true);
    try {
      await requestPayout(sellerId, {
        amount: payoutAmount,
        notes: payoutNotes || undefined,
      });
      setShowPayoutModal(false);
      setPayoutAmount("");
      setPayoutNotes("");
      balanceQuery.retry();
      payoutsQuery.retry();
    } catch (err) {
      setPayoutError(
        err instanceof Error ? err.message : "Failed to request payout",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (balanceQuery.kind === "loading") {
    return <LoadingState />;
  }

  if (balanceQuery.kind === "error") {
    return (
      <ApiErrorState error={balanceQuery.error} onRetry={balanceQuery.retry} />
    );
  }

  const balance: SellerBalance = balanceQuery.data;

  const ledgerColumns: Column<SellerLedgerEntry>[] = [
    {
      id: "type",
      heading: "Type",
      cell: (entry) => <StatusBadge status={entry.entry_type} />,
    },
    {
      id: "amount",
      align: "right" as const,
      heading: "Amount",
      cell: (entry) => {
        const isNegative = entry.amount.startsWith("-");
        return (
          <span
            className={
              isNegative
                ? "font-medium text-ui-danger"
                : "font-medium text-ui-success"
            }
          >
            {isNegative ? "" : "+"}
            <Money amount={entry.amount} currency={entry.currency} />
          </span>
        );
      },
    },
    {
      id: "balance_after",
      align: "right" as const,
      heading: "Balance After",
      cell: (entry) => (
        <Money amount={entry.balance_after} currency={entry.currency} />
      ),
    },
    {
      id: "description",
      heading: "Description",
      cell: (entry) => (
        <div>
          <div className="text-sm text-ui-foreground">{entry.description}</div>
          {entry.seller_order_number && (
            <div className="text-xs text-ui-muted">
              Order: {entry.seller_order_number}
            </div>
          )}
          {entry.payout_number && (
            <div className="text-xs text-ui-muted">
              Payout: {entry.payout_number}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "created_at",
      heading: "Date",
      cell: (entry) => <DateDisplay value={entry.created_at} />,
    },
  ];

  const payoutColumns: Column<Payout>[] = [
    {
      id: "payout_number",
      heading: "Payout #",
      cell: (payout) => (
        <span className="font-mono text-sm font-medium">
          {payout.payout_number}
        </span>
      ),
    },
    {
      id: "amount",
      align: "right" as const,
      heading: "Amount",
      cell: (payout) => (
        <Money amount={payout.amount} currency={payout.currency} />
      ),
    },
    {
      id: "status",
      heading: "Status",
      cell: (payout) => <StatusBadge status={payout.status} />,
    },
    {
      id: "created_at",
      heading: "Requested",
      cell: (payout) => <DateDisplay value={payout.created_at} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Overview"
        description="Balances, transactions and payout requests."
        actions={
          canReadPayouts && (
            <button
              type="button"
              className={primaryButton}
              onClick={() => setShowPayoutModal(true)}
            >
              Request Payout
            </button>
          )
        }
      />

      <StatGroup
        columns={3}
        items={[
          {
            label: "Available Balance",
            primary: true,
            value: (
              <Money
                amount={balance.current_balance}
                currency={balance.currency}
              />
            ),
            hint: "Available for payout",
          },
          {
            label: "Pending Balance",
            value: (
              <Money
                amount={balance.pending_balance}
                currency={balance.currency}
              />
            ),
            hint: "Awaiting order fulfillment",
          },
          {
            label: "Total Paid Out",
            value: (
              <Money
                amount={balance.total_paid_out}
                currency={balance.currency}
              />
            ),
            hint: "Lifetime payouts",
          },
        ]}
      />

      <div className="border-t border-ui-border pt-6">
        <ContentSection
          id="finance-ledger"
          title="Recent Transactions"
          actions={
            <Link
              href="/seller/finance/transactions"
              className="inline-flex min-h-11 items-center text-ui-body text-ui-accent hover:underline"
            >
              View all transactions
            </Link>
          }
        >
          {ledgerQuery.kind === "loading" && <LoadingState variant="table" />}
          {ledgerQuery.kind === "error" && (
            <ApiErrorState
              error={ledgerQuery.error}
              onRetry={ledgerQuery.retry}
            />
          )}
          {ledgerQuery.kind === "ready" && (
            <DataTable
              mobile="scroll"
              rows={ledgerQuery.data.results.slice(0, 5)}
              columns={ledgerColumns}
              rowKey={(row) => row.id}
              caption="Recent ledger transactions"
            />
          )}
        </ContentSection>
      </div>
      {canReadPayouts && (
        <div className="border-t border-ui-border pt-6">
          <ContentSection
            id="finance-payouts"
            title="Recent Payouts"
            actions={
              <Link
                href="/seller/finance/payouts"
                className="inline-flex min-h-11 items-center text-ui-body text-ui-accent hover:underline"
              >
                View all payouts
              </Link>
            }
          >
            {payoutsQuery.kind === "loading" && (
              <LoadingState variant="table" />
            )}
            {payoutsQuery.kind === "error" && (
              <ApiErrorState
                error={payoutsQuery.error}
                onRetry={payoutsQuery.retry}
              />
            )}
            {payoutsQuery.kind === "ready" && (
              <DataTable
                rows={payoutsQuery.data.results.slice(0, 5)}
                columns={payoutColumns}
                rowKey={(row) => row.id}
                caption="Recent payouts"
              />
            )}
          </ContentSection>
        </div>
      )}

      {/* Request Payout Modal */}
      {showPayoutModal && (
        <Dialog
          open
          title={<>Request Payout</>}
          description={
            <>
              Available balance:{" "}
              <span className="font-semibold text-ui-foreground">
                <Money
                  amount={balance.current_balance}
                  currency={balance.currency}
                />
              </span>
            </>
          }
          onClose={() => setShowPayoutModal(false)}
          busy={submitting}
          error={payoutError}
        >
          <form onSubmit={handleRequestPayout} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="payout-amount"
                className="block text-sm font-medium text-ui-secondary"
              >
                Amount ({balance.currency})
              </label>
              <input
                id="payout-amount"
                type="text"
                required
                placeholder="0.00"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ui-control-border px-3 py-2 text-sm text-ui-foreground focus:border-orange-700 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="payout-notes"
                className="block text-sm font-medium text-ui-secondary"
              >
                Notes (Optional)
              </label>
              <textarea
                id="payout-notes"
                rows={2}
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ui-control-border px-3 py-2 text-sm text-ui-foreground focus:border-orange-700 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                className={secondaryButton}
                onClick={() => setShowPayoutModal(false)}
                data-dialog-cancel
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={primaryButton}
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
