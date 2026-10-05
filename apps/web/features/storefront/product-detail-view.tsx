"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCart } from "@/features/cart/cart-context";
import { errorMessage } from "@/lib/api/client";
import type { StorefrontProductDetail } from "@/lib/api/types";
import {
  discountPercentage,
  StorefrontBreadcrumb,
  StorefrontPrice,
  StorefrontRating,
  StorefrontSeller,
} from "@/components/storefront/content";
import {
  StorefrontButton,
  StorefrontQuantity,
} from "@/components/storefront/controls";
import { ProductGallery } from "./detail/gallery";
import { RelatedProducts } from "./detail/related";
import { previousPrice } from "./detail/evidence";

const reviewDate = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function ProductContent({ product }: { product: StorefrontProductDetail }) {
  const { addItem } = useCart();
  const [variantId, setVariantId] = useState(
    product.variants.find((variant) => variant.in_stock)?.id ??
      product.variants[0]?.id,
  );
  const variant = product.variants.find((option) => option.id === variantId);
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const pendingRef = useRef(false);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (feedback?.kind === "error") feedbackRef.current?.focus();
  }, [feedback]);
  const price = variant?.price ?? product.starting_price;
  const compareAt = previousPrice(
    price,
    variant ? variant.compare_at_price : product.compare_at_price,
  );
  const discount = discountPercentage(price, compareAt);
  const available = Boolean(
    variant?.in_stock && variant.available_quantity > 0,
  );
  const maximum = variant?.available_quantity ?? 0;

  const addToCart = async () => {
    if (
      pendingRef.current ||
      !available ||
      !variant ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > maximum
    )
      return;
    pendingRef.current = true;
    setPending(true);
    setFeedback(null);
    try {
      await addItem(variant.id, quantity);
      if (alive.current)
        setFeedback({
          kind: "success",
          message: `${quantity === 1 ? "Item" : `${quantity} items`} added to cart.`,
        });
    } catch (error: unknown) {
      if (alive.current)
        setFeedback({ kind: "error", message: errorMessage(error) });
    } finally {
      pendingRef.current = false;
      if (alive.current) setPending(false);
    }
  };

  return (
    <div className="sf-pdp-container">
      <StorefrontBreadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/search" },
          {
            label: product.category.name,
            href: `/categories/${product.category.id}`,
          },
          { label: product.title },
        ]}
      />
      <div className="sf-pdp-main">
        <ProductGallery images={product.images} title={product.title} />
        <div className="sf-pdp-intro">
          <p className="sf-pdp-eyebrow">
            {product.brand ? (
              <Link href={`/search?brand=${product.brand.id}`}>
                {product.brand.name}
              </Link>
            ) : (
              <Link href={`/categories/${product.category.id}`}>
                {product.category.name}
              </Link>
            )}
          </p>
          <h1 data-long={product.title.length > 100}>{product.title}</h1>
          <StorefrontSeller
            id={product.seller.id}
            name={product.seller.store_name}
          />
          <a className="sf-pdp-review-link" href="#product-reviews">
            <StorefrontRating
              value={product.average_rating}
              count={product.review_count}
            />
          </a>
        </div>
        <div className="sf-pdp-purchase">
          <div className="sf-pdp-price-row">
            <StorefrontPrice
              amount={price}
              currency={product.currency}
              compareAt={compareAt}
            />
            {discount !== null && discount > 0 && (
              <span className="sf-pdp-saving">Save {discount}%</span>
            )}
          </div>
          {product.short_description && (
            <p className="sf-pdp-summary">{product.short_description}</p>
          )}
          {product.variants.length > 1 && (
            <fieldset className="sf-pdp-options" disabled={pending}>
              <legend>Choose your option</legend>
              <div className="sf-pdp-option-grid">
                {product.variants.map((option) => {
                  const label =
                    Object.values(option.attributes).join(" / ") || option.sku;
                  return (
                    <button
                      type="button"
                      key={option.id}
                      aria-pressed={variantId === option.id}
                      data-unavailable={!option.in_stock}
                      onClick={() => {
                        setVariantId(option.id);
                        setQuantity(1);
                        setFeedback(null);
                      }}
                    >
                      <span>{label}</span>
                      <StorefrontPrice
                        amount={option.price}
                        currency={product.currency}
                      />
                      {!option.in_stock && (
                        <span className="sf-pdp-caption">Out of stock</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          {product.variants.length === 1 &&
            variant &&
            Object.keys(variant.attributes).length > 0 && (
              <p className="sf-pdp-single-option">
                Option: {Object.values(variant.attributes).join(" / ")}
              </p>
            )}
          <p
            className="sf-pdp-stock"
            data-in-stock={available}
            aria-live="polite"
          >
            {available
              ? `In stock · ${maximum} available`
              : product.variants.length
                ? "This option is out of stock"
                : "No purchasable options available"}
          </p>
          <div className="sf-pdp-cart-controls">
            <StorefrontQuantity
              value={quantity}
              maximum={maximum}
              disabled={!available || pending}
              onChange={(value) => {
                setQuantity(value);
                setFeedback(null);
              }}
            />
            <StorefrontButton
              busy={pending}
              disabled={!available}
              onClick={() => {
                void addToCart();
              }}
            >
              {pending ? "Adding…" : "Add to cart"}
            </StorefrontButton>
          </div>
          <div className="sf-pdp-feedback">
            {feedback && (
              <p
                ref={feedbackRef}
                tabIndex={-1}
                role={feedback.kind === "error" ? "alert" : "status"}
                data-tone={feedback.kind}
              >
                {feedback.message}
                {feedback.kind === "success" && (
                  <>
                    {" "}
                    <Link href="/cart">View cart</Link>
                  </>
                )}
              </p>
            )}
          </div>
          <div className="sf-pdp-delivery">
            <p>Delivery</p>
            <span>
              Delivery options and charges are shown at checkout. No delivery
              date is provided for this listing.
            </span>
          </div>
        </div>
      </div>
      <nav className="sf-pdp-section-nav" aria-label="Product information">
        <a href="#product-details">Details</a>
        <a href="#product-specifications">Specifications</a>
        <a href="#product-seller">Seller</a>
        <a href="#product-reviews">
          Reviews{product.review_count > 0 ? ` (${product.review_count})` : ""}
        </a>
      </nav>
      <div className="sf-pdp-details-grid">
        <section
          id="product-details"
          tabIndex={-1}
          className="sf-pdp-details"
          aria-labelledby="product-details-title"
        >
          <p className="sf-pdp-eyebrow">A closer look</p>
          <h2 id="product-details-title">Product details</h2>
          <p className="sf-pdp-description">
            {product.description ||
              "The seller hasn’t provided a detailed description."}
          </p>
        </section>
        <section
          id="product-specifications"
          tabIndex={-1}
          className="sf-pdp-specifications"
          aria-labelledby="product-specifications-title"
        >
          <h2 id="product-specifications-title">Specifications</h2>
          <dl>
            <div>
              <dt>Category</dt>
              <dd>
                <Link href={`/categories/${product.category.id}`}>
                  {product.category.name}
                </Link>
              </dd>
            </div>
            {product.brand && (
              <div>
                <dt>Brand</dt>
                <dd>{product.brand.name}</dd>
              </div>
            )}
            {variant && (
              <>
                <div>
                  <dt>SKU</dt>
                  <dd>{variant.sku}</dd>
                </div>
                {Object.entries(variant.attributes).map(([name, value]) => (
                  <div key={name}>
                    <dt>{name.replaceAll("_", " ")}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </>
            )}
          </dl>
          {variant && Object.keys(variant.attributes).length > 0 && (
            <p className="sf-pdp-caption">For the selected option.</p>
          )}
        </section>
      </div>
      <section
        id="product-seller"
        tabIndex={-1}
        className="sf-pdp-seller-band"
        aria-labelledby="product-seller-title"
      >
        <div>
          <p className="sf-pdp-eyebrow">The store behind this product</p>
          <h2 id="product-seller-title">{product.seller.store_name}</h2>
          <p>Explore more products from this seller.</p>
        </div>
        <Link
          href={`/sellers/${product.seller.id}`}
          className="sf-pdp-text-link"
        >
          Visit store <span aria-hidden="true">↗</span>
        </Link>
      </section>
      <section
        id="product-reviews"
        tabIndex={-1}
        className="sf-pdp-reviews"
        aria-labelledby="product-reviews-title"
      >
        <div className="sf-pdp-section-heading">
          <div>
            <p className="sf-pdp-eyebrow">From the customers</p>
            <h2 id="product-reviews-title">Ratings & reviews</h2>
          </div>
          {product.review_count > 0 && (
            <StorefrontRating
              value={product.average_rating}
              count={product.review_count}
            />
          )}
        </div>
        {product.review_count === 0 ? (
          <p className="sf-pdp-caption">No customer reviews yet.</p>
        ) : (
          <div className="sf-pdp-review-grid">
            <div className="sf-pdp-review-summary">
              <p>
                {product.review_count}{" "}
                {product.review_count === 1 ? "review" : "reviews"}
              </p>
              <p className="sf-pdp-caption">All published ratings</p>
              <dl className="sf-pdp-rating-breakdown">
                {[5, 4, 3, 2, 1].map((star) => (
                  <div key={star}>
                    <dt>
                      {star} {star === 1 ? "star" : "stars"}
                    </dt>
                    <dd>
                      <meter
                        min={0}
                        max={Math.max(1, product.review_count)}
                        value={product.rating_breakdown[String(star)] ?? 0}
                        aria-label={`${star} star ratings`}
                      />
                      <span>{product.rating_breakdown[String(star)] ?? 0}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="sf-pdp-review-list">
              {product.recent_reviews.length === 0 ? (
                <p className="sf-pdp-caption">
                  Written reviews are unavailable for this listing.
                </p>
              ) : (
                <>
                  <p className="sf-pdp-caption">
                    {product.recent_reviews.length < product.review_count
                      ? `Showing ${product.recent_reviews.length} recent reviews.`
                      : "Customer feedback"}
                  </p>
                  {product.recent_reviews.map((review) => (
                    <article key={review.id}>
                      <div className="sf-pdp-review-meta">
                        <span>{review.customer_name}</span>
                        <time dateTime={review.created_at}>
                          {reviewDate.format(new Date(review.created_at))}
                        </time>
                      </div>
                      <div className="sf-pdp-review-rating">
                        <StorefrontRating value={review.rating} />
                        {review.verified_purchase && (
                          <span className="sf-pdp-verified">
                            Verified purchase
                          </span>
                        )}
                      </div>
                      {review.title && <h3>{review.title}</h3>}
                      <p>{review.body}</p>
                      {review.seller_response && (
                        <div className="sf-pdp-seller-response">
                          <p>Seller response</p>
                          <p>{review.seller_response}</p>
                        </div>
                      )}
                    </article>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </section>
      <RelatedProducts
        key={`${product.category.id}:${product.id}`}
        categoryId={product.category.id}
        categoryName={product.category.name}
        productId={product.id}
      />
    </div>
  );
}

export function ProductDetailView({
  product,
}: {
  product: StorefrontProductDetail;
}) {
  return <ProductContent key={product.id} product={product} />;
}
