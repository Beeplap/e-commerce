import Link from "next/link";
import { StorefrontBrand } from "./brand";

const groups = [
  {
    title: "Shop",
    links: [
      { href: "/search", label: "All products" },
      { href: "/search?sort=newest", label: "New arrivals" },
      { href: "/cart", label: "Your cart" },
    ],
  },
  {
    title: "Your account",
    links: [
      { href: "/account/orders", label: "Orders & returns" },
      { href: "/account/profile", label: "Profile" },
      { href: "/account/addresses", label: "Saved addresses" },
    ],
  },
  {
    title: "Sell with us",
    links: [
      { href: "/onboarding", label: "Become a Seller" },
      { href: "/workspaces", label: "Your workspaces" },
    ],
  },
];

export function StorefrontFooter() {
  return (
    <footer className="sf-footer sf-shell-footer">
      <div className="sf-footer-inner">
        <div className="sf-footer-navigation">
          {groups.map((group) => (
            <nav key={group.title} aria-label={`Footer ${group.title}`}>
              <h2>{group.title}</h2>
              <ul>
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="sf-footer-bottom">
          <StorefrontBrand />
          <p>© {new Date().getUTCFullYear()} QuickCommerce</p>
        </div>
      </div>
    </footer>
  );
}
