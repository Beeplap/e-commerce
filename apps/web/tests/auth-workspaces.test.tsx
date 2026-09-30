import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/features/auth/auth-provider";
import { LoginForm } from "@/features/auth/login-form";
import { AccountMenu } from "@/features/auth/account-menu";
import { RequireSession } from "@/features/auth/require-session";
import { AdminWorkspace } from "@/features/workspaces/admin-workspace";
import {
  SellerWorkspace,
  useSeller,
} from "@/features/workspaces/seller-workspace";
import { WorkspaceFrame } from "@/features/workspaces/workspace-frame";
import { WorkspaceChooser } from "@/features/workspaces/workspace-chooser";
import {
  csrf,
  json,
  membership,
  page,
  secondMembership,
  user,
} from "./fixtures";

const navigation = vi.hoisted(() => ({
  router: { replace: vi.fn() },
  pathname: "/seller",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation.router,
  usePathname: () => navigation.pathname,
}));

beforeEach(() => {
  navigation.pathname = "/seller";
  navigation.router.replace.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

function Probe() {
  const { state } = useAuth();
  return (
    <output>
      {state.kind === "authenticated" ? state.user.email : state.kind}
    </output>
  );
}

function sellerContent() {
  return <span>Authorized seller content</span>;
}
function SelectedSeller() {
  const selected = useSeller();
  return <h1>Selected: {selected.seller.display_name}</h1>;
}

function signIn() {
  fireEvent.change(screen.getByLabelText(/Email address/), {
    target: { value: user.email },
  });
  fireEvent.change(screen.getByLabelText(/^Password/), {
    target: { value: "test-password-value" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Sign in" }).closest("form")!,
  );
}

function mockSession(platform = false) {
  return vi.fn(async (path: string, options?: RequestInit) => {
    if (path === "/api/v1/auth/me" || path === "/api/v1/admin/access")
      return json({
        ...user,
        platform_permissions: platform ? ["platform.access"] : [],
      });
    if (path === "/api/v1/auth/csrf") return json({ csrf_token: csrf });
    if (path === "/api/v1/auth/logout")
      return new Response(null, { status: 204 });
    if (path.startsWith("/api/v1/seller/memberships"))
      return json(page([membership, secondMembership]));
    if (path === "/api/v1/seller/access")
      return json(
        new Headers(options?.headers).get("X-Seller-ID") ===
          secondMembership.seller.id
          ? secondMembership
          : membership,
      );
    return json({ detail: "Not found" }, 404);
  });
}

describe("session authentication UI", () => {
  it("signs in with CSRF, clears the password and navigates to authorized workspace selection", async () => {
    const fetcher = vi.fn(async (path: string) => {
      if (path.endsWith("/csrf")) return json({ csrf_token: csrf });
      if (path.endsWith("/login")) return json(user);
      return json({ detail: "Authentication required." }, 403);
    });
    vi.stubGlobal("fetch", fetcher);
    render(
      <AuthProvider>
        <LoginForm />
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText("anonymous");
    signIn();
    await waitFor(() =>
      expect(navigation.router.replace).toHaveBeenCalledWith("/workspaces"),
    );
    expect(screen.getByRole("status")).toHaveTextContent(user.email);
    expect(screen.getByLabelText(/^Password/)).toHaveValue("");
    expect(
      fetcher.mock.calls.some((call) => call[0] === "/api/v1/auth/login"),
    ).toBe(true);
  });

  it("shows rejected credentials and clears the password without redirecting", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) =>
        path.endsWith("/csrf")
          ? json({ csrf_token: csrf })
          : json({ detail: "Invalid email or password." }, 403),
      ),
    );
    render(
      <AuthProvider>
        <LoginForm />
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText("anonymous");
    signIn();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password.",
    );
    expect(screen.getByLabelText(/^Password/)).toHaveValue("");
    expect(screen.getByLabelText(/Email address/)).toHaveValue(user.email);
    expect(navigation.router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("anonymous");
  });

  it("does not let an earlier session lookup overwrite a successful login", async () => {
    let finishInitial!: (response: Response) => void;
    const initial = new Promise<Response>((resolve) => {
      finishInitial = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) => {
        if (path.endsWith("/me")) return initial;
        if (path.endsWith("/csrf")) return json({ csrf_token: csrf });
        return json(user);
      }),
    );
    render(
      <AuthProvider>
        <LoginForm />
        <Probe />
      </AuthProvider>,
    );
    signIn();
    await waitFor(() =>
      expect(navigation.router.replace).toHaveBeenCalledWith("/workspaces"),
    );
    await act(async () => {
      finishInitial(json({ detail: "Authentication required." }, 403));
    });
    expect(screen.getByRole("status")).toHaveTextContent(user.email);
  });

  it("signs out through Django before clearing identity or navigating", async () => {
    const fetcher = mockSession();
    vi.stubGlobal("fetch", fetcher);
    render(
      <AuthProvider>
        <AccountMenu />
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(user.email),
    );
    const summary = screen.getByText(/menu for/).closest("summary")!;
    fireEvent.click(summary);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() =>
      expect(navigation.router.replace).toHaveBeenCalledWith("/login"),
    );
    expect(screen.getByRole("status")).toHaveTextContent("anonymous");
    expect(
      fetcher.mock.calls.some((call) => call[0] === "/api/v1/auth/logout"),
    ).toBe(true);
  });

  it("keeps identity and displays an error when logout fails", async () => {
    const fetcher = mockSession();
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string, options?: RequestInit) =>
        path.endsWith("/logout")
          ? Promise.resolve(json({ detail: "Logout rejected" }, 403))
          : fetcher(path, options),
      ),
    );
    render(
      <AuthProvider>
        <AccountMenu />
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(user.email),
    );
    fireEvent.click(screen.getByText(/menu for/).closest("summary")!);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Logout rejected",
    );
    expect(screen.getByRole("status")).toHaveTextContent(user.email);
    expect(navigation.router.replace).not.toHaveBeenCalled();
  });

  it("redirects anonymous protected routes and hides their contents", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(json({ detail: "Authentication required." }, 403)),
    );
    render(
      <AuthProvider>
        <RequireSession>
          <span>Private workspace</span>
        </RequireSession>
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(navigation.router.replace).toHaveBeenCalledWith("/login"),
    );
    expect(screen.queryByText("Private workspace")).not.toBeInTheDocument();
  });

  it("displays session service errors and allows a real retry", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ detail: "private traceback" }, 500))
      .mockResolvedValueOnce(json(user));
    vi.stubGlobal("fetch", fetcher);
    render(
      <AuthProvider>
        <RequireSession>
          <span>Authorized content</span>
        </RequireSession>
      </AuthProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "temporarily unavailable",
    );
    expect(screen.queryByText("private traceback")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Authorized content")).toBeVisible();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("workspace authorization UX", () => {
  it("denies the platform route for a regular user", async () => {
    const fetcher = mockSession();
    vi.stubGlobal("fetch", fetcher);
    render(
      <AuthProvider>
        <RequireSession>
          <AdminWorkspace>
            <span>Platform content</span>
          </AdminWorkspace>
        </RequireSession>
      </AuthProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "You don’t have access" }),
    ).toBeVisible();
    expect(screen.queryByText("Platform content")).not.toBeInTheDocument();
    expect(
      fetcher.mock.calls.some((call) => call[0] === "/api/v1/admin/access"),
    ).toBe(false);
  });

  it("revalidates platform access with Django and hides revoked access", async () => {
    const fetcher = mockSession(true);
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string, options?: RequestInit) =>
        path === "/api/v1/admin/access"
          ? Promise.resolve(json({ detail: "Permission denied" }, 403))
          : fetcher(path, options),
      ),
    );
    render(
      <AuthProvider>
        <RequireSession>
          <AdminWorkspace>
            <span>Platform content</span>
          </AdminWorkspace>
        </RequireSession>
      </AuthProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "You don’t have access" }),
    ).toBeVisible();
    expect(screen.queryByText("Platform content")).not.toBeInTheDocument();
  });

  it("renders the platform shell after backend validation", async () => {
    vi.stubGlobal("fetch", mockSession(true));
    render(
      <AuthProvider>
        <RequireSession>
          <AdminWorkspace>
            <h1>Platform overview</h1>
          </AdminWorkspace>
        </RequireSession>
      </AuthProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "Platform overview" }),
    ).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "Workspace navigation" }),
    ).toBeInTheDocument();
  });

  it("validates seller context and revalidates when selecting another seller", async () => {
    const fetcher = mockSession();
    vi.stubGlobal("fetch", fetcher);
    render(
      <AuthProvider>
        <RequireSession>
          <SellerWorkspace>
            <SelectedSeller />
          </SellerWorkspace>
        </RequireSession>
      </AuthProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "Selected: Seller A" }),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Seller workspace"), {
      target: { value: secondMembership.seller.id },
    });
    expect(
      await screen.findByRole("heading", { name: "Selected: Seller B" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Selected: Seller A" }),
    ).not.toBeInTheDocument();
    const requests = fetcher.mock.calls.filter(
      (call) => call[0] === "/api/v1/seller/access",
    );
    expect(
      requests.map((call) => new Headers(call[1]?.headers).get("X-Seller-ID")),
    ).toEqual([membership.seller.id, secondMembership.seller.id]);
  });

  it("does not render a seller workspace for a user without memberships", async () => {
    const fetcher = mockSession();
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string, options?: RequestInit) =>
        path.includes("/memberships")
          ? Promise.resolve(json(page([])))
          : fetcher(path, options),
      ),
    );
    render(
      <AuthProvider>
        <RequireSession>
          <SellerWorkspace>{sellerContent()}</SellerWorkspace>
        </RequireSession>
      </AuthProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "You don’t have access" }),
    ).toBeVisible();
    expect(
      screen.queryByText("Authorized seller content"),
    ).not.toBeInTheDocument();
  });

  it("does not show seller content after backend membership revocation", async () => {
    const fetcher = mockSession();
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string, options?: RequestInit) =>
        path === "/api/v1/seller/access"
          ? Promise.resolve(json({ detail: "Seller not found." }, 404))
          : fetcher(path, options),
      ),
    );
    render(
      <AuthProvider>
        <RequireSession>
          <SellerWorkspace>{sellerContent()}</SellerWorkspace>
        </RequireSession>
      </AuthProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "You don’t have access" }),
    ).toBeVisible();
    expect(
      screen.queryByText("Authorized seller content"),
    ).not.toBeInTheDocument();
  });

  it("hides platform navigation without an explicit permission and supports mobile navigation", async () => {
    vi.stubGlobal("fetch", mockSession());
    render(
      <AuthProvider>
        <RequireSession>
          <WorkspaceFrame mode="seller">
            <h1>Seller overview</h1>
          </WorkspaceFrame>
        </RequireSession>
      </AuthProvider>,
    );
    await screen.findByRole("heading", { name: "Seller overview" });
    expect(
      screen.queryByRole("link", { name: "Platform workspace" }),
    ).not.toBeInTheDocument();
    const menu = screen.getByRole("button", { name: "Menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeInTheDocument();
  });

  it("renders authoritative membership data without invented metrics", async () => {
    vi.stubGlobal("fetch", mockSession());
    render(
      <AuthProvider>
        <RequireSession>
          <WorkspaceChooser />
        </RequireSession>
      </AuthProvider>,
    );
    expect(
      await screen.findByRole("table", { name: "Your seller memberships" }),
    ).toBeVisible();
    expect(screen.getByText("Seller A")).toBeInTheDocument();
    expect(screen.getByText("Seller B")).toBeInTheDocument();
    expect(
      screen.queryByText(/GMV|Gross sales|Total orders/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open platform workspace" }),
    ).not.toBeInTheDocument();
  });
});
