import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/features/auth/auth-provider";
import { LoginForm } from "@/features/auth/login-form";
import { CustomerAddressesPage } from "@/features/account/addresses";
import { CustomerProfilePage } from "@/features/account/profile";
import { CustomerOrdersPage } from "@/features/account/orders";
import { CustomerOrderDetailPage } from "@/features/account/order-detail";
import { DeliveryStepper } from "@/features/account/delivery-stepper";
import { ReviewModal } from "@/features/account/review-modal";
import { ReturnModal } from "@/features/account/return-modal";
import {
  orderEvidence,
  ordersEvidence,
  profileEvidence,
} from "@/features/account/evidence";
import { csrf, json, user } from "./fixtures";
import {
  accountAddress,
  accountId,
  accountListOrder,
  accountOrder,
  accountProfile,
} from "./account-fixtures";

const navigation = vi.hoisted(() => ({
  path: "/account/orders",
  id: "91000000-0000-4000-8000-000000000003",
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => navigation.path,
  useParams: () => ({ id: navigation.id }),
}));
vi.mock("@/features/storefront/header", () => ({
  StorefrontHeader: () => <header>Customer shell</header>,
}));
vi.mock("@/features/storefront/footer", () => ({
  StorefrontFooter: () => <footer>Customer footer</footer>,
}));
beforeEach(() => {
  navigation.id = accountOrder.id;
  navigation.path = "/account/orders";
  navigation.replace.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
type Handler = (
  path: string,
  init?: RequestInit,
) => Response | Promise<Response>;
function server(handler: Handler, session = user) {
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/api/v1/auth/me") return json(session);
    if (path === "/api/v1/auth/csrf") return json({ csrf_token: csrf });
    return handler(path, init);
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
const list = (results = [accountListOrder]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});

describe("Consumed customer response evidence", () => {
  it("preserves large exact decimal snapshots without recalculating financial history", () => {
    const value = { ...accountOrder, grand_total: "9007199254740993.123400" };
    expect(orderEvidence(value, accountOrder.id).grand_total).toBe(
      value.grand_total,
    );
  });
  it("preserves historical item snapshots when optional catalog references are absent", () => {
    const value = {
      ...accountOrder,
      packages: [
        {
          ...accountOrder.packages[0]!,
          items: [
            {
              ...accountOrder.packages[0]!.items[0]!,
              product_id: null,
              variant_id: null,
            },
          ],
        },
      ],
    };
    expect(
      orderEvidence(value as unknown as typeof accountOrder, accountOrder.id)
        .packages[0]!.items[0]!.product_title,
    ).toBe("Everyday linen");
  });
  it.each([
    ["foreign ID", { id: accountId(99) }],
    ["currency", { currency: "usd" }],
    ["money", { grand_total: "NaN" }],
    ["timestamp", { created_at: "yesterday" }],
    ["address", { shipping_address: { line1: { private: true } } }],
    [
      "duplicate packages",
      { packages: [accountOrder.packages[0], accountOrder.packages[0]] },
    ],
    [
      "malformed items",
      {
        packages: [
          {
            ...accountOrder.packages[0],
            items: [{ ...accountOrder.packages[0]!.items[0], quantity: 1.5 }],
          },
        ],
      },
    ],
    [
      "fake eligibility",
      {
        packages: [
          {
            ...accountOrder.packages[0],
            items: [
              { ...accountOrder.packages[0]!.items[0], can_return: "true" },
            ],
          },
        ],
      },
    ],
    [
      "bad event",
      {
        packages: [
          {
            ...accountOrder.packages[0],
            tracking_events: [
              {
                ...accountOrder.packages[0]!.tracking_events[0],
                timestamp: "not-a-date",
              },
            ],
          },
        ],
      },
    ],
  ])("rejects %s before confidential order rendering", (_name, changes) => {
    expect(() =>
      orderEvidence(
        { ...accountOrder, ...changes } as typeof accountOrder,
        accountOrder.id,
      ),
    ).toThrow("could not be verified");
  });
  it.each([
    [
      "unbounded rows",
      { ...list(), results: Array(26).fill(accountListOrder) },
    ],
    [
      "duplicate identities",
      { ...list(), count: 2, results: [accountListOrder, accountListOrder] },
    ],
    ["fractional count", { ...list(), count: 1.5 }],
    ["invalid row", list([{ ...accountListOrder, id: "../other-user" }])],
    ["invalid price", list([{ ...accountListOrder, grand_total: "1e5" }])],
  ])("rejects %s in order history", (_name, value) => {
    expect(() => ordersEvidence(value)).toThrow("could not be verified");
  });
  it("rejects a profile for another session user", () => {
    expect(() => profileEvidence(accountProfile, accountId(99))).toThrow();
  });
  it("rejects invalid profile dates before date rendering", () => {
    expect(() =>
      profileEvidence({ ...accountProfile, created_at: "bad" }, user.id),
    ).toThrow();
  });
});

it("keeps read failures separate from no-orders empty state and permits retry", async () => {
  let failed = true;
  server(() =>
    failed
      ? json({ detail: "private database exception" }, 503)
      : json(list([])),
  );
  render(
    <AuthProvider>
      <CustomerOrdersPage />
    </AuthProvider>,
  );
  expect(await screen.findByRole("alert")).not.toHaveTextContent(
    "private database exception",
  );
  expect(screen.queryByText("No orders yet")).not.toBeInTheDocument();
  failed = false;
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("No orders yet")).toBeInTheDocument();
});
it("uses page numbers through the API client and never follows a server-supplied pagination URL", async () => {
  const fetcher = server((path) =>
    json(
      path.includes("page=2")
        ? {
            ...list([
              {
                ...accountListOrder,
                id: accountId(20),
                order_number: "QC-SECOND",
              },
            ]),
            previous: "https://untrusted.invalid",
          }
        : { ...list(), count: 26, next: "https://untrusted.invalid" },
    ),
  );
  render(
    <AuthProvider>
      <CustomerOrdersPage />
    </AuthProvider>,
  );
  await screen.findByText(accountOrder.order_number);
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(await screen.findByText("QC-SECOND")).toBeInTheDocument();
  expect(
    fetcher.mock.calls.some(
      ([path]) => path === "/api/v1/customer/orders/?page=2",
    ),
  ).toBe(true);
  expect(
    fetcher.mock.calls.every(([path]) => path.startsWith("/api/v1/")),
  ).toBe(true);
  expect(screen.queryByText(accountOrder.order_number)).not.toBeInTheDocument();
});
it("renders exact large amounts and currency in operational order history", async () => {
  server(() =>
    json(
      list([
        {
          ...accountListOrder,
          grand_total: "9007199254740993.123400",
          currency: "NPR",
        },
      ]),
    ),
  );
  render(
    <AuthProvider>
      <CustomerOrdersPage />
    </AuthProvider>,
  );
  expect(
    await screen.findByText(/9,007,199,254,740,993\.123400\sNPR/),
  ).toBeInTheDocument();
});
it("rejects an invalid order URL before any detail request", async () => {
  navigation.id = "../seller-order";
  const fetcher = server(() => json(accountOrder));
  render(
    <AuthProvider>
      <CustomerOrderDetailPage />
    </AuthProvider>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("link is invalid");
  expect(
    fetcher.mock.calls.every(([path]) => !path.includes("/customer/orders")),
  ).toBe(true);
});
it("does not show cancellation for a paid order even if its aggregate status says pending", async () => {
  server(() => json({ ...accountOrder, status: "pending" }));
  render(
    <AuthProvider>
      <CustomerOrderDetailPage />
    </AuthProvider>,
  );
  await screen.findByTestId("order-detail-number");
  expect(screen.queryByTestId("cancel-order-button")).not.toBeInTheDocument();
});
it("uses backend item eligibility instead of synthesizing review/return actions from delivery status", async () => {
  server(() =>
    json({
      ...accountOrder,
      packages: [
        {
          ...accountOrder.packages[0],
          items: accountOrder.packages[0]!.items.map((item) => ({
            ...item,
            can_review: false,
            can_return: false,
          })),
        },
      ],
    }),
  );
  render(
    <AuthProvider>
      <CustomerOrderDetailPage />
    </AuthProvider>,
  );
  await screen.findByTestId("order-detail-number");
  expect(screen.queryByText("Write Review")).not.toBeInTheDocument();
  expect(screen.queryByText("Request Return")).not.toBeInTheDocument();
});
it("preserves private read isolation when navigating to another order while an old response is pending", async () => {
  let finish!: (response: Response) => void;
  let oldSignal: AbortSignal | null | undefined;
  server((path, init) => {
    if (path.includes(accountOrder.id)) {
      oldSignal = init?.signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    }
    return json({
      ...accountOrder,
      id: accountId(30),
      order_number: "NEW-ORDER",
    });
  });
  const ui = render(
    <AuthProvider>
      <CustomerOrderDetailPage />
    </AuthProvider>,
  );
  await waitFor(() => expect(finish).toBeDefined());
  navigation.id = accountId(30);
  navigation.path = "/account/orders/" + navigation.id;
  ui.rerender(
    <AuthProvider>
      <CustomerOrderDetailPage />
    </AuthProvider>,
  );
  expect(await screen.findByText("NEW-ORDER")).toBeInTheDocument();
  await act(async () => finish(json(accountOrder)));
  expect(oldSignal?.aborted).toBe(true);
  expect(screen.queryByText(accountOrder.order_number)).not.toBeInTheDocument();
});
it("shows unverified email honestly without creating a verification/reset/signup action", async () => {
  server(() => json({ ...accountProfile, is_email_verified: false }));
  render(
    <AuthProvider>
      <CustomerProfilePage />
    </AuthProvider>,
  );
  expect(await screen.findByText("unverified")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /verify|resend|reset/i }),
  ).not.toBeInTheDocument();
});
it("maps server profile errors to labeled fields without displaying private exceptions", async () => {
  server((_path, init) =>
    init?.method === "PATCH"
      ? json({ email: ["This email is already in use."] }, 400)
      : json(accountProfile),
  );
  render(
    <AuthProvider>
      <CustomerProfilePage />
    </AuthProvider>,
  );
  const email = await screen.findByTestId("profile-input-email");
  fireEvent.change(email, { target: { value: "another@example.com" } });
  fireEvent.click(screen.getByTestId("profile-save-button"));
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(email).toHaveAttribute("aria-invalid", "true");
  expect(email).toHaveAccessibleDescription("This email is already in use.");
  expect(
    screen.queryByText("Your profile has been updated successfully."),
  ).not.toBeInTheDocument();
});
it.each(["short", "mismatch"])(
  "prevents a %s password command and clears raw fields",
  async (mode) => {
    const fetcher = server(() => json(accountProfile));
    render(
      <AuthProvider>
        <CustomerProfilePage />
      </AuthProvider>,
    );
    await screen.findByTestId("password-form");
    fireEvent.change(screen.getByTestId("password-input-current"), {
      target: { value: "old-long-password" },
    });
    fireEvent.change(screen.getByTestId("password-input-new"), {
      target: { value: mode === "short" ? "eight123" : "new-long-password" },
    });
    fireEvent.change(screen.getByTestId("password-input-confirm"), {
      target: {
        value:
          mode === "mismatch" ? "different-long-password" : "new-long-password",
      },
    });
    fireEvent.submit(screen.getByTestId("password-form"));
    expect(await screen.findByRole("alert")).toHaveTextContent("highlighted");
    expect(
      fetcher.mock.calls.every(([path]) => !path.includes("change-password")),
    ).toBe(true);
    for (const field of ["current", "new", "confirm"])
      expect(screen.getByTestId(`password-input-${field}`)).toHaveValue("");
  },
);
it("clears rejected submitted password fields and does not claim success", async () => {
  server((path) =>
    path.includes("change-password")
      ? json({ old_password: ["Current password is incorrect."] }, 400)
      : json(accountProfile),
  );
  render(
    <AuthProvider>
      <CustomerProfilePage />
    </AuthProvider>,
  );
  await screen.findByTestId("password-form");
  for (const field of ["current", "new", "confirm"])
    fireEvent.change(screen.getByTestId(`password-input-${field}`), {
      target: {
        value: field === "current" ? "old-long-password" : "new-long-password",
      },
    });
  fireEvent.submit(screen.getByTestId("password-form"));
  await screen.findByRole("alert");
  await waitFor(() =>
    expect(screen.getByTestId("password-input-current")).toHaveValue(""),
  );
  expect(
    screen.queryByText("Your password has been changed successfully."),
  ).not.toBeInTheDocument();
});
it("requires a native delete confirmation and fresh CSRF without mass-assigned address fields", async () => {
  let deleted = false;
  const fetcher = server((_path, init) => {
    if (init?.method === "DELETE") {
      deleted = true;
      return new Response(null, { status: 204 });
    }
    return json(deleted ? [] : [accountAddress]);
  });
  render(
    <AuthProvider>
      <CustomerAddressesPage />
    </AuthProvider>,
  );
  const opener = await screen.findByTestId(
    `delete-address-${accountAddress.id}`,
  );
  fireEvent.click(opener);
  expect(deleted).toBe(false);
  const dialog = screen.getByRole("dialog", { name: "Delete this address?" });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Delete address" }),
  );
  expect(await screen.findByText("Address removed.")).toBeInTheDocument();
  const call = fetcher.mock.calls.find(
    ([, init]) => init?.method === "DELETE",
  )!;
  expect(call[1]?.credentials).toBe("include");
  expect(new Headers(call[1]?.headers).get("X-CSRFToken")).toBe(csrf);
  expect(call[1]?.redirect).toBe("error");
});
it("sets default with only allowlisted editable address fields", async () => {
  const secondary = { ...accountAddress, is_default: false };
  const fetcher = server((_path, init) =>
    init?.method === "PATCH" ? json(accountAddress) : json([secondary]),
  );
  render(
    <AuthProvider>
      <CustomerAddressesPage />
    </AuthProvider>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Set as default" }),
  );
  await screen.findByText("Default address updated.");
  const call = fetcher.mock.calls.find(([, init]) => init?.method === "PATCH")!;
  expect(Object.keys(JSON.parse(String(call[1]?.body))).sort()).toEqual(
    [
      "full_name",
      "phone",
      "line1",
      "line2",
      "city",
      "state",
      "postal_code",
      "country",
      "is_default",
    ].sort(),
  );
});
it("does not render a malformed address response as an empty book", async () => {
  server(() => json([{ ...accountAddress, id: "foreign/unsafe" }]));
  render(
    <AuthProvider>
      <CustomerAddressesPage />
    </AuthProvider>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "could not be verified",
  );
  expect(screen.queryByText("No saved addresses")).not.toBeInTheDocument();
});
it("does not synthesize delivery progress for unknown or failed package states", () => {
  render(<DeliveryStepper status="failed" />);
  expect(
    screen.queryByTestId("delivery-progress-stepper"),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText("Delivery progress is not available for this status."),
  ).toBeInTheDocument();
});
it("bounds return quantity and does not send a fractional command", async () => {
  const fetcher = server(() => json({}));
  render(
    <ReturnModal
      isOpen
      orderItemId={accountId(6)}
      productTitle="Linen"
      maxQuantity={2}
      onClose={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByTestId("return-quantity-select"), {
    target: { value: "1.5" },
  });
  fireEvent.submit(screen.getByTestId("submit-return-button").closest("form")!);
  expect(await screen.findByRole("alert")).toHaveTextContent("valid quantity");
  expect(fetcher).not.toHaveBeenCalled();
});
it("keeps a rejected review open with focused error and no publication claim", async () => {
  server(() =>
    json({ detail: "This item is not eligible for a review." }, 400),
  );
  const closed = vi.fn();
  render(
    <ReviewModal
      isOpen
      orderItemId={accountId(6)}
      productTitle="Linen"
      onClose={closed}
    />,
  );
  fireEvent.change(screen.getByTestId("review-title-input"), {
    target: { value: "Useful linen" },
  });
  fireEvent.change(screen.getByTestId("review-body-input"), {
    target: { value: "Everyday use." },
  });
  fireEvent.click(screen.getByTestId("submit-review-button"));
  const error = await screen.findByRole("alert");
  await waitFor(() => expect(error).toHaveFocus());
  expect(closed).not.toHaveBeenCalled();
});
it("discards a review response after navigation/unmount and aborts the request", async () => {
  let finish!: (response: Response) => void,
    signal: AbortSignal | null | undefined;
  server((_path, init) => {
    signal = init?.signal;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const accepted = vi.fn();
  const ui = render(
    <ReviewModal
      isOpen
      orderItemId={accountId(6)}
      productTitle="Linen"
      onClose={vi.fn()}
      onSuccess={accepted}
    />,
  );
  fireEvent.change(screen.getByTestId("review-title-input"), {
    target: { value: "Useful linen" },
  });
  fireEvent.change(screen.getByTestId("review-body-input"), {
    target: { value: "Everyday use." },
  });
  fireEvent.click(screen.getByTestId("submit-review-button"));
  await waitFor(() => expect(finish).toBeDefined());
  ui.unmount();
  await act(async () =>
    finish(
      json(
        {
          id: accountId(50),
          product_id: accountId(7),
          rating: 5,
          title: "Useful linen",
          body: "Everyday use.",
          status: "pending",
          verified_purchase: true,
          created_at: accountOrder.created_at,
        },
        201,
      ),
    ),
  );
  expect(signal?.aborted).toBe(true);
  expect(accepted).not.toHaveBeenCalled();
});
it("serializes a pending review and disables dismissal until the command settles", async () => {
  let finish!: (response: Response) => void;
  const fetcher = server(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const close = vi.fn();
  render(
    <ReviewModal
      isOpen
      orderItemId={accountId(6)}
      productTitle="Linen"
      onClose={close}
    />,
  );
  fireEvent.change(screen.getByTestId("review-title-input"), {
    target: { value: "Useful linen" },
  });
  fireEvent.change(screen.getByTestId("review-body-input"), {
    target: { value: "Everyday use." },
  });
  const submit = screen.getByTestId("submit-review-button");
  fireEvent.click(submit);
  fireEvent.submit(submit.closest("form")!);
  await waitFor(() => expect(finish).toBeDefined());
  expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
  expect(
    fetcher.mock.calls.filter(([path]) => path.includes("/customer/reviews"))
      .length,
  ).toBe(1);
  await act(async () => finish(json({ detail: "Already reviewed." }, 400)));
  expect(close).not.toHaveBeenCalled();
});
it("retains account identity after failed sign-out and does not navigate", async () => {
  server((path) => (path.includes("logout") ? json({}, 503) : json(list())));
  render(
    <AuthProvider>
      <CustomerOrdersPage />
    </AuthProvider>,
  );
  await screen.findByText(accountOrder.order_number);
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.getByText(accountOrder.order_number)).toBeInTheDocument();
  expect(navigation.replace).not.toHaveBeenCalled();
});
it("hides and aborts previous user's reads during a session recheck", async () => {
  let finish!: (response: Response) => void,
    signal: AbortSignal | null | undefined;
  server((_path, init) => {
    signal = init?.signal;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  function Recheck() {
    const { refresh } = useAuth();
    return <button onClick={() => void refresh()}>Recheck</button>;
  }
  render(
    <AuthProvider>
      <CustomerOrdersPage />
      <Recheck />
    </AuthProvider>,
  );
  await waitFor(() => expect(finish).toBeDefined());
  fireEvent.click(screen.getByText("Recheck"));
  expect(signal?.aborted).toBe(true);
  await act(async () => finish(json(list())));
  // The new read has its own signal; no old result may appear while it is pending.
  expect(screen.queryByText(accountOrder.order_number)).not.toBeInTheDocument();
});
it("does not navigate after an unmounted sign-in form accepts a session", async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi.fn(async (path: string) =>
    path.endsWith("/me")
      ? json({}, 403)
      : path.endsWith("/csrf")
        ? json({ csrf_token: csrf })
        : new Promise<Response>((resolve) => {
            finish = resolve;
          }),
  );
  vi.stubGlobal("fetch", fetcher);
  const ui = render(
    <AuthProvider>
      <LoginForm />
    </AuthProvider>,
  );
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: user.email },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "test-long-password" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Sign in" }).closest("form")!,
  );
  await waitFor(() => expect(finish).toBeDefined());
  const password = screen.getByLabelText("Password");
  ui.unmount();
  await act(async () => finish(json(user)));
  expect(password).toHaveValue("");
  expect(navigation.replace).not.toHaveBeenCalled();
});

it("does not load private account data for an anonymous session", async () => {
  const fetcher = vi.fn(async () =>
    json({ detail: "Authentication required." }, 403),
  );
  vi.stubGlobal("fetch", fetcher);
  render(
    <AuthProvider>
      <CustomerProfilePage />
    </AuthProvider>,
  );
  await screen.findByText("Sign in to view your account");
  expect(screen.queryByTestId("profile-form")).not.toBeInTheDocument();
  expect(fetcher.mock.calls).toHaveLength(1);
});
it("keeps rejected address deletion in its native dialog without a duplicate alert or removed row", async () => {
  server((_path, init) =>
    init?.method === "DELETE"
      ? json({ detail: "Address could not be removed." }, 400)
      : json([accountAddress]),
  );
  render(
    <AuthProvider>
      <CustomerAddressesPage />
    </AuthProvider>,
  );
  fireEvent.click(
    await screen.findByTestId(`delete-address-${accountAddress.id}`),
  );
  const dialog = screen.getByRole("dialog", { name: "Delete this address?" });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Delete address" }),
  );
  const error = await screen.findByRole("alert");
  await waitFor(() => expect(error).toHaveFocus());
  expect(dialog).toContainElement(error);
  expect(screen.getAllByRole("alert")).toHaveLength(1);
  expect(screen.queryByText("Address removed.")).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Keep address" }));
  expect(
    screen.getByTestId(`delete-address-${accountAddress.id}`),
  ).toBeInTheDocument();
});
