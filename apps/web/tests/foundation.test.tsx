import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "../app/page";
import { GET } from "../app/health/route";
import nextConfig from "../next.config";

describe("platform foundation", () => {
  it("renders an accessible landing page without fake business data", () => {
    render(<Home />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Marketplace administration",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /log in/i }),
    ).not.toBeInTheDocument();
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
