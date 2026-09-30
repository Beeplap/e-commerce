import type { Metadata } from "next";
import { AuthProvider } from "@/features/auth/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quick Commerce",
  description: "Marketplace administration platform",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
