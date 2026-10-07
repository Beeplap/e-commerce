import type { IconName } from "@/components/ui/icon";
import type { CurrentUser } from "@/lib/api/types";
import { hasPlatformPermission } from "@/lib/permissions";

export type WorkspaceMode = "seller" | "admin" | "account" | "workspaces";
export const workspaceNames: Record<WorkspaceMode, string> = {
  seller: "Seller workspace",
  admin: "Platform workspace",
  account: "My account",
  workspaces: "Workspaces",
};
export type SellerNavigationAccess = {
  sellerCanReadSettings?: boolean;
  sellerCanReadProducts?: boolean;
  sellerCanReadInventory?: boolean;
  sellerCanReadOrders?: boolean;
  sellerCanReadFulfillment?: boolean;
  sellerCanReadReturns?: boolean;
  sellerCanReadFinance?: boolean;
  sellerCanReadPayouts?: boolean;
  sellerCanReadStaff?: boolean;
  sellerCanReadPromotions?: boolean;
  sellerCanReadReviews?: boolean;
};
export type NavigationLink = { href: string; label: string; icon: IconName };
export type NavigationGroup = { label: string; links: NavigationLink[] };

export function workspaceNavigation(
  mode: WorkspaceMode,
  user: CurrentUser | null,
  access: SellerNavigationAccess,
): NavigationGroup[] {
  const groups: NavigationGroup[] = [];
  function group(label: string, links: (NavigationLink | false | undefined)[]) {
    const available = links.filter((link): link is NavigationLink => !!link);
    if (available.length) groups.push({ label, links: available });
  }
  const link = (
    href: string,
    label: string,
    icon: IconName,
  ): NavigationLink => ({ href, label, icon });
  group("Overview", [link(`/${mode}`, "Overview", "overview")]);
  if (mode === "account") {
    group("My account", [
      link("/account/orders", "Orders", "orders"),
      link("/account/addresses", "Addresses", "catalog"),
      link("/account/profile", "Profile", "team"),
    ]);
  }
  if (mode === "seller") {
    group("Commerce", [
      access.sellerCanReadOrders && link("/seller/orders", "Orders", "orders"),
      access.sellerCanReadProducts &&
        link("/seller/products", "Products", "products"),
      access.sellerCanReadInventory &&
        link("/seller/inventory", "Inventory", "inventory"),
    ]);
    group("Operations", [
      access.sellerCanReadFulfillment &&
        link("/seller/shipments", "Shipments", "truck"),
      access.sellerCanReadReturns &&
        link("/seller/returns", "Returns", "returns"),
      access.sellerCanReadReturns &&
        link("/seller/refunds", "Refunds", "wallet"),
    ]);
    group("Growth", [
      access.sellerCanReadPromotions &&
        link("/seller/promotions", "Promotions", "promotions"),
      access.sellerCanReadReviews &&
        link("/seller/reviews", "Reviews", "reviews"),
    ]);
    group("Finance", [
      access.sellerCanReadFinance &&
        link("/seller/finance", "Finance", "wallet"),
      access.sellerCanReadFinance &&
        link("/seller/finance/transactions", "Transactions", "catalog"),
      access.sellerCanReadPayouts &&
        link("/seller/finance/payouts", "Payouts", "wallet"),
    ]);
    group("Organization", [
      access.sellerCanReadStaff && link("/seller/staff", "Staff", "team"),
      access.sellerCanReadStaff &&
        link("/seller/staff/roles", "Roles", "settings"),
      access.sellerCanReadInventory &&
        link("/seller/warehouses", "Warehouses", "inventory"),
      link("/seller/notifications", "Notifications", "bell"),
    ]);
    group("Settings", [
      access.sellerCanReadSettings &&
        link("/seller/settings", "Seller settings", "settings"),
    ]);
  }
  if (mode === "admin") {
    const allowed = (capability: string) =>
      hasPlatformPermission(user, capability);
    group("Marketplace", [
      allowed("platform.sellers.read") &&
        link("/admin/sellers", "Sellers", "team"),
      allowed("platform.orders.read") &&
        link("/admin/orders", "Orders", "orders"),
      allowed("platform.catalog.read") &&
        link("/admin/categories", "Categories", "catalog"),
      allowed("platform.catalog.read") &&
        link("/admin/attributes", "Attributes", "settings"),
      allowed("platform.catalog.read") &&
        link("/admin/brands", "Brands", "products"),
    ]);
    group("Operations", [
      allowed("platform.products.read") &&
        link("/admin/products", "Moderation queue", "products"),
      allowed("platform.inventory.read") &&
        link("/admin/inventory", "Inventory", "inventory"),
      allowed("platform.fulfillment.read") &&
        link("/admin/fulfillment", "Fulfillment", "truck"),
      allowed("platform.fulfillment.read") &&
        link("/admin/fulfillment/returns", "Returns", "returns"),
      allowed("platform.reviews.read") &&
        link("/admin/reviews", "Reviews", "reviews"),
      allowed("platform.promotions.read") &&
        link("/admin/promotions", "Promotions", "promotions"),
    ]);
    group("Finance", [
      allowed("platform.finance.read") &&
        link("/admin/finance", "Finance", "wallet"),
      allowed("platform.finance.read") &&
        link("/admin/finance/commissions", "Commissions", "settings"),
      allowed("platform.finance.read") &&
        link("/admin/finance/seller-balances", "Seller balances", "catalog"),
      allowed("platform.finance.read") &&
        link("/admin/finance/payouts", "Payouts", "wallet"),
      allowed("platform.fulfillment.read") &&
        link("/admin/fulfillment/refunds", "Refunds", "returns"),
    ]);
  }
  group("Workspace", [
    mode !== "workspaces" && link("/workspaces", "Workspaces", "overview"),
    mode !== "account" && link("/account", "My account", "team"),
    mode !== "admin" &&
      hasPlatformPermission(user, "platform.access") &&
      link("/admin", "Platform workspace", "settings"),
  ]);
  return groups;
}

export function activeNavigationLink(
  pathname: string,
  groups: NavigationGroup[],
) {
  return groups
    .flatMap((group) => group.links)
    .filter(
      (link) => pathname === link.href || pathname.startsWith(`${link.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export function workspaceBreadcrumbs(
  mode: WorkspaceMode,
  pathname: string,
  groups: NavigationGroup[],
) {
  const root = `/${mode}`;
  const crumbs =
    mode === "workspaces" ? [] : [{ href: "/workspaces", label: "Workspaces" }];
  crumbs.push({ href: root, label: workspaceNames[mode] });
  const routes = groups.flatMap((group) => group.links);
  const sections = routes
    .filter(
      (link) =>
        link.href !== root &&
        link.href.startsWith(`${root}/`) &&
        (pathname === link.href || pathname.startsWith(`${link.href}/`)),
    )
    .sort((a, b) => a.href.length - b.href.length);
  crumbs.push(...sections.map(({ href, label }) => ({ href, label })));
  if (pathname !== crumbs.at(-1)?.href) {
    crumbs.push({
      href: pathname,
      label: pathname === "/seller/products/new" ? "New product" : "Details",
    });
  }
  return crumbs;
}
