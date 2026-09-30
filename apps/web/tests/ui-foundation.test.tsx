import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { useCallback } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { DateDisplay, formatMoney } from "@/components/ui/displays";
import { FilterBar, SearchInput } from "@/components/ui/filter-bar";
import { Pagination } from "@/components/ui/pagination";
import { FormField, StatusBadge } from "@/components/ui/primitives";
import { useApiQuery } from "@/lib/api/use-api-query";
import { hasPlatformPermission, hasSellerPermission } from "@/lib/permissions";
import ErrorPage from "@/app/error";
import NotFound from "@/app/not-found";
import { membership, user } from "./fixtures";

const originalShowModal = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "showModal",
);
const originalClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "close",
);
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
});
afterAll(() => {
  if (originalShowModal)
    Object.defineProperty(
      HTMLDialogElement.prototype,
      "showModal",
      originalShowModal,
    );
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (originalClose)
    Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

describe("accessible administration components", () => {
  it("labels fields and associates validation errors with the control", () => {
    render(
      <FormField
        id="test-email"
        label="Email"
        error="Enter a valid email"
        hint="Your account email"
        required
        type="email"
      />,
    );
    const input = screen.getByLabelText(/Email/);
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "Your account email Enter a valid email",
    );
  });

  it("provides table semantics and a meaningful empty state", () => {
    const columns = [
      {
        id: "name",
        heading: "Name",
        cell: (row: { id: string; name: string }) => row.name,
      },
    ];
    const view = render(
      <DataTable
        caption="Members"
        columns={columns}
        rows={[{ id: "1", name: "Alex" }]}
        rowKey={(row) => row.id}
      />,
    );
    expect(screen.getByRole("table", { name: "Members" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute(
      "scope",
      "col",
    );
    expect(screen.getByRole("cell", { name: "Alex" })).toBeInTheDocument();
    view.rerender(
      <DataTable
        caption="Members"
        columns={columns}
        rows={[]}
        rowKey={(row) => row.id}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "No results" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("bounds pagination and disables actions while a request is pending", () => {
    const change = vi.fn();
    const view = render(
      <Pagination page={1} count={26} onPageChange={change} />,
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(change).toHaveBeenCalledWith(2);
    view.rerender(
      <Pagination page={2} count={26} busy onPageChange={change} />,
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(
      screen.getByRole("navigation", { name: "Pagination" }),
    ).toHaveTextContent("Page 2 of 2");
  });

  it("labels search and exposes statuses as text", () => {
    const change = vi.fn();
    render(
      <>
        <FilterBar>
          <SearchInput value="" onChange={change} />
        </FilterBar>
        <StatusBadge status="suspended" />
      </>,
    );
    fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
      target: { value: "query" },
    });
    expect(change).toHaveBeenCalledWith("query");
    expect(screen.getByText("suspended")).toBeInTheDocument();
  });

  it("focuses a modal's cancel button, responds to cancel and restores focus", () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    const view = render(
      <>
        <button type="button">Open action</button>
        <ConfirmDialog
          open={false}
          title="Confirm change"
          description="Review this action"
          onConfirm={confirm}
          onCancel={cancel}
        />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Open action" });
    trigger.focus();
    view.rerender(
      <>
        <button type="button">Open action</button>
        <ConfirmDialog
          open
          title="Confirm change"
          description="Review this action"
          onConfirm={confirm}
          onCancel={cancel}
        />
      </>,
    );
    const dialog = screen.getByRole("dialog", { name: "Confirm change" });
    expect(dialog).toHaveAccessibleDescription("Review this action");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(cancel).toHaveBeenCalledTimes(1);
    view.rerender(
      <>
        <button type="button">Open action</button>
        <ConfirmDialog
          open={false}
          title="Confirm change"
          description="Review this action"
          onConfirm={confirm}
          onCancel={cancel}
        />
      </>,
    );
    expect(trigger).toHaveFocus();
  });

  it("prevents modal dismissal or repeated actions while busy", () => {
    const cancel = vi.fn();
    const confirm = vi.fn();
    render(
      <ConfirmDialog
        open
        busy
        title="Processing"
        description="Please wait"
        onCancel={cancel}
        onConfirm={confirm}
      />,
    );
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { cancelable: true }),
    );
    expect(cancel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Working…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("shows a retryable error without exposing raw exception values", () => {
    const retry = vi.fn();
    render(
      <ErrorPage error={new Error("private secret payload")} retry={retry} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("unexpected error");
    expect(
      screen.queryByText("private secret payload"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("provides a 404 recovery route", () => {
    render(<NotFound />);
    expect(
      screen.getByRole("heading", { name: "This page isn’t here" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to workspaces" }),
    ).toHaveAttribute("href", "/workspaces");
  });
});

describe("exact and explicit display helpers", () => {
  it("preserves monetary precision beyond binary floating-point integers", () => {
    expect(formatMoney("9007199254740993.01", "USD")).toBe(
      "9,007,199,254,740,993.01\u00a0USD",
    );
    expect(formatMoney("-0.05", "USD")).toBe("−0.05\u00a0USD");
    expect(formatMoney("1234.50", "EUR", "de-DE")).toBe("1.234,50\u00a0EUR");
    expect(() => formatMoney("NaN", "USD")).toThrow();
    expect(() => formatMoney("1e10", "USD")).toThrow();
    expect(() => formatMoney("10.00", "usd")).toThrow();
  });

  it("renders dates in an explicit timezone and preserves machine-readable time", () => {
    render(<DateDisplay value="2026-09-30T01:00:00Z" timezone="UTC" />);
    expect(screen.getByText(/Sep 30, 2026/)).toHaveAttribute(
      "datetime",
      "2026-09-30T01:00:00.000Z",
    );
    expect(() => DateDisplay({ value: "invalid" })).toThrow(
      "A valid date is required.",
    );
  });
});

describe("permission utilities", () => {
  it("requires capabilities and never treats role names as permission", () => {
    expect(hasPlatformPermission(user, "platform.access")).toBe(false);
    expect(
      hasPlatformPermission(
        { ...user, platform_permissions: ["platform.access"] },
        "platform.access",
      ),
    ).toBe(true);
    expect(hasPlatformPermission(null, "platform.access")).toBe(false);
    expect(hasSellerPermission(membership, "staff.read")).toBe(true);
    expect(hasSellerPermission(membership, "staff.update")).toBe(false);
    expect(
      hasSellerPermission({ ...membership, status: "suspended" }, "staff.read"),
    ).toBe(false);
    expect(
      hasSellerPermission(
        { ...membership, seller: { ...membership.seller, status: "closed" } },
        "staff.read",
      ),
    ).toBe(false);
    expect(hasSellerPermission(null, "staff.read")).toBe(false);
    const pending = {
      ...membership,
      seller: { ...membership.seller, status: "pending" as const },
    };
    expect(hasSellerPermission(pending, "staff.read")).toBe(false);
    expect(hasSellerPermission(pending, "seller.context.read", true)).toBe(
      true,
    );
  });
});

it("cancels stale queries and never displays a previous seller's delayed response", async () => {
  const pending = new Map<
    string,
    { signal: AbortSignal; resolve: (value: string) => void }
  >();
  function Probe({ seller }: { seller: string }) {
    const load = useCallback(
      (signal: AbortSignal) =>
        new Promise<string>((resolve) => {
          pending.set(seller, { signal, resolve });
        }),
      [seller],
    );
    const query = useApiQuery(seller, load);
    return <output>{query.kind === "ready" ? query.data : query.kind}</output>;
  }
  const view = render(<Probe seller="seller-a" />);
  await act(async () => {});
  view.rerender(<Probe seller="seller-b" />);
  await act(async () => {});
  expect(pending.get("seller-a")?.signal.aborted).toBe(true);
  await act(async () => {
    pending.get("seller-b")?.resolve("Seller B");
  });
  expect(screen.getByRole("status")).toHaveTextContent("Seller B");
  await act(async () => {
    pending.get("seller-a")?.resolve("Seller A");
  });
  expect(screen.getByRole("status")).toHaveTextContent("Seller B");
});
