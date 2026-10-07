import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StorefrontHeader } from "@/features/storefront/header";
import { SearchBar } from "@/features/storefront/search-bar";
import type { StorefrontSuggestResponse } from "@/lib/api/types";
import { json, user } from "./fixtures";

const mocks = vi.hoisted(() => ({ push: vi.fn(), openCart: vi.fn() }));
let pathname = "/";
let session:
  { kind: "anonymous" } | { kind: "authenticated"; user: typeof user } = {
  kind: "anonymous",
};
let cart: { total_items: number } | null = { total_items: 7 };
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({ state: session }),
}));
vi.mock("@/features/cart/cart-context", () => ({
  useCart: () => ({ cart, openCart: mocks.openCart }),
}));

const category = {
  id: "60000000-0000-4000-8000-000000000036",
  name: "Lighting",
  slug: "lighting",
  description: "",
  parent_id: null,
  product_count: 1,
};
const suggestions: StorefrontSuggestResponse = {
  query: "lamp",
  suggestions: ["desk lamp"],
  categories: [category],
  brands: [
    {
      id: "70000000-0000-4000-8000-000000000036",
      name: "Oak",
      slug: "oak",
      product_count: 1,
    },
  ],
  products: [
    {
      id: "80000000-0000-4000-8000-000000000036",
      title: "Reading lamp",
      slug: "reading-lamp",
      starting_price: "9007199254740993.25",
      currency: "NPR",
      thumbnail_url: null,
      category_name: "Lighting",
    },
  ],
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function typeQuery(query = "lamp") {
  const field = screen.getByRole("combobox");
  act(() => field.focus());
  fireEvent.change(field, { target: { value: query } });
  return field;
}

beforeEach(() => {
  vi.clearAllMocks();
  pathname = "/";
  session = { kind: "anonymous" };
  cart = { total_items: 7 };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/suggest")) return Promise.resolve(json(suggestions));
      if (url.includes("/categories")) return Promise.resolve(json([category]));
      if (url.includes("/products"))
        return Promise.resolve(json({ results: [] }));
      return Promise.reject(new Error("Unexpected request"));
    }),
  );
});

