import { Suspense } from "react";
import {
  DiscoveryLoading,
  DiscoveryPage,
  DiscoveryShell,
} from "@/features/storefront/discovery/page";

export default async function CategoryBrowsePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <DiscoveryShell>
      <Suspense fallback={<DiscoveryLoading />}>
        <DiscoveryPage categoryId={id} />
      </Suspense>
    </DiscoveryShell>
  );
}
