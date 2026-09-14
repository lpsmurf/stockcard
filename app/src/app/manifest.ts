import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StockCard",
    short_name: "StockCard",
    description: "Spend what you own. Never sell it.",
    start_url: "/",
    display: "standalone",
    background_color: "#e9ece8",
    theme_color: "#e9ece8",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
