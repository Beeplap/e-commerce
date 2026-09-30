import { SellerWorkspace } from "@/features/workspaces/seller-workspace";

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SellerWorkspace>{children}</SellerWorkspace>;
}
