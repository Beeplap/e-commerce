import { RequireSession } from "@/features/auth/require-session";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireSession>{children}</RequireSession>;
}
