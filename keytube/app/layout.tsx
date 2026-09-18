import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KeyTube — Tu contenido tiene llave",
  description:
    "Descubre videos, imágenes, audio y artículos exclusivos. Apoya a tus creadores con membresías de Unlock.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
