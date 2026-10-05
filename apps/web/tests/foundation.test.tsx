import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import Home from "../app/page";
import { GET } from "../app/health/route";
import nextConfig from "../next.config";
import { AuthProvider } from "@/features/auth/auth-provider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe("platform foundation", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [], count: 0 }),
      }),
    );
  });

  it("renders an accessible landing page without fake business data", () => {
    render(
      <AuthProvider>
        <Home />
      </AuthProvider>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Good finds.*Independent shops/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Sell on QuickCommerce" }),
    ).toHaveAttribute("href", "/onboarding");
  });

  it("returns minimal, uncached web liveness", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("does not enable a development backend proxy outside development", async () => {
    expect(await nextConfig.rewrites?.()).toEqual([]);
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
