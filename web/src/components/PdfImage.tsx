'use client';

import { useEffect, useRef, useState } from 'react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '/api').replace('/v1', '');

/** URLs do Google Drive/Docs precisam ser buscadas pelo proxy do backend para evitar CORS */
function needsProxy(url: string): boolean {
  return url.includes('drive.google.com') || url.includes('docs.google.com');
}

function proxyUrl(url: string): string {
  return `${API_BASE}/v1/proxy/pdf?url=${encodeURIComponent(url)}`;
}

/**
 * Loads a PDF and returns the first page as a base64 PNG data URL.
 * Does NOT render anything — use the dataUrl in an <img> or Konva.Image.
 */
export function usePdfAsImage(src: string | undefined): { dataUrl: string | null; error: boolean; loading: boolean } {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const srcRef = useRef('');

  useEffect(() => {
    if (!src || src === srcRef.current) return;
    srcRef.current = src;
    setDataUrl(null);
    setError(false);
    setLoading(true);

    let cancelled = false;

    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist/build/pdf.min.mjs');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const resolvedSrc = needsProxy(src) ? proxyUrl(src) : src;

        const pdf = await pdfjsLib.getDocument({
          url: resolvedSrc,
          disableAutoFetch: true,
          isEvalSupported: false,
        }).promise;
        const page = await pdf.getPage(1);

        const scale = 2;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;

        if (!cancelled) {
          setDataUrl(canvas.toDataURL('image/png'));
        }
        pdf.destroy();
      } catch (err) {
        console.error('PDF render error:', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [src]);

  return { dataUrl, error, loading };
}

/**
 * Renders the first page of a PDF as a static <img> (base64 PNG).
 */
export default function PdfImage({
  src,
  className,
  style,
}: {
  src: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { dataUrl, error, loading } = usePdfAsImage(src);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className ?? ''}`} style={{ minHeight: 200, ...style }}>
        <div className="text-center">
          <span className="text-3xl">📄</span>
          <p className="mt-2 text-xs font-semibold text-gray-500">Erro ao carregar PDF</p>
        </div>
      </div>
    );
  }

  if (loading || !dataUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 animate-pulse ${className ?? ''}`} style={{ minHeight: 400, ...style }}>
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          <p className="mt-2 text-xs text-gray-500">Renderizando planta...</p>
        </div>
      </div>
    );
  }

  return <img src={dataUrl} alt="Planta (PDF)" className={className} style={style} />;
}
