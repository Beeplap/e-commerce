import { notFound } from "next/navigation";
import { SellerProductDetail } from "@/features/catalog/product-detail";
import { isUuid } from "@/lib/api/validation";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return <SellerProductDetail key={id} productId={id} />;
}
