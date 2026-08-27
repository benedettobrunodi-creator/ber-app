'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ClipboardList } from 'lucide-react';

/**
 * Pós-Obra · Pendências — em construção (etapa 2 do redesign do menu).
 * Vai digitalizar a Ficha de Pendências: itens por ambiente com disciplina,
 * fornecedor, criticidade, fotos (estado atual + conclusão) e resumos vivos.
 */
export default function PendenciasPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="max-w-3xl">
      <Link href={`/obras/${id}`} className="inline-flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon mb-6">
        <ArrowLeft size={16} /> Voltar à obra
      </Link>
      <div className="bg-white border border-ber-border rounded-xl p-10 text-center">
        <ClipboardList size={40} className="mx-auto text-ber-teal mb-4" />
        <h1 className="text-lg font-semibold text-ber-carbon mb-2">Pendências — em construção</h1>
        <p className="text-sm text-ber-gray max-w-md mx-auto">
          Aqui vai viver a ficha de pendências digitalizada: itens por ambiente, fornecedor,
          criticidade, fotos do antes/depois e resumos sempre atualizados. Chegando em breve.
        </p>
      </div>
    </div>
  );
}
