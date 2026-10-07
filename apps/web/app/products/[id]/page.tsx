import { ProductDetailPage } from "@/features/storefront/detail/page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductDetailPage key={id} id={id} />;
}
