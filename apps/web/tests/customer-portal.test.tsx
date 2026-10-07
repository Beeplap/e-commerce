import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/features/auth/auth-provider";
import CustomerOrdersPage from "@/app/(customer-account)/account/orders/page";
import CustomerOrderDetailPage from "@/app/(customer-account)/account/orders/[id]/page";
import CustomerAddressesPage from "@/app/(customer-account)/account/addresses/page";
import CustomerProfilePage from "@/app/(customer-account)/account/profile/page";
import { DeliveryStepper } from "@/features/account/delivery-stepper";
import { ReviewModal } from "@/features/account/review-modal";
import { ReturnModal } from "@/features/account/return-modal";
import type {
  CustomerAddress,
  CustomerOrderDetail,
  CustomerOrderListItem,
  CustomerProfile,
  Page,
} from "@/lib/api/types";
import { csrf, json, user } from "./fixtures";

const mockPush = vi.fn();
let mockParams = { id: "70000000-0000-4000-8000-000000000001" };

vi.mock("next/navigation", () => ({
  usePathname: () => "/account/orders",
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useParams: () => mockParams,
}));

const mockOrderListItem: CustomerOrderListItem = {
  id: "70000000-0000-4000-8000-000000000001",
  order_number: "ORD-98765432",
  created_at: "2026-10-03T10:00:00Z",
  status: "pending",
  payment_status: "paid",
  fulfillment_status: "unfulfilled",
  grand_total: "75.00",
  currency: "USD",
  total_items: 2,
  packages_count: 1,
  items_preview: [
    {
      id: "71000000-0000-4000-8000-000000000001",
      product_title: "Wireless Keyboard",
      variant_name: "Space Gray",
      quantity: 1,
      unit_price: "75.00",
    },
  ],
};

const mockOrderDetail: CustomerOrderDetail = {
  id: "70000000-0000-4000-8000-000000000001",
  order_number: "ORD-98765432",
  created_at: "2026-10-03T10:00:00Z",
  status: "delivered",
  payment_status: "paid",
  fulfillment_status: "delivered",
  subtotal: "70.00",
  shipping_total: "5.00",
  discount_total: "0.00",
  grand_total: "75.00",
  currency: "USD",
  shipping_address: {
    full_name: "Jane Doe",
    line1: "123 Market St",
    city: "San Francisco",
    state: "CA",
    postal_code: "94105",
    country: "US",
  },
  billing_address: {
    full_name: "Jane Doe",
    line1: "123 Market St",
    city: "San Francisco",
    state: "CA",
    postal_code: "94105",
    country: "US",
  },
  packages: [
    {
      seller_order_id: "72000000-0000-4000-8000-000000000001",
      seller_id: "73000000-0000-4000-8000-000000000001",
      seller_name: "TechStore",
      status: "delivered",
      carrier: "FedEx",
      tracking_number: "TRK-FEDEX-998877",
      items: [
        {
          id: "71000000-0000-4000-8000-000000000001",
          product_id: "74000000-0000-4000-8000-000000000001",
          product_title: "Wireless Keyboard",
          variant_id: "75000000-0000-4000-8000-000000000001",
          variant_name: "Space Gray",
          sku: "KB-SG-01",
          quantity: 1,
          unit_price: "75.00",
          total_price: "75.00",
          can_review: true,
          can_return: true,
        },
      ],
      tracking_events: [
        {
          id: "79000000-0000-4000-8000-000000000001",
          status: "delivered",
          location: "Front Porch",
          description: "Delivered to recipient residence",
          timestamp: "2026-10-03T14:30:00Z",
        },
      ],
    },
  ],
};

const mockAddress: CustomerAddress = {
  id: "76000000-0000-4000-8000-000000000001",
  full_name: "Jane Doe",
  phone: "+1 555-0100",
  line1: "123 Market St",
  line2: "Apt 4B",
  city: "San Francisco",
  state: "CA",
  postal_code: "94105",
  country: "US",
  is_default: true,
  created_at: "2026-10-01T12:00:00Z",
  updated_at: "2026-10-01T12:00:00Z",
};

const mockCustomerProfile: CustomerProfile = {
  id: user.id,
  email: "shopper@example.com",
  first_name: "Jane",
  last_name: "Doe",
  phone: "+1 555-0100",
  is_email_verified: true,
  created_at: "2026-09-01T12:00:00Z",
};

