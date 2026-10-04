"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { storefrontApi } from "@/lib/api/client";
import type { StorefrontSuggestResponse } from "@/lib/api/types";
import { StorefrontPrice } from "@/components/storefront/content";
import { ShellIcon } from "./shell-icons";

type Option = {
  kind: "Suggestions" | "Categories" | "Brands" | "Products";
  label: string;
  href: string;
  product?: StorefrontSuggestResponse["products"][number];
};
type Result = { query: string } & (
  { kind: "loading" } | { kind: "error" } | { kind: "ready"; options: Option[] }
);

/** Only genuine response items become destinations. Malformed evidence becomes visible failure. */
function optionsFrom(
  response: StorefrontSuggestResponse,
  query: string,
): Option[] {
  // Django strips control characters and caps the echoed query at 100 code points.
  // Request generation still governs stale responses; this only honors that public contract.
  const canonical = [...query]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code > 31 && (code < 127 || code > 159);
    })
    .join("")
    .trim();
  const echo = [...canonical].slice(0, 100).join("");
  if (
    response.query !== echo ||
    ![
      response.suggestions,
      response.categories,
      response.brands,
      response.products,
    ].every(Array.isArray)
  )
    throw new Error("Invalid search suggestions");
  const options: Option[] = [];
  for (const label of response.suggestions.slice(0, 8)) {
    if (typeof label !== "string" || !label.trim())
      throw new Error("Invalid suggestion");
    options.push({
      kind: "Suggestions",
      label,
      href: `/search?q=${encodeURIComponent(label)}`,
    });
  }
  for (const [kind, items] of [
    ["Categories", response.categories],
    ["Brands", response.brands],
  ] as const) {
    for (const item of items.slice(0, 5)) {
      if (
        typeof item.id !== "string" ||
        !item.id ||
        typeof item.name !== "string" ||
        !item.name.trim()
      )
        throw new Error("Invalid suggestion destination");
      options.push({
        kind,
        label: item.name,
        href:
          kind === "Categories"
            ? `/categories/${encodeURIComponent(item.id)}`
            : `/search?brand=${encodeURIComponent(item.id)}`,
      });
    }
  }
  for (const product of response.products.slice(0, 5)) {
    if (
      typeof product.id !== "string" ||
      !product.id ||
      typeof product.title !== "string" ||
      !product.title.trim() ||
      typeof product.starting_price !== "string" ||
      !/^\d+(?:\.\d+)?$/.test(product.starting_price) ||
      typeof product.currency !== "string" ||
      !/^[A-Z]{3}$/.test(product.currency)
    )
      throw new Error("Invalid product suggestion");
    options.push({
      kind: "Products",
      label: product.title,
      href: `/products/${encodeURIComponent(product.id)}`,
      product,
    });
  }
  return options;
}

