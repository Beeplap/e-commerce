import Link from "next/link";

export function StorefrontBrand() {
  return (
    <Link href="/" className="sf-brand" aria-label="QuickCommerce home">
      <span className="sf-brand-mark" aria-hidden="true">
        QC
      </span>
      <span className="sf-brand-name">QuickCommerce</span>
    </Link>
  );
}
