"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

function MissingImage() {
  return (
    <span
      className="sf-cart-image-missing"
      role="img"
      aria-label="Product image unavailable"
    >
      <svg
        width="28"
        height="28"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8" cy="8" r="1.5" />
        <path d="m3 17 6-6 5 5 3-3 4 4" />
      </svg>
    </span>
  );
}
function ImageRead({ url, title }: { url: string; title: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const element = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const image = element.current;
    if (image?.complete) setState(image.naturalWidth ? "ready" : "error");
  }, []);
  if (state === "error") return <MissingImage />;
  return (
    <>
      <Image
        ref={element}
        src={url}
        alt={title}
        width={112}
        height={112}
        loading="lazy"
        unoptimized
        onLoad={() => setState("ready")}
        onError={() => setState("error")}
        style={{ opacity: state === "ready" ? 1 : 0 }}
      />
      {state === "loading" && (
        <span className="sr-only">Loading product image…</span>
      )}
    </>
  );
}
export function CartThumbnail({
  url,
  title,
}: {
  url: string | null;
  title: string;
}) {
  return (
    <span className="sf-cart-thumbnail">
      {url ? <ImageRead key={url} url={url} title={title} /> : <MissingImage />}
    </span>
  );
}
