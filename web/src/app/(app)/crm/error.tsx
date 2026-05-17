'use client';

import { useEffect } from 'react';

export default function CrmError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[CRM Error]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-sm font-semibold text-red-600">Erro ao carregar CRM</p>
      <p className="text-xs text-gray-500 max-w-sm text-center">{error.message}</p>
      <button
        onClick={unstable_retry}
        className="px-4 py-2 bg-ber-teal text-white text-sm rounded-lg"
      >
        Tentar novamente
      </button>
    </div>
  );
}