describe("Phase 36 customer shell", () => {
  it("marks the actual current category and its navigation section", async () => {
    pathname = `/categories/${category.id}`;
    render(<StorefrontHeader />);
    const toggle = screen.getByRole("button", { name: "Categories" });
    expect(toggle).toHaveAttribute("aria-current", "location");
    expect(screen.getByRole("link", { name: "Shop" })).not.toHaveAttribute(
      "aria-current",
    );
    fireEvent.click(toggle);
    expect(
      await screen.findByRole("link", { name: "Lighting" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("opens actual category destinations, dismisses with Escape/outside and returns focus", async () => {
    render(<StorefrontHeader />);
    const toggle = screen.getByRole("button", { name: "Categories" });
    fireEvent.click(toggle);
    expect(
      await screen.findByRole("link", { name: "Lighting" }),
    ).toHaveAttribute("href", `/categories/${category.id}`);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      document.getElementById(toggle.getAttribute("aria-controls")!),
    ).toBeInTheDocument();
    fireEvent.keyDown(toggle, { key: "Escape" });
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    fireEvent.pointerDown(document.body);
    expect(
      screen.queryByRole("link", { name: "Lighting" }),
    ).not.toBeInTheDocument();
  });

  it("shows failed category loading and genuinely retries rather than presenting empty success", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Offline"));
    render(<StorefrontHeader />);
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    expect(
      await screen.findByText("We couldn’t load categories."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No categories are available yet."),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("link", { name: "Lighting" }),
    ).toBeInTheDocument();
  });

  it("loads bounded genuine seller previews lazily, deduplicates stores and labels their source", async () => {
    const stores = Array.from({ length: 10 }, (_, index) => ({
      seller: {
        id: `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        name: `Store ${index}`,
        store_name: `Store ${index}`,
      },
    }));
    vi.mocked(fetch).mockImplementation((input) =>
      Promise.resolve(
        String(input).includes("/products")
          ? json({ results: [stores[0], ...stores] })
          : json([]),
      ),
    );
    render(<StorefrontHeader />);
    expect(
      vi
        .mocked(fetch)
        .mock.calls.every(([input]) => !String(input).includes("/products")),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Sellers" }));
    const links = await screen.findAllByRole("link", { name: /^Store / });
    expect(links).toHaveLength(8);
    expect(
      screen.getByText("Stores from the latest catalog arrivals."),
    ).toBeInTheDocument();
    expect(links[0]).toHaveAttribute(
      "href",
      "/sellers/30000000-0000-4000-8000-000000000000",
    );
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([input]) =>
          String(input).endsWith("/products?sort=newest"),
        ),
    ).toBe(true);
  });

  it("preserves real cart opening, describes counts and avoids reporting zero when unavailable", () => {
    const view = render(<StorefrontHeader />);
    const button = screen.getByRole("button", { name: "Shopping Cart" });
    expect(button).toHaveAccessibleDescription("7 items");
    fireEvent.click(button);
    expect(mocks.openCart).toHaveBeenCalledOnce();
    cart = null;
    view.rerender(<StorefrontHeader />);
    expect(button).toHaveAccessibleDescription("Item count unavailable");
    expect(screen.getByTestId("cart-badge")).toHaveTextContent("—");
  });

  it("uses the native mobile drawer with search, navigation, cart, account and seller entry points", async () => {
    render(<StorefrontHeader />);
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    act(() => trigger.focus());
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", {
      name: "Explore QuickCommerce",
    });
    const field = within(dialog).getByRole("combobox");
    await waitFor(() => expect(field).toHaveFocus());
    expect(
      within(dialog).getByRole("link", { name: "Shop all products" }),
    ).toHaveAttribute("href", "/search");
    expect(
      within(dialog).getByRole("link", { name: "Sign In" }),
    ).toHaveAttribute("href", "/login");
    expect(
      within(dialog).getByRole("link", { name: /Your cart/ }),
    ).toHaveAttribute("href", "/cart");
    expect(
      within(dialog).getByRole("link", { name: "Sell with us" }),
    ).toHaveAttribute("href", "/onboarding");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("dismisses autocomplete before the mobile drawer and restores the opener's focus", async () => {
    render(<StorefrontHeader />);
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    act(() => trigger.focus());
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", {
      name: "Explore QuickCommerce",
    });
    const field = within(dialog).getByRole("combobox");
    await waitFor(() => expect(field).toHaveFocus());
    fireEvent.change(field, { target: { value: "lamp" } });
    expect(await within(dialog).findAllByRole("option")).toHaveLength(4);
    fireEvent.keyDown(field, { key: "Escape", isComposing: true });
    expect(dialog).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(field, { key: "Escape" });
    expect(dialog).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-expanded", "false");
    fireEvent.keyDown(field, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("closes mobile navigation at the desktop breakpoint and focuses the visible brand", async () => {
    const media = new EventTarget();
    let matches = false;
    Object.defineProperty(media, "matches", { get: () => matches });
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => media),
    );
    render(<StorefrontHeader />);
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    act(() => trigger.focus());
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    act(() => {
      matches = true;
      media.dispatchEvent(new Event("change"));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "QuickCommerce home" }),
    ).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe("");
    vi.unstubAllGlobals();
  });

  it("remounts discovery and closes the drawer on route/identity changes without exposing email", async () => {
    const old = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(old.promise);
    const view = render(<StorefrontHeader />);
    const signal = vi.mocked(fetch).mock.calls[0]?.[1]?.signal;
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    session = { kind: "authenticated", user };
    pathname = "/search";
    view.rerender(<StorefrontHeader />);
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Your account" })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(screen.queryByText(user.email)).not.toBeInTheDocument();
    await act(async () =>
      old.resolve(json([{ ...category, name: "Stale category" }])),
    );
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    expect(
      await screen.findByRole("link", { name: "Lighting" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Stale category")).not.toBeInTheDocument();
  });
});

describe("Phase 36 search interactions", () => {
  it("gives every suggestion type a selectable option and a unique active descendant", async () => {
    render(<SearchBar />);
    const field = typeQuery();
    expect(await screen.findAllByRole("option")).toHaveLength(4);
    expect(
      screen.getByText("9,007,199,254,740,993.25 NPR"),
    ).toBeInTheDocument();
    for (const label of ["Suggestions", "Categories", "Brands", "Products"])
      expect(screen.getByRole("group", { name: label })).toBeInTheDocument();
    fireEvent.keyDown(field, { key: "ArrowUp" });
    const active = document.getElementById(
      field.getAttribute("aria-activedescendant")!,
    );
    expect(active).toHaveAttribute("aria-selected", "true");
    expect(active).toHaveTextContent("Reading lamp");
    fireEvent.keyDown(field, { key: "Enter" });
    expect(mocks.push).toHaveBeenCalledWith(
      "/products/80000000-0000-4000-8000-000000000036",
    );
  });

  it("resets selection on Escape so Enter searches the typed query", async () => {
    render(<SearchBar />);
    const field = typeQuery();
    await screen.findAllByRole("option");
    fireEvent.keyDown(field, { key: "ArrowDown" });
    fireEvent.keyDown(field, { key: "Escape" });
    expect(field).toHaveAttribute("aria-expanded", "false");
    expect(field).not.toHaveAttribute("aria-activedescendant");
    fireEvent.keyDown(field, { key: "Enter" });
    expect(mocks.push).toHaveBeenCalledWith("/search?q=lamp");
  });

  it("View all searches the query even with an active quick suggestion", async () => {
    render(<SearchBar />);
    const field = typeQuery();
    await screen.findAllByRole("option");
    fireEvent.keyDown(field, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("button", { name: /View all results/ }));
    expect(mocks.push).toHaveBeenCalledWith("/search?q=lamp");
  });

  it("aborts older requests and discards late responses after another query", async () => {
    const old = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(old.promise);
    render(<SearchBar />);
    const field = typeQuery();
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const signal = vi.mocked(fetch).mock.calls[0]?.[1]?.signal;
    fireEvent.change(field, { target: { value: "light" } });
    vi.mocked(fetch).mockResolvedValueOnce(
      json({ ...suggestions, query: "light", suggestions: ["light fixture"] }),
    );
    expect(
      await screen.findByRole("option", { name: "light fixture" }),
    ).toBeInTheDocument();
    expect(signal?.aborted).toBe(true);
    await act(async () => old.resolve(json(suggestions)));
    expect(
      screen.queryByRole("option", { name: "desk lamp" }),
    ).not.toBeInTheDocument();
  });

  it("does not reopen a dismissed pending popup and clearing discards its late data", async () => {
    const pending = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(pending.promise);
    render(<SearchBar />);
    const field = typeQuery();
    await screen.findByText("Searching…");
    fireEvent.keyDown(field, { key: "Escape" });
    await act(async () => pending.resolve(json(suggestions)));
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    fireEvent.keyDown(field, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Clear search input" }));
    expect(field).toHaveValue("");
    expect(field).toHaveFocus();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("shows a suggestion failure while Enter still performs a real search", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Offline"));
    render(<SearchBar />);
    const field = typeQuery("lamp & shade");
    expect(
      await screen.findByText(
        "Suggestions unavailable. Press Enter to search.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No quick matches/)).not.toBeInTheDocument();
    fireEvent.keyDown(field, { key: "Enter" });
    expect(mocks.push).toHaveBeenCalledWith("/search?q=lamp%20%26%20shade");
  });

  it("keeps multiple search identities independent and honors IME composition", async () => {
    render(
      <>
        <SearchBar />
        <SearchBar />
      </>,
    );
    const fields = screen.getAllByRole("combobox");
    expect(fields[0]?.id).not.toBe(fields[1]?.id);
    const field = fields[0]!;
    act(() => field.focus());
    fireEvent.change(field, { target: { value: "lamp" } });
    await screen.findAllByRole("option");
    expect(field.getAttribute("aria-controls")).toBeTruthy();
    expect(fields[1]).not.toHaveAttribute("aria-controls");
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: "Enter" });
    expect(mocks.push).toHaveBeenCalledWith("/search?q=lamp");
  });

  it("rejects malformed or mismatched suggestion evidence rather than making links", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      json({ ...suggestions, query: "another query" }),
    );
    render(<SearchBar />);
    typeQuery();
    expect(
      await screen.findByText(
        "Suggestions unavailable. Press Enter to search.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("accepts the backend's bounded query echo for an existing long initial query", async () => {
    const query = "é".repeat(110);
    vi.mocked(fetch).mockResolvedValueOnce(
      json({ ...suggestions, query: "é".repeat(100) }),
    );
    render(<SearchBar initialQuery={query} />);
    const field = screen.getByRole("combobox");
    act(() => field.focus());
    expect(await screen.findAllByRole("option")).toHaveLength(4);
    expect(
      screen.queryByText(/Suggestions unavailable/),
    ).not.toBeInTheDocument();
    expect(field).toHaveAttribute("maxlength", "100");
  });
});
