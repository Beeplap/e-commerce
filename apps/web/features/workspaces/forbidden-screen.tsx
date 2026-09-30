import Link from "next/link";
import { secondaryButton } from "@/components/ui/styles";

export function ForbiddenScreen({
  message = "Your account does not have access to this workspace.",
}: {
  message?: string;
}) {
  return (
    <section className="mx-auto max-w-xl px-6 py-20">
      <p className="mb-3 text-sm font-semibold text-slate-500">
        403 · Access restricted
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        You don’t have access
      </h1>
      <p className="mt-4 text-sm leading-7 text-slate-600">{message}</p>
      <Link href="/workspaces" className={`${secondaryButton} mt-6`}>
        Back to workspaces
      </Link>
    </section>
  );
}