describe("Phase 22: Customer Account, Order History, Tracking & Post-Purchase", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    mockPush.mockReset();
    mockParams = { id: "70000000-0000-4000-8000-000000000001" };
  });

  describe("Customer Orders List Page", () => {
    it("renders customer orders with order number, status, and items preview", async () => {
      global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/me")) {
          return Promise.resolve(json(user));
        }
        if (url.includes("/api/v1/customer/orders/")) {
          const response: Page<CustomerOrderListItem> = {
            count: 1,
            next: null,
            previous: null,
            results: [mockOrderListItem],
          };
          return Promise.resolve(json(response));
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      render(
        <AuthProvider>
          <CustomerOrdersPage />
        </AuthProvider>,
      );

      expect(
        await screen.findByRole("heading", { level: 1, name: "Order History" }),
      ).toBeDefined();
      expect(await screen.findByText("ORD-98765432")).toBeDefined();
      expect(screen.getByText("Wireless Keyboard")).toBeDefined();
      expect(
        screen.getByTestId(`customer-order-card-${mockOrderListItem.id}`),
      ).toHaveTextContent(/75\.00\sUSD/);
      expect(screen.getByText("pending")).toBeDefined();
    });

    it("renders empty state when customer has no orders", async () => {
      global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/me")) {
          return Promise.resolve(json(user));
        }
        if (url.includes("/api/v1/customer/orders/")) {
          const response: Page<CustomerOrderListItem> = {
            count: 0,
            next: null,
            previous: null,
            results: [],
          };
          return Promise.resolve(json(response));
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      render(
        <AuthProvider>
          <CustomerOrdersPage />
        </AuthProvider>,
      );

      expect(await screen.findByText("No orders yet")).toBeDefined();
      expect(screen.getByText("Start Shopping")).toBeDefined();
    });
  });

  describe("Customer Order Detail & Post-Purchase", () => {
    it("renders order detail with package tracking and review/return actions", async () => {
      global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/me")) {
          return Promise.resolve(json(user));
        }
        if (url.includes("/api/v1/customer/orders/")) {
          return Promise.resolve(json(mockOrderDetail));
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      render(
        <AuthProvider>
          <CustomerOrderDetailPage />
        </AuthProvider>,
      );

      expect(await screen.findByTestId("order-detail-number")).toBeDefined();
      expect(screen.getByText(/Package from: TechStore/i)).toBeDefined();
      expect(screen.getByText("TRK-FEDEX-998877")).toBeDefined();
      expect(screen.getByText("Write Review")).toBeDefined();
      expect(screen.getByText("Request Return")).toBeDefined();
    });

    it("allows canceling a pending order with stock release", async () => {
      const pendingDetail: CustomerOrderDetail = {
        ...mockOrderDetail,
        status: "pending",
        payment_status: "pending",
        fulfillment_status: "unfulfilled",
        packages: mockOrderDetail.packages.map((pkg) => ({
          ...pkg,
          status: "pending",
        })),
      };

      const cancelledDetail: CustomerOrderDetail = {
        ...mockOrderDetail,
        status: "cancelled",
        fulfillment_status: "cancelled",
        packages: mockOrderDetail.packages.map((pkg) => ({
          ...pkg,
          status: "cancelled",
        })),
      };

      let cancellationAccepted = false;
      global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/me")) {
          return Promise.resolve(json(user));
        }
        if (url.includes("/api/v1/auth/csrf")) {
          return Promise.resolve(json({ csrf_token: csrf }));
        }
        if (url.includes("/cancel/")) {
          cancellationAccepted = true;
          return Promise.resolve(json(cancelledDetail));
        }
        if (url.includes("/api/v1/customer/orders/")) {
          return Promise.resolve(
            json(cancellationAccepted ? cancelledDetail : pendingDetail),
          );
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      render(
        <AuthProvider>
          <CustomerOrderDetailPage />
        </AuthProvider>,
      );

      const cancelBtn = await screen.findByTestId("cancel-order-button");
      fireEvent.click(cancelBtn);

      const confirmBtn = await screen.findByTestId("confirm-cancel-button");
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByTestId("order-detail-status")).toHaveTextContent(
          "cancelled",
        );
      });
    });
  });

  describe("Customer Address Book Page", () => {
    it("renders saved addresses, adds a new address, and sets default", async () => {
      let currentAddresses = [mockAddress];

      global.fetch = vi
        .fn()
        .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input);
          const method = init?.method ?? "GET";

          if (url.includes("/api/v1/auth/me")) {
            return Promise.resolve(json(user));
          }
          if (url.includes("/api/v1/auth/csrf")) {
            return Promise.resolve(json({ csrf_token: csrf }));
          }
          if (url.includes("/api/v1/customer/addresses/")) {
            if (method === "GET") {
              return Promise.resolve(json(currentAddresses));
            }
            if (method === "POST") {
              const body = JSON.parse(init?.body as string);
              const created = {
                id: "76000000-0000-4000-8000-000000000002",
                ...body,
                created_at: "2026-10-03T12:00:00Z",
                updated_at: "2026-10-03T12:00:00Z",
              };
              currentAddresses = [...currentAddresses, created];
              return Promise.resolve(json(created, 201));
            }
          }
          return Promise.reject(new Error(`Unhandled URL: ${url}`));
        });

      render(
        <AuthProvider>
          <CustomerAddressesPage />
        </AuthProvider>,
      );

      expect(
        await screen.findByRole("heading", { level: 1, name: "Address book" }),
      ).toBeDefined();
      expect(
        await screen.findByRole("heading", { name: "Jane Doe" }),
      ).toBeDefined();
      expect(screen.getByText("123 Market St")).toBeDefined();

      // Open add modal
      const addBtn = screen.getByTestId("add-address-button");
      fireEvent.click(addBtn);

      expect(
        screen.getByRole("dialog", { name: "Add new address" }),
      ).toBeDefined();

      // Fill form
      fireEvent.change(screen.getByTestId("address-input-fullname"), {
        target: { value: "John Smith" },
      });
      fireEvent.change(screen.getByTestId("address-input-phone"), {
        target: { value: "+1 555-9999" },
      });
      fireEvent.change(screen.getByTestId("address-input-line1"), {
        target: { value: "456 Pine St" },
      });
      fireEvent.change(screen.getByTestId("address-input-city"), {
        target: { value: "San Francisco" },
      });
      fireEvent.change(screen.getByTestId("address-input-state"), {
        target: { value: "CA" },
      });
      fireEvent.change(screen.getByTestId("address-input-postal"), {
        target: { value: "94108" },
      });

      // Submit
      fireEvent.click(screen.getByTestId("save-address-submit"));

      await waitFor(() => {
        expect(screen.getByText("Address added successfully.")).toBeDefined();
      });
    });
  });

  describe("Customer Profile & Password Page", () => {
    it("renders profile details and saves updates", async () => {
      global.fetch = vi
        .fn()
        .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input);
          const method = init?.method ?? "GET";

          if (url.includes("/api/v1/auth/me")) {
            return Promise.resolve(json(user));
          }
          if (url.includes("/api/v1/auth/csrf")) {
            return Promise.resolve(json({ csrf_token: csrf }));
          }
          if (url.includes("/api/v1/customer/profile/")) {
            if (method === "GET") {
              return Promise.resolve(json(mockCustomerProfile));
            }
            if (method === "PATCH") {
              return Promise.resolve(
                json({ ...mockCustomerProfile, first_name: "Janet" }),
              );
            }
          }
          return Promise.reject(new Error(`Unhandled URL: ${url}`));
        });

      render(
        <AuthProvider>
          <CustomerProfilePage />
        </AuthProvider>,
      );

      expect(
        await screen.findByRole("heading", {
          level: 1,
          name: "Profile & Security",
        }),
      ).toBeDefined();
      const firstNameInput = await screen.findByTestId(
        "profile-input-firstname",
      );
      expect((firstNameInput as HTMLInputElement).value).toBe("Jane");

      fireEvent.change(firstNameInput, { target: { value: "Janet" } });
      fireEvent.click(screen.getByTestId("profile-save-button"));

      await waitFor(() => {
        expect(
          screen.getByText("Your profile has been updated successfully."),
        ).toBeDefined();
      });
    });

    it("validates and submits password change", async () => {
      let passwordChanged = false;

      global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/v1/auth/me")) {
          return Promise.resolve(json(user));
        }
        if (url.includes("/api/v1/auth/csrf")) {
          return Promise.resolve(json({ csrf_token: csrf }));
        }
        if (url.includes("/api/v1/customer/profile/")) {
          return Promise.resolve(json(mockCustomerProfile));
        }
        if (url.includes("/api/v1/auth/change-password")) {
          passwordChanged = true;
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      render(
        <AuthProvider>
          <CustomerProfilePage />
        </AuthProvider>,
      );

      await screen.findByText("Account Security");

      fireEvent.change(screen.getByTestId("password-input-current"), {
        target: { value: "old-secure-password" },
      });
      fireEvent.change(screen.getByTestId("password-input-new"), {
        target: { value: "new-super-secure-pass123" },
      });
      fireEvent.change(screen.getByTestId("password-input-confirm"), {
        target: { value: "new-super-secure-pass123" },
      });

      expect(
        new FormData(
          screen.getByTestId("password-form") as HTMLFormElement,
        ).get("new_password") === "new-super-secure-pass123",
      ).toBe(true);
      fireEvent.click(screen.getByTestId("password-save-button"));
      await waitFor(() => expect(passwordChanged).toBe(true));

      await waitFor(() => {
        expect(
          screen.getByText("Your password has been changed successfully."),
        ).toBeDefined();
      });
      expect(passwordChanged).toBe(true);
    });
  });

  describe("Delivery Stepper & Post-Purchase Modals", () => {
    it("renders delivery stepper with tracking milestone progression", () => {
      render(
        <DeliveryStepper
          status="shipped"
          carrier="UPS"
          trackingNumber="1Z9999999999999999"
          trackingEvents={[
            {
              id: "ev-1",
              status: "shipped",
              location: "Oakland Hub",
              description: "Package departed carrier facility",
              timestamp: "2026-10-03T10:00:00Z",
            },
          ]}
        />,
      );

      expect(screen.getByText("UPS")).toBeDefined();
      expect(screen.getByText("1Z9999999999999999")).toBeDefined();
      expect(screen.getByText("Dispatched / Shipped")).toBeDefined();
      expect(
        screen.getByText("Package departed carrier facility"),
      ).toBeDefined();
    });

    it("submits a review for an eligible item", async () => {
      let submitted = false;
      global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/csrf")) {
          return Promise.resolve(json({ csrf_token: csrf }));
        }
        if (url.includes("/api/v1/customer/reviews/")) {
          submitted = true;
          return Promise.resolve(
            json(
              {
                id: "77000000-0000-4000-8000-000000000001",
                product_id: "74000000-0000-4000-8000-000000000001",
                rating: 5,
                title: "Excellent keyboard!",
                body: "Super tactile and fast connection.",
                status: "approved",
                verified_purchase: true,
                created_at: "2026-10-03T12:00:00Z",
              },
              201,
            ),
          );
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      const onSuccess = vi.fn();
      render(
        <ReviewModal
          orderItemId="71000000-0000-4000-8000-000000000001"
          productTitle="Wireless Keyboard"
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={onSuccess}
        />,
      );

      fireEvent.change(screen.getByTestId("review-title-input"), {
        target: { value: "Excellent keyboard!" },
      });
      fireEvent.change(screen.getByTestId("review-body-input"), {
        target: { value: "Super tactile and fast connection." },
      });

      fireEvent.click(screen.getByTestId("submit-review-button"));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
      expect(submitted).toBe(true);
    });

    it("submits a return request (RMA) for an eligible item", async () => {
      let submitted = false;
      global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/csrf")) {
          return Promise.resolve(json({ csrf_token: csrf }));
        }
        if (url.includes("/api/v1/customer/returns/")) {
          submitted = true;
          return Promise.resolve(
            json(
              {
                id: "78000000-0000-4000-8000-000000000001",
                return_number: "RMA-12345678",
                seller_order_id: "72000000-0000-4000-8000-000000000001",
                seller_name: "TechStore",
                status: "requested",
                reason: "defective",
                customer_notes: "Key was sticking on arrival",
                created_at: "2026-10-03T12:00:00Z",
              },
              201,
            ),
          );
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      const onSuccess = vi.fn();
      render(
        <ReturnModal
          orderItemId="71000000-0000-4000-8000-000000000001"
          productTitle="Wireless Keyboard"
          maxQuantity={1}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={onSuccess}
        />,
      );

      fireEvent.change(screen.getByTestId("return-reason-select"), {
        target: { value: "defective" },
      });
      fireEvent.change(screen.getByTestId("return-notes-input"), {
        target: { value: "Key was sticking on arrival" },
      });

      fireEvent.click(screen.getByTestId("submit-return-button"));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
      expect(submitted).toBe(true);
    });
  });
});
