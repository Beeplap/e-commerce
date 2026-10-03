import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrendChart, trendGeometry } from "@/features/workspaces/trend-chart";

const points = [
  { date: "2026-10-01", value: "9007199254740993.01", orders: 2 },
  { date: "2026-10-03", value: "20.10", orders: 4 },
  { date: "2026-10-11", value: "0.00", orders: 0 },
];

describe("dashboard trends", () => {
  it("keeps exact monetary values visible during keyboard inspection", () => {
    render(
      <TrendChart
        points={points}
        secondaryValues={["10.01", "18.00", "0.00"]}
        currency="USD"
        label="Gross sales"
        secondaryLabel="Net sales"
      />,
    );
    const chart = screen.getByRole("group", { name: /Gross sales chart/ });
    chart.focus();
    expect(
      within(screen.getByRole("status")).getByText(
        "9,007,199,254,740,993.01 USD",
      ),
    ).toBeInTheDocument();
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(screen.getByRole("status")).toHaveTextContent("Oct 3 / 20.10 USD");
    fireEvent.keyDown(chart, { key: "End" });
    expect(screen.getByRole("status")).toHaveTextContent("Oct 11 / 0.00 USD");
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(screen.getByRole("status")).toHaveTextContent("Oct 11");
    fireEvent.keyDown(chart, { key: "Home" });
    expect(screen.getByRole("status")).toHaveTextContent("Oct 1");
  });

  it("switches between actual revenue and order series with selected states", () => {
    render(
      <TrendChart
        points={points}
        secondaryValues={["10.01", "18.00", "0.00"]}
        currency="USD"
        label="Gross sales"
        secondaryLabel="Net sales"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Net sales" }));
    expect(screen.getByRole("button", { name: "Net sales" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent("10.01 USD");
    fireEvent.click(screen.getByRole("button", { name: "Orders" }));
    expect(
      screen.getByRole("group", { name: /Orders chart/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 orders");
  });

  it("preserves gaps between dates and handles exact large, zero and negative amounts", () => {
    const geometry = trendGeometry(points);
    expect(geometry).toHaveLength(3);
    expect(geometry[1]!.x - geometry[0]!.x).toBeLessThan(
      geometry[2]!.x - geometry[1]!.x,
    );
    for (const point of geometry) {
      expect(Number.isFinite(point.y)).toBe(true);
      expect(point.y).toBeGreaterThanOrEqual(8);
      expect(point.y).toBeLessThanOrEqual(92);
    }
    const negative = trendGeometry([
      { date: "2026-10-01", value: "-5.01", orders: 1 },
      { date: "2026-10-02", value: "0.00", orders: 0 },
    ]);
    expect(negative[0]!.y).toBeGreaterThan(negative[1]!.y);
  });

  it("shows an explicit empty state and no estimated points", () => {
    render(
      <TrendChart
        points={[]}
        secondaryValues={[]}
        currency="USD"
        label="Sales"
        secondaryLabel="Net sales"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "No sales activity" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: /chart/ }),
    ).not.toBeInTheDocument();
  });

  it("rejects malformed financial or date input instead of graphing a false zero", () => {
    expect(() =>
      trendGeometry([{ date: "2026-10-01", value: "NaN", orders: 1 }]),
    ).toThrow("decimal trend value");
    expect(() =>
      trendGeometry([{ date: "invalid", value: "1.00", orders: 1 }]),
    ).toThrow("valid trend date");
  });
});
