import { Suspense } from "react";
import { CheckoutPayContent } from "@/features/checkout/pay-page";
import { CheckoutShell } from "@/features/checkout/shell";
export default function CheckoutPayPage() {
  return (
    <CheckoutShell
      title="Payment"
      description="Review the amount due, then finish your order."
    >
      <Suspense fallback={<p role="status">Loading payment…</p>}>
        <CheckoutPayContent />
      </Suspense>
    </CheckoutShell>
  );
}
