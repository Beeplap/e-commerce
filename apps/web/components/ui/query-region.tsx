"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function QueryRegion({
  busy,
  children,
}: {
  busy: boolean;
  children: ReactNode;
}) {
  const region = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const element = region.current;
    if (busy || !element || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.height;
      if (measured !== undefined && Number.isFinite(measured) && measured > 0)
        setHeight(measured);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [busy]);
  return (
    <div
      ref={region}
      aria-busy={busy}
      className="min-w-0"
      style={busy && height ? { minHeight: height } : undefined}
    >
      {children}
    </div>
  );
}
