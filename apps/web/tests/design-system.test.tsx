import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  FieldErrorsProvider,
  FormField,
  SelectField,
  TextareaField,
} from "@/components/ui/form-fields";
import { PageHeader, StatusBadge } from "@/components/ui/primitives";
import { ManagedForm } from "@/features/sellers/forms";
import { ApiError } from "@/lib/api/client";

const nativeShowModal = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "showModal",
);
const nativeClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "close",
);

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
});
afterEach(() => {
  cleanup();
  for (const [name, descriptor] of [
    ["showModal", nativeShowModal],
    ["close", nativeClose],
  ] as const) {
    if (descriptor) {
      Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    } else {
      Reflect.deleteProperty(HTMLDialogElement.prototype, name);
    }
  }
  vi.restoreAllMocks();
});

describe("design foundation behavior", () => {
  it("prevents a busy action from firing and retains its accessible name", () => {
    const action = vi.fn();
    const view = render(
      <Button busy onClick={action}>
        Approve payout
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Approve payout" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(action).not.toHaveBeenCalled();
    view.rerender(<Button onClick={action}>Approve payout</Button>);
    fireEvent.click(button);
    expect(action).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("type", "button");
  });

  it("associates textarea/select labels, hints, server errors and caller descriptions", () => {
    render(
      <FieldErrorsProvider
        errors={{
          description: ["Describe the product"],
          status: ["Choose an allowed state"],
        }}
      >
        <p id="extra-description">Only plain text is supported.</p>
        <TextareaField
          label="Description"
          name="description"
          hint="Visible to customers"
          aria-describedby="extra-description"
          required
        />
        <SelectField label="Status" name="status">
          <option value="draft">Draft</option>
        </SelectField>
      </FieldErrorsProvider>,
    );
    const textarea = screen.getByRole("textbox", { name: /Description/ });
    expect(textarea).toBeRequired();
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveAccessibleDescription(
      "Only plain text is supported. Visible to customers Describe the product",
    );
    const select = screen.getByRole("combobox", { name: "Status" });
    expect(select).toHaveAccessibleDescription("Choose an allowed state");
    expect(select).toHaveAttribute("aria-invalid", "true");
  });

  it("preserves input after a failed save, maps errors inline and permits a successful retry", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError("Check these fields", 400, {
          name: ["Use a unique name"],
        }),
      )
      .mockResolvedValueOnce(undefined);
    render(
      <ManagedForm title="Business profile" onSave={save}>
        <FormField label="Name" name="name" defaultValue="My shop" required />
      </ManagedForm>,
    );
    const form = screen.getByRole("form", { name: "Business profile" });
    fireEvent.submit(form);
    await screen.findByRole("alert");
    const name = screen.getByRole("textbox", { name: /Name/ });
    expect(name).toHaveValue("My shop");
    expect(name).toHaveAccessibleDescription("Use a unique name");
    expect(screen.queryByText("Saved successfully.")).not.toBeInTheDocument();
    fireEvent.change(name, { target: { value: "New name" } });
    fireEvent.submit(form);
    await screen.findByText("Saved successfully.");
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]?.[0].get("name")).toBe("New name");
    expect(name).toHaveAttribute("aria-invalid", "false");
  });

  it("blocks repeated form submission while the real save is pending", async () => {
    let finish: (() => void) | undefined;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <ManagedForm title="Save profile" onSave={save}>
        <FormField label="Name" name="name" />
      </ManagedForm>,
    );
    const form = screen.getByRole("form", { name: "Save profile" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(save).toHaveBeenCalledTimes(1);
    expect(form).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("textbox", { name: "Name" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await act(async () => finish?.());
    await waitFor(() => expect(form).toHaveAttribute("aria-busy", "false"));
  });

  it("does not submit a read-only form even when a submit event is dispatched", () => {
    const save = vi.fn();
    render(
      <ManagedForm title="Read profile" onSave={save} disabled>
        <FormField label="Name" name="name" />
      </ManagedForm>,
    );
    fireEvent.submit(screen.getByRole("form", { name: "Read profile" }));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Name" })).toBeDisabled();
  });

  it("opens a named native dialog, focuses the requested control and restores scroll/focus", () => {
    const cancel = createRef<HTMLButtonElement>();
    const close = vi.fn();
    document.documentElement.style.overflow = "auto";
    const view = render(
      <>
        <button>Open review</button>
        <Dialog
          open={false}
          title="Review seller"
          description="Review Acme before approving."
          onClose={close}
          initialFocus={cancel}
        >
          <button ref={cancel}>Cancel review</button>
        </Dialog>
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Open review" });
    trigger.focus();
    view.rerender(
      <>
        <button>Open review</button>
        <Dialog
          open
          title="Review seller"
          description="Review Acme before approving."
          onClose={close}
          initialFocus={cancel}
        >
          <button ref={cancel}>Cancel review</button>
        </Dialog>
      </>,
    );
    const dialog = screen.getByRole("dialog", { name: "Review seller" });
    expect(dialog).toHaveAccessibleDescription("Review Acme before approving.");
    expect(screen.getByRole("button", { name: "Cancel review" })).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe("hidden");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(close).toHaveBeenCalledTimes(1);
    view.rerender(
      <>
        <button>Open review</button>
        <Dialog open={false} title="Review seller" onClose={close}>
          <p>Review closed</p>
        </Dialog>
      </>,
    );
    expect(trigger).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe("auto");
    document.documentElement.style.overflow = "";
  });

  it("prevents Escape and backdrop dismissal during a sensitive operation", () => {
    const close = vi.fn();
    render(
      <Dialog open busy title="Processing payout" onClose={close}>
        <p>Please wait</p>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Processing payout" });
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    fireEvent.click(dialog, { clientX: -20, clientY: -20 });
    expect(close).not.toHaveBeenCalled();
  });

  it("keeps draft and unknown statuses neutral while representing state in text", () => {
    render(
      <>
        <StatusBadge status="draft" />
        <StatusBadge status="pending_review" />
        <StatusBadge status="rejected" />
        <StatusBadge status="future_status" />
      </>,
    );
    expect(screen.getByText("draft")).toHaveAttribute("data-tone", "neutral");
    expect(screen.getByText("pending review")).toHaveAttribute(
      "data-tone",
      "warning",
    );
    expect(screen.getByText("rejected")).toHaveAttribute("data-tone", "danger");
    expect(screen.getByText("future status")).toHaveAttribute(
      "data-tone",
      "neutral",
    );
  });

  it("keeps entity identity and contextual actions in the page header", () => {
    render(
      <PageHeader
        title="Acme seller"
        description="Pending verification"
        actions={<Button>Approve seller</Button>}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Acme seller", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve seller" }),
    ).toBeInTheDocument();
  });
});
