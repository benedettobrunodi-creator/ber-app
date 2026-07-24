import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Turbopack (Next 16 default) — polyfill de Buffer para xlsx/SheetJS no Safari
  turbopack: {
    resolveAlias: {
      buffer: 'buffer',
    },
  },

  // exclude packages with node-only internals from server bundle
  serverExternalPackages: ['pdfjs-dist', 'jspdf', 'html2canvas'],

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

  // Bookmarks/PWA start_url antigos (commit 23e14022 removeu Dashboard + Painel)
  async redirects() {
    return [
      // Portfolio 360 foi removido. Ele era o start_url do PWA e o destino de
      // rotas antigas — sem estes redirects, quem tem o app instalado ou um
      // bookmark antigo cai em 404. Tudo aponta pra /obras, a nova home.
      { source: "/portfolio-360", destination: "/obras", permanent: true },
      { source: "/dashboard", destination: "/obras", permanent: true },
      { source: "/kanban", destination: "/obras", permanent: true },
    ];
  },
};

export default nextConfig;
