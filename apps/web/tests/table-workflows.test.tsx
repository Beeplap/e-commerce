import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Identifier } from "@/components/ui/identifier";
import {
  useDebouncedValue,
  useTableQuery,
} from "@/components/ui/use-table-query";

function QueryProbe() {
  const table = useTableQuery({ search: 10, status: ["draft", "active"] });
  const search = useDebouncedValue(table.values.search);
  return (
    <>
      <label>
        Search
        <input
          value={table.values.search}
          onChange={(event) =>
            table.setFilters({ search: event.target.value }, true)
          }
        />
      </label>
      <label>
        Status
        <select
          value={table.values.status}
          onChange={(event) => table.setFilters({ status: event.target.value })}
        >
          <option value="">All</option>
          <option>draft</option>
          <option>active</option>
        </select>
      </label>
      <Button onClick={() => table.setPage(table.page + 1)}>Next</Button>
      <Button onClick={table.clear}>Clear</Button>
      <output aria-label="View state">
        {JSON.stringify({ page: table.page, ...table.values })}
      </output>
      <output aria-label="Applied search">{search || "empty"}</output>
    </>
  );
}

const originalClipboard = Object.getOwnPropertyDescriptor(
  navigator,
  "clipboard",
);
beforeEach(() =>
  window.history.replaceState(
    { routerMarker: "preserved" },
    "",
    "/seller/products",
  ),
);
afterEach(() => {
  vi.useRealTimers();
  if (originalClipboard)
    Object.defineProperty(navigator, "clipboard", originalClipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
});

describe("shareable table state", () => {
  it("restores bounded allowlisted values from the URL", () => {
    window.history.replaceState(
      null,
      "",
      "/seller/products?page=999999&status=owner&search=abcdefghijklmnop&seller_id=untrusted",
    );
    render(<QueryProbe />);
    expect(screen.getByLabelText("Search")).toHaveValue("abcdefghij");
    expect(screen.getByLabelText("Status")).toHaveValue("");
    expect(screen.getByLabelText("View state")).toHaveTextContent('"page":1');
    expect(screen.getByLabelText("View state")).not.toHaveTextContent(
      "seller_id",
    );
  });

  it("resets pagination on filters and preserves unrelated URL and router state", () => {
    window.history.replaceState(
      { routerMarker: "preserved" },
      "",
      "/seller/products?page=4&utm_source=review#items",
    );
    render(<QueryProbe />);
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "active" },
    });
    expect(screen.getByLabelText("View state")).toHaveTextContent('"page":1');
    expect(new URLSearchParams(window.location.search).get("status")).toBe(
      "active",
    );
    expect(new URLSearchParams(window.location.search).get("utm_source")).toBe(
      "review",
    );
    expect(window.location.hash).toBe("#items");
    expect(window.history.state).toEqual({ routerMarker: "preserved" });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(new URLSearchParams(window.location.search).get("page")).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(window.location.search).toBe("?utm_source=review");
  });

  it("restores a previous filter and page with browser Back", async () => {
    render(<QueryProbe />);
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "active" },
    });
    await act(async () => {
      window.history.back();
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Status")).toHaveValue("draft"),
    );
    expect(screen.getByLabelText("View state")).toHaveTextContent('"page":2');
  });

  it("debounces search without adding a history entry for every keystroke", async () => {
    vi.useFakeTimers();
    render(<QueryProbe />);
    const length = window.history.length;
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "one" },
    });
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "two" },
    });
    expect(screen.getByLabelText("Applied search")).toHaveTextContent("empty");
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByLabelText("Applied search")).toHaveTextContent("two");
    expect(window.history.length).toBe(length);
  });
});

describe("operational tables and identifiers", () => {
  it("aligns amounts and retains table semantics with one copy of each record", () => {
    const { container } = render(
      <DataTable
        caption="Orders"
        columns={[
          {
            id: "name",
            heading: "Order",
            cell: (row: { id: string; amount: string }) => row.id,
          },
          {
            id: "amount",
            heading: "Total",
            align: "right",
            cell: (row) => row.amount,
          },
        ]}
        rows={[{ id: "SO-100", amount: "15.00 USD" }]}
        rowKey={(row) => row.id}
      />,
    );
    expect(screen.getByRole("table", { name: "Orders" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Total" })).toHaveAttribute(
      "data-align",
      "right",
    );
    expect(screen.getByRole("cell", { name: "15.00 USD" })).toHaveAttribute(
      "data-align",
      "right",
    );
    expect(screen.getAllByText("SO-100")).toHaveLength(1);
    expect(
      container.querySelector('[data-mobile="stacked"]'),
    ).toBeInTheDocument();
  });

  it("distinguishes filtered-empty views from an empty dataset", () => {
    const view = render(
      <DataTable
        caption="Ledger"
        mobile="scroll"
        filtered
        columns={[]}
        rows={[]}
        rowKey={() => "unused"}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "No matching results" }),
    ).toBeInTheDocument();
    view.rerender(
      <DataTable
        caption="Ledger"
        columns={[]}
        rows={[]}
        rowKey={() => "unused"}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "No results" }),
    ).toBeInTheDocument();
  });

  it("confirms a full identifier copy only after the clipboard operation succeeds", async () => {
    let finish!: () => void;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <Identifier
        value="30000000-0000-4000-8000-000000000001"
        label="seller ID"
        copyable
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy seller ID" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(
      "30000000-0000-4000-8000-000000000001",
    );
    await act(async () => finish());
    expect(screen.getByRole("status")).toHaveTextContent("seller ID copied");
  });

  it("reports clipboard failure and keeps the full identifier available", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(<Identifier value="SKU-123" label="SKU" copyable />);
    fireEvent.click(screen.getByRole("button", { name: "Copy SKU" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Copy is unavailable",
    );
    expect(screen.getByText("SKU-123")).toBeInTheDocument();
    expect(screen.queryByText("SKU copied")).not.toBeInTheDocument();
  });
});
