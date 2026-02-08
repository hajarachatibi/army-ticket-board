import type { MetadataRoute } from "next";

/**
 * Web App Manifest for PWA and iOS standalone mode.
 * Required for "Add to Home Screen" to open without Safari UI (iOS 16.4+).
 * Use absolute icon URLs so home screen icons resolve correctly on all devices.
 */
export default function manifest(): MetadataRoute.Manifest {
  const base =
    typeof process.env.NEXT_PUBLIC_SITE_URL === "string" && process.env.NEXT_PUBLIC_SITE_URL
      ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "";
  const iconPath = "/army-ticket-board-logo.png";
  const iconSrc = base ? `${base}${iconPath}` : iconPath;

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
      { src: iconSrc, sizes: "any", type: "image/png", purpose: "any" },
      { src: iconSrc, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: iconSrc, sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
