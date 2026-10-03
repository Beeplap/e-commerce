import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceFrame } from "@/features/workspaces/workspace-frame";
import { AccountMenu } from "@/features/auth/account-menu";
import { user } from "./fixtures";

const navigation = vi.hoisted(() => ({
  pathname: "/seller",
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}));
let currentUser = user;
vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    state: { kind: "authenticated", user: currentUser },
    logout: vi.fn(),
  }),
}));
beforeEach(() => {
  navigation.pathname = "/seller";
  currentUser = user;
});
afterEach(() => vi.unstubAllGlobals());

describe("workspace navigation", () => {
  it("requires payout read access separately from finance access", () => {
    render(
      <WorkspaceFrame mode="seller" sellerCanReadFinance>
        <h1>Finance only</h1>
      </WorkspaceFrame>,
    );
    const nav = within(
      screen.getByRole("navigation", { name: "Workspace navigation" }),
    );
    expect(nav.getByRole("link", { name: "Finance" })).toBeInTheDocument();
    expect(
      nav.queryByRole("link", { name: "Payouts" }),
    ).not.toBeInTheDocument();
  });
  it("keeps the most specific section active on nested routes", () => {
    navigation.pathname = "/seller/finance/payouts";
    render(
      <WorkspaceFrame mode="seller" sellerCanReadFinance sellerCanReadPayouts>
        <h1>Payout requests</h1>
      </WorkspaceFrame>,
    );
    const nav = within(
      screen.getByRole("navigation", { name: "Workspace navigation" }),
    );
    expect(nav.getByRole("link", { name: "Payouts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(nav.getByRole("link", { name: "Finance" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(nav.getByRole("link", { name: "Transactions" })).toHaveAttribute(
      "href",
      "/seller/finance/transactions",
    );
  });

  it("limits seller links to available capabilities and omits empty groups", () => {
    render(
      <WorkspaceFrame mode="seller" sellerCanReadOrders>
        <h1>Orders only</h1>
      </WorkspaceFrame>,
    );
    const nav = within(
      screen.getByRole("navigation", { name: "Workspace navigation" }),
    );
    expect(nav.getByRole("link", { name: "Orders" })).toBeInTheDocument();
    expect(
      nav.queryByRole("link", { name: "Products" }),
    ).not.toBeInTheDocument();
    expect(
      nav.queryByRole("link", { name: "Payouts" }),
    ).not.toBeInTheDocument();
    expect(nav.queryByText("Growth")).not.toBeInTheDocument();
    expect(
      nav.queryByRole("link", { name: "Platform workspace" }),
    ).not.toBeInTheDocument();
  });

  it("requires explicit platform capabilities for each navigation family", () => {
    currentUser = {
      ...user,
      platform_permissions: ["platform.access", "platform.finance.read"],
    };
    navigation.pathname = "/admin/finance/commissions";
    render(
      <WorkspaceFrame mode="admin">
        <h1>Commission plans</h1>
      </WorkspaceFrame>,
    );
    const nav = within(
      screen.getByRole("navigation", { name: "Workspace navigation" }),
    );
    expect(nav.getByRole("link", { name: "Commissions" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      nav.getByRole("link", { name: "Seller balances" }),
    ).toBeInTheDocument();
    expect(
      nav.queryByRole("link", { name: "Sellers" }),
    ).not.toBeInTheDocument();
    expect(
      nav.queryByRole("link", { name: "Moderation queue" }),
    ).not.toBeInTheDocument();
    expect(nav.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
  });

  it("provides section breadcrumbs without exposing a raw identifier as the title", () => {
    navigation.pathname = "/seller/orders/7e116a42-6a83-42a1-a562-534af15d3afe";
    render(
      <WorkspaceFrame mode="seller" sellerCanReadOrders>
        <h1>Order 1042</h1>
      </WorkspaceFrame>,
    );
    const crumbs = within(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    );
    expect(crumbs.getByRole("link", { name: "Orders" })).toHaveAttribute(
      "href",
      "/seller/orders",
    );
    expect(crumbs.getByText("Details")).toHaveAttribute("aria-current", "page");
    expect(crumbs.queryByText(/7e116a42/)).not.toBeInTheDocument();
    expect(
      within(
        screen.getByRole("navigation", { name: "Workspace navigation" }),
      ).getByRole("link", { name: "Orders" }),
    ).toHaveAttribute("aria-current", "location");
  });

  it("opens a labeled mobile drawer, focuses Close, and closes on Escape", () => {
    render(
      <WorkspaceFrame mode="seller" sellerCanReadOrders>
        <h1>Seller overview</h1>
      </WorkspaceFrame>,
    );
    const trigger = screen.getByRole("button", { name: "Menu" });
    trigger.focus();
    fireEvent.click(trigger);
    const drawer = screen.getByRole("dialog", { name: "Seller workspace" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(
      within(drawer).getByRole("button", { name: "Close navigation" }),
    ).toHaveFocus();
    fireEvent(drawer, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes mobile navigation when the route changes and does not reopen on Back", () => {
    const view = render(
      <WorkspaceFrame mode="seller" sellerCanReadOrders>
        <h1>Page</h1>
      </WorkspaceFrame>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    navigation.pathname = "/seller/orders";
    view.rerender(
      <WorkspaceFrame mode="seller" sellerCanReadOrders>
        <h1>Page</h1>
      </WorkspaceFrame>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    navigation.pathname = "/seller";
    view.rerender(
      <WorkspaceFrame mode="seller" sellerCanReadOrders>
        <h1>Page</h1>
      </WorkspaceFrame>,
    );
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("dismisses the account popover on Escape and outside interaction", () => {
    render(
      <>
        <AccountMenu />
        <button type="button">Outside</button>
      </>,
    );
    const summary = screen
      .getByText("Account", { selector: "summary" })
      .closest("summary")!;
    const details = summary.closest("details")!;
    act(() => {
      details.open = true;
    });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(details.open).toBe(false);
    expect(summary).toHaveFocus();
    act(() => {
      details.open = true;
    });
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(details.open).toBe(false);
  });
});
