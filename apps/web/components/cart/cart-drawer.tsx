"use client";
import { useRef, type KeyboardEvent } from "react";
import { Dialog } from "@/components/ui/dialog";
import { StorefrontButton } from "@/components/storefront/controls";
import { useCart } from "@/features/cart/cart-context";
import { useCartActions } from "@/features/cart/actions";
import { CartContents } from "@/features/cart/contents";

// Keep boundary Tab presses inside the cart; native dialog owns modality/Escape.
function cycleCartFocus(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "Tab") return;
  const dialog =
    event.currentTarget.querySelector<HTMLDialogElement>("dialog[open]");
  if (!dialog?.matches(":modal")) return;
  const controls = [
    ...dialog.querySelectorAll<HTMLElement>(
      "a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]",
    ),
  ].filter(
    (element) => element.tabIndex >= 0 && element.getClientRects().length > 0,
  );
  const first = controls[0],
    last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

function Drawer() {
  const { isOpen, closeCart, identity } = useCart();
  const actions = useCartActions(identity, isOpen);
  const close = useRef<HTMLButtonElement>(null);
  if (!isOpen) return null;
  return (
    <div
      className="sf-storefront sf-cart sf-cart-overlay"
      onKeyDown={cycleCartFocus}
    >
      <Dialog
        open={isOpen}
        title={
          <>
            <span aria-hidden="true">Shopping Cart</span>
            <span className="sr-only">Shopping Cart Drawer</span>
          </>
        }
        variant="drawer"
        initialFocus={close}
        onClose={closeCart}
      >
        <StorefrontButton
          ref={close}
          className="sf-cart-close"
          variant="quiet"
          aria-label="Close cart"
          onClick={closeCart}
        >
          ×
        </StorefrontButton>
        <CartContents compact actions={actions} onNavigate={closeCart} />
      </Dialog>
    </div>
  );
}
export function CartDrawer() {
  const { identity } = useCart();
  return <Drawer key={identity} />;
}
