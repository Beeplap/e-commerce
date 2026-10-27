import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/features/auth/auth-provider";
import { AdminFinanceOverview } from "@/features/finance/admin-finance-overview";
import { AdminOverview } from "@/features/workspaces/overview";
import { parseAdminFinanceSummary } from "@/features/finance/api";
import { parsePlatformDashboard } from "@/lib/api/reporting";
import { json, user } from "./fixtures";
import { financeReport, platformReport } from "./reporting-fixtures";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
afterEach(() => vi.unstubAllGlobals());

function setup(
  report: (currency: string) => unknown | Promise<Response>,
  capability: string,
) {
  return vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname === "/api/v1/auth/me")
        return json({ ...user, platform_permissions: [capability] });
      const result = await report(url.searchParams.get("currency") ?? "USD");
      return result instanceof Response ? result : json(result);
    }),
  );
}

describe("currency-scoped report presentation", () => {
  it.each(["finance", "dashboard"])(
    "switches %s totals without converting or rounding money",
    async (view) => {
      const report = view === "finance" ? financeReport : platformReport;
      const urls: string[] = [];
      const fetcher = vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), "http://localhost");
        urls.push(url.toString());
        return json(
          url.pathname === "/api/v1/auth/me"
            ? {
                ...user,
                platform_permissions: [
                  view === "finance"
                    ? "platform.finance.read"
                    : "platform.analytics.read",
                ],
              }
            : report(url.searchParams.get("currency") ?? "USD"),
        );
      });
      vi.stubGlobal("fetch", fetcher);
      render(
        <AuthProvider>
          {view === "finance" ? <AdminFinanceOverview /> : <AdminOverview />}
        </AuthProvider>,
      );
      await screen.findAllByText("12.00 USD");
      const selector = screen.getByRole("combobox", {
        name: "Reporting currency",
      });
      selector.focus();
      fireEvent.change(selector, { target: { value: "NPR" } });
      await screen.findAllByText("98,765,432,109,876.12 NPR");
      expect(screen.queryByText("12.00 USD")).not.toBeInTheDocument();
      expect(selector).toHaveFocus();
      expect(
        urls.some((url) => new URL(url).searchParams.get("currency") === "NPR"),
      ).toBe(true);
      if (view === "dashboard") {
        fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
        await waitFor(() =>
          expect(
            urls.filter(
              (url) => new URL(url).searchParams.get("currency") === "NPR",
            ),
          ).toHaveLength(2),
        );
        const last = new URL(urls.at(-1)!);
        expect(
          Date.parse(last.searchParams.get("end_date")!) -
            Date.parse(last.searchParams.get("start_date")!),
        ).toBe(7 * 86400000);
      }
    },
  );

  it("discards an obsolete currency response and keeps the selector usable while loading", async () => {
    let resolveNpr!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveNpr = resolve;
    });
    setup(
      (currency) => (currency === "NPR" ? pending : financeReport()),
      "platform.finance.read",
    );
    render(
      <AuthProvider>
        <AdminFinanceOverview />
      </AuthProvider>,
    );
    await screen.findByText("12.00 USD");
    const selector = screen.getByRole("combobox", {
      name: "Reporting currency",
    });
    fireEvent.change(selector, { target: { value: "NPR" } });
    await waitFor(() =>
      expect(screen.queryByText("12.00 USD")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("option", { name: "USD" })).toBeInTheDocument();
    fireEvent.change(selector, { target: { value: "USD" } });
    await screen.findByText("12.00 USD");
    await act(async () => resolveNpr(json(financeReport("NPR"))));
    await waitFor(() => expect(selector).toHaveValue("USD"));
    expect(screen.getByText("12.00 USD")).toBeInTheDocument();
    expect(screen.queryByText(/98,765/)).not.toBeInTheDocument();
  });

  it.each(["finance", "dashboard"])(
    "rejects a %s response in a different currency",
    async (view) => {
      setup(
        () =>
          view === "finance" ? financeReport("NPR") : platformReport("NPR"),
        view === "finance"
          ? "platform.finance.read"
          : "platform.analytics.read",
      );
      render(
        <AuthProvider>
          {view === "finance" ? <AdminFinanceOverview /> : <AdminOverview />}
        </AuthProvider>,
      );
      await screen.findByText("The server returned an unexpected response.");
      expect(screen.queryByText(/98,765/)).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /try again/i }),
      ).toBeInTheDocument();
    },
  );
});

describe("financial report response validation", () => {
  it.each([
    { currency: undefined },
    { available_currencies: ["USD", "USD"] },
    { available_currencies: [] },
    { total_gross_sales: 12 },
    { total_gross_sales: "NaN" },
    { total_gross_sales: undefined },
    { pending_payouts_count: -1 },
    { active_plans_count: 1.5 },
  ])("rejects incomplete or malformed finance evidence: %j", (change) => {
    expect(() =>
      parseAdminFinanceSummary({ ...financeReport(), ...change }, "USD"),
    ).toThrow();
  });
  it.each([
    {
      top_sellers: [
        {
          id: "../admin",
          name: "Invalid",
          gross_sales: "1.00",
          orders_count: 1,
        },
      ],
    },
    { gmv: Infinity },
    { gmv: "1e20" },
    { orders_count: 1.5 },
    { refund_rate: NaN },
    {
      sales_over_time: Array.from(
        { length: 368 },
        () => platformReport().sales_over_time[0],
      ),
    },
    {
      sales_over_time: [
        {
          date: "2026-02-30",
          gmv: "1.00",
          platform_revenue: "0.10",
          orders_count: 1,
        },
      ],
    },
  ])("rejects malformed platform evidence: %j", (change) => {
    expect(() =>
      parsePlatformDashboard({ ...platformReport(), ...change }, "USD"),
    ).toThrow();
  });
});
