import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Identifier } from "@/components/ui/identifier";
import { LoadingState } from "@/components/ui/primitives";
import { QueryRegion } from "@/components/ui/query-region";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("loading continuity and confirmed feedback", () => {
  it("keeps measured geometry during reload without retaining the previous records", () => {
    let measure!: ResizeObserverCallback;
    const disconnect = vi.fn();
    const observe = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          measure = callback;
        }
        observe = observe;
        disconnect = disconnect;
      },
    );
    const view = render(
      <QueryRegion busy={false}>
        <p>Previous seller record</p>
      </QueryRegion>,
    );
    const region = view.container.firstElementChild as HTMLElement;
    expect(observe).toHaveBeenCalledWith(region);
    act(() =>
      measure(
        [{ contentRect: { height: 640 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      ),
    );
    view.rerender(
      <QueryRegion busy>
        <LoadingState variant="table" label="Loading orders" />
      </QueryRegion>,
    );
    expect(region).toHaveStyle({ minHeight: "640px" });
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(
      screen.queryByText("Previous seller record"),
    ).not.toBeInTheDocument();
    expect(disconnect).toHaveBeenCalledTimes(1);
    view.rerender(
      <QueryRegion busy={false}>
        <p>New seller record</p>
      </QueryRegion>,
    );
    expect(region.style.minHeight).toBe("");
    expect(region).toHaveAttribute("aria-busy", "false");
    view.unmount();
    expect(disconnect).toHaveBeenCalledTimes(2);
  });

  it("can load without browser measurement support or fake table records", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const view = render(
      <QueryRegion busy={false}>
        <p>Current record</p>
      </QueryRegion>,
    );
    for (const variant of [
      "section",
      "table",
      "dashboard",
      "detail",
    ] as const) {
      view.rerender(
        <QueryRegion busy>
          <LoadingState variant={variant} label="Loading current view" />
        </QueryRegion>,
      );
      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(screen.getByRole("status")).toHaveTextContent(
        "Loading current view",
      );
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.queryByText("Current record")).not.toBeInTheDocument();
    }
  });

  it("prevents duplicate clipboard operations and confirms success inside the existing control", async () => {
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
    render(<Identifier value="SO-123" label="order number" copyable />);
    const copy = screen.getByRole("button", { name: "Copy order number" });
    fireEvent.click(copy);
    fireEvent.click(copy);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(copy).toBeDisabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await act(async () => finish());
    expect(copy).toBeEnabled();
    expect(copy).toHaveAttribute("title", "order number copied");
    expect(screen.getByRole("status")).toHaveTextContent("order number copied");
  });

  it("does not announce an old identifier as copied when the visible record changes", async () => {
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
    const view = render(
      <Identifier value="OLD" label="order number" copyable />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy order number" }));
    view.rerender(<Identifier value="NEW" label="order number" copyable />);
    await act(async () => finish());
    expect(writeText).toHaveBeenCalledWith("OLD");
    expect(screen.getByText("NEW")).toBeInTheDocument();
    expect(screen.queryByText("OLD")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy order number" }),
    ).toHaveAttribute("title", "Copy order number");
  });
});
