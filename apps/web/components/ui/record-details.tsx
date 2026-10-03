import type { ReactNode } from "react";

export function readableLabel(value: string) {
  return value.replaceAll("_", " ").replaceAll(".", " ");
}

function recordedValue(value: unknown, depth: number): ReactNode {
  if (value === null || value === "") return "Not supplied";
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (depth > 6)
    throw new Error("Recorded details exceed the supported nesting depth.");
  if (Array.isArray(value))
    return (
      <ul className="space-y-1">
        {value.map((item, index) => (
          <li key={index}>{recordedValue(item, depth + 1)}</li>
        ))}
      </ul>
    );
  if (typeof value === "object")
    return (
      <RecordDetails
        value={value as Record<string, unknown>}
        depth={depth + 1}
      />
    );
  throw new Error("Invalid recorded value.");
}

export function RecordDetails({
  value,
  emptyMessage = "No details recorded.",
  depth = 0,
}: {
  value: Record<string, unknown>;
  emptyMessage?: string;
  depth?: number;
}) {
  const entries = Object.entries(value);
  if (!entries.length)
    return <p className="text-ui-body text-ui-secondary">{emptyMessage}</p>;
  return (
    <dl className="grid min-w-0 gap-3">
      {entries.map(([key, entry]) => (
        <div key={key} className="min-w-0">
          <dt className="text-ui-caption capitalize text-ui-secondary">
            {readableLabel(key)}
          </dt>
          <dd className="mt-1 break-words whitespace-pre-wrap text-ui-body text-ui-foreground">
            {recordedValue(entry, depth)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