export function SearchBar({
  initialQuery = "",
  className = "",
  onSearchSubmit,
  onNavigate,
  inputRef,
}: {
  initialQuery?: string;
  className?: string;
  onSearchSubmit?: (query: string) => void;
  onNavigate?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const router = useRouter();
  const identity = useId();
  const ownInput = useRef<HTMLInputElement>(null);
  const input = inputRef ?? ownInput;
  const container = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const focused = useRef(false);
  const dismissed = useRef(false);
  const [query, setQuery] = useState(initialQuery);
  const [previousInitial, setPreviousInitial] = useState(initialQuery);
  const [result, setResult] = useState<Result | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(-1);
  if (previousInitial !== initialQuery) {
    setPreviousInitial(initialQuery);
    setQuery(initialQuery);
    setResult(null);
    setSelected(-1);
    setOpen(false);
  }
  const trimmed = query.trim();
  const current = result?.query === trimmed ? result : null;
  const options = current?.kind === "ready" ? current.options : [];

  useEffect(() => {
    if (!trimmed) return;
    const controller = new AbortController();
    request.current = controller;
    const version = ++generation.current;
    const timer = setTimeout(() => {
      setResult({ query: trimmed, kind: "loading" });
      if (focused.current && !dismissed.current) setOpen(true);
      storefrontApi
        .suggest(trimmed, controller.signal)
        .then((response) => {
          const items = optionsFrom(response, trimmed);
          if (controller.signal.aborted || generation.current !== version)
            return;
          setResult({ query: trimmed, kind: "ready", options: items });
          setSelected(-1);
          if (focused.current && !dismissed.current) setOpen(true);
        })
        .catch(() => {
          if (!controller.signal.aborted && generation.current === version)
            setResult({ query: trimmed, kind: "error" });
        });
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);
  useEffect(() => {
    if (open && selected >= 0)
      document
        .getElementById(`${identity}-option-${selected}`)
        ?.scrollIntoView?.({ block: "nearest" });
  }, [open, selected, identity]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      ) {
        dismissed.current = true;
        setOpen(false);
        setSelected(-1);
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);

  const dismiss = () => {
    dismissed.current = true;
    setOpen(false);
    setSelected(-1);
  };
  const navigate = (href: string) => {
    ++generation.current;
    request.current?.abort();
    dismiss();
    router.push(href);
    onNavigate?.();
  };
  const searchAll = () => {
    ++generation.current;
    request.current?.abort();
    dismiss();
    if (onSearchSubmit) onSearchSubmit(trimmed);
    else
      router.push(
        trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search",
      );
    onNavigate?.();
  };
  return (
    <div
      ref={container}
      className={`sf-search ${className}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          focused.current = false;
          dismiss();
        }
      }}
    >
      <form
        role="search"
        aria-label="Marketplace search"
        onSubmit={(event) => {
          event.preventDefault();
          const item = open ? options[selected] : undefined;
          if (item) navigate(item.href);
          else searchAll();
        }}
      >
        <div className="sf-search-field">
          <ShellIcon name="search" className="sf-search-icon" />
          <input
            ref={input}
            id={`${identity}-input`}
            type="search"
            role="combobox"
            aria-label="Search products, brands and categories"
            aria-expanded={open && Boolean(current)}
            aria-autocomplete="list"
            aria-controls={open && current ? `${identity}-listbox` : undefined}
            aria-activedescendant={
              open && options[selected]
                ? `${identity}-option-${selected}`
                : undefined
            }
            aria-busy={current?.kind === "loading" || undefined}
            placeholder="Search products, brands, categories…"
            autoComplete="off"
            maxLength={100}
            value={query}
            onChange={(event) => {
              ++generation.current;
              request.current?.abort();
              dismissed.current = false;
              setQuery(event.target.value);
              setResult(null);
              setSelected(-1);
              setOpen(false);
            }}
            onFocus={() => {
              focused.current = true;
              dismissed.current = false;
              if (current && trimmed) setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Enter") {
                event.preventDefault();
                const item = open ? options[selected] : undefined;
                if (item) navigate(item.href);
                else searchAll();
              } else if (event.key === "Escape" && open) {
                event.preventDefault();
                event.stopPropagation();
                dismiss();
              } else if (
                (event.key === "ArrowDown" || event.key === "ArrowUp") &&
                options.length
              ) {
                event.preventDefault();
                dismissed.current = false;
                setOpen(true);
                setSelected((index) =>
                  event.key === "ArrowDown"
                    ? (index + 1) % options.length
                    : index <= 0
                      ? options.length - 1
                      : index - 1,
                );
              }
            }}
          />
          {query && (
            <button
              type="button"
              className="sf-search-clear"
              aria-label="Clear search input"
              onClick={() => {
                ++generation.current;
                request.current?.abort();
                setQuery("");
                setResult(null);
                dismiss();
                input.current?.focus();
              }}
            >
              ×
            </button>
          )}
        </div>
      </form>
      {open && current && (
        <div className="sf-search-popup">
          <p role="status" className="sf-search-status">
            {current.kind === "loading"
              ? "Searching…"
              : current.kind === "error"
                ? "Suggestions unavailable. Press Enter to search."
                : options.length
                  ? `${options.length} suggestions available.`
                  : "No quick matches. Search all products below."}
          </p>
          <div
            id={`${identity}-listbox`}
            role="listbox"
            aria-label="Search suggestions"
          >
            {(["Suggestions", "Categories", "Brands", "Products"] as const).map(
              (kind) => {
                const group = options
                  .map((option, index) => ({ option, index }))
                  .filter((item) => item.option.kind === kind);
                if (!group.length) return null;
                return (
                  <div
                    role="group"
                    aria-label={kind}
                    className="sf-search-group"
                    key={kind}
                  >
                    <p aria-hidden="true">{kind}</p>
                    {group.map(({ option, index }) => (
                      <button
                        type="button"
                        role="option"
                        tabIndex={-1}
                        id={`${identity}-option-${index}`}
                        aria-selected={selected === index}
                        data-active={selected === index}
                        className="sf-search-option"
                        key={`${index}-${option.href}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => navigate(option.href)}
                      >
                        <span>{option.label}</span>
                        {option.product ? (
                          <span className="sf-search-price">
                            <StorefrontPrice
                              amount={option.product.starting_price}
                              currency={option.product.currency}
                            />
                          </span>
                        ) : (
                          <ShellIcon name="arrow" />
                        )}
                      </button>
                    ))}
                  </div>
                );
              },
            )}
          </div>
          <button type="button" className="sf-search-all" onClick={searchAll}>
            View all results for “{trimmed}”<ShellIcon name="arrow" />
          </button>
        </div>
      )}
    </div>
  );
}
