import { AdminWorkspace } from "@/features/workspaces/admin-workspace";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminWorkspace>{children}</AdminWorkspace>;
}
