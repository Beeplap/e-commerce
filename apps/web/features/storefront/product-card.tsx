import Link from "next/link";
import type { StorefrontProductCard as ProductCardType } from "@/lib/api/types";

interface ProductCardProps {
  product: ProductCardType;
}

export function ProductCard({ product }: ProductCardProps) {
  const discountPercent =
    product.compare_at_price &&
    parseFloat(product.compare_at_price) > parseFloat(product.starting_price)
      ? Math.round(
          ((parseFloat(product.compare_at_price) -
            parseFloat(product.starting_price)) /
            parseFloat(product.compare_at_price)) *
            100,
        )
      : null;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-ui-surface shadow-sm transition hover:shadow-md">
      {/* Image Container */}
      <Link
        href={`/products/${product.id}`}
        className="relative aspect-square w-full overflow-hidden bg-slate-100"
      >
        {product.thumbnail_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.thumbnail_url}
            alt={product.title}
            className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <svg
              className="h-16 w-16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Discount Badge */}
        {discountPercent !== null && (
          <span className="absolute top-2.5 left-2.5 rounded-md bg-rose-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
            {discountPercent}% OFF
          </span>
        )}

        {/* Stock Badge */}
        <span
          className={`absolute top-2.5 right-2.5 rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide ${
            product.in_stock
              ? "bg-emerald-100 text-emerald-800"
              : "bg-slate-200 text-slate-700"
          }`}
        >
          {product.in_stock ? "In Stock" : "Out of Stock"}
        </span>
      </Link>

      {/* Product Info */}
      <div className="flex flex-1 flex-col p-4">
        {/* Category & Brand */}
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <Link
            href={`/categories/${product.category_id}`}
            className="truncate hover:text-orange-700 transition"
          >
            {product.category_name}
          </Link>
          {product.brand_name && (
            <span className="truncate">{product.brand_name}</span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-slate-900 group-hover:text-orange-700 transition line-clamp-2">
          <Link href={`/products/${product.id}`}>{product.title}</Link>
        </h3>

        {/* Rating */}
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          {product.average_rating ? (
            <>
              <div className="flex text-amber-400">
                {"★".repeat(Math.round(product.average_rating))}
                {"☆".repeat(5 - Math.round(product.average_rating))}
              </div>
              <span className="font-semibold text-slate-700">
                {product.average_rating.toFixed(1)}
              </span>
              <span>({product.review_count})</span>
            </>
          ) : (
            <span className="text-slate-400">No reviews yet</span>
          )}
        </div>

        {/* Seller Info */}
        <div className="mt-2 text-xs text-slate-500">
          Sold by{" "}
          <Link
            href={`/sellers/${product.seller.id}`}
            className="font-medium text-slate-700 hover:text-orange-700 transition underline underline-offset-2"
          >
            {product.seller.store_name}
          </Link>
        </div>

        {/* Price & CTA */}
        <div className="mt-auto pt-4 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-slate-900">
              ${parseFloat(product.starting_price).toFixed(2)}
            </span>
            {product.compare_at_price && (
              <span className="text-xs text-slate-400 line-through">
                ${parseFloat(product.compare_at_price).toFixed(2)}
              </span>
            )}
          </div>

          <Link
            href={`/products/${product.id}`}
            className="rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800 transition hover:bg-orange-700 hover:text-white"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}
