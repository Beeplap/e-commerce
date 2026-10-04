import Link from "next/link";
import type { ReactNode } from "react";
import { Money } from "@/components/ui/displays";

export function StorefrontBadge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  return (
    <span className={`sf-badge ${className}`} data-tone={tone}>
      {children}
    </span>
  );
}

export function StorefrontPrice({
  amount,
  currency,
  compareAt,
  className = "",
}: {
  amount: string;
  currency: string;
  compareAt?: string | null;
  className?: string;
}) {
  return (
    <span className={`sf-price ${className}`}>
      <Money amount={amount} currency={currency} />
      {compareAt && (
        <del aria-label="Previous price">
          <Money amount={compareAt} currency={currency} />
        </del>
      )}
    </span>
  );
}

/** Decimal strings stay exact, including values above Number.MAX_SAFE_INTEGER. */
export function discountPercentage(
  amount: string,
  compareAt: string | null,
): number | null {
  if (compareAt === null) return null;
  if (![amount, compareAt].every((value) => /^\d+(?:\.\d+)?$/.test(value)))
    throw new Error("Discount prices must be nonnegative decimal strings.");
  const places = Math.max(
    ...[amount, compareAt].map((value) => value.split(".")[1]?.length ?? 0),
  );
  const units = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole + fraction.padEnd(places, "0"));
  };
  const price = units(amount),
    previous = units(compareAt);
  if (previous === BigInt(0) || previous <= price) return null;
  // Only the bounded integer percentage (0–100), never money, becomes a Number.
  return Number(
    ((previous - price) * BigInt(100) + previous / BigInt(2)) / previous,
  );
}

export function StorefrontRating({
  value,
  count,
}: {
  value: number | null;
  count?: number;
}) {
  if (value === null)
    return <span className="sf-rating-count">No reviews yet</span>;
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 5 ||
    (count !== undefined && (!Number.isSafeInteger(count) || count < 0))
  )
    throw new Error("Rating evidence must be bounded.");
  const stars = Math.round(value);
  return (
    <span className="sf-rating">
      <span className="sf-rating-stars" aria-hidden="true">
        {"★".repeat(stars)}
        {"☆".repeat(5 - stars)}
      </span>
      <span>
        <span className="sr-only">Rated </span>
        {value.toFixed(1)}
        <span className="sr-only"> out of 5</span>
      </span>
      {count !== undefined && (
        <span className="sf-rating-count">
          <span>({count})</span>
          <span className="sr-only"> reviews</span>
        </span>
      )}
    </span>
  );
}

export function StorefrontSeller({ id, name }: { id: string; name: string }) {
  return (
    <span className="sf-seller">
      Sold by <Link href={`/sellers/${id}`}>{name}</Link>
    </span>
  );
}

export function StorefrontImage({
  src,
  alt,
  eager = false,
  children,
}: {
  src: string | null;
  alt: string;
  eager?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="sf-image">
      {src ? (
        // Existing authenticated/same-origin image URLs remain unchanged.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
        />
      ) : (
        <span className="sf-image-placeholder">
          Image unavailable<span className="sr-only"> for {alt}</span>
        </span>
      )}
      {children}
    </div>
  );
}

export function StorefrontBreadcrumb({
  items,
}: {
  items: ReadonlyArray<{ label: string; href?: string }>;
}) {
  return (
    <nav className="sf-breadcrumb" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => (
          <li key={`${index}-${item.label}`}>
            {item.href && index !== items.length - 1 ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span
                aria-current={index === items.length - 1 ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function StorefrontSectionHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="sf-section-header">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions}
    </header>
  );
}

export function StorefrontSkeleton({
  className = "h-6 w-full",
}: {
  className?: string;
}) {
  return <div aria-hidden="true" className={`sf-skeleton ${className}`} />;
}

export function StorefrontEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="sf-empty">
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}
