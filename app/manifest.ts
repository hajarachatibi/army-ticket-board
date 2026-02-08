import type { MetadataRoute } from "next";

/**
 * Web App Manifest for PWA and iOS standalone mode.
 * iOS Add to Home Screen requires exact icon sizes and direct relative paths (no redirects).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Army Ticket Board",
    short_name: "Army Ticket Board",
    description: "Find and exchange BTS concert tickets with ARMY.",
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    background_color: "#ffffff",
    theme_color: "#6b21a8",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
