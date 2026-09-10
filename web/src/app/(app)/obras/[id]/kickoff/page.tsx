'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Rocket, Users, Building2 } from 'lucide-react';

// Seletor de Kickoff (Bruno 10/09/26): o conteúdo original virou o INTERNO;
// o EXTERNO (com o cliente) tem estrutura própria — página em construção até
// o Bruno definir o conteúdo.
export default function KickoffSelectorPage() {
  const { id: obraId } = useParams<{ id: string }>();

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href={`/obras/${obraId}`} className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> Voltar à obra
        </Link>
        <span>/</span>
        <span className="font-medium text-ber-carbon">Kickoff</span>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Rocket size={20} className="text-ber-teal" />
        <h1 className="text-xl font-black text-ber-carbon">Kickoff da Obra</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 max-w-3xl">
        <Link href={`/obras/${obraId}/kickoff/interno`}
          className="group rounded-xl border border-ber-border bg-white p-6 hover:border-ber-teal hover:shadow-md transition-all">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-ber-teal/10 text-ber-teal">
            <Users size={20} />
          </div>
          <h2 className="text-base font-black text-ber-carbon group-hover:text-ber-teal transition-colors">Kickoff Interno</h2>
          <p className="mt-1 text-sm text-ber-gray leading-relaxed">
            Alinhamento Comercial × Engenharia: responsáveis, prazos, documentos e ações da passagem de bastão. Gera PDF.
          </p>
        </Link>

        <Link href={`/obras/${obraId}/kickoff/externo`}
          className="group rounded-xl border border-ber-border bg-white p-6 hover:border-ber-teal hover:shadow-md transition-all">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-ber-olive/20 text-ber-carbon">
            <Building2 size={20} />
          </div>
          <h2 className="text-base font-black text-ber-carbon group-hover:text-ber-teal transition-colors">Kickoff Externo</h2>
          <p className="mt-1 text-sm text-ber-gray leading-relaxed">
            Reunião de abertura com o cliente / gerenciadora — estrutura em definição.
          </p>
        </Link>
      </div>
    </div>
  );
}
