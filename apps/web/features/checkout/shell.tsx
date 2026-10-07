import type { ReactNode } from "react";
import { StorefrontBreadcrumb } from "@/components/storefront/content";
import { StorefrontHeader } from "../storefront/header";
import { StorefrontFooter } from "../storefront/footer";

export function CheckoutShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="sf-storefront sf-checkout">
      <StorefrontHeader />
      <main
        id="storefront-content"
        tabIndex={-1}
        className="sf-checkout-main sf-container"
      >
        <StorefrontBreadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Cart", href: "/cart" },
            { label: title },
          ]}
        />
        <header className="sf-checkout-heading">
          <p className="sf-eyebrow">A few details, then it’s yours</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>
        {children}
      </main>
      <StorefrontFooter />
    </div>
  );
}
