import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWARegister from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "KeyTube — Tu contenido tiene llave",
  description:
    "Descubre videos, imágenes, audio y artículos exclusivos. Apoya a tus creadores con membresías de Unlock.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};
export const viewport: Viewport = {
  themeColor: "#6f52ed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="antialiased"><PWARegister/>{children}</body>
    </html>
  );
}
