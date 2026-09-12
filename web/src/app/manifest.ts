import type { MetadataRoute } from 'next';

// PWA (Bruno 11/09/26): app instalável — a base do push e do offline de campo.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BÈR — Excelência Operacional',
    short_name: 'BER App',
    description: 'Sistema interno BÈR — Excelência Operacional',
    start_url: '/',
    display: 'standalone',
    background_color: '#16161A',
    theme_color: '#16161A',
    icons: [
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
