import { CheckoutContent } from "@/features/checkout/page";
import { CheckoutShell } from "@/features/checkout/shell";

export default function CheckoutPage() {
  return (
    <CheckoutShell
      title="Checkout"
      description="Choose where it goes. Review delivery and your order before payment."
    >
      <CheckoutContent />
    </CheckoutShell>
  );
}
