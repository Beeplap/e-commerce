import Link from "next/link";
import { StorefrontBrand } from "./brand";
import { ShellIcon } from "./shell-icons";

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
        <div className="sf-footer-intro">
          <div>
            <p className="sf-footer-eyebrow">The independent marketplace</p>
            <h2 className="sf-display">
              Independent shops.
              <br />
              One place to explore.
            </h2>
          </div>
          <Link href="/search" className="sf-footer-explore">
            Explore the catalog <ShellIcon name="arrow" />
          </Link>
        </div>
        <div className="sf-footer-navigation">
          {groups.map((group) => (
            <nav key={group.title} aria-label={`Footer ${group.title}`}>
              <h3>{group.title}</h3>
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
