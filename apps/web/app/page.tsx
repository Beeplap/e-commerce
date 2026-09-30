export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="mb-4 text-sm font-semibold tracking-widest text-slate-600 uppercase">
        Quick Commerce
      </p>
      <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
        Marketplace administration
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
        Manage the seller and platform workspaces available to your account.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/login" className={primaryButton}>
          Sign in
        </Link>
        <Link href="/workspaces" className={secondaryButton}>
          Your workspaces
        </Link>
      </div>
    </main>
  );
}
import Link from "next/link";
import { primaryButton, secondaryButton } from "@/components/ui/styles";
