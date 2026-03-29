import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BÈR App',
    short_name: 'BÈR',
    description: 'Sistema interno BÈR — Excelência Operacional',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#D8DDD8',
    theme_color: '#16a34a',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
