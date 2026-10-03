import type { SVGProps } from "react";

const paths = {
  overview: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  orders: "M6 7h12l2 14H4L6 7ZM9 7V5a3 3 0 0 1 6 0v2",
  products: "m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9M7 5.8l9 5",
  inventory: "M3 4h18v16H3zM3 9h18M9 9v11M15 9v11",
  truck: "M3 5h11v12H3zM14 9h4l3 4v4h-7M6 17a2 2 0 1 0 4 0M16 17a2 2 0 1 0 4 0",
  returns: "M9 4 4 9l5 5M4 9h10a6 6 0 0 1 0 12h-3",
  wallet: "M4 5h15v15H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13M14 10h7v6h-7zM17 13h1",
  team: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M17 4a4 4 0 0 1 0 7M22 21v-2a4 4 0 0 0-3-3.9",
  reviews: "M4 3h16v13H9l-5 5V3ZM8 7h8M8 11h5",
  promotions: "m3 11 18-7v16L3 13v-2ZM7 14l2 7h4l-2-5",
  settings: "M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6",
  catalog: "M4 3h16v18H4zM8 7h8M8 11h8M8 15h5",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "m6 6 12 12M6 18 18 6",
  chevron: "m9 5 7 7-7 7",
} as const;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 18,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: 16 | 18 | 20 }) {
  return (
    <svg
      {...props}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${props.className ?? ""}`}
    >
      <path d={paths[name]} />
    </svg>
  );
}
