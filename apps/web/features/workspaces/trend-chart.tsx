"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { formatMoney } from "@/components/ui/displays";
import { EmptyState } from "@/components/ui/primitives";

export type TrendPoint = { date: string; value: string; orders: number };
export function trendGeometry(points: readonly TrendPoint[]) {
  const precision = Math.max(
    2,
    ...points.map((point) => point.value.split(".")[1]?.length ?? 0),
  );
  const units = points.map(({ value }) => {
    if (!/^-?\d+(?:\.\d+)?$/.test(value))
      throw new Error("A decimal trend value is required.");
    const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
    const absolute = BigInt(whole! + fraction.padEnd(precision, "0"));
    return value.startsWith("-") ? -absolute : absolute;
  });
  const min = units.reduce((a, b) => (a < b ? a : b), BigInt(0));
  const max = units.reduce((a, b) => (a > b ? a : b), BigInt(0));
  const span = max - min || BigInt(1);
  const dates = points.map((point) => {
    const date = Date.parse(`${point.date}T00:00:00Z`);
    if (!Number.isFinite(date))
      throw new Error("A valid trend date is required.");
    return date;
  });
  const first = Math.min(...dates),
    last = Math.max(...dates);
  // Only bounded coordinate ratios become Number. Financial amounts stay exact.
  return points.map((point, index) => ({
    ...point,
    x:
      first === last ? 50 : 4 + ((dates[index]! - first) / (last - first)) * 92,
    y: 92 - Number(((units[index]! - min) * BigInt(8400)) / span) / 100,
  }));
}

function dayLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function TrendChart({
  points,
  currency,
  label,
  secondaryLabel,
  secondaryValues,
}: {
  points: readonly TrendPoint[];
  currency: string;
  label: string;
  secondaryLabel: string;
  secondaryValues: readonly string[];
}) {
  const [series, setSeries] = useState<"sales" | "secondary" | "orders">(
    "sales",
  );
  const [selected, setSelected] = useState(0);
  const [showData, setShowData] = useState(false);
  const identity = useId();
  const data = points.map((point, index) => ({
    ...point,
    value:
      series === "orders"
        ? String(point.orders)
        : series === "secondary"
          ? secondaryValues[index]!
          : point.value,
  }));
  if (!data.length)
    return (
      <EmptyState
        title="No sales activity"
        description="There are no recorded orders in this period."
      />
    );
  const positions = trendGeometry(data);
  const current = positions[Math.min(selected, positions.length - 1)]!;
  const valueLabel = (value: string) =>
    series === "orders"
      ? `${new Intl.NumberFormat("en-US").format(BigInt(value))} orders`
      : formatMoney(value, currency);
  const currentLabel =
    series === "orders"
      ? "Orders"
      : series === "secondary"
        ? secondaryLabel
        : label;
  const highest = positions.reduce((a, b) => (b.y < a.y ? b : a));
  const lowest = positions.reduce((a, b) => (b.y > a.y ? b : a));
  return (
    <figure className="min-w-0">
      <div
        role="group"
        aria-label="Trend measure"
        className="mb-3 flex flex-wrap gap-1"
      >
        {(
          [
            ["sales", label],
            ["secondary", secondaryLabel],
            ["orders", "Orders"],
          ] as const
        ).map(([value, text]) => (
          <Button
            key={value}
            variant="quiet"
            aria-pressed={series === value}
            className={series === value ? "bg-ui-selected text-ui-accent" : ""}
            onClick={() => {
              setSeries(value);
              setSelected(0);
            }}
          >
            {text}
          </Button>
        ))}
      </div>
      <div className="mb-1 flex flex-wrap justify-between gap-2 text-ui-caption text-ui-secondary">
        <span>{currentLabel}</span>
        <span>
          {valueLabel(
            highest.y === 8
              ? highest.value
              : series === "orders"
                ? "0"
                : "0.00",
          )}
        </span>
      </div>
      <div
        role="group"
        tabIndex={0}
        aria-label={`${currentLabel} chart. Use Left and Right arrows to inspect dates.`}
        aria-describedby={`${identity}-value`}
        className="relative rounded-control bg-ui-surface"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          setSelected((index) =>
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? positions.length - 1
                : Math.max(
                    0,
                    Math.min(
                      positions.length - 1,
                      index + (event.key === "ArrowRight" ? 1 : -1),
                    ),
                  ),
          );
        }}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          if (!box.width) return;
          const x = ((event.clientX - box.left) / box.width) * 100;
          let nearest = 0;
          positions.forEach((point, index) => {
            if (Math.abs(point.x - x) < Math.abs(positions[nearest]!.x - x))
              nearest = index;
          });
          setSelected(nearest);
        }}
      >
        <svg
          viewBox="0 0 100 100"
          width="100%"
          height="180"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {[8, 50, 92].map((y) => (
            <line
              key={y}
              x1="0"
              x2="100"
              y1={y}
              y2={y}
              stroke="var(--ui-border)"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <polyline
            points={positions.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke="var(--ui-accent)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={current.x}
            x2={current.x}
            y1="8"
            y2="92"
            stroke="var(--ui-control-border)"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ui-accent"
          style={{ left: `${current.x}%`, top: `${current.y}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between gap-2 text-ui-caption text-ui-muted">
        <time dateTime={data[0]!.date}>{dayLabel(data[0]!.date)}</time>
        <span>
          {valueLabel(
            lowest.y === 92 ? lowest.value : series === "orders" ? "0" : "0.00",
          )}
        </span>
        {data.length > 1 && (
          <time dateTime={data.at(-1)!.date}>
            {dayLabel(data.at(-1)!.date)}
          </time>
        )}
      </div>
      <figcaption
        id={`${identity}-value`}
        role="status"
        className="mt-3 min-h-11 border-t border-ui-border pt-3 text-ui-body"
      >
        <time dateTime={current.date}>{dayLabel(current.date)}</time>{" "}
        <span className="mx-2 text-ui-muted" aria-hidden="true">
          /
        </span>{" "}
        <span className="font-semibold tabular-nums">
          {valueLabel(current.value)}
        </span>
      </figcaption>
      <p className="text-ui-caption text-ui-muted">
        Recorded order days only. Missing dates are not filled with estimates.
      </p>
      <details
        className="mt-3"
        onToggle={(event) => setShowData(event.currentTarget.open)}
      >
        <summary className="flex min-h-11 cursor-pointer items-center text-ui-body font-medium text-ui-accent hover:underline">
          View trend data
        </summary>
        {showData && (
          <DataTable
            caption="Recorded daily trend data"
            mobile="scroll"
            rows={points.map((point, index) => ({
              ...point,
              secondary: secondaryValues[index]!,
            }))}
            rowKey={(point) => point.date}
            columns={[
              {
                id: "date",
                heading: "Date",
                cell: (point) => (
                  <time dateTime={point.date}>{point.date}</time>
                ),
              },
              {
                id: "sales",
                heading: label,
                align: "right",
                cell: (point) => formatMoney(point.value, currency),
              },
              {
                id: "secondary",
                heading: secondaryLabel,
                align: "right",
                cell: (point) => formatMoney(point.secondary, currency),
              },
              {
                id: "orders",
                heading: "Orders",
                align: "right",
                cell: (point) =>
                  new Intl.NumberFormat("en-US").format(point.orders),
              },
            ]}
          />
        )}
      </details>
    </figure>
  );
}
