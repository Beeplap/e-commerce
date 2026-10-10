import Link from "next/link";

export function StorefrontFooter() {
  return (
    <footer className="mt-20 border-t border-slate-200 bg-slate-50 text-slate-600">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-700 font-bold text-white">
                QC
              </span>
              <span className="text-lg font-bold text-slate-900">
                QuickCommerce
              </span>
            </div>
            <p className="text-sm leading-6 text-slate-500">
              The modern marketplace connecting customers with verified local
              and national sellers for lightning-fast fulfillment.
            </p>
            <div className="flex gap-4 text-xs text-slate-400">
              <span>© {new Date().getFullYear()} QuickCommerce, Inc.</span>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              Shop
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-orange-700 transition">
                  All Products
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-orange-700 transition">
                  Featured Categories
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-orange-700 transition">
                  Top Sellers
                </Link>
              </li>
            </ul>
          </div>

          {/* Sellers */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              For Sellers
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link
                  href="/onboarding"
                  className="hover:text-orange-700 transition"
                >
                  Become a Seller
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="hover:text-orange-700 transition"
                >
                  Seller Portal
                </Link>
              </li>
              <li>
                <Link
                  href="/workspaces"
                  className="hover:text-orange-700 transition"
                >
                  Seller Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Trust & Guarantee */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              Customer Trust
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-500">
              <li className="flex items-center gap-2">
                <span className="text-emerald-700">✓</span> 100% Verified
                Sellers
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-700">✓</span> Real-Time Stock
                Tracking
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-700">✓</span> Transparent Reviews
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-700">✓</span> Secure Checkout &
                Returns
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
