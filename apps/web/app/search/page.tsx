import { Suspense } from "react";
import {
  DiscoveryLoading,
  DiscoveryPage,
  DiscoveryShell,
} from "@/features/storefront/discovery/page";

export default function SearchPage() {
  return (
    <DiscoveryShell>
      <Suspense fallback={<DiscoveryLoading />}>
        <DiscoveryPage />
      </Suspense>
    </DiscoveryShell>
  );
}
