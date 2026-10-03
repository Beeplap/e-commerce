import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/features/auth/auth-provider";
import { SellerWorkspace } from "@/features/workspaces/seller-workspace";
import { SellerStaff } from "@/features/sellers/staff";
import { csrf, json, membership, page, user } from "./fixtures";

vi.mock("next/navigation", () => ({
  usePathname: () => "/seller/staff",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("staff access workflow", () => {
  const member = {
    id: "20000000-0000-4000-8000-000000000003",
    user: { ...user, email: "colleague@example.com" },
    role: { ...membership.role, name: "Operations", is_owner: false },
    status: "active",
    permissions: [],
    joined_at: null,
    invited_at: "2026-10-01T00:00:00Z",
  };
  function setup(canManage = true) {
    const revoked = vi.fn();
    const access = {
      ...membership,
      permissions: [
        "seller.context.read",
        "seller.staff.read",
        ...(canManage ? ["seller.staff.manage"] : []),
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/auth/csrf")) return json({ csrf_token: csrf });
        if (url.includes("/auth/me")) return json(user);
        if (url.includes("/seller/memberships")) return json(page([access]));
        if (url.includes("/seller/access")) return json(access);
        if (url.endsWith("/revoke")) {
          revoked(init);
          return json({ detail: "You cannot revoke this membership." }, 403);
        }
        if (url.includes("/seller/staff"))
          return json({ count: 1, results: [member] });
        if (url.includes("/seller/roles")) return json([]);
        return json({ detail: "Not found" }, 404);
      }),
    );
    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerStaff />
        </SellerWorkspace>
      </AuthProvider>,
    );
    return revoked;
  }

  it("requires a target-specific confirmation and keeps backend rejection visible", async () => {
    const revoked = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));
    const dialog = screen.getByRole("dialog", { name: "Revoke staff access" });
    expect(dialog).toHaveAccessibleDescription(
      expect.stringContaining(member.user.email),
    );
    expect(dialog).toHaveAccessibleDescription(
      expect.stringContaining("lose access"),
    );
    expect(revoked).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(revoked).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    fireEvent.click(screen.getByRole("button", { name: "Revoke access" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You cannot revoke this membership.",
    );
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(
      screen.getByRole("dialog", { name: "Revoke staff access" }),
    ).toBeVisible();
    expect(revoked).toHaveBeenCalledTimes(1);
    const request = revoked.mock.calls[0]?.[0] as RequestInit | undefined;
    expect(new Headers(request?.headers).get("X-Seller-ID")).toBe(
      membership.seller.id,
    );
  });

  it("hides management actions when the server grants read access only", async () => {
    const revoked = setup(false);
    await waitFor(() =>
      expect(screen.getByText(member.user.email)).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "Revoke" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Invite member" }),
    ).not.toBeInTheDocument();
    expect(revoked).not.toHaveBeenCalled();
  });
});
