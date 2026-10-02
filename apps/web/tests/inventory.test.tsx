import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/features/auth/auth-provider";
import { SellerWorkspace } from "@/features/workspaces/seller-workspace";
import { SellerWarehouses } from "@/features/inventory/warehouses";
import {
  SellerInventory,
  PlatformInventory,
} from "@/features/inventory/inventory";
import { SellerInventoryAdjustments } from "@/features/inventory/adjustments";
import {
  type Warehouse,
  type InventoryItem,
  type InventoryTransaction,
} from "@/features/inventory/api";
import { csrf, json, membership, user } from "./fixtures";

vi.mock("next/navigation", () => ({
  usePathname: () => "/seller/inventory",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const warehouseA: Warehouse = {
  id: "e1000000-0000-4000-8000-000000000001",
  name: "Kathmandu Central",
  code: "ktm-central",
  address: "Thamel, Kathmandu",
  is_active: true,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
};

const inventoryItemA: InventoryItem = {
  id: "e2000000-0000-4000-8000-000000000001",
  warehouse: warehouseA,
  variant: {
    id: "e3000000-0000-4000-8000-000000000001",
    sku: "APPLE-RED",
    barcode: "890123456789",
    product_id: "e4000000-0000-4000-8000-000000000001",
    product_name: "Red Apple",
  },
  quantity_on_hand: 50,
  quantity_reserved: 10,
  available_quantity: 40,
  reorder_level: 20,
  is_low_stock: false,
  updated_at: "2026-10-01T00:00:00Z",
};

const lowStockItem: InventoryItem = {
  id: "e2000000-0000-4000-8000-000000000002",
  warehouse: warehouseA,
  variant: {
    id: "e3000000-0000-4000-8000-000000000002",
    sku: "BANANA-YELLOW",
    barcode: "890123456790",
    product_id: "e4000000-0000-4000-8000-000000000002",
    product_name: "Yellow Banana",
  },
  quantity_on_hand: 15,
  quantity_reserved: 10,
  available_quantity: 5,
  reorder_level: 10,
  is_low_stock: true,
  updated_at: "2026-10-01T00:00:00Z",
};

const transactionA: InventoryTransaction = {
  id: "e5000000-0000-4000-8000-000000000001",
  inventory_id: inventoryItemA.id,
  type: "adjustment",
  quantity_delta: 50,
  reference_type: "po",
  reference_id: "PO-900",
  reason: "Initial purchase receipt",
  created_by_id: user.id,
  created_at: "2026-10-01T00:00:00Z",
};

const page = (results: unknown[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});

const defaultMemberCaps = [
  "seller.context.read",
  "inventory.read",
  "inventory.adjust",
];

const defaultPlatformCaps = ["platform.access", "platform.inventory.read"];

function mockApi(
  userCaps = defaultPlatformCaps,
  memberCaps = defaultMemberCaps,
) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url === "/api/v1/auth/me")
      return json({ ...user, platform_permissions: userCaps });
    if (url === "/api/v1/auth/csrf") return json({ csrf_token: csrf });
    if (url.startsWith("/api/v1/seller/memberships"))
      return json(page([{ ...membership, permissions: memberCaps }]));
    if (url.startsWith("/api/v1/seller/access"))
      return json({ ...membership, permissions: memberCaps });

    // Warehouses
    if (url.startsWith("/api/v1/seller/warehouses") && method === "GET") {
      return json(page([warehouseA]));
    }
    if (url.startsWith("/api/v1/seller/warehouses") && method === "POST") {
      const body = JSON.parse((init?.body as string) || "{}");
      return json({
        ...warehouseA,
        id: "e1000000-0000-4000-8000-000000000099",
        name: body.name,
        code: body.code,
      });
    }

    // Inventory
    if (url.startsWith("/api/v1/seller/inventory/transactions")) {
      return json(page([transactionA]));
    }
    if (url.startsWith("/api/v1/seller/inventory") && method === "GET") {
      return json(page([inventoryItemA, lowStockItem]));
    }
    if (url.includes("/adjust") && method === "POST") {
      return json({ ...inventoryItemA, quantity_on_hand: 90 });
    }

    // Platform
    if (url.startsWith("/api/v1/admin/inventory/transactions")) {
      return json(page([transactionA]));
    }
    if (url.startsWith("/api/v1/admin/inventory")) {
      return json(page([inventoryItemA, lowStockItem]));
    }

    return new Response(JSON.stringify({ detail: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  });
}

describe("Warehouse Management", () => {
  beforeAll(() => {
    global.fetch = mockApi();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders warehouse listing with code and name", async () => {
    global.fetch = mockApi();
    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerWarehouses />
        </SellerWorkspace>
      </AuthProvider>,
    );

    expect(await screen.findByText("Warehouses")).toBeInTheDocument();
    expect(await screen.findByText("Kathmandu Central")).toBeInTheDocument();
    expect(screen.getByText("ktm-central")).toBeInTheDocument();
    expect(screen.getByText("Add warehouse")).toBeInTheDocument();
  });

  it("creates a new warehouse successfully", async () => {
    const fetchMock = mockApi();
    global.fetch = fetchMock;

    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerWarehouses />
        </SellerWorkspace>
      </AuthProvider>,
    );

    const addBtn = await screen.findByText("Add warehouse");
    fireEvent.click(addBtn);

    expect(screen.getByText("Create Warehouse")).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Warehouse name/);
    const codeInput = screen.getByLabelText(/Warehouse code/);

    fireEvent.change(nameInput, { target: { value: "Pokhara Hub" } });
    fireEvent.change(codeInput, { target: { value: "pkr-hub" } });

    const submitBtn = screen.getByRole("button", { name: "Create warehouse" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const calls = fetchMock.mock.calls;
      const postCall = calls.find(
        (c) =>
          typeof c[0] === "string" &&
          c[0].includes("/api/v1/seller/warehouses") &&
          c[1]?.method === "POST",
      );
      expect(postCall).toBeDefined();
    });
  });
});

