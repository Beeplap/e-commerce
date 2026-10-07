import type { ComponentProps } from "react";

const paths = {
  cart: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z",
  account: "M20 21v-2a7 7 0 00-14 0v2M17 7a5 5 0 11-10 0 5 5 0 0110 0z",
  menu: "M4 7h16M4 12h16M4 17h16",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  chevron: "M7 10l5 5 5-5",
  arrow: "M5 12h14m-5-5l5 5-5 5",
};

export function ShellIcon({
  name,
  ...props
}: ComponentProps<"svg"> & { name: keyof typeof paths }) {
  return (
    <svg
      {...props}
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={paths[name]}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
