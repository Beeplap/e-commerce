import type { Metadata } from "next";
import { AuthProvider } from "@/features/auth/auth-provider";
import { SessionCartProvider } from "@/features/cart/cart-context";
import { CartDrawer } from "@/components/cart/cart-drawer";
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
        <AuthProvider>
          <SessionCartProvider>
            {children}
            <CartDrawer />
          </SessionCartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
