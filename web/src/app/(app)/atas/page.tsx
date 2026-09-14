'use client';

/**
 * Reuniões de Engenharia semanais (14/09/26) — menu Atas do painel de obras.
 * Lista o histórico de reuniões; cada uma agrupa as obras em andamento e
 * aponta pra ata viva de cada obra (/atas/[id]).
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ClipboardList, Plus, Users, Lock } from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/lib/toast';

interface ReuniaoRow {
  id: string;
  data: string;
  status: 'aberta' | 'encerrada';
  participantes: { id: string; name: string }[];
  totalObras: number;
  encerradaEm: string | null;
  enviadaEm: string | null;
}

const fmtData = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

export default function ReunioesEngenhariaPage() {
  const router = useRouter();
  const [reunioes, setReunioes] = useState<ReuniaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    api.get('/reunioes-engenharia')
      .then(r => setReunioes(r.data.data ?? []))
      .catch(() => toast('Erro ao carregar as reuniões', 'erro'))
      .finally(() => setLoading(false));
  }, []);

  async function novaReuniao() {
    if (criando) return;
    setCriando(true);
    try {
      const r = await api.post('/reunioes-engenharia');
      router.push(`/atas/${r.data.data.id}`);
    } catch (e) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast(m || 'Erro ao criar a reunião', 'erro');
      setCriando(false);
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href="/obras" className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> Obras
        </Link>
        <span>/</span>
        <span className="font-medium text-ber-carbon">Atas</span>
      </div>

      <div className="mb-5 flex items-center gap-2 flex-wrap">
        <ClipboardList size={20} className="text-ber-teal" />
        <h1 className="text-xl font-black text-ber-carbon">Reuniões de Engenharia</h1>
        <span className="hidden text-xs text-ber-gray sm:inline">— uma ata consolidada por semana, com todas as obras em andamento</span>
        <button onClick={novaReuniao} disabled={criando}
          className="ml-auto flex min-h-[40px] items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-1.5 text-xs font-semibold text-white hover:bg-ber-black disabled:opacity-50">
          <Plus size={14} /> {criando ? 'Criando…' : 'Nova reunião'}
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center text-sm text-ber-gray">Carregando…</div>
      ) : reunioes.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-14 text-center">
          <ClipboardList size={30} className="mx-auto mb-2 text-ber-gray/40" />
          <p className="text-sm font-medium text-ber-gray">Nenhuma reunião ainda.</p>
          <p className="mt-1 text-xs text-ber-gray/60">O botão acima cria a primeira já com as obras em andamento.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {reunioes.map(r => (
            <Link key={r.id} href={`/atas/${r.id}`}
              className="flex w-full items-center gap-4 rounded-xl border border-ber-gray/15 bg-white px-4 py-3.5 text-left shadow-sm transition-colors hover:border-ber-teal/40">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold capitalize text-ber-carbon">{fmtData(r.data)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ber-gray">
                  <span>{r.totalObras} obra(s)</span>
                  {r.participantes.length > 0 && (
                    <span className="inline-flex items-center gap-1"><Users size={11} /> {r.participantes.map(p => p.name.split(' ')[0]).join(', ')}</span>
                  )}
                  {r.enviadaEm && <span className="text-green-700">✉ enviada</span>}
                </div>
              </div>
              {r.status === 'aberta' ? (
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Aberta</span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                  <Lock size={10} /> Encerrada
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
