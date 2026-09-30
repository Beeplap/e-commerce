"use client";

import { ErrorState } from "@/components/ui/primitives";

export default function ErrorPage({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <ErrorState
        message="An unexpected error interrupted this page. Please try again."
        onRetry={retry}
      />
    </main>
  );
}
