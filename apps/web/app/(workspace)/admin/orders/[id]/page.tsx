import { notFound } from "next/navigation";
import { AdminOrderDetailView } from "@/features/orders/admin-order-detail";
import { isUuid } from "@/lib/api/validation";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return <AdminOrderDetailView key={id} orderId={id} />;
}
