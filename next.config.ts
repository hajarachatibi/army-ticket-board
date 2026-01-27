import type { NextConfig } from "next";
import path from "path";

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
};

export default nextConfig;
