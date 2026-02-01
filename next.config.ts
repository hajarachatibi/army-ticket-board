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
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "frame-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "script-src-elem 'self' 'unsafe-inline'",
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
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
          // Set by CDN/host in production ideally; harmless locally.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default withBotId(nextConfig);
