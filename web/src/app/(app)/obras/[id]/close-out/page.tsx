'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FolderCheck } from 'lucide-react';

/**
 * Pós-Obra · Close Out — em construção (etapa 3 do redesign do menu).
 * Checklist de documentos da obra (as-built, ART/RRT, manuais, garantias,
 * acabamentos, contatos, fotos finais, laudos) que compila o Manual do
 * Proprietário.
 */
export default function CloseOutPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="max-w-3xl">
      <Link href={`/obras/${id}`} className="inline-flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon mb-6">
        <ArrowLeft size={16} /> Voltar à obra
      </Link>
      <div className="bg-white border border-ber-border rounded-xl p-10 text-center">
        <FolderCheck size={40} className="mx-auto text-ber-teal mb-4" />
        <h1 className="text-lg font-semibold text-ber-carbon mb-2">Close Out — em construção</h1>
        <p className="text-sm text-ber-gray max-w-md mx-auto">
          Aqui vão os documentos de fechamento da obra — as-built, ART/RRT, manuais, garantias,
          acabamentos, contatos e laudos — que no final compilam o Manual do Proprietário.
        </p>
      </div>
    </div>
  );
}
