import { notFound } from "next/navigation";
import { PlatformSellerDetail } from "@/features/sellers/platform-detail";
import { isUuid } from "@/lib/api/validation";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return <PlatformSellerDetail key={id} sellerId={id} />;
}
