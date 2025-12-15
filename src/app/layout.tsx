import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/contexts/CartContext";

export const metadata: Metadata = {
  title: "E-Kantin",
  description: "Temukan kantin favorit Anda",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={"antialiased"}>
        <CartProvider>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
