"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type ImageState = {
  src: string | null;
  status: "loading" | "loaded" | "failed";
};

/** Keep the catalog image box stable while preserving the existing private stream URL. */
export function StorefrontImage({
  src,
  alt,
  eager = false,
  children,
}: {
  src: string | null;
  alt: string;
  eager?: boolean;
  children?: ReactNode;
}) {
  const element = useRef<HTMLImageElement>(null);
  const [image, setImage] = useState<ImageState>({ src, status: "loading" });
  const status = image.src === src ? image.status : "loading";

  useEffect(() => {
    const current = element.current;
    if (src && current?.complete)
      setImage({ src, status: current.naturalWidth > 0 ? "loaded" : "failed" });
  }, [src]);

  return (
    <div className="sf-image" data-image-state={src ? status : "failed"}>
      {src ? (
        <>
          {status === "loading" && (
            <span className="sf-image-loading" aria-hidden="true" />
          )}
          {/* Keep same-origin/private streams; Next's optimizer cannot forward auth headers. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={src}
            ref={element}
            src={src}
            alt={status === "failed" ? "" : alt}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : "auto"}
            decoding="async"
            data-loaded={status === "loaded"}
            onLoad={() => setImage({ src, status: "loaded" })}
            onError={() => setImage({ src, status: "failed" })}
          />
          {status === "failed" && (
            <span
              className="sf-image-placeholder"
              role="img"
              aria-label={`Image unavailable: ${alt}`}
            >
              Image unavailable
            </span>
          )}
        </>
      ) : (
        <span
          className="sf-image-placeholder"
          role="img"
          aria-label={
            alt ? `Image unavailable for ${alt}` : "Image unavailable"
          }
        >
          Image unavailable
          {alt && <span className="sr-only"> for {alt}</span>}
        </span>
      )}
      {children}
    </div>
  );
}