describe("Inventory Ledger", () => {
  beforeAll(() => {
    global.fetch = mockApi();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders stock quantities, available count, and low stock warnings", async () => {
    global.fetch = mockApi();
    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerInventory />
        </SellerWorkspace>
      </AuthProvider>,
    );

    expect(await screen.findByText("Inventory Ledger")).toBeInTheDocument();
    expect(await screen.findByText("APPLE-RED")).toBeInTheDocument();
    expect(screen.getByText("BANANA-YELLOW")).toBeInTheDocument();

    // Check available count
    expect(screen.getByText("40")).toBeInTheDocument();
    // Check low stock badge
    expect(screen.getByText("Low Stock")).toBeInTheDocument();
  });

  it("opens stock adjustment modal and adjusts quantity", async () => {
    const fetchMock = mockApi();
    global.fetch = fetchMock;

    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerInventory />
        </SellerWorkspace>
      </AuthProvider>,
    );

    const adjustBtns = await screen.findAllByText("Adjust stock");
    expect(adjustBtns[0]).toBeDefined();
    fireEvent.click(adjustBtns[0]!);

    expect(screen.getByText(/Adjust Stock: APPLE-RED/)).toBeInTheDocument();

    const deltaInput = screen.getByLabelText(/Adjustment delta/);
    const reasonInput = screen.getByLabelText(/Reason for adjustment/);

    fireEvent.change(deltaInput, { target: { value: "40" } });
    fireEvent.change(reasonInput, { target: { value: "Restock batch" } });

    const submitBtn = screen.getByRole("button", { name: "Submit adjustment" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const calls = fetchMock.mock.calls;
      const postCall = calls.find(
        (c) =>
          typeof c[0] === "string" &&
          c[0].includes("/adjust") &&
          c[1]?.method === "POST",
      );
      expect(postCall).toBeDefined();
    });
  });

  it("renders transaction audit ledger entries", async () => {
    global.fetch = mockApi();
    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerInventoryAdjustments />
        </SellerWorkspace>
      </AuthProvider>,
    );

    expect(
      await screen.findByText("Inventory Audit Ledger"),
    ).toBeInTheDocument();
    expect(await screen.findByText("+50")).toBeInTheDocument();
    expect(screen.getByText("Initial purchase receipt")).toBeInTheDocument();
    expect(screen.getByText("po: PO-900")).toBeInTheDocument();
  });
});

describe("Platform Inventory", () => {
  beforeAll(() => {
    global.fetch = mockApi();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders platform inventory for authorized staff", async () => {
    global.fetch = mockApi();
    render(
      <AuthProvider>
        <PlatformInventory />
      </AuthProvider>,
    );

    expect(await screen.findByText("Platform Inventory")).toBeInTheDocument();
    expect(await screen.findByText("APPLE-RED")).toBeInTheDocument();
  });

  it("denies access to unauthorized users without platform.inventory.read", async () => {
    global.fetch = mockApi([]); // No platform permissions
    render(
      <AuthProvider>
        <PlatformInventory />
      </AuthProvider>,
    );

    expect(
      await screen.findByText("You don’t have access"),
    ).toBeInTheDocument();
  });
});
