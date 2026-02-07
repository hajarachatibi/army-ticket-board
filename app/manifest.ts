import type { MetadataRoute } from "next";

/**
 * Web App Manifest for PWA and iOS standalone mode.
 * Required for "Add to Home Screen" to open without Safari UI (iOS 16.4+).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Army Ticket Board",
    short_name: "ATB",
    description: "Find and exchange BTS concert tickets with ARMY.",
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    background_color: "#ffffff",
    theme_color: "#6b21a8",
    icons: [
      { src: "/army-ticket-board-logo.png", sizes: "any", type: "image/png", purpose: "any" },
      { src: "/army-ticket-board-logo.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/army-ticket-board-logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
