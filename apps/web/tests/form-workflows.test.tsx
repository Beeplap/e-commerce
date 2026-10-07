import { StrictMode, useState } from "react";
import Link from "next/link";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/primitives";
import { ManagedForm } from "@/features/sellers/forms";
import { ApiError } from "@/lib/api/client";
import { confirmUnsavedNavigation } from "@/components/ui/unsaved-changes";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("form workflows", () => {
  function Editor({
    onSave = async () => {},
    disabled = false,
  }: {
    onSave?: (data: FormData) => Promise<void>;
    disabled?: boolean;
  }) {
    return (
      <ManagedForm
        title="Product"
        warnUnsaved
        stickyActions
        disabled={disabled}
        onSave={onSave}
      >
        <FormField label="Name" name="name" defaultValue="Original" required />
        <Link href="/seller/orders" onClick={(event) => event.preventDefault()}>
          Orders
        </Link>
      </ManagedForm>
    );
  }

  it("warns only for changed data and stops cancelled link navigation", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Editor />);
    expect(confirmUnsavedNavigation()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    const name = screen.getByRole("textbox", { name: "Name" });
    fireEvent.focus(name);
    fireEvent.change(name, { target: { value: "Edited" } });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    fireEvent(screen.getByRole("link", { name: "Orders" }), event);
    expect(event.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Product"));
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    fireEvent.change(name, { target: { value: "Original" } });
    expect(confirmUnsavedNavigation()).toBe(true);
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
  });

  it("keeps failed values dirty and focuses the server-invalid field", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const onSave = vi
      .fn()
      .mockRejectedValue(
        new ApiError("Correct the name.", 400, { name: ["Already in use."] }),
      );
    render(<Editor onSave={onSave} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Existing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus(),
    );
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue(
      "Existing",
    );
    expect(
      screen.getByRole("textbox", { name: "Name" }),
    ).toHaveAccessibleDescription("Already in use.");
    expect(confirmUnsavedNavigation()).toBe(false);
    expect(screen.queryByText("Saved successfully.")).not.toBeInTheDocument();
    const submitted = onSave.mock.calls[0]?.[0] as FormData | undefined;
    expect(submitted?.get("name")).toBe("Existing");
  });

  it("submits once while pending and clears the guard only after success", async () => {
    let finish!: () => void;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Editor onSave={onSave} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Saved" },
    });
    const form = screen.getByRole("form", { name: "Product" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox", { name: "Name" })).toBeDisabled();
    expect(confirmUnsavedNavigation()).toBe(false);
    await act(async () => finish());
    expect(await screen.findByText("Saved successfully.")).toBeInTheDocument();
    expect(confirmUnsavedNavigation()).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "New edit" },
    });
    expect(screen.queryByText("Saved successfully.")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Saved" },
    });
    expect(confirmUnsavedNavigation()).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("guards native Back/Forward traversal without intercepting hash changes or new tabs", () => {
    const navigation = new EventTarget();
    vi.stubGlobal("navigation", navigation);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Editor />);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Changed" },
    });
    function traversal(hashChange: boolean) {
      return Object.assign(new Event("navigate", { cancelable: true }), {
        navigationType: "traverse",
        destination: { url: "http://localhost/seller/orders" },
        hashChange,
      });
    }
    const back = traversal(false);
    navigation.dispatchEvent(back);
    expect(back.defaultPrevented).toBe(true);
    const hash = traversal(true);
    navigation.dispatchEvent(hash);
    expect(hash.defaultPrevented).toBe(false);
    fireEvent.click(screen.getByRole("link", { name: "Orders" }), {
      ctrlKey: true,
    });
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("does not retain a form guard after its workspace unmounts", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const view = render(<Editor />);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Changed" },
    });
    expect(confirmUnsavedNavigation()).toBe(false);
    view.unmount();
    expect(confirmUnsavedNavigation()).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("keeps nested modal scroll locks and restores focus to the parent", () => {
    const close = vi.fn();
    document.documentElement.style.overflow = "clip";
    const view = render(
      <Dialog open title="Return" onClose={close}>
        <button data-dialog-cancel>Close return</button>
        <button>Inspect items</button>
      </Dialog>,
    );
    const trigger = screen.getByRole("button", { name: "Inspect items" });
    trigger.focus();
    const parent = (
      <Dialog open title="Return" onClose={close}>
        <button data-dialog-cancel>Close return</button>
        <button>Inspect items</button>
      </Dialog>
    );
    view.rerender(
      <>
        {parent}
        <Dialog open title="Inspect" onClose={close}>
          <button data-dialog-cancel>Cancel inspection</button>
        </Dialog>
      </>,
    );
    expect(
      screen.getByRole("button", { name: "Cancel inspection" }),
    ).toHaveFocus();
    view.rerender(<>{parent}</>);
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(screen.getByRole("button", { name: "Inspect items" })).toHaveFocus();
    view.unmount();
    expect(document.documentElement.style.overflow).toBe("clip");
    document.documentElement.style.overflow = "";
  });

  it("focuses modal errors and disables every input during pending work", () => {
    const close = vi.fn();
    const view = render(
      <Dialog
        open
        title="Adjustment"
        error="Not enough available stock."
        onClose={close}
      >
        <FormField label="Quantity" />
        <button data-dialog-cancel>Cancel</button>
      </Dialog>,
    );
    expect(screen.getByRole("alert")).toHaveFocus();
    view.rerender(
      <Dialog open busy title="Adjustment" onClose={close}>
        <FormField label="Quantity" />
        <button data-dialog-cancel>Cancel</button>
      </Dialog>,
    );
    expect(screen.getByLabelText("Quantity")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { cancelable: true }),
    );
    fireEvent(screen.getByRole("dialog"), new Event("close"));
    expect(close).not.toHaveBeenCalled();
  });

  it("keeps a newly mounted dialog open through controlled field edits", () => {
    function Workflow() {
      const [open, setOpen] = useState(false);
      const [value, setValue] = useState("");
      return (
        <>
          <button onClick={() => setOpen(true)}>Start</button>
          {open && (
            <Dialog open title="Shipment" onClose={() => setOpen(false)}>
              <input
                aria-label="Carrier"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <button data-dialog-cancel onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button>Confirm shipment</button>
            </Dialog>
          )}
        </>
      );
    }
    render(
      <StrictMode>
        <Workflow />
      </StrictMode>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByRole("dialog", { name: "Shipment" })).toHaveAttribute(
      "open",
    );
    fireEvent.change(screen.getByLabelText("Carrier"), {
      target: { value: "DHL" },
    });
    expect(
      screen.getByRole("button", { name: "Confirm shipment" }),
    ).toBeVisible();
  });
});
