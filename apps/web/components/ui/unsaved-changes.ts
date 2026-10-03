"use client";

import { useEffect, useId } from "react";

const dirtyForms = new Map<string, string>();
let removeListeners: (() => void) | null = null;
let skipUnloadOnce = false;

export function confirmUnsavedNavigation(): boolean {
  if (!dirtyForms.size) return true;
  const titles = [...new Set(dirtyForms.values())].join(", ");
  const leave = window.confirm(
    `Leave with unsaved changes to ${titles}? These changes will be lost.`,
  );
  if (leave) {
    skipUnloadOnce = true;
    window.setTimeout(() => {
      skipUnloadOnce = false;
    }, 0);
  }
  return leave;
}

function installListeners() {
  function beforeUnload(event: BeforeUnloadEvent) {
    if (skipUnloadOnce) {
      skipUnloadOnce = false;
      return;
    }
    if (!dirtyForms.size) return;
    event.preventDefault();
    event.returnValue = "";
  }
  function linkClick(event: MouseEvent) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const anchor =
      event.target instanceof Element ? event.target.closest("a") : null;
    if (
      !anchor ||
      anchor.hasAttribute("download") ||
      anchor.target === "_blank"
    )
      return;
    const next = new URL(anchor.href, window.location.href);
    if (
      next.origin === window.location.origin &&
      next.pathname === window.location.pathname &&
      next.search === window.location.search
    )
      return;
    if (!confirmUnsavedNavigation()) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
  function navigate(event: Event) {
    const navigationEvent = event as Event & {
      navigationType?: string;
      destination?: { url: string };
      hashChange?: boolean;
    };
    // Native traversal cancellation covers Back/Forward without monkeypatching
    // Next's router or inserting sentinel entries into the history stack.
    if (
      navigationEvent.navigationType !== "traverse" ||
      !event.cancelable ||
      navigationEvent.hashChange ||
      !navigationEvent.destination
    )
      return;
    const next = new URL(navigationEvent.destination.url);
    if (
      next.pathname === window.location.pathname &&
      next.search === window.location.search
    )
      return;
    if (!confirmUnsavedNavigation()) event.preventDefault();
  }
  const navigation = (window as Window & { navigation?: EventTarget })
    .navigation;
  window.addEventListener("beforeunload", beforeUnload);
  document.addEventListener("click", linkClick, true);
  navigation?.addEventListener("navigate", navigate);
  return () => {
    window.removeEventListener("beforeunload", beforeUnload);
    document.removeEventListener("click", linkClick, true);
    navigation?.removeEventListener("navigate", navigate);
  };
}

export function useUnsavedChanges(title: string, dirty: boolean) {
  const identity = useId();
  useEffect(() => {
    if (!dirty) return;
    dirtyForms.set(identity, title);
    skipUnloadOnce = false;
    if (!removeListeners) removeListeners = installListeners();
    return () => {
      dirtyForms.delete(identity);
      if (!dirtyForms.size) {
        removeListeners?.();
        removeListeners = null;
        skipUnloadOnce = false;
      }
    };
  }, [identity, title, dirty]);
}
