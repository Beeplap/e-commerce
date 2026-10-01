import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { AuthProvider } from "@/features/auth/auth-provider";
import { SellerOnboarding } from "@/features/sellers/onboarding";
import { PlatformSellers } from "@/features/sellers/platform-sellers";
import { PlatformSellerDetail } from "@/features/sellers/platform-detail";
import { DocumentPanel } from "@/features/sellers/documents";
import {
  parseDetail,
  pageParser,
  parseDocument,
  sellerManagementApi,
} from "@/features/sellers/api";
import { apiRequest } from "@/lib/api/client";
import { csrf, json, membership, user } from "./fixtures";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/sellers",
  useRouter: () => ({ replace: vi.fn() }),
}));
const seller = {
  ...membership.seller,
  status: "pending",
  verification_status: "pending",
  legal_name: "Acme Registered",
  email: "store@example.com",
  phone: "",
  created_at: "2026-09-30T00:00:00Z",
  updated_at: "2026-09-30T00:00:00Z",
  approved_at: null,
  approved_by: null,
  profile: { description: "Independent store", website: "" },
  settings: { support_email: "" },
  addresses: [],
};
const doc = {
  id: "50000000-0000-4000-8000-000000000001",
  document_type: "registration",
  content_type: "image/png",
  size: 100,
  status: "pending",
  verified_by_id: null,
  verified_at: null,
  rejection_reason: "",
  expires_at: null,
  created_at: "2026-09-30T00:00:00Z",
};
const page = (results: unknown[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});
const permissions = [
  "platform.access",
  "platform.sellers.read",
  "platform.sellers.manage",
  "platform.sellers.documents.read",
  "platform.sellers.documents.review",
  "platform.sellers.audit.read",
];
function mockApi(caps = permissions) {
  return vi.fn(async (path: string) => {
    if (path === "/api/v1/auth/me")
      return json({ ...user, platform_permissions: caps });
    if (path === "/api/v1/auth/csrf") return json({ csrf_token: csrf });
    if (path.includes("/documents?")) return json(page([doc]));
    if (/\/(history|audit|members)\?/.test(path)) return json(page([]));
    if (path.startsWith("/api/v1/admin/sellers?")) return json(page([seller]));
    return json(seller);
  });
}
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
afterAll(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

describe("seller lifecycle browser contract", () => {
  it("uploads multipart with fresh CSRF, cookies and verified seller context", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ csrf_token: csrf }))
      .mockResolvedValueOnce(json(doc, 201));
    vi.stubGlobal("fetch", fetcher);
    const data = new FormData();
    data.set("document_type", "registration");
    data.set("file", new File(["scan"], "scan.png", { type: "image/png" }));
    await sellerManagementApi.upload(seller.id, data);
    const options = fetcher.mock.calls[1]?.[1] as RequestInit;
    expect(options.body).toBe(data);
    expect(options.credentials).toBe("include");
    expect(new Headers(options.headers).get("X-CSRFToken")).toBe(csrf);
    expect(new Headers(options.headers).get("X-Seller-ID")).toBe(seller.id);
    expect(new Headers(options.headers).has("Content-Type")).toBe(false);
  });
  it("encodes search terms without changing the API path", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(page([])));
    vi.stubGlobal("fetch", fetcher);
    await sellerManagementApi.list({
      page: 1,
      search: "Tea & Coffee",
      status: "pending",
      verification_status: "",
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "/api/v1/admin/sellers?page=1&search=Tea+%26+Coffee&status=pending",
    );
    await expect(
      apiRequest("/api/v1/%2e%2e/secrets", { parse: () => null }),
    ).rejects.toThrow("invalid API path");
  });
  it("rejects malformed pages and strips private storage fields", () => {
    expect(
      parseDocument({ ...doc, storage_key: "private/key" }),
    ).not.toHaveProperty("storage_key");
    expect(() =>
      parseDocument({ ...doc, status: "approved_by_browser" }),
    ).toThrow();
    expect(() =>
      pageParser(parseDocument)(page(Array.from({ length: 26 }, () => doc))),
    ).toThrow();
    expect(() =>
      parseDetail({ ...seller, addresses: [{ id: "bad" }] }),
    ).toThrow();
  });
  it("surfaces a denied private download and rejects a JSON success masquerading as a file", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({ detail: "Document unavailable" }, 404))
        .mockResolvedValueOnce(json({ url: "https://public.example/scan" })),
    );
    await expect(
      sellerManagementApi.download(seller.id, false, doc.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      sellerManagementApi.download(seller.id, false, doc.id),
    ).rejects.toThrow("unexpected download");
  });
});

