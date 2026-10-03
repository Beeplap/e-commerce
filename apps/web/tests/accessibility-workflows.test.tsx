import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Tabs } from "@/components/ui/tabs";
import { TrendChart } from "@/features/workspaces/trend-chart";
import { SellerStaff } from "@/features/sellers/staff";
import { SellerWarehouses } from "@/features/inventory/warehouses";
import { AdminFulfillmentOverview } from "@/features/fulfillment/admin-fulfillment";
import { AccountMenu } from "@/features/auth/account-menu";
import { AuthProvider } from "@/features/auth/auth-provider";
import { SellerWorkspace } from "@/features/workspaces/seller-workspace";
import { csrf, json, membership, page, user } from "./fixtures";

vi.mock("next/navigation", () => ({
  usePathname: () => "/seller/staff",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Views() {
  const [value, setValue] = useState("shipments");
  return (
    <Tabs
      label="Fulfillment views"
      value={value}
      onChange={setValue}
      items={[
        {
          value: "shipments",
          label: "Shipments",
          content: <p>Shipping evidence</p>,
        },
        { value: "returns", label: "Returns", content: <p>Return evidence</p> },
        { value: "refunds", label: "Refunds", content: <p>Refund evidence</p> },
      ]}
    />
  );
}

describe("accessible operational workflows", () => {
  it("opens direct fulfillment destinations on their named view and resets when the destination changes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/auth/me"))
          return json({
            ...user,
            platform_permissions: ["platform.fulfillment.read"],
          });
        if (url.includes("/api/v1/admin/fulfillment/")) return json(page([]));
        return json({ detail: "Not found" }, 404);
      }),
    );
    const view = render(
      <AuthProvider>
        <AdminFulfillmentOverview initialTab="returns" />
      </AuthProvider>,
    );
    expect(await screen.findByRole("tab", { name: "Returns" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel", { name: "Returns" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Shipments" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    view.rerender(
      <AuthProvider>
        <AdminFulfillmentOverview initialTab="refunds" />
      </AuthProvider>,
    );
    expect(await screen.findByRole("tab", { name: "Refunds" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel", { name: "Refunds" })).toBeVisible();
    expect(
      screen.queryByRole("tabpanel", { name: "Returns" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Platform Refund" }),
    ).not.toBeInTheDocument();
  });

  it("gives warehouse editing native dialog dismissal and focused errors while preserving failed inputs", async () => {
    const access = {
      ...membership,
      permissions: [
        "seller.context.read",
        "inventory.read",
        "inventory.adjust",
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/auth/csrf")) return json({ csrf_token: csrf });
        if (url.includes("/auth/me")) return json(user);
        if (url.includes("/seller/memberships")) return json(page([access]));
        if (url.includes("/seller/access")) return json(access);
        if (url.includes("/seller/warehouses"))
          return init?.method === "POST"
            ? json({ detail: "Warehouse access denied" }, 403)
            : json(page([]));
        return json({ detail: "Not found" }, 404);
      }),
    );
    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerWarehouses />
        </SellerWorkspace>
      </AuthProvider>,
    );
    const trigger = await screen.findByRole("button", {
      name: "Add warehouse",
    });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Create Warehouse" });
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toHaveFocus();
    fireEvent.change(
      within(dialog).getByRole("textbox", { name: "Warehouse name" }),
      { target: { value: "Local hub" } },
    );
    fireEvent.change(
      within(dialog).getByRole("textbox", { name: "Warehouse code" }),
      { target: { value: "local" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create warehouse" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Warehouse access denied",
    );
    // The alert is rendered before the dialog's passive focus effect runs.
    await waitFor(() =>
      expect(within(dialog).getByRole("alert")).toHaveFocus(),
    );
    expect(
      within(dialog).getByRole("textbox", { name: "Warehouse name" }),
    ).toHaveValue("Local hub");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("supports roving tab focus, arrows, wraparound and Home/End with associated panels", () => {
    render(<Views />);
    const tabs = within(
      screen.getByRole("tablist", { name: "Fulfillment views" }),
    );
    const shipments = tabs.getByRole("tab", { name: "Shipments" });
    const returns = tabs.getByRole("tab", { name: "Returns" });
    const refunds = tabs.getByRole("tab", { name: "Refunds" });
    expect(shipments.tabIndex).toBe(0);
    expect(returns.tabIndex).toBe(-1);
    shipments.focus();
    fireEvent.keyDown(shipments, { key: "ArrowLeft" });
    expect(refunds).toHaveFocus();
    expect(refunds).toHaveAttribute("aria-selected", "true");
    expect(shipments.tabIndex).toBe(-1);
    const panel = screen.getByRole("tabpanel", { name: "Refunds" });
    expect(refunds.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.getAttribute("aria-labelledby")).toBe(refunds.id);
    expect(panel.tabIndex).toBe(0);
    expect(screen.queryByText("Shipping evidence")).not.toBeInTheDocument();
    fireEvent.keyDown(refunds, { key: "ArrowRight" });
    expect(shipments).toHaveFocus();
    fireEvent.keyDown(shipments, { key: "End" });
    expect(refunds).toHaveFocus();
    fireEvent.keyDown(refunds, { key: "Home" });
    expect(shipments).toHaveFocus();
    fireEvent.keyDown(shipments, { key: "ArrowRight" });
    expect(returns).toHaveFocus();
    const vertical = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    fireEvent(returns, vertical);
    expect(vertical.defaultPrevented).toBe(false);
    expect(returns).toHaveFocus();
  });

  it("keeps panel identities unique for separate tab groups", () => {
    render(
      <>
        <Views />
        <Views />
      </>,
    );
    const tabs = screen.getAllByRole("tab", { name: "Shipments" });
    expect(tabs[0]!.id).not.toBe(tabs[1]!.id);
    expect(tabs[0]!.getAttribute("aria-controls")).not.toBe(
      tabs[1]!.getAttribute("aria-controls"),
    );
    expect(screen.getAllByRole("tabpanel")).toHaveLength(2);
  });

  it("offers the complete chart evidence as a labeled exact-value table without invented dates", () => {
    render(
      <TrendChart
        points={[
          { date: "2026-10-01", value: "9007199254740993.01", orders: 2 },
          { date: "2026-10-03", value: "20.10", orders: 4 },
        ]}
        secondaryValues={["10.01", "18.00"]}
        currency="NPR"
        label="Gross sales"
        secondaryLabel="Net sales"
      />,
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const disclosure = screen.getByText("View trend data").closest("details")!;
    act(() => {
      disclosure.open = true;
      fireEvent(disclosure, new Event("toggle"));
    });
    const table = screen.getByRole("table", {
      name: "Recorded daily trend data",
    });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Date", "Gross sales", "Net sales", "Orders"]);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(
      within(table).getByRole("cell", {
        name: /^9,007,199,254,740,993\.01\sNPR$/,
      }),
    ).toBeInTheDocument();
    expect(within(table).getByText("2026-10-03")).toBeInTheDocument();
    expect(within(table).queryByText("2026-10-02")).not.toBeInTheDocument();
    const region = screen.getByRole("region", {
      name: "Recorded daily trend data",
    });
    expect(region.tabIndex).toBe(0);
    act(() => {
      disclosure.open = false;
      fireEvent(disclosure, new Event("toggle"));
    });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("labels invitation and inline staff role selection without losing server capability boundaries", async () => {
    const access = {
      ...membership,
      permissions: [
        "seller.context.read",
        "seller.staff.read",
        "seller.staff.manage",
      ],
    };
    const role = { ...membership.role, name: "Operations", is_owner: false };
    const colleague = { ...user, email: "colleague@example.com" };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/auth/csrf")) return json({ csrf_token: csrf });
        if (url.includes("/auth/me")) return json(user);
        if (url.includes("/seller/memberships")) return json(page([access]));
        if (url.includes("/seller/access")) return json(access);
        if (url.includes("/seller/staff"))
          return json({
            count: 1,
            results: [
              {
                id: "20000000-0000-4000-8000-000000000003",
                user: colleague,
                role,
                status: "active",
                permissions: [],
                joined_at: null,
                invited_at: "2026-10-01T00:00:00Z",
              },
            ],
          });
        if (url.includes("/seller/roles")) return json([role]);
        return json({ detail: "Not found" }, 404);
      }),
    );
    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerStaff />
        </SellerWorkspace>
      </AuthProvider>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Invite member" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Invite Team Member" });
    const inviteRole = within(dialog).getByRole("combobox", { name: "Role" });
    expect(inviteRole).toBeRequired();
    expect(
      within(dialog).getByRole("textbox", { name: "Email address" }),
    ).toBeRequired();
    fireEvent.change(inviteRole, { target: { value: role.id } });
    expect(inviteRole).toHaveValue(role.id);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Change role" }));
    expect(
      screen.getByRole("combobox", { name: "Role for colleague@example.com" }),
    ).toBeInTheDocument();
  });

  it("dismisses account disclosure when keyboard focus leaves without stealing focus", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => json(user)),
    );
    render(
      <AuthProvider>
        <AccountMenu />
        <button type="button">Outside</button>
      </AuthProvider>,
    );
    const summary = await screen.findByText("Account", { selector: "summary" });
    const details = summary.closest("details")!;
    act(() => {
      details.open = true;
    });
    const account = screen.getByRole("link", { name: "My account" });
    account.focus();
    expect(details.open).toBe(true);
    screen.getByRole("button", { name: "Outside" }).focus();
    expect(details.open).toBe(false);
    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();
  });
});
