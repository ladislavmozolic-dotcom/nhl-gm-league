import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the sandbox dev server needs its own build dir so it can run next to the live dev server
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // the chat PWA's service worker lives at /chat-sw.js but controls only /chat
  async headers() {
    return [{ source: "/chat-sw.js", headers: [{ key: "Service-Worker-Allowed", value: "/chat" }, { key: "Cache-Control", value: "no-cache" }] }];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'profinhl.cz',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;