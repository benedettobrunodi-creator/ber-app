import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: [
    'judge-holly-ringtone-chips.trycloudflare.com',
    'dose-boating-franchise-fence.trycloudflare.com',
    '*.trycloudflare.com',
  ],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/v1/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://localhost:3000/uploads/:path*',
      },
    ];
  },
};
export default nextConfig;
