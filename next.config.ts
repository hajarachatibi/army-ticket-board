import type { NextConfig } from "next";
import path from "path";
import { withBotId } from "botid/next/config";

const nextConfig: NextConfig = {
  experimental: {
    // Disable Turbopack dev cache; corrupt cache can cause "stuck compiling"
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: {
    resolveAlias: {
      tailwindcss: path.resolve(process.cwd(), "node_modules", "tailwindcss"),
      autoprefixer: path.resolve(process.cwd(), "node_modules", "autoprefixer"),
    },
  },
  async headers() {
    // NOTE: PayPal Smart Buttons render inside secure PayPal iframes and load PayPal-hosted scripts.
    // If you integrate other payment providers, update CSP carefully (keep it as tight as possible).
    const paypalOrigins = ["https://www.paypal.com", "https://www.sandbox.paypal.com", "https://www.paypalobjects.com"];

    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      `frame-src 'self' ${paypalOrigins.join(" ")}`,
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${paypalOrigins.join(" ")}`,
      `script-src-elem 'self' 'unsafe-inline' ${paypalOrigins.join(" ")}`,
      // Tailwind inline styles are used in some components
      "style-src 'self' 'unsafe-inline'",
      // Images
      "img-src 'self' https: data: blob:",
      "font-src 'self' https: data:",
      "worker-src 'self' blob:",
      // Supabase + Upstash
      "connect-src 'self' https: wss:",
    ].join("; ");

    return [
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value:
              // Allow Payment Request API from our own origin (some wallet flows rely on it).
              // This does NOT grant third-party pages access; they still run in isolated iframes.
              "camera=(), microphone=(), geolocation=(), payment=(self), usb=(), interest-cohort=()",
          },
          // Set by CDN/host in production ideally; harmless locally.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default withBotId(nextConfig);
