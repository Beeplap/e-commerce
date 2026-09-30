import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest, authApi, sellerApi } from "@/lib/api/client";
import { parseMembershipPage, parseUser } from "@/lib/api/validation";
import { csrf, json, membership, page, user } from "./fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("same-origin session API client", () => {
  it("acquires fresh CSRF for login and logout, includes cookies and stores no browser tokens", async () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ csrf_token: csrf }))
      .mockResolvedValueOnce(json(user))
      .mockResolvedValueOnce(json({ csrf_token: "b".repeat(64) }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await authApi.login(user.email, "password-value")).toEqual(user);
    await authApi.logout();
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      "/api/v1/auth/csrf",
      "/api/v1/auth/login",
      "/api/v1/auth/csrf",
      "/api/v1/auth/logout",
    ]);
    const options = fetcher.mock.calls[1]?.[1] as RequestInit;
    expect(options.credentials).toBe("include");
    expect(options.cache).toBe("no-store");
    expect(options.redirect).toBe("error");
    expect(new Headers(options.headers).get("X-CSRFToken")).toBe(csrf);
    expect(new Headers(options.headers).has("Authorization")).toBe(false);
    expect(JSON.parse(String(options.body))).toEqual({
      email: user.email,
      password: "password-value",
    });
    expect(
      new Headers(fetcher.mock.calls[3]?.[1]?.headers).get("X-CSRFToken"),
    ).toBe("b".repeat(64));
    expect(storage).not.toHaveBeenCalled();
  });

  it("does not submit credentials when CSRF acquisition fails", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(json({ detail: "CSRF rejected" }, 403));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      authApi.login(user.email, "password-value"),
    ).rejects.toMatchObject({ status: 403, message: "CSRF rejected" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects an unexpected logout success response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({ csrf_token: csrf }))
        .mockResolvedValueOnce(json({ detail: "ok" })),
    );
    await expect(authApi.logout()).rejects.toMatchObject({
      status: 200,
      message: "The server returned an unexpected response.",
    });
  });

  it("preserves standard validation errors and request references", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        json({ email: ["Enter a valid email."] }, 400, {
          "X-Request-ID": "request-123",
        }),
      ),
    );
    await expect(authApi.me()).rejects.toMatchObject({
      status: 400,
      fields: { email: ["Enter a valid email."] },
      requestId: "request-123",
    });
  });

  it.each([403, 404, 429])(
    "never silently ignores HTTP %i errors",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(json({ detail: "Action denied" }, status)),
      );
      await expect(authApi.me()).rejects.toMatchObject({
        status,
        message: "Action denied",
      });
    },
  );

  it("does not surface server exception details or HTML error bodies", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        json(
          {
            detail: "Traceback with secret configuration",
            password: ["secret exception value"],
          },
          500,
        ),
      )
      .mockResolvedValueOnce(
        new Response("<html>sensitive error</html>", {
          status: 403,
          headers: { "Content-Type": "text/html" },
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(authApi.me()).rejects.toMatchObject({
      message: "The service is temporarily unavailable. Please try again.",
      fields: {},
    });
    await expect(authApi.me()).rejects.toMatchObject({
      status: 403,
      message: "You don’t have permission to perform this action.",
    });
  });

  it("reports network failure without exposing its raw exception", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("internal connection details")),
    );
    await expect(authApi.me()).rejects.toMatchObject({
      status: 0,
      message: "We couldn’t reach the service. Please try again.",
    });
  });

  it.each([
    "https://example.com/api/v1/auth/me",
    "//example.com/api/v1/auth/me",
    "/api/v1/../../outside",
    "/outside",
    "/api/v1/auth/me#fragment",
  ])("rejects unsafe path %s before issuing a request", async (path) => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      apiRequest(path, { parse: parseUser, method: "POST" }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("validates successful response shapes and malformed JSON", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ id: user.id }))
      .mockResolvedValueOnce(
        new Response("{bad", {
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(authApi.me()).rejects.toMatchObject({
      message: "The server returned an unexpected response.",
    });
    await expect(authApi.me()).rejects.toMatchObject({
      message: "The server returned an unexpected response.",
    });
  });

  it("sends seller context explicitly and validates the membership response", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(membership));
    vi.stubGlobal("fetch", fetcher);
    expect(await sellerApi.access(membership.seller.id)).toEqual(membership);
    expect(
      new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("X-Seller-ID"),
    ).toBe(membership.seller.id);
    await expect(sellerApi.access("invalid")).rejects.toBeInstanceOf(ApiError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("bounds pages and never follows a server-supplied pagination URL", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        json({ ...page(), next: "https://untrusted.example/page" }),
      );
    vi.stubGlobal("fetch", fetcher);
    const result = await sellerApi.memberships(1);
    expect(result.results).toEqual([membership]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(() => sellerApi.memberships(0)).toThrow(ApiError);
    expect(() => sellerApi.memberships(10001)).toThrow(ApiError);
    expect(() =>
      parseMembershipPage({
        ...page(),
        results: Array.from({ length: 26 }, () => membership),
      }),
    ).toThrow();
    expect(() => parseMembershipPage({ ...page(), count: -1 })).toThrow();
  });

  it("preserves deliberate request cancellation", async () => {
    const abort = new DOMException("Aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));
    await expect(authApi.me(new AbortController().signal)).rejects.toBe(abort);
  });
});
