import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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