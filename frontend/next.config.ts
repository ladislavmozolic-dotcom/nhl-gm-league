import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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