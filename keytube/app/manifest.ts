import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KeyTube",
    short_name: "KeyTube",
    description: "Contenido, creadores y membresías en un solo lugar.",
    start_url: "/",
    display: "standalone",
    background_color: "#050a13",
    theme_color: "#6f52ed",
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
