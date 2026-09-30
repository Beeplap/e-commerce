export function formatMoney(
  amount: string,
  currency: string,
  locale = "en-US",
): string {
  if (!/^-?\d+(?:\.\d+)?$/.test(amount) || !/^[A-Z]{3}$/.test(currency)) {
    throw new Error("A decimal amount and currency code are required.");
  }
  const negative = amount.startsWith("-");
  const [whole = "0", fraction] = amount.replace(/^-/, "").split(".");
  const grouped = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(BigInt(whole));
  const decimal =
    new Intl.NumberFormat(locale)
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")?.value ?? ".";
  // No binary floating-point conversion or implicit rounding of financial values.
  return `${negative ? "−" : ""}${grouped}${fraction ? decimal + fraction : ""}\u00a0${currency}`;
}

export function Money({
  amount,
  currency,
  locale,
}: {
  amount: string;
  currency: string;
  locale?: string;
}) {
  return (
    <span className="tabular-nums">
      {formatMoney(amount, currency, locale)}
    </span>
  );
}

export function DateDisplay({
  value,
  timezone = "UTC",
  locale = "en-US",
}: {
  value: string | null;
  timezone?: string;
  locale?: string;
}) {
  if (value === null) return <span>Not set</span>;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new Error("A valid date is required.");
  return (
    <time dateTime={date.toISOString()}>
      {new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: timezone,
      }).format(date)}
    </time>
  );
}