describe("seller lifecycle screens", () => {
  it("registers the business with explicit fields then links to settings", async () => {
    const fetcher = mockApi([]);
    fetcher.mockImplementation(async (path) =>
      path === "/api/v1/auth/me"
        ? json(user)
        : path === "/api/v1/auth/csrf"
          ? json({ csrf_token: csrf })
          : json(seller, 201),
    );
    vi.stubGlobal("fetch", fetcher);
    render(
      <AuthProvider>
        <SellerOnboarding />
      </AuthProvider>,
    );
    fireEvent.change(screen.getByLabelText(/Registered legal name/), {
      target: { value: "Acme Registered" },
    });
    fireEvent.change(screen.getByLabelText(/Store display name/), {
      target: { value: "Acme" },
    });
    fireEvent.change(screen.getByLabelText(/Business email/), {
      target: { value: "store@example.com" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Create seller workspace" })
        .closest("form")!,
    );
    expect(
      await screen.findByRole("link", { name: "Continue to seller settings" }),
    ).toHaveAttribute("href", "/seller/settings");
    const call = fetcher.mock.calls.find(
      ([path]) => path === "/api/v1/seller/onboarding",
    );
    expect(call).toBeDefined();
  });
  it("does not query the seller list without its explicit capability", async () => {
    const fetcher = mockApi(["platform.access"]);
    vi.stubGlobal("fetch", fetcher);
    render(
      <AuthProvider>
        <PlatformSellers />
      </AuthProvider>,
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(
      fetcher.mock.calls.some(([path]) =>
        path.startsWith("/api/v1/admin/sellers"),
      ),
    ).toBe(false);
  });
  it("applies server-side filters and links to seller detail", async () => {
    const fetcher = mockApi();
    vi.stubGlobal("fetch", fetcher);
    render(
      <AuthProvider>
        <PlatformSellers />
      </AuthProvider>,
    );
    expect(
      await screen.findByRole("link", { name: seller.display_name }),
    ).toHaveAttribute("href", `/admin/sellers/${seller.id}`);
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "Tea & Coffee" },
    });
    fireEvent.change(screen.getByLabelText("Seller status"), {
      target: { value: "pending" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Apply filters" }).closest("form")!,
    );
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([path]) =>
          path.includes("search=Tea+%26+Coffee&status=pending"),
        ),
      ).toBe(true),
    );
  });
  it("hides platform mutation and document controls from a read-only inspector", async () => {
    const fetcher = mockApi(["platform.access", "platform.sellers.read"]);
    vi.stubGlobal("fetch", fetcher);
    render(
      <AuthProvider>
        <PlatformSellerDetail sellerId={seller.id} />
      </AuthProvider>,
    );
    await screen.findByRole("heading", { name: "Business profile" });
    expect(
      screen.queryByRole("button", { name: "approve seller" }),
    ).not.toBeInTheDocument();
    expect(
      fetcher.mock.calls.some(
        ([path]) => path.includes("/documents?") || path.includes("/audit?"),
      ),
    ).toBe(false);
  });
  it("keeps an approval dialog open on authoritative backend denial", async () => {
    const fetcher = mockApi();
    const fallback = fetcher.getMockImplementation()!;
    fetcher.mockImplementation(async (path) =>
      path.endsWith("/approve")
        ? json({ detail: "Seller members cannot approve themselves." }, 403)
        : fallback(path),
    );
    vi.stubGlobal("fetch", fetcher);
    render(
      <AuthProvider>
        <PlatformSellerDetail sellerId={seller.id} />
      </AuthProvider>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "approve seller" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm action" }));
    expect(
      await screen.findByText("Seller members cannot approve themselves."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("allows a complete document rejection reason before opening confirmation", async () => {
    const fetcher = mockApi();
    const fallback = fetcher.getMockImplementation()!;
    fetcher.mockImplementation(async (path) =>
      path.endsWith("/reject")
        ? json({
            ...doc,
            status: "rejected",
            rejection_reason: "Entire scan is illegible",
          })
        : fallback(path),
    );
    vi.stubGlobal("fetch", fetcher);
    render(
      <DocumentPanel
        sellerId={seller.id}
        platform
        canUpload={false}
        canReview
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Reject document" }),
    );
    fireEvent.change(screen.getByLabelText(/Document rejection reason/), {
      target: { value: "Entire scan is illegible" },
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review rejection" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Reject document",
      }),
    );
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([path]) => path.endsWith(`/${doc.id}/reject`)),
      ).toBe(true),
    );
    await act(async () => {});
  });
});
