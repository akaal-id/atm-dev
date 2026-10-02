import type { NextConfig } from "next";

const lanDevOrigins =
  process.env.ALLOWED_DEV_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  // Allow other devices on the LAN to load client bundles (e.g. chat input) in dev.
  allowedDevOrigins: ["192.168.1.167", ...lanDevOrigins],
  serverExternalPackages: ["googleapis"],
  experimental: {
    // Keep visited pages in the client router cache so back/repeat navigations are instant.
    // Fully prefetched links (sidebar) stay fresh for 60s; realtime/refresh updates sooner.
    staleTimes: { dynamic: 30, static: 60 },
  },
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
