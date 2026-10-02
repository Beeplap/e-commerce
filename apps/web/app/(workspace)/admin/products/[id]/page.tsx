import { notFound } from "next/navigation";
import { PlatformProductDetail } from "@/features/catalog/product-detail";
import { isUuid } from "@/lib/api/validation";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return <PlatformProductDetail key={id} productId={id} />;
}
