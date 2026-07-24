'use client';

/**
 * Cronograma da Obra — upload do PDF e extração das tarefas.
 *
 * As tarefas extraídas aqui alimentam a lista que o time escolhe ao montar
 * as ATIVIDADES DO PERÍODO do relatório semanal (GET /relatorios/tarefas).
 * Sem cronograma processado, as atividades precisam ser digitadas à mão.
 *
 * Vivia dentro do Gestão 360; virou página própria quando o 360 saiu.
 */

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import CronogramaPanel from '@/components/obras/CronogramaPanel';

export default function CronogramaObraPage() {
  const params = useParams<{ id: string }>();
  const obraId = params.id;

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href={`/obras/${obraId}`} className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> Voltar para a obra
        </Link>
        <span>/</span>
        <span className="font-medium text-ber-carbon">Cronograma</span>
      </div>

      <h1 className="text-xl font-black text-ber-carbon">Cronograma da Obra</h1>
      <p className="mt-1 mb-5 max-w-2xl text-xs text-ber-gray">
        Suba o PDF do cronograma e use o reprocessamento para extrair as tarefas.
        São elas que aparecem para escolher ao montar as atividades do relatório semanal.
      </p>

      <CronogramaPanel obraId={obraId} />
    </div>
  );
}
