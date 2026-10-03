"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/features/cart/cart-context";
import type {
  StorefrontProductDetail,
  StorefrontVariant,
} from "@/lib/api/types";

interface ProductDetailViewProps {
  product: StorefrontProductDetail;
}

export function ProductDetailView({ product }: ProductDetailViewProps) {
  const { addItem } = useCart();
  const [selectedVariant, setSelectedVariant] =
    useState<StorefrontVariant | null>(product.variants[0] || null);
  const [selectedImage, setSelectedImage] = useState<string | null>(
    product.images[0]?.url || null,
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [addedToCartNotification, setAddedToCartNotification] = useState(false);

  const activePrice = selectedVariant
    ? selectedVariant.price
    : product.starting_price;
  const activeCompareAt = selectedVariant
    ? selectedVariant.compare_at_price
    : product.compare_at_price;
  const isAvailable = selectedVariant
    ? selectedVariant.in_stock
    : product.in_stock;
  const availableQty = selectedVariant
    ? selectedVariant.available_quantity
    : product.total_available_stock;

  const discountPercent =
    activeCompareAt && parseFloat(activeCompareAt) > parseFloat(activePrice)
      ? Math.round(
          ((parseFloat(activeCompareAt) - parseFloat(activePrice)) /
            parseFloat(activeCompareAt)) *
            100,
        )
      : null;

  const handleAddToCart = () => {
    if (!isAvailable || !selectedVariant) return;
    setAddedToCartNotification(true);
    setTimeout(() => setAddedToCartNotification(false), 3000);
    void addItem(selectedVariant.id, quantity).catch(() => {});
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex items-center gap-2 text-xs text-slate-500"
      >
        <Link href="/" className="hover:text-teal-700 transition">
          Home
        </Link>
        <span>/</span>
        <Link
          href={`/categories/${product.category.id}`}
          className="hover:text-teal-700 transition"
        >
          {product.category.name}
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-900 truncate max-w-xs">
          {product.title}
        </span>
      </nav>

      {/* Main Grid: Gallery + Purchasing Details */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Media Gallery */}
        <div className="space-y-4">
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner">
            {selectedImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={selectedImage}
                alt={product.title}
                className="h-full w-full object-cover object-center"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-300">
                <svg
                  className="h-24 w-24"
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
          </div>

          {/* Thumbnail Strip */}
          {product.images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {product.images.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setSelectedImage(img.url)}
                  className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${
                    selectedImage === img.url
                      ? "border-teal-700 ring-2 ring-teal-200"
                      : "border-slate-200"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt_text}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info & Controls */}
        <div className="flex flex-col">
          {/* Brand & Category badges */}
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-teal-800">
            {product.brand && (
              <Link
                href={`/brands/${product.brand.id}`}
                className="hover:underline"
              >
                {product.brand.name}
              </Link>
            )}
            {product.brand && <span>•</span>}
            <Link
              href={`/categories/${product.category.id}`}
              className="hover:underline"
            >
              {product.category.name}
            </Link>
          </div>

          {/* Title */}
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {product.title}
          </h1>

          {/* Rating Summary */}
          <div className="mt-3 flex items-center gap-3">
            {product.average_rating ? (
              <div className="flex items-center gap-1.5">
                <div className="flex text-amber-400 text-sm">
                  {"★".repeat(Math.round(product.average_rating))}
                  {"☆".repeat(5 - Math.round(product.average_rating))}
                </div>
                <span className="text-sm font-bold text-slate-900">
                  {product.average_rating.toFixed(1)}
                </span>
                <span className="text-xs text-slate-500">
                  ({product.review_count} verified reviews)
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-400">No ratings yet</span>
            )}
          </div>

          {/* Seller Store Badge */}
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <span className="text-slate-500">Sold & Shipped by:</span>
            <Link
              href={`/sellers/${product.seller.id}`}
              className="font-semibold text-teal-900 hover:underline"
            >
              {product.seller.store_name}
            </Link>
            <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-800">
              Verified Seller
            </span>
          </div>

          {/* Price & Savings */}
          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-slate-900">
              ${parseFloat(activePrice).toFixed(2)}
            </span>
            {activeCompareAt && (
              <span className="text-lg text-slate-400 line-through">
                ${parseFloat(activeCompareAt).toFixed(2)}
              </span>
            )}
            {discountPercent !== null && (
              <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">
                Save {discountPercent}%
              </span>
            )}
          </div>

          {/* Short Description */}
          {product.short_description && (
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              {product.short_description}
            </p>
          )}

          {/* Variant Selector */}
          {product.variants.length > 1 && (
            <div className="mt-6 border-t border-slate-200 pt-6">
              <label className="block text-sm font-semibold text-slate-900">
                Select Option / Variant:
              </label>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {product.variants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id;
                  const attrLabels =
                    Object.values(v.attributes).join(" / ") || v.sku;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                        isSelected
                          ? "border-teal-700 bg-teal-50/50 ring-2 ring-teal-600"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="text-xs font-semibold text-slate-900">
                        {attrLabels}
                      </span>
                      <span className="mt-1 text-xs font-bold text-slate-700">
                        ${parseFloat(v.price).toFixed(2)}
                      </span>
                      <span
                        className={`mt-1 text-[10px] font-medium ${
                          v.in_stock ? "text-emerald-700" : "text-slate-400"
                        }`}
                      >
                        {v.in_stock
                          ? `${v.available_quantity} available`
                          : "Out of stock"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Real-time Inventory Status */}
          <div className="mt-6 flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isAvailable ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
              }`}
            />
            <span
              className={`text-sm font-medium ${
                isAvailable ? "text-emerald-700" : "text-slate-500"
              }`}
            >
              {isAvailable
                ? `In Stock (${availableQty} units ready to ship)`
                : "Temporarily out of stock"}
            </span>
          </div>

          {/* Purchasing Controls */}
          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center rounded-lg border border-slate-300">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1 || !isAvailable}
                className="px-3 py-2.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 rounded-l-lg transition"
                aria-label="Decrease quantity"
              >
                -
              </button>
              <span
                data-testid="selected-quantity"
                className="w-12 text-center text-sm font-semibold text-slate-800"
              >
                {quantity}
              </span>
              <button
                type="button"
                onClick={() =>
                  setQuantity(Math.min(availableQty, quantity + 1))
                }
                disabled={quantity >= availableQty || !isAvailable}
                className="px-3 py-2.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 rounded-r-lg transition"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!isAvailable}
              className="flex-1 rounded-xl bg-teal-800 px-6 py-3 text-sm font-bold text-white shadow transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add to Cart
            </button>
          </div>

          {addedToCartNotification && (
            <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-medium text-emerald-800 animate-in fade-in">
              ✓ Added to cart! Real-time cart reservations active.
            </div>
          )}

          {/* Full Description */}
          {product.description && (
            <div className="mt-10 border-t border-slate-200 pt-6">
              <h2 className="text-base font-bold text-slate-900">
                Product Details
              </h2>
              <div className="mt-3 text-sm leading-relaxed text-slate-600 whitespace-pre-line">
                {product.description}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ratings & Customer Reviews Section */}
      <section className="mt-16 border-t border-slate-200 pt-10">
        <h2 className="text-xl font-bold text-slate-900">
          Customer Ratings & Reviews
        </h2>

        <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Score & Breakdown */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
            <div className="text-center">
              <div className="text-4xl font-extrabold text-slate-900">
                {product.average_rating
                  ? product.average_rating.toFixed(1)
                  : "N/A"}
              </div>
              <div className="mt-1 flex justify-center text-amber-400 text-lg">
                {"★".repeat(Math.round(product.average_rating || 0))}
                {"☆".repeat(5 - Math.round(product.average_rating || 0))}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Based on {product.review_count} ratings
              </p>
            </div>

            {/* Distribution Bars */}
            <div className="mt-6 space-y-2 text-xs">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = product.rating_breakdown?.[String(star)] || 0;
                const percentage =
                  product.review_count > 0
                    ? (count / product.review_count) * 100
                    : 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="w-4 font-semibold text-slate-700">
                      {star}★
                    </span>
                    <div className="h-2 flex-1 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-amber-400 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-slate-500">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Verified Reviews List */}
          <div className="md:col-span-2 space-y-4">
            {product.recent_reviews.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                No customer reviews yet. Be the first verified customer to share
                feedback!
              </div>
            ) : (
              product.recent_reviews.map((rev) => (
                <article
                  key={rev.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">
                        {rev.customer_name}
                      </span>
                      {rev.verified_purchase && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          Verified Purchase
                        </span>
                      )}
                    </div>
                    <time className="text-slate-400">
                      {new Date(rev.created_at).toLocaleDateString()}
                    </time>
                  </div>

                  <div className="flex text-amber-400 text-xs">
                    {"★".repeat(rev.rating)}
                    {"☆".repeat(5 - rev.rating)}
                  </div>

                  <h3 className="text-sm font-semibold text-slate-900">
                    {rev.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-600">
                    {rev.body}
                  </p>

                  {/* Seller Response */}
                  {rev.seller_response && (
                    <div className="mt-3 rounded-lg border-l-2 border-teal-700 bg-slate-50 p-3 text-xs">
                      <div className="font-semibold text-teal-900">
                        Seller Response:
                      </div>
                      <p className="mt-0.5 text-slate-600">
                        {rev.seller_response}
                      </p>
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
