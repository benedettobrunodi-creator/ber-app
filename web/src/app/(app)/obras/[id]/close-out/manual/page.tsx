'use client';

/**
 * Manual do Proprietário — view imprimível compilada do Close Out.
 * Mesmo padrão do "Versão para impressão" do Cockpit: window.print().
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer, FileText } from 'lucide-react';
import api from '@/lib/api';

interface CloseOutItem {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string | null;
  fornecedor: string | null;
  status: string;
  arquivoUrl: string | null;
  arquivoNome: string | null;
  validade: string | null;
}
interface ManualData {
  obra: { name: string; client: string | null; address: string | null };
  itens: CloseOutItem[];
  geradoEm: string;
}

const CATEGORIAS: Record<string, string> = {
  asbuilt: 'Projetos As-Built',
  art_licencas: 'ART/RRT e Licenças',
  manuais: 'Manuais e NFs de Equipamentos',
  garantias: 'Garantias',
  acabamentos: 'Especificações de Acabamentos',
  contatos: 'Contatos de Manutenção',
  fotos_finais: 'Fotos Finais',
  laudos: 'Laudos e Testes',
  outros: 'Outros',
};

function fmtBR(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export default function ManualProprietarioPage() {
  const { id: obraId } = useParams<{ id: string }>();
  const [data, setData] = useState<ManualData | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ data: ManualData }>(`/obras/${obraId}/close-out/manual`);
      setData(r.data.data);
    } catch {
      setErro('Erro ao carregar o manual');
    }
  }, [obraId]);
  useEffect(() => { load(); }, [load]);

  const grupos = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, CloseOutItem[]>();
    for (const cat of Object.keys(CATEGORIAS)) m.set(cat, []);
    for (const i of data.itens) (m.get(i.categoria) ?? m.get('outros')!).push(i);
    return [...m.entries()].filter(([, arr]) => arr.length > 0);
  }, [data]);

  if (erro) return <p className="text-sm text-red-600">{erro}</p>;
  if (!data) return <p className="text-sm text-ber-gray">Carregando…</p>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link href={`/obras/${obraId}/close-out`} className="inline-flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon">
          <ArrowLeft size={16} /> Voltar ao Close Out
        </Link>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 text-sm font-bold bg-ber-carbon text-white rounded-lg px-4 py-2 hover:opacity-90">
          <Printer size={15} /> Imprimir / salvar PDF
        </button>
      </div>

      {/* Capa */}
      <div className="bg-[#1E2432] rounded-xl print:rounded-none p-8 mb-6 text-white">
        <p className="text-xs font-bold tracking-[0.2em] mb-4">BÈR ENGENHARIA</p>
        <h1 className="text-2xl font-semibold">Manual do Proprietário</h1>
        <p className="text-sm text-white/70 mt-2">{data.obra.name}</p>
        {data.obra.client && <p className="text-xs text-white/50 mt-0.5">{data.obra.client}</p>}
        {data.obra.address && <p className="text-xs text-white/50">{data.obra.address}</p>}
        <p className="text-[10px] text-white/40 mt-4">Compilado em {new Date(data.geradoEm).toLocaleDateString('pt-BR')}</p>
      </div>

      {grupos.map(([cat, arr]) => (
        <div key={cat} className="mb-5 break-inside-avoid">
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-[#5A7A7A] border-b border-ber-border pb-1.5 mb-2">
            {CATEGORIAS[cat]}
          </h2>
          {arr.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 py-1.5 text-sm">
              <div>
                <p className={item.status === 'recebido' ? 'text-ber-carbon' : 'text-ber-gray'}>
                  {item.status === 'recebido' ? '✓' : '○'} {item.titulo}
                  {item.fornecedor && <span className="text-[11px] text-ber-gray"> · {item.fornecedor}</span>}
                  {item.validade && <span className="text-[11px] text-ber-gray"> · validade {fmtBR(item.validade)}</span>}
                </p>
                {item.descricao && <p className="text-[11px] text-ber-gray">{item.descricao}</p>}
              </div>
              {item.arquivoUrl && (
                <a href={item.arquivoUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[11px] text-[#5A7A7A] font-semibold inline-flex items-center gap-1 hover:underline print:hidden">
                  <FileText size={12} /> abrir
                </a>
              )}
            </div>
          ))}
        </div>
      ))}

      <p className="text-[10px] text-ber-gray text-center mt-8 pb-8">
        BÈR Engenharia · Cuidado em cada obra. · {data.obra.name}
      </p>
    </div>
  );
}
