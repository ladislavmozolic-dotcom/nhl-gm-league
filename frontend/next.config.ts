import type { NextConfig } from "next";

// one id per build — the chat compares it with the server's to notice it is running outdated code
const BUILD_ID = Date.now().toString(36);

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  // the sandbox dev server needs its own build dir so it can run next to the live dev server
  distDir: process.env.NEXT_DIST_DIR || ".next",
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