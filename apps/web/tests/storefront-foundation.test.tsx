import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  StorefrontButton,
  StorefrontInput,
  StorefrontQuantity,
  StorefrontSelect,
} from "@/components/storefront/controls";
import {
  discountPercentage,
  StorefrontBreadcrumb,
  StorefrontImage,
  StorefrontPrice,
  StorefrontRating,
} from "@/components/storefront/content";
import {
  StorefrontNotice,
  StorefrontOverlay,
} from "@/components/storefront/feedback";

describe("Customer design foundation", () => {
  it("uses non-submitting buttons and prevents busy actions", () => {
    const action = vi.fn();
    const view = render(
      <StorefrontButton busy onClick={action}>
        Add item
      </StorefrontButton>,
    );
    const button = screen.getByRole("button", { name: "Add item" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(action).not.toHaveBeenCalled();
    view.rerender(
      <StorefrontButton onClick={action}>Add item</StorefrontButton>,
    );
    fireEvent.click(button);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("associates distinct labels, hints and errors without dropping existing descriptions", () => {
    render(
      <>
        <p id="external-help">Address information</p>
        <StorefrontInput
          label="City"
          hint="Shipping city"
          error="Choose a city"
          aria-describedby="external-help"
        />
        <StorefrontInput label="Region" />
      </>,
    );
    const city = screen.getByRole("textbox", { name: "City" });
    const region = screen.getByRole("textbox", { name: "Region" });
    expect(city.id).not.toBe(region.id);
    expect(city).toHaveAccessibleDescription(
      "Address information Shipping city Choose a city",
    );
    expect(city).toHaveAttribute("aria-invalid", "true");
    expect(region).not.toHaveAttribute("aria-invalid");
  });

  it("keeps a labeled native select and consumer change handler", () => {
    const change = vi.fn();
    render(
      <StorefrontSelect
        label="Sort products"
        onChange={change}
        defaultValue="newest"
      >
        <option value="newest">Newest</option>
        <option value="price">Price</option>
      </StorefrontSelect>,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Sort products" }), {
      target: { value: "price" },
    });
    expect(change).toHaveBeenCalledTimes(1);
  });

  it("bounds quantity changes and disables controls while the caller is busy", () => {
    function Example() {
      const [value, setValue] = useState(1);
      return (
        <StorefrontQuantity value={value} maximum={2} onChange={setValue} />
      );
    }
    const view = render(<Example />);
    const lower = screen.getByRole("button", { name: "Decrease quantity" });
    const higher = screen.getByRole("button", { name: "Increase quantity" });
    expect(lower).toBeDisabled();
    fireEvent.click(higher);
    expect(screen.getByTestId("selected-quantity")).toHaveTextContent("2");
    expect(higher).toBeDisabled();
    fireEvent.click(higher);
    expect(screen.getByTestId("selected-quantity")).toHaveTextContent("2");
    view.rerender(
      <StorefrontQuantity value={2} maximum={3} disabled onChange={vi.fn()} />,
    );
    expect(
      screen.getByRole("button", { name: "Decrease quantity" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Increase quantity" }),
    ).toBeDisabled();
  });

  it("preserves exact large values, fractional precision and actual currency", () => {
    render(
      <StorefrontPrice
        amount="9007199254740993.1234"
        currency="NPR"
        compareAt="10000000000000000.5678"
      />,
    );
    expect(
      screen.getByText("9,007,199,254,740,993.1234 NPR"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("10,000,000,000,000,000.5678 NPR"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Previous price").tagName).toBe("DEL");
    expect(() =>
      render(<StorefrontPrice amount="not-money" currency="USD" />),
    ).toThrow("decimal amount");
  });

  it("computes only bounded discount percentages without converting prices to floats", () => {
    expect(discountPercentage("799.00", "999.00")).toBe(20);
    expect(
      discountPercentage("9007199254740993.00", "9007199254740994.00"),
    ).toBe(0);
    expect(discountPercentage("0.005", "0.010")).toBe(50);
    expect(discountPercentage("5.00", "0.00")).toBeNull();
    expect(discountPercentage("6.00", "5.00")).toBeNull();
    expect(discountPercentage("5.00", null)).toBeNull();
    expect(() => discountPercentage("NaN", "10.00")).toThrow("decimal strings");
  });

  it("names unavailable product images and lazy-loads genuine image URLs", () => {
    const view = render(<StorefrontImage src={null} alt="Linen shirt" />);
    expect(screen.getByText("Image unavailable")).toHaveTextContent(
      "Image unavailable for Linen shirt",
    );
    view.rerender(
      <StorefrontImage
        src="/api/v1/storefront/product-image"
        alt="Linen shirt"
      />,
    );
    expect(screen.getByRole("img", { name: "Linen shirt" })).toHaveAttribute(
      "loading",
      "lazy",
    );
  });

  it("shows image feedback while a same-origin stream loads and after it fails", () => {
    const view = render(
      <StorefrontImage
        src="/api/v1/storefront/product-image"
        alt="Linen shirt"
      />,
    );
    const image = screen.getByRole("img", { name: "Linen shirt" });
    expect(image.parentElement).toHaveAttribute("data-image-state", "loading");
    expect(
      image.parentElement?.querySelector(".sf-image-loading"),
    ).toBeTruthy();
    fireEvent.load(image);
    expect(image.parentElement).toHaveAttribute("data-image-state", "loaded");
    expect(image).toHaveAttribute("data-loaded", "true");

    fireEvent.error(image);
    expect(image.parentElement).toHaveAttribute("data-image-state", "failed");
    expect(image).toHaveAttribute("src", "/api/v1/storefront/product-image");
    expect(screen.queryByRole("img", { name: "Linen shirt" })).toBeNull();
    expect(
      screen.getByRole("img", { name: "Image unavailable: Linen shirt" }),
    ).toBeInTheDocument();

    view.rerender(
      <StorefrontImage
        src="/api/v1/storefront/next-image"
        alt="Canvas bag"
        eager
      />,
    );
    expect(screen.getByRole("img", { name: "Canvas bag" })).toHaveAttribute(
      "src",
      "/api/v1/storefront/next-image",
    );
    expect(screen.getByRole("img", { name: "Canvas bag" })).toHaveAttribute(
      "fetchpriority",
      "high",
    );
  });

  it("uses readable rating evidence and a semantic current breadcrumb", () => {
    render(
      <>
        <StorefrontRating value={4.8} count={42} />
        <StorefrontBreadcrumb
          items={[{ label: "Shop", href: "/search" }, { label: "Linen shirt" }]}
        />
      </>,
    );
    expect(screen.getByText("4.8", { exact: false })).toHaveTextContent(
      "Rated 4.8 out of 5",
    );
    expect(screen.getByText("(42)").parentElement).toHaveTextContent(
      "(42) reviews",
    );
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("list")).toBeInTheDocument();
    expect(within(breadcrumb).getByText("Linen shirt")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(() => render(<StorefrontRating value={6} />)).toThrow("bounded");
  });

  it("reuses native overlay dismissal, busy protection and focus return", () => {
    const close = vi.fn();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const view = render(
      <StorefrontOverlay open title="Delivery details" busy onClose={close}>
        <StorefrontInput label="City" />
      </StorefrontOverlay>,
    );
    const dialog = screen.getByRole("dialog", { name: "Delivery details" });
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveAttribute("aria-busy", "true");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(close).not.toHaveBeenCalled();
    view.rerender(
      <StorefrontOverlay open title="Delivery details" onClose={close}>
        <StorefrontInput label="City" />
      </StorefrontOverlay>,
    );
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(close).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("wraps customer overlay keyboard focus and holds it when controls are disabled", () => {
    const rect = new DOMRect(0, 0, 100, 44);
    const geometry = vi
      .spyOn(HTMLElement.prototype, "getClientRects")
      .mockReturnValue(Object.assign([rect], { item: () => rect }));
    try {
      const view = render(
        <StorefrontOverlay open title="Focus controls" onClose={vi.fn()}>
          <StorefrontButton>Last action</StorefrontButton>
        </StorefrontOverlay>,
      );
      const first = screen.getByRole("button", { name: "Close" });
      const last = screen.getByRole("button", { name: "Last action" });
      last.focus();
      fireEvent.keyDown(last, { key: "Tab" });
      expect(first).toHaveFocus();
      fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
      expect(last).toHaveFocus();
      view.rerender(
        <StorefrontOverlay open title="Focus controls" busy onClose={vi.fn()}>
          <StorefrontButton>Last action</StorefrontButton>
        </StorefrontOverlay>,
      );
      const dialog = screen.getByRole("dialog", { name: "Focus controls" });
      dialog.focus();
      fireEvent.keyDown(dialog, { key: "Tab" });
      expect(dialog).toHaveFocus();
    } finally {
      geometry.mockRestore();
    }
  });

  it("makes only caller-provided notices and lets errors remain visible", () => {
    const dismiss = vi.fn();
    render(
      <StorefrontNotice tone="error" onDismiss={dismiss}>
        Could not update this item
      </StorefrontNotice>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not update this item",
    );
    expect(screen.queryByText(/success/i)).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss notification" }),
    );
    expect(dismiss).toHaveBeenCalledOnce();
  });
});
