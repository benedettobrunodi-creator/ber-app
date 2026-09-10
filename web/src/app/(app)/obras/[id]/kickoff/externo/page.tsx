'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2 } from 'lucide-react';

// Kickoff EXTERNO (com o cliente) — placeholder: estrutura/conteúdo em
// definição pelo Bruno (10/09/26). Substituir pelo form real quando chegar.
export default function KickoffExternoPage() {
  const { id: obraId } = useParams<{ id: string }>();

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href={`/obras/${obraId}/kickoff`} className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> Kickoff
        </Link>
        <span>/</span>
        <span className="font-medium text-ber-carbon">Externo</span>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Building2 size={20} className="text-ber-teal" />
        <h1 className="text-xl font-black text-ber-carbon">Kickoff Externo</h1>
      </div>

      <div className="max-w-xl rounded-xl border border-dashed border-ber-border bg-white p-8 text-center">
        <p className="text-sm font-semibold text-ber-carbon">Estrutura em definição</p>
        <p className="mt-1 text-sm text-ber-gray">
          O roteiro do kickoff com o cliente está sendo montado e entra aqui em breve.
        </p>
      </div>
    </div>
  );
}
