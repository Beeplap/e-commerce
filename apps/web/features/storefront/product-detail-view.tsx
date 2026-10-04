"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/features/cart/cart-context";
import {
  discountPercentage,
  StorefrontPrice,
} from "@/components/storefront/content";
import { StorefrontQuantity } from "@/components/storefront/controls";
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

  const discountPercent = discountPercentage(activePrice, activeCompareAt);

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
        className="mb-6 flex items-center gap-2 text-xs text-sf-muted"
      >
        <Link href="/" className="hover:text-sf-link transition">
          Home
        </Link>
        <span>/</span>
        <Link
          href={`/categories/${product.category.id}`}
          className="hover:text-sf-link transition"
        >
          {product.category.name}
        </Link>
        <span>/</span>
        <span className="font-semibold text-sf-foreground truncate max-w-xs">
          {product.title}
        </span>
      </nav>

      {/* Main Grid: Gallery + Purchasing Details */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Media Gallery */}
        <div className="space-y-4">
          <div className="relative aspect-square w-full overflow-hidden rounded-sf-image border border-sf-border bg-sf-surface-strong">
            {selectedImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={selectedImage}
                alt={product.title}
                className="h-full w-full object-cover object-center"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sf-muted">
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
                  className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-sf-control border-2 transition ${
                    selectedImage === img.url
                      ? "border-sf-action ring-2 ring-sf-action"
                      : "border-sf-border"
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
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-sf-link">
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
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-sf-foreground sm:text-3xl">
            {product.title}
          </h1>

          {/* Rating Summary */}
          <div className="mt-3 flex items-center gap-3">
            {product.average_rating ? (
              <div className="flex items-center gap-1.5">
                <div className="flex text-sf-warning-text text-sm">
                  {"★".repeat(Math.round(product.average_rating))}
                  {"☆".repeat(5 - Math.round(product.average_rating))}
                </div>
                <span className="text-sm font-bold text-sf-foreground">
                  {product.average_rating.toFixed(1)}
                </span>
                <span className="text-xs text-sf-muted">
                  ({product.review_count} verified reviews)
                </span>
              </div>
            ) : (
              <span className="text-xs text-sf-muted">No ratings yet</span>
            )}
          </div>

          {/* Seller Store Badge */}
          <div className="mt-4 flex items-center gap-2 rounded-sf-control border border-sf-border bg-sf-background p-3 text-sm">
            <span className="text-sf-muted">Sold & Shipped by:</span>
            <Link
              href={`/sellers/${product.seller.id}`}
              className="font-semibold text-sf-link hover:underline"
            >
              {product.seller.store_name}
            </Link>
            <span className="rounded bg-sf-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-sf-link">
              Verified Seller
            </span>
          </div>

          {/* Price & Savings */}
          <div className="mt-6 flex items-baseline gap-3">
            <StorefrontPrice
              amount={activePrice}
              currency={product.currency}
              compareAt={activeCompareAt}
              className="text-3xl"
            />
            {discountPercent !== null && (
              <span className="rounded-full bg-sf-danger-surface px-2.5 py-1 text-xs font-bold text-sf-danger">
                Save {discountPercent}%
              </span>
            )}
          </div>

          {/* Short Description */}
          {product.short_description && (
            <p className="mt-4 text-sm leading-relaxed text-sf-soft">
              {product.short_description}
            </p>
          )}

          {/* Variant Selector */}
          {product.variants.length > 1 && (
            <div className="mt-6 border-t border-sf-border pt-6">
              <label className="block text-sm font-semibold text-sf-foreground">
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
                      className={`flex flex-col items-start rounded-sf-image border p-3 text-left transition ${
                        isSelected
                          ? "border-sf-action bg-sf-accent-soft/50 ring-2 ring-sf-action"
                          : "border-sf-border hover:border-sf-control"
                      }`}
                    >
                      <span className="text-xs font-semibold text-sf-foreground">
                        {attrLabels}
                      </span>
                      <span className="mt-1 text-xs font-bold text-sf-soft">
                        <StorefrontPrice
                          amount={v.price}
                          currency={product.currency}
                        />
                      </span>
                      <span
                        className={`mt-1 text-[10px] font-medium ${
                          v.in_stock ? "text-sf-success" : "text-sf-muted"
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
                isAvailable
                  ? "bg-sf-success motion-safe:animate-pulse"
                  : "bg-sf-border"
              }`}
            />
            <span
              className={`text-sm font-medium ${
                isAvailable ? "text-sf-success" : "text-sf-muted"
              }`}
            >
              {isAvailable
                ? `In Stock (${availableQty} units ready to ship)`
                : "Temporarily out of stock"}
            </span>
          </div>

          {/* Purchasing Controls */}
          <div className="mt-6 flex items-center gap-4">
            <StorefrontQuantity
              value={quantity}
              maximum={availableQty}
              disabled={!isAvailable}
              onChange={setQuantity}
            />

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!isAvailable}
              className="flex-1 rounded-sf-image bg-sf-action px-6 py-3 text-sm font-bold text-sf-on-dark shadow-sf-small transition hover:bg-sf-action-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add to Cart
            </button>
          </div>

          {addedToCartNotification && (
            <div className="mt-3 rounded-sf-control bg-sf-success-surface border border-sf-success p-3 text-xs font-medium text-sf-success animate-in fade-in">
              ✓ Added to cart! Real-time cart reservations active.
            </div>
          )}

          {/* Full Description */}
          {product.description && (
            <div className="mt-10 border-t border-sf-border pt-6">
              <h2 className="text-base font-bold text-sf-foreground">
                Product Details
              </h2>
              <div className="mt-3 text-sm leading-relaxed text-sf-soft whitespace-pre-line">
                {product.description}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ratings & Customer Reviews Section */}
      <section className="mt-16 border-t border-sf-border pt-10">
        <h2 className="text-xl font-bold text-sf-foreground">
          Customer Ratings & Reviews
        </h2>

        <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Score & Breakdown */}
          <div className="rounded-sf-image border border-sf-border bg-sf-background p-6">
            <div className="text-center">
              <div className="text-4xl font-extrabold text-sf-foreground">
                {product.average_rating
                  ? product.average_rating.toFixed(1)
                  : "N/A"}
              </div>
              <div className="mt-1 flex justify-center text-sf-warning-text text-lg">
                {"★".repeat(Math.round(product.average_rating || 0))}
                {"☆".repeat(5 - Math.round(product.average_rating || 0))}
              </div>
              <p className="mt-1 text-xs text-sf-muted">
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
                    <span className="w-4 font-semibold text-sf-soft">
                      {star}★
                    </span>
                    <div className="h-2 flex-1 rounded-full bg-sf-border overflow-hidden">
                      <div
                        className="h-full bg-sf-warning transition-all duration-[var(--sf-duration-normal)]"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-sf-muted">
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
              <div className="rounded-sf-image border border-dashed border-sf-control p-8 text-center text-sm text-sf-muted">
                No customer reviews yet. Be the first verified customer to share
                feedback!
              </div>
            ) : (
              product.recent_reviews.map((rev) => (
                <article
                  key={rev.id}
                  className="rounded-sf-image border border-sf-border bg-sf-surface p-5 shadow-sf-small space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sf-foreground">
                        {rev.customer_name}
                      </span>
                      {rev.verified_purchase && (
                        <span className="rounded bg-sf-success-surface px-1.5 py-0.5 text-[10px] font-bold text-sf-success">
                          Verified Purchase
                        </span>
                      )}
                    </div>
                    <time className="text-sf-muted">
                      {new Date(rev.created_at).toLocaleDateString()}
                    </time>
                  </div>

                  <div className="flex text-sf-warning-text text-xs">
                    {"★".repeat(rev.rating)}
                    {"☆".repeat(5 - rev.rating)}
                  </div>

                  <h3 className="text-sm font-semibold text-sf-foreground">
                    {rev.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-sf-soft">
                    {rev.body}
                  </p>

                  {/* Seller Response */}
                  {rev.seller_response && (
                    <div className="mt-3 rounded-sf-control border-l-2 border-sf-action bg-sf-background p-3 text-xs">
                      <div className="font-semibold text-sf-link">
                        Seller Response:
                      </div>
                      <p className="mt-0.5 text-sf-soft">
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
