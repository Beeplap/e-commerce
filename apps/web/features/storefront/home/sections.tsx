import Link from "next/link";
import {
  StorefrontImage,
  StorefrontPrice,
  StorefrontRating,
  StorefrontSeller,
  StorefrontSectionHeader,
  StorefrontSkeleton,
} from "@/components/storefront/content";
import { StorefrontButton } from "@/components/storefront/controls";
import type { StorefrontProductCard } from "@/lib/api/types";
import { ShellIcon } from "../shell-icons";
import { homeSellers } from "./catalog";
import type { useHomeCatalog } from "./use-home-catalog";

type HomeData = ReturnType<typeof useHomeCatalog>;
const productHref = (id: string) => `/products/${encodeURIComponent(id)}`;

export function HomeHero({ catalog }: Pick<HomeData, "catalog">) {
  const product =
    catalog.kind === "ready" ? catalog.value.products[0] : undefined;
  return (
    <section
      className="sf-home-hero sf-home-container"
      aria-labelledby="home-title"
    >
      <div className="sf-home-hero-copy">
        <p className="sf-home-eyebrow">The independent marketplace</p>
        <h1 id="home-title">
          Good finds.
          <br /> <em>Independent shops.</em>
        </h1>
        <p className="sf-home-hero-description">
          Explore new arrivals and the independent shops behind them.
        </p>
        <div className="sf-home-hero-actions">
          <Link
            href="/search?sort=newest"
            className="sf-button"
            data-variant="primary"
          >
            Shop new arrivals <ShellIcon name="arrow" />
          </Link>
          <a href="#sellers" className="sf-home-text-link">
            Explore the shops <ShellIcon name="arrow" />
          </a>
        </div>
      </div>
      <div className="sf-home-spotlight">
        <p className="sf-home-eyebrow">From the latest arrivals</p>
        {product ? (
          <article
            className="sf-home-feature"
            data-has-image={Boolean(product.thumbnail_url)}
          >
            <Link
              href={productHref(product.id)}
              className="sf-home-feature-visual"
              aria-label={`View ${product.title}`}
            >
              {product.thumbnail_url ? (
                <StorefrontImage
                  src={product.thumbnail_url}
                  alt={product.title}
                  eager
                />
              ) : (
                <div className="sf-home-feature-type">
                  <span className="sf-home-eyebrow">
                    {product.category_name}
                  </span>
                  <span className="sf-home-feature-title">{product.title}</span>
                  <span className="sf-home-photo-status">
                    Product photo unavailable
                  </span>
                </div>
              )}
              <span className="sf-home-feature-arrow" aria-hidden="true">
                <ShellIcon name="arrow" />
              </span>
            </Link>
            <div className="sf-home-feature-details">
              <div>
                {product.thumbnail_url && (
                  <h2>
                    <Link href={productHref(product.id)}>{product.title}</Link>
                  </h2>
                )}
                <StorefrontSeller
                  id={product.seller.id}
                  name={product.seller.store_name}
                />
              </div>
              <StorefrontPrice
                amount={product.starting_price}
                currency={product.currency}
              />
            </div>
          </article>
        ) : catalog.kind === "loading" ? (
          <div
            className="sf-home-feature-loading"
            role="status"
            aria-label="Loading latest arrivals"
          >
            <StorefrontSkeleton />
            <StorefrontSkeleton />
          </div>
        ) : (
          <div className="sf-home-feature-note">
            <p>
              Find something
              <br />
              that feels like you.
            </p>
            <span>
              Browse products and the independent shops behind them, all in one
              place.
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

export function HomeCategories({
  categories,
  retryCategories,
}: Pick<HomeData, "categories" | "retryCategories">) {
  return (
    <section
      className="sf-home-categories sf-home-container"
      aria-labelledby="home-categories-title"
    >
      <div>
        <p className="sf-home-eyebrow">Follow your curiosity</p>
        <h2 id="home-categories-title">Shop by category</h2>
      </div>
      {categories.kind === "loading" ? (
        <div
          className="sf-home-category-loading"
          role="status"
          aria-label="Loading categories"
        >
          <StorefrontSkeleton />
          <StorefrontSkeleton />
        </div>
      ) : categories.kind === "error" ? (
        <div className="sf-home-small-state" role="status">
          <p>Categories are unavailable right now.</p>
          <StorefrontButton variant="quiet" onClick={retryCategories}>
            Retry categories
          </StorefrontButton>
        </div>
      ) : categories.value.length ? (
        <ul className="sf-home-category-links">
          {categories.value.slice(0, 6).map((category) => (
            <li key={category.id}>
              <Link href={`/categories/${encodeURIComponent(category.id)}`}>
                <span>
                  <strong>{category.name}</strong>{" "}
                  <span>
                    {category.product_count}{" "}
                    {category.product_count === 1 ? "product" : "products"}
                  </span>
                </span>
                <ShellIcon name="arrow" />
              </Link>
            </li>
          ))}
          {categories.value.length > 6 && (
            <li>
              <Link href="/search">
                <span>
                  <strong>More to explore</strong>
                  <span>Browse the full catalog</span>
                </span>
                <ShellIcon name="arrow" />
              </Link>
            </li>
          )}
        </ul>
      ) : (
        <p className="sf-home-small-state">
          Categories will appear here as the catalog grows.
        </p>
      )}
    </section>
  );
}

function HomeProduct({ product }: { product: StorefrontProductCard }) {
  return (
    <article
      className="sf-home-product"
      data-has-image={Boolean(product.thumbnail_url)}
    >
      <Link
        href={productHref(product.id)}
        className="sf-home-product-image"
        aria-label={`View ${product.title}`}
      >
        <StorefrontImage src={product.thumbnail_url} alt={product.title} />
      </Link>
      <div className="sf-home-product-details">
        <p className="sf-home-product-category">
          {product.brand_name || product.category_name}
        </p>
        <h3>
          <Link href={productHref(product.id)}>{product.title}</Link>
        </h3>
        <StorefrontSeller
          id={product.seller.id}
          name={product.seller.store_name}
        />
        <StorefrontPrice
          amount={product.starting_price}
          currency={product.currency}
          compareAt={product.compare_at_price}
        />
        {product.average_rating !== null && (
          <StorefrontRating
            value={product.average_rating}
            count={product.review_count}
          />
        )}
        <p className="sf-home-product-stock" data-in-stock={product.in_stock}>
          {product.in_stock ? "In stock" : "Currently out of stock"}
        </p>
      </div>
    </article>
  );
}

export function HomeArrivals({
  catalog,
  retryCatalog,
}: Pick<HomeData, "catalog" | "retryCatalog">) {
  const products =
    catalog.kind === "ready" ? catalog.value.products.slice(0, 8) : [];
  return (
    <section
      id="catalog"
      className="sf-home-arrivals sf-home-container"
      aria-labelledby="home-arrivals-title"
    >
      <StorefrontSectionHeader
        title={<span id="home-arrivals-title">New on the shelves</span>}
        description="The latest published products from independent shops."
        actions={
          <Link href="/search?sort=newest" className="sf-home-text-link">
            View all arrivals <ShellIcon name="arrow" />
          </Link>
        }
      />
      {catalog.kind === "loading" ? (
        <div
          className="sf-home-product-loading"
          role="status"
          aria-label="Loading products"
        >
          {[1, 2, 3, 4].map((value) => (
            <StorefrontSkeleton key={value} />
          ))}
        </div>
      ) : catalog.kind === "error" ? (
        <div className="sf-home-catalog-state" role="alert">
          <h3>We couldn’t load the latest arrivals.</h3>
          <p>
            Please try again. Products and seller stores will appear once the
            catalog is available.
          </p>
          <StorefrontButton variant="secondary" onClick={retryCatalog}>
            Retry latest arrivals
          </StorefrontButton>
        </div>
      ) : products.length ? (
        <div className="sf-home-products" data-count={products.length}>
          {products.map((product) => (
            <HomeProduct key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="sf-home-catalog-state">
          <p className="sf-home-eyebrow">The catalog is quiet for now</p>
          <h3>Nothing on the shelves yet.</h3>
          <p>
            No products are currently published. Come back to explore new
            arrivals as the catalog grows.
          </p>
          <Link href="/search" className="sf-home-text-link">
            Explore the catalog <ShellIcon name="arrow" />
          </Link>
        </div>
      )}
    </section>
  );
}

export function HomeShops({ catalog }: Pick<HomeData, "catalog">) {
  const sellers =
    catalog.kind === "ready" ? homeSellers(catalog.value.products) : [];
  return (
    <section
      id="sellers"
      className="sf-home-shops sf-home-container"
      aria-labelledby="home-shops-title"
    >
      <StorefrontSectionHeader
        title={<span id="home-shops-title">Meet the shops</span>}
        description="Stores represented in the latest arrivals."
      />
      {sellers.length ? (
        <ul className="sf-home-seller-links">
          {sellers.map(({ seller, categories }) => (
            <li key={seller.id}>
              <Link href={`/sellers/${encodeURIComponent(seller.id)}`}>
                <span>
                  <strong>{seller.store_name}</strong>{" "}
                  <span>{[...categories].slice(0, 3).join(" · ")}</span>
                </span>
                <ShellIcon name="arrow" />
              </Link>
              {seller.rating !== null && (
                <StorefrontRating value={seller.rating} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="sf-home-small-state">
          {catalog.kind === "loading"
            ? "Loading the shops behind the arrivals…"
            : catalog.kind === "error"
              ? "Retry the latest arrivals above to discover their sellers."
              : "Seller stores will appear here with their published products."}
        </p>
      )}
    </section>
  );
}

export function HomeEditorial() {
  return (
    <section
      className="sf-home-editorial"
      aria-labelledby="home-editorial-title"
    >
      <div className="sf-home-container sf-home-editorial-inner">
        <div>
          <h2 id="home-editorial-title">Bring your shop to QuickCommerce</h2>
        </div>
        <div>
          <p>
            Create a seller account to list your products in the marketplace.
          </p>
          <Link href="/onboarding" className="sf-home-text-link">
            Become a seller <ShellIcon name="arrow" />
          </Link>
        </div>
      </div>
    </section>
  );
}
