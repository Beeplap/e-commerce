import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("../apps/web/styles/storefront.css", import.meta.url),
  "utf8",
);
const cartCss = readFileSync(
  new URL("../apps/web/styles/storefront-cart.css", import.meta.url),
  "utf8",
);
const tokens = new Map(
  [
    ...css
      .split("@theme inline")[0]
      .matchAll(/(--sf-[\w-]+):\s*(#[\da-f]{6}|var\(--sf-[\w-]+\));/gi),
  ].map((match) => [match[1], match[2]]),
);
function resolve(name) {
  const value = tokens.get(`--sf-${name}`);
  assert.ok(value, `Missing token ${name}`);
  return value.startsWith("var") ? resolve(value.slice(9, -1)) : value;
}
function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((pair) => {
      const value = parseInt(pair, 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
const checks = [
  ["foreground", "background", 4.5],
  ["soft", "background", 4.5],
  ["muted", "background", 4.5],
  ["muted", "surface", 4.5],
  ["action", "background", 4.5],
  ["on-dark", "action", 4.5],
  ["on-dark", "action-hover", 4.5],
  ["on-dark", "dark", 4.5],
  ["dark-muted", "dark", 4.5],
  ["success", "success-surface", 4.5],
  ["warning-text", "warning-surface", 4.5],
  ["danger", "danger-surface", 4.5],
  ["info", "info-surface", 4.5],
  ["on-dark", "danger", 4.5],
  ["focus", "background", 3],
  ["focus", "surface", 3],
  ["control-border", "background", 3],
  ["control-border", "surface", 3],
  ["link", "accent-soft", 4.5],
  ["link", "surface-strong", 4.5],
  ["muted-strong", "surface-strong", 4.5],
  ["control-border", "surface-strong", 3],
];
tokens.set("--sf-soft", tokens.get("--sf-foreground-soft"));
const report = checks.map(([foreground, background, minimum]) => {
  const [a, b] = [
    luminance(resolve(foreground)),
    luminance(resolve(background)),
  ];
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  assert.ok(
    ratio >= minimum,
    `${foreground}/${background}: ${ratio} < ${minimum}`,
  );
  return { foreground, background, ratio: Number(ratio.toFixed(3)), minimum };
});
assert.ok(
  !css.includes(":root"),
  "Customer palette must not replace operational root tokens",
);
assert.match(
  cartCss,
  /\.sf-cart-note\s*\{[^}]*color:\s*var\(--sf-muted-strong\)/s,
  "Cart summary notes need the stronger muted token on the strong surface",
);
console.log(JSON.stringify({ passed: report.length, report }, null, 2));
