import Link from "next/link";

export function StorefrontFooter() {
  return (
    <footer className="sf-footer mt-20 border-t border-sf-dark-soft bg-sf-dark text-sf-dark-muted">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-sf-control bg-sf-action font-bold text-sf-on-dark">
                QC
              </span>
              <span className="text-lg font-bold text-sf-foreground">
                QuickCommerce
              </span>
            </div>
            <p className="text-sm leading-6 text-sf-muted">
              The modern marketplace connecting customers with verified local
              and national sellers for lightning-fast fulfillment.
            </p>
            <div className="flex gap-4 text-xs text-sf-muted">
              <span>© {new Date().getFullYear()} QuickCommerce, Inc.</span>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h3 className="text-sm font-semibold text-sf-foreground uppercase tracking-wider">
              Shop
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-sf-link transition">
                  All Products
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-sf-link transition">
                  Featured Categories
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-sf-link transition">
                  Top Sellers
                </Link>
              </li>
            </ul>
          </div>

          {/* Sellers */}
          <div>
            <h3 className="text-sm font-semibold text-sf-foreground uppercase tracking-wider">
              For Sellers
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link
                  href="/onboarding"
                  className="hover:text-sf-link transition"
                >
                  Become a Seller
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-sf-link transition">
                  Seller Portal
                </Link>
              </li>
              <li>
                <Link
                  href="/workspaces"
                  className="hover:text-sf-link transition"
                >
                  Seller Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Trust & Guarantee */}
          <div>
            <h3 className="text-sm font-semibold text-sf-foreground uppercase tracking-wider">
              Customer Trust
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-sf-muted">
              <li className="flex items-center gap-2">
                <span className="text-sf-link">✓</span> 100% Verified Sellers
              </li>
              <li className="flex items-center gap-2">
                <span className="text-sf-link">✓</span> Real-Time Stock Tracking
              </li>
              <li className="flex items-center gap-2">
                <span className="text-sf-link">✓</span> Transparent Reviews
              </li>
              <li className="flex items-center gap-2">
                <span className="text-sf-link">✓</span> Secure Checkout &
                Returns
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
