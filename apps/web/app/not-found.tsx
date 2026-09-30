import Link from "next/link";
import { secondaryButton } from "@/components/ui/styles";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <p className="mb-3 text-sm font-semibold text-slate-500">
        404 · Page not found
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        This page isn’t here
      </h1>
      <p className="mt-4 text-sm leading-7 text-slate-600">
        Check the address or return to your workspaces.
      </p>
      <Link href="/workspaces" className={`${secondaryButton} mt-6`}>
        Back to workspaces
      </Link>
    </main>
  );
}
