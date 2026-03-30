import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Turbopack (Next 16 default) — polyfill de Buffer para xlsx/SheetJS no Safari
  turbopack: {
    resolveAlias: {
      buffer: 'buffer',
    },
  },

  // Rewrites only used in local dev (when NEXT_PUBLIC_API_URL is not set)
  // In production (Vercel) NEXT_PUBLIC_API_URL points to Railway backend
  async rewrites() {
    if (process.env.NEXT_PUBLIC_API_URL) return [];
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3000/v1/:path*",
      },
      {
        source: "/uploads/:path*",
        destination: "http://localhost:3000/uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
