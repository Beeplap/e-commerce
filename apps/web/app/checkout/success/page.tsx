import { Suspense } from "react";
import { CheckoutSuccessContent } from "@/features/checkout/success-page";
import { CheckoutShell } from "@/features/checkout/shell";
export default function CheckoutSuccessPage() {
  return (
    <CheckoutShell
      title="Order confirmation"
      description="Your order reference and current payment status."
    >
      <Suspense fallback={<p role="status">Loading order status…</p>}>
        <CheckoutSuccessContent />
      </Suspense>
    </CheckoutShell>
  );
}
