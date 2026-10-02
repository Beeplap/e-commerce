import { notFound } from "next/navigation";
import { SellerOrderDetailView } from "@/features/orders/seller-order-detail";
import { isUuid } from "@/lib/api/validation";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return <SellerOrderDetailView key={id} orderId={id} />;
}
