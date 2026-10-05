"use client";

import { useEffect, useRef, useState } from "react";
import type { StorefrontImage } from "@/lib/api/types";

function GalleryImage({
  image,
  title,
  thumbnail = false,
}: {
  image: StorefrontImage;
  title: string;
  thumbnail?: boolean;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"loading" | "loaded" | "failed">(
    "loading",
  );
  useEffect(() => {
    if (ref.current?.complete)
      setState(ref.current.naturalWidth > 0 ? "loaded" : "failed");
  }, []);
  return (
    <>
      {state !== "failed" && (
        // These public streams are served by Django, preserving their visibility rules.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={ref}
          src={image.url}
          alt={thumbnail ? "" : image.alt_text || title}
          loading={thumbnail ? "lazy" : "eager"}
          decoding="async"
          width={1000}
          height={1000}
          data-loaded={state === "loaded"}
          onLoad={() => setState("loaded")}
          onError={() => setState("failed")}
        />
      )}
      {!thumbnail && state === "loading" && (
        <span className="sf-pdp-image-message" role="status">
          Loading image…
        </span>
      )}
      {state === "failed" && (
        <span className="sf-pdp-image-message">
          {thumbnail ? "—" : "Image unavailable"}
        </span>
      )}
    </>
  );
}

export function ProductGallery({
  images,
  title,
}: {
  images: StorefrontImage[];
  title: string;
}) {
  const [selected, setSelected] = useState(images[0]?.id);
  const active = images.find((image) => image.id === selected) ?? images[0];
  return (
    <section className="sf-pdp-gallery" aria-label="Product gallery">
      <div className="sf-pdp-image" id="product-image">
        {active ? (
          <GalleryImage key={active.url} image={active} title={title} />
        ) : (
          <div className="sf-pdp-image-message sf-pdp-missing">
            <svg
              aria-hidden="true"
              viewBox="0 0 48 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            >
              <rect x="8" y="8" width="32" height="32" rx="2" />
              <circle cx="19" cy="19" r="3" />
              <path d="m8 34 11-10 9 8 6-5 6 7" />
            </svg>
            <span>Product image unavailable</span>
            <span className="sf-pdp-caption">
              The seller hasn’t added a photograph.
            </span>
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div
          className="sf-pdp-thumbnails"
          role="group"
          aria-label="Choose a product image"
        >
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              aria-label={`View image ${index + 1}${image.alt_text ? `: ${image.alt_text}` : ""}`}
              aria-pressed={active?.id === image.id}
              aria-controls="product-image"
              onClick={() => setSelected(image.id)}
            >
              <GalleryImage
                key={image.url}
                image={image}
                title={title}
                thumbnail
              />
              <span aria-hidden="true" className="sf-pdp-image-number">
                {index + 1}
              </span>
            </button>
          ))}
        </div>
      )}
      {images.length > 1 && (
        <p className="sf-pdp-caption" aria-live="polite">
          Image {images.findIndex((image) => image.id === active?.id) + 1} of{" "}
          {images.length}
        </p>
      )}
    </section>
  );
}
