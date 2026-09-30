import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AuthProvider } from "@/features/auth/auth-provider";
import { LoginForm } from "@/features/auth/login-form";
import { json } from "./fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());

it("reports an initial session service failure on the login page and permits retry", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(json({ detail: "private failure" }, 500))
    .mockResolvedValueOnce(json({ detail: "Authentication required" }, 403));
  vi.stubGlobal("fetch", fetcher);
  render(
    <AuthProvider>
      <LoginForm />
    </AuthProvider>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "temporarily unavailable",
  );
  expect(screen.queryByText("private failure")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
});
