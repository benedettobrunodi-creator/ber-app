'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Renders the first page of a PDF as a static <img> (base64 PNG).
 * Uses pdfjs-dist with disabled worker (main thread) for bundler compatibility.
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
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const srcRef = useRef('');

  useEffect(() => {
    if (!src || src === srcRef.current) return;
    srcRef.current = src;
    setDataUrl(null);
    setError(false);

    let cancelled = false;

    (async () => {
      try {
        // Dynamic import to avoid SSR issues
        const pdfjsLib = await import('pdfjs-dist/build/pdf.min.mjs');

        // Disable worker — runs on main thread, simpler and bundler-compatible
        pdfjsLib.GlobalWorkerOptions.workerSrc = '';

        const loadingTask = pdfjsLib.getDocument({
          url: src,
          disableAutoFetch: true,
          isEvalSupported: false,
        });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        // Render at 2x for crisp display on retina
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

        // Cleanup
        pdf.destroy();
      } catch (err) {
        console.error('PdfImage render error:', err);
        if (!cancelled) setError(true);
      }
    })();

    return () => { cancelled = true; };
  }, [src]);

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

  if (!dataUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 animate-pulse ${className ?? ''}`} style={{ minHeight: 400, ...style }}>
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          <p className="mt-2 text-xs text-gray-500">Renderizando planta...</p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="Planta (PDF)"
      className={className}
      style={style}
    />
  );
}
