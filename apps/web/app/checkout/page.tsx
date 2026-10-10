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
      <div className="min-h-screen flex flex-col bg-slate-50">
        <StorefrontHeader />
        <main className="flex-1 mx-auto max-w-3xl w-full px-4 py-16 text-center">
          <div className="rounded-2xl border border-slate-200 bg-ui-surface p-12 shadow-sm">
            <h1 className="text-xl font-bold text-slate-900">
              Your cart is empty
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Add items to your cart before proceeding to checkout.
            </p>
            <div className="mt-6">
              <Link
                href="/"
                className="rounded-xl bg-orange-800 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-orange-900 transition"
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
    <div className="min-h-screen flex flex-col bg-slate-50">
      <StorefrontHeader />

      <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex items-center gap-2 text-xs text-slate-500"
        >
          <Link href="/" className="hover:text-orange-700 transition">
            Home
          </Link>
          <span>/</span>
          <Link href="/cart" className="hover:text-orange-700 transition">
            Cart
          </Link>
          <span>/</span>
          <span className="font-semibold text-slate-800">Checkout</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Customer Checkout
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Multi-seller marketplace fulfillment with real-time stock
            reservations.
          </p>
        </div>

        {error && (
          <div
            data-testid="checkout-error-banner"
            className="mb-6 rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-start gap-2"
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
            <div className="rounded-2xl border border-slate-200 bg-ui-surface p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-800 text-xs text-white">
                    1
                  </span>
                  Shipping Address
                </h2>
                {isAuthenticated && addresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setUseNewAddress(!useNewAddress)}
                    className="text-xs font-semibold text-orange-800 hover:underline"
                  >
                    {useNewAddress ? "Use saved address" : "+ Add new address"}
                  </button>
                )}
              </div>

              {/* Guest Email Field */}
              {!isAuthenticated && (
                <div className="mt-4 pt-2 pb-4 border-b border-slate-100">
                  <label
                    htmlFor="guestEmail"
                    className="block text-xs font-bold text-slate-700 mb-1"
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
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-orange-700 focus:outline-none focus:ring-1 focus:ring-ui-focus"
                  />
                </div>
              )}

              {/* Saved Addresses List (Authenticated) */}
              {isAuthenticated && !useNewAddress && addresses.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {addresses.map((addr) => (
                    <label
                      key={addr.id}
                      className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition ${
                        selectedAddressId === addr.id
                          ? "border-orange-700 bg-orange-50/40 ring-1 ring-orange-700"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="savedAddress"
                        value={addr.id}
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                        className="mt-1 text-orange-800 focus:ring-ui-focus"
                      />
                      <div className="text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {addr.full_name}
                          </span>
                          {addr.is_default && (
                            <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-800">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-slate-600">{addr.line1}</p>
                        {addr.line2 && (
                          <p className="text-slate-600">{addr.line2}</p>
                        )}
                        <p className="text-slate-600">
                          {addr.city}, {addr.state} {addr.postal_code},{" "}
                          {addr.country}
                        </p>
                        <p className="mt-1 text-slate-400 font-mono">
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
                      className="block text-xs font-bold text-slate-700 mb-1"
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
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 focus:border-orange-700 focus:outline-none focus:ring-1 focus:ring-ui-focus"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="phone"
                      className="block text-xs font-bold text-slate-700 mb-1"
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
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 focus:border-orange-700 focus:outline-none focus:ring-1 focus:ring-ui-focus"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="country"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Country *
                    </label>
                    <select
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 focus:border-orange-700 focus:outline-none focus:ring-1 focus:ring-ui-focus bg-ui-surface"
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
                      className="block text-xs font-bold text-slate-700 mb-1"
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
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 focus:border-orange-700 focus:outline-none focus:ring-1 focus:ring-ui-focus"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="line2"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Apt, Suite, Unit (optional)
                    </label>
                    <input
                      id="line2"
                      type="text"
                      value={line2}
                      onChange={(e) => setLine2(e.target.value)}
                      placeholder="Apt 4B"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 focus:border-orange-700 focus:outline-none focus:ring-1 focus:ring-ui-focus"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="city"
                      className="block text-xs font-bold text-slate-700 mb-1"
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
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 focus:border-orange-700 focus:outline-none focus:ring-1 focus:ring-ui-focus"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label
                        htmlFor="state"
                        className="block text-xs font-bold text-slate-700 mb-1"
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
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 focus:border-orange-700 focus:outline-none focus:ring-1 focus:ring-ui-focus"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="postalCode"
                        className="block text-xs font-bold text-slate-700 mb-1"
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
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 focus:border-orange-700 focus:outline-none focus:ring-1 focus:ring-ui-focus"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Multi-Seller Shipping Options */}
            <div className="rounded-2xl border border-slate-200 bg-ui-surface p-6 shadow-sm">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-800 text-xs text-white">
                    2
                  </span>
                  Shipping Method & Multi-Seller Delivery
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Each independent seller dispatches their items separately.
                  Choose your preferred delivery method per seller.
                </p>
              </div>

              {quote?.sellers && quote.sellers.length > 0 ? (
                <div className="mt-4 space-y-6">
                  {quote.sellers.map((seller) => (
                    <div
                      key={seller.seller_id}
                      className="rounded-xl border border-slate-200 p-4 bg-slate-50/50"
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                        <span className="text-xs font-bold text-orange-900 uppercase tracking-wider">
                          Seller: {seller.seller_name}
                        </span>
                        <span className="text-xs text-slate-500">
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
                                className={`flex items-center justify-between p-3 rounded-lg border text-xs cursor-pointer transition ${
                                  isSelected
                                    ? "border-orange-700 bg-ui-surface ring-1 ring-orange-700 font-semibold"
                                    : "border-slate-200 bg-ui-surface hover:bg-slate-50"
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
                                    className="text-orange-800 focus:ring-ui-focus"
                                  />
                                  <div>
                                    <span className="text-slate-900">
                                      {method.name}
                                    </span>
                                    <span className="ml-1 text-slate-400 font-normal">
                                      ({method.carrier}, {method.min_days}–
                                      {method.max_days} business days)
                                    </span>
                                  </div>
                                </div>
                                <span className="font-bold text-slate-900">
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
                <div className="py-6 text-center text-xs text-slate-500">
                  Please provide your complete shipping address to preview
                  delivery options.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Order Summary & Placement (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-ui-surface p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-4">
                Order Review
              </h2>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Items Subtotal</span>
                  <span
                    data-testid="checkout-summary-subtotal"
                    className="font-semibold text-slate-900"
                  >
                    ${quote?.subtotal || cart?.subtotal || "0.00"}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Shipping Total</span>
                  <span
                    data-testid="checkout-summary-shipping"
                    className="font-semibold text-slate-900"
                  >
                    ${quote?.shipping_total || "0.00"}
                  </span>
                </div>

                {quote?.discount_total &&
                  parseFloat(quote.discount_total) > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount</span>
                      <span className="font-bold">
                        -${quote.discount_total}
                      </span>
                    </div>
                  )}

                <div className="border-t border-slate-200 pt-3 flex justify-between text-base font-bold text-slate-900">
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
                  className="w-full rounded-xl bg-orange-800 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-orange-900 disabled:opacity-40 transition"
                >
                  {isSubmitting ? "Placing Order..." : "Confirm & Place Order"}
                </button>
              </div>

              <p className="mt-3 text-center text-[11px] text-slate-400">
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
