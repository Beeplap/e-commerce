"use client";
import { useState } from "react";

export function ReportingCurrency({
  currency,
  currencies,
  onChange,
}: {
  currency: string;
  currencies: readonly string[] | null;
  onChange: (currency: string) => void;
}) {
  const [previous, setPrevious] = useState(currencies);
  if (currencies !== null && currencies !== previous) setPrevious(currencies);
  const options = currencies ?? previous ?? [currency];
  return (
    <label className="flex min-h-11 items-center gap-2 text-ui-caption text-ui-secondary">
      Reporting currency
      <select
        value={currency}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-sm border border-ui-control-border bg-ui-surface px-3 text-ui-body text-ui-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus"
      >
        {options.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
    </label>
  );
}
