"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { useCart } from "@/features/cart/cart-context";
import { StorefrontHeader } from "@/features/storefront/header";
import { StorefrontFooter } from "@/features/storefront/footer";
import { checkoutApi } from "@/lib/api/client";
import type {
  CheckoutQuote,
  CustomerAddress,
  ShippingOption,
} from "@/lib/api/types";

export default function CheckoutPage() {
  const router = useRouter();
  const { state: authState } = useAuth();
  const user = authState.kind === "authenticated" ? authState.user : null;
  const { cart, refreshCart } = useCart();
  const [, startTransition] = useTransition();

  // State
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [useNewAddress, setUseNewAddress] = useState(false);

  // Address form fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("US");
  const [guestEmail, setGuestEmail] = useState("");

  // Shipping selections per seller: { [seller_id]: method_id }
  const [shippingSelections, setShippingSelections] = useState<
    Record<string, string>
  >({});

  // Quote
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAuthenticated = Boolean(user);

  // Load saved addresses for authenticated customer
  useEffect(() => {
    if (!isAuthenticated) return;
    const abort = new AbortController();
    checkoutApi
      .addresses(abort.signal)
      .then((data) => {
        setAddresses(data);
        const defaultAddr = data.find((a) => a.is_default) || data[0];
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
          setUseNewAddress(false);
        } else {
          setUseNewAddress(true);
        }
      })
      .catch(() => {
        setAddresses([]);
        setUseNewAddress(true);
      });
    return () => abort.abort();
  }, [isAuthenticated]);

  // Request real-time quote whenever address or shipping selections change
  useEffect(() => {
    if (!cart || cart.total_items === 0) return;

    let addressPayload: Partial<CustomerAddress> | undefined;
    let addrId: string | null = null;

    if (isAuthenticated && selectedAddressId && !useNewAddress) {
      addrId = selectedAddressId;
    } else {
      addressPayload = {
        full_name: fullName,
        phone,
        line1,
        line2,
        city,
        state,
        postal_code: postalCode,
        country: country || "US",
      };
    }

    const abort = new AbortController();

    checkoutApi
      .quote(
        {
          shipping_address: addressPayload,
          address_id: addrId,
          shipping_selections: shippingSelections,
        },
        abort.signal,
      )
      .then((data) => {
        setQuote(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        // Don't flash hard error if address is simply incomplete during editing
        setQuote(null);
      });

    return () => abort.abort();
  }, [
    cart,
    isAuthenticated,
    selectedAddressId,
    useNewAddress,
    fullName,
    phone,
    line1,
    line2,
    city,
    state,
    postalCode,
    country,
    shippingSelections,
  ]);

  const handleSelectShippingMethod = (sellerId: string, methodId: string) => {
    setShippingSelections((prev) => ({
      ...prev,
      [sellerId]: methodId,
    }));
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart || cart.total_items === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      let shippingAddressData: Partial<CustomerAddress> | undefined;
      let addressIdToSend: string | null = null;

      if (isAuthenticated && selectedAddressId && !useNewAddress) {
        addressIdToSend = selectedAddressId;
      } else {
        if (
          !fullName.trim() ||
          !phone.trim() ||
          !line1.trim() ||
          !city.trim() ||
          !state.trim() ||
          !postalCode.trim()
        ) {
          setError("Please complete all required shipping address fields.");
          setIsSubmitting(false);
          return;
        }
        if (
          !isAuthenticated &&
          (!guestEmail.trim() || !guestEmail.includes("@"))
        ) {
          setError(
            "A valid contact email is required for order notifications.",
          );
          setIsSubmitting(false);
          return;
        }
        shippingAddressData = {
          full_name: fullName.trim(),
          phone: phone.trim(),
          line1: line1.trim(),
          line2: line2.trim(),
          city: city.trim(),
          state: state.trim(),
          postal_code: postalCode.trim(),
          country: country.trim().toUpperCase() || "US",
        };
      }

      const res = await checkoutApi.placeOrder({
        address_id: addressIdToSend,
        shipping_address: shippingAddressData,
        customer_email: isAuthenticated ? undefined : guestEmail.trim(),
        shipping_selections: shippingSelections,
      });

      // Refresh cart context so cart drawer/badge count resets to 0
      await refreshCart();

      // Proceed to the payment step; reservations are held until capture.
      startTransition(() => {
        router.push(
          `/checkout/pay?order_id=${res.order_id}&order_number=${res.order_number}&email=${encodeURIComponent(
            res.customer_email,
          )}&total=${res.grand_total}&currency=${res.currency}`,
        );
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "Failed to place order. Please review your details and try again.",
        );
      }
      setIsSubmitting(false);
    }
  };

  if (cart && cart.total_items === 0 && !isSubmitting) {
    return (
      <div className="sf-storefront min-h-screen flex flex-col bg-sf-background">
        <StorefrontHeader />
        <main
          id="storefront-content"
          tabIndex={-1}
          className="flex-1 mx-auto max-w-3xl w-full px-4 py-16 text-center"
        >
          <div className="rounded-sf-editorial border border-sf-border bg-sf-surface p-12 shadow-sf-small">
            <h1 className="text-xl font-bold text-sf-foreground">
              Your cart is empty
            </h1>
            <p className="mt-2 text-sm text-sf-muted">
              Add items to your cart before proceeding to checkout.
            </p>
            <div className="mt-6">
              <Link
                href="/"
                className="rounded-sf-image bg-sf-action px-6 py-2.5 text-sm font-bold text-sf-on-dark shadow-sf-small hover:bg-sf-action-hover transition"
              >
                Browse Products
              </Link>
            </div>
          </div>
        </main>
        <StorefrontFooter />
      </div>
    );
  }

  return (
    <div className="sf-storefront min-h-screen flex flex-col bg-sf-background">
      <StorefrontHeader />

      <main
        id="storefront-content"
        tabIndex={-1}
        className="flex-1 mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 lg:px-8"
      >
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex items-center gap-2 text-xs text-sf-muted"
        >
          <Link href="/" className="hover:text-sf-link transition">
            Home
          </Link>
          <span>/</span>
          <Link href="/cart" className="hover:text-sf-link transition">
            Cart
          </Link>
          <span>/</span>
          <span className="font-semibold text-sf-foreground">Checkout</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-2xl font-black tracking-tight text-sf-foreground sm:text-3xl">
            Customer Checkout
          </h1>
          <p className="mt-1 text-sm text-sf-muted">
            Multi-seller marketplace fulfillment with real-time stock
            reservations.
          </p>
        </div>

        {error && (
          <div
            data-testid="checkout-error-banner"
            className="mb-6 rounded-sf-image bg-sf-danger-surface border border-sf-danger p-4 text-sm text-sf-danger flex items-start gap-2"
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={handlePlaceOrder}
          className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start"
        >
          {/* Left Column: Addresses & Shipping (8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Step 1: Customer & Shipping Address */}
            <div className="rounded-sf-editorial border border-sf-border bg-sf-surface p-6 shadow-sf-small">
              <div className="flex items-center justify-between border-b border-sf-border pb-4">
                <h2 className="text-base font-bold text-sf-foreground flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sf-action text-xs text-sf-on-dark">
                    1
                  </span>
                  Shipping Address
                </h2>
                {isAuthenticated && addresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setUseNewAddress(!useNewAddress)}
                    className="text-xs font-semibold text-sf-link hover:underline"
                  >
                    {useNewAddress ? "Use saved address" : "+ Add new address"}
                  </button>
                )}
              </div>

              {/* Guest Email Field */}
              {!isAuthenticated && (
                <div className="mt-4 pt-2 pb-4 border-b border-sf-border">
                  <label
                    htmlFor="guestEmail"
                    className="block text-xs font-bold text-sf-soft mb-1"
                  >
                    Contact Email (for receipt & order tracking) *
                  </label>
                  <input
                    id="guestEmail"
                    type="email"
                    required
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-sf-image border border-sf-control px-3.5 py-2 text-sm text-sf-foreground placeholder:text-sf-muted focus:border-sf-action focus:outline-none focus:ring-1 focus:ring-sf-action"
                  />
                </div>
              )}

              {/* Saved Addresses List (Authenticated) */}
              {isAuthenticated && !useNewAddress && addresses.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {addresses.map((addr) => (
                    <label
                      key={addr.id}
                      className={`flex items-start gap-3 rounded-sf-image border p-4 cursor-pointer transition ${
                        selectedAddressId === addr.id
                          ? "border-sf-action bg-sf-accent-soft/40 ring-1 ring-sf-action"
                          : "border-sf-border hover:bg-sf-background"
                      }`}
                    >
                      <input
                        type="radio"
                        name="savedAddress"
                        value={addr.id}
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                        className="mt-1 text-sf-link focus:ring-sf-action"
                      />
                      <div className="text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sf-foreground">
                            {addr.full_name}
                          </span>
                          {addr.is_default && (
                            <span className="rounded bg-sf-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-sf-link">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sf-soft">{addr.line1}</p>
                        {addr.line2 && (
                          <p className="text-sf-soft">{addr.line2}</p>
                        )}
                        <p className="text-sf-soft">
                          {addr.city}, {addr.state} {addr.postal_code},{" "}
                          {addr.country}
                        </p>
                        <p className="mt-1 text-sf-muted font-mono">
                          Tel: {addr.phone}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                /* New Address Form */
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="fullName"
                      className="block text-xs font-bold text-sf-soft mb-1"
                    >
                      Full Name *
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full rounded-sf-image border border-sf-control px-3.5 py-2 text-sm text-sf-foreground focus:border-sf-action focus:outline-none focus:ring-1 focus:ring-sf-action"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="phone"
                      className="block text-xs font-bold text-sf-soft mb-1"
                    >
                      Phone Number *
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full rounded-sf-image border border-sf-control px-3.5 py-2 text-sm text-sf-foreground focus:border-sf-action focus:outline-none focus:ring-1 focus:ring-sf-action"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="country"
                      className="block text-xs font-bold text-sf-soft mb-1"
                    >
                      Country *
                    </label>
                    <select
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full rounded-sf-image border border-sf-control px-3.5 py-2 text-sm text-sf-foreground focus:border-sf-action focus:outline-none focus:ring-1 focus:ring-sf-action bg-sf-surface"
                    >
                      <option value="US">United States (US)</option>
                      <option value="CA">Canada (CA)</option>
                      <option value="GB">United Kingdom (GB)</option>
                      <option value="AU">Australia (AU)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="line1"
                      className="block text-xs font-bold text-sf-soft mb-1"
                    >
                      Street Address *
                    </label>
                    <input
                      id="line1"
                      type="text"
                      required
                      value={line1}
                      onChange={(e) => setLine1(e.target.value)}
                      placeholder="123 Market St"
                      className="w-full rounded-sf-image border border-sf-control px-3.5 py-2 text-sm text-sf-foreground focus:border-sf-action focus:outline-none focus:ring-1 focus:ring-sf-action"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="line2"
                      className="block text-xs font-bold text-sf-soft mb-1"
                    >
                      Apt, Suite, Unit (optional)
                    </label>
                    <input
                      id="line2"
                      type="text"
                      value={line2}
                      onChange={(e) => setLine2(e.target.value)}
                      placeholder="Apt 4B"
                      className="w-full rounded-sf-image border border-sf-control px-3.5 py-2 text-sm text-sf-foreground focus:border-sf-action focus:outline-none focus:ring-1 focus:ring-sf-action"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="city"
                      className="block text-xs font-bold text-sf-soft mb-1"
                    >
                      City *
                    </label>
                    <input
                      id="city"
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Austin"
                      className="w-full rounded-sf-image border border-sf-control px-3.5 py-2 text-sm text-sf-foreground focus:border-sf-action focus:outline-none focus:ring-1 focus:ring-sf-action"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label
                        htmlFor="state"
                        className="block text-xs font-bold text-sf-soft mb-1"
                      >
                        State *
                      </label>
                      <input
                        id="state"
                        type="text"
                        required
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="TX"
                        className="w-full rounded-sf-image border border-sf-control px-3.5 py-2 text-sm text-sf-foreground focus:border-sf-action focus:outline-none focus:ring-1 focus:ring-sf-action"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="postalCode"
                        className="block text-xs font-bold text-sf-soft mb-1"
                      >
                        Zip Code *
                      </label>
                      <input
                        id="postalCode"
                        type="text"
                        required
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="78701"
                        className="w-full rounded-sf-image border border-sf-control px-3.5 py-2 text-sm text-sf-foreground focus:border-sf-action focus:outline-none focus:ring-1 focus:ring-sf-action"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Multi-Seller Shipping Options */}
            <div className="rounded-sf-editorial border border-sf-border bg-sf-surface p-6 shadow-sf-small">
              <div className="border-b border-sf-border pb-4">
                <h2 className="text-base font-bold text-sf-foreground flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sf-action text-xs text-sf-on-dark">
                    2
                  </span>
                  Shipping Method & Multi-Seller Delivery
                </h2>
                <p className="mt-1 text-xs text-sf-muted">
                  Each independent seller dispatches their items separately.
                  Choose your preferred delivery method per seller.
                </p>
              </div>

              {quote?.sellers && quote.sellers.length > 0 ? (
                <div className="mt-4 space-y-6">
                  {quote.sellers.map((seller) => (
                    <div
                      key={seller.seller_id}
                      className="rounded-sf-image border border-sf-border p-4 bg-sf-background/50"
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-sf-border/60">
                        <span className="text-xs font-bold text-sf-link uppercase tracking-wider">
                          Seller: {seller.seller_name}
                        </span>
                        <span className="text-xs text-sf-muted">
                          {seller.items.length}{" "}
                          {seller.items.length === 1 ? "item" : "items"}
                        </span>
                      </div>

                      <div className="mt-3 space-y-2">
                        {seller.available_shipping_methods.map(
                          (method: ShippingOption) => {
                            const isSelected =
                              (shippingSelections[seller.seller_id] ||
                                seller.selected_shipping_method?.method_id) ===
                              method.method_id;
                            return (
                              <label
                                key={method.method_id}
                                htmlFor={`shipping-${method.method_id}`}
                                className={`flex items-center justify-between p-3 rounded-sf-control border text-xs cursor-pointer transition ${
                                  isSelected
                                    ? "border-sf-action bg-sf-surface ring-1 ring-sf-action font-semibold"
                                    : "border-sf-border bg-sf-surface hover:bg-sf-background"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <input
                                    id={`shipping-${method.method_id}`}
                                    data-testid={`shipping-method-${method.code}`}
                                    aria-label={method.name}
                                    type="radio"
                                    name={`shipping_${seller.seller_id}`}
                                    value={method.method_id}
                                    checked={isSelected}
                                    onChange={() =>
                                      handleSelectShippingMethod(
                                        seller.seller_id,
                                        method.method_id,
                                      )
                                    }
                                    className="text-sf-link focus:ring-sf-action"
                                  />
                                  <div>
                                    <span className="text-sf-foreground">
                                      {method.name}
                                    </span>
                                    <span className="ml-1 text-sf-muted font-normal">
                                      ({method.carrier}, {method.min_days}–
                                      {method.max_days} business days)
                                    </span>
                                  </div>
                                </div>
                                <span className="font-bold text-sf-foreground">
                                  {parseFloat(method.rate) === 0
                                    ? "FREE"
                                    : `$${method.rate}`}
                                </span>
                              </label>
                            );
                          },
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-sf-muted">
                  Please provide your complete shipping address to preview
                  delivery options.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Order Summary & Placement (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-sf-editorial border border-sf-border bg-sf-surface p-6 shadow-sf-small">
              <h2 className="text-base font-bold text-sf-foreground border-b border-sf-border pb-4">
                Order Review
              </h2>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between text-sf-soft">
                  <span>Items Subtotal</span>
                  <span
                    data-testid="checkout-summary-subtotal"
                    className="font-semibold text-sf-foreground"
                  >
                    ${quote?.subtotal || cart?.subtotal || "0.00"}
                  </span>
                </div>

                <div className="flex justify-between text-sf-soft">
                  <span>Shipping Total</span>
                  <span
                    data-testid="checkout-summary-shipping"
                    className="font-semibold text-sf-foreground"
                  >
                    ${quote?.shipping_total || "0.00"}
                  </span>
                </div>

                {quote?.discount_total &&
                  parseFloat(quote.discount_total) > 0 && (
                    <div className="flex justify-between text-sf-success">
                      <span>Discount</span>
                      <span className="font-bold">
                        -${quote.discount_total}
                      </span>
                    </div>
                  )}

                <div className="border-t border-sf-border pt-3 flex justify-between text-base font-bold text-sf-foreground">
                  <span>Total Amount</span>
                  <span data-testid="checkout-summary-total">
                    ${quote?.grand_total || cart?.subtotal || "0.00"}
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="submit"
                  disabled={isSubmitting || !cart || cart.total_items === 0}
                  className="w-full rounded-sf-image bg-sf-action py-3.5 text-sm font-bold text-sf-on-dark shadow-sf-small hover:bg-sf-action-hover disabled:opacity-40 transition"
                >
                  {isSubmitting ? "Placing Order..." : "Confirm & Place Order"}
                </button>
              </div>

              <p className="mt-3 text-center text-[11px] text-sf-muted">
                🔒 Safe and encrypted checkout. Stock is locked upon order
                confirmation.
              </p>
            </div>
          </div>
        </form>
      </main>

      <StorefrontFooter />
    </div>
  );
}
