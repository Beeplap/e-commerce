"use client";
import { StorefrontHeader } from "@/features/storefront/header";
import { StorefrontFooter } from "@/features/storefront/footer";
import { StorefrontBreadcrumb } from "@/components/storefront/content";
import { useCart } from "./cart-context";
import { useCartActions } from "./actions";
import { CartContents } from "./contents";

function CartBody() {
  const { identity } = useCart();
  const actions = useCartActions(identity);
  return <CartContents actions={actions} />;
}
export function CartPage() {
  const { identity } = useCart();
  return (
    <div className="sf-storefront sf-cart flex min-h-screen flex-col">
      <StorefrontHeader />
      <main
        id="storefront-content"
        tabIndex={-1}
        className="sf-cart-container flex-1"
      >
        <StorefrontBreadcrumb
          items={[{ label: "Home", href: "/" }, { label: "Shopping Cart" }]}
        />
        <header className="sf-cart-heading">
          <p className="sf-cart-eyebrow">Good finds, together</p>
          <h1>Shopping Cart</h1>
          <p>From your favorite stores to your doorstep.</p>
        </header>
        <CartBody key={identity} />
      </main>
      <StorefrontFooter />
    </div>
  );
}
