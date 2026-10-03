import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

// jsdom has no native dialog API. Mock open/close state only; browser focus
// containment and background inertness require separate real-browser checks.
for (const [method, open] of [
  ["showModal", true],
  ["close", false],
] as const) {
  if (!(method in HTMLDialogElement.prototype)) {
    Object.defineProperty(HTMLDialogElement.prototype, method, {
      configurable: true,
      writable: true,
      value(this: HTMLDialogElement) {
        this.open = open;
      },
    });
  }
}
