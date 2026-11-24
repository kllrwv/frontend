import type { MetadataRoute } from "next";
import { copy } from "./lib/locale";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: copy.ru.brand,
    short_name: copy.ru.brand,
    description: copy.ru.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    icons: [
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
