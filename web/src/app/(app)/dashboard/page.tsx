'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

const safe = async (fn: () => Promise<any>, fallback: any = null) => {
  try { return await Promise.race([fn(), new Promise((_, r) => setTimeout(() => r('timeout'), 5_000))]); }
  catch { return fallback; }
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso.slice(0, 10) + 'T12:00:00').getTime()) / 86_400_000);
}

function diasRestantes(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function calcTimePct(obra: any): number | null {
  const { startDate, expectedEndDate } = obra;
  if (!startDate || !expectedEndDate) return null;
  const total = new Date(expectedEndDate).getTime() - new Date(startDate).getTime();
  const elapsed = Date.now() - new Date(startDate).getTime();
  if (total <= 0) return null;
  return Math.min(100, Math.round((elapsed / total) * 100));
}

function obraHealth(obra: any): 'ok' | 'risco' | 'atrasado' | null {
  const timePct = calcTimePct(obra);
  if (timePct == null) return null;
  const delta = (obra.progressPercent ?? 0) - timePct;
  if (delta >= -5) return 'ok';
  if (delta >= -20) return 'risco';
  return 'atrasado';
}

function healthOrder(h: ReturnType<typeof obraHealth>): number {
  if (h === 'atrasado') return 0;
  if (h === 'risco') return 1;
  if (h === 'ok') return 2;
  return 3;
}

export default function DashboardPage() {
  const router = useRouter();
  const [obras, setObras] = useState<any[]>([]);
  const [fvsData, setFvsData] = useState<Record<string, number>>({});
  const [lastDiario, setLastDiario] = useState<Record<string, string | null>>({});
  const [atrasadasData, setAtrasadasData] = useState<Record<string, number>>({});
  const [seqData, setSeqData] = useState({ aguardando: 0, atrasadas: 0 });
  const [naoConformes, setNaoConformes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    async function load() {
      const obrasRes = await safe(() => api.get('/obras').then(r => r.data), { data: [] });
      const ativas: any[] = (obrasRes?.data ?? []).filter((o: any) => o.status === 'em_andamento');
      setObras(ativas);

      await Promise.all(ativas.map(async (o: any) => {
        const [fvsRes, diarioRes, seqRes, checkRes] = await Promise.all([
          safe(() => api.get(`/obras/${o.id}/fvs`).then(r => r.data), { data: [] }),
          safe(() => api.get(`/obras/${o.id}/diario`).then(r => r.data), { data: [] }),
          safe(() => api.get(`/obras/${o.id}/sequenciamento`).then(r => r.data), null),
          safe(() => api.get(`/obras/${o.id}/checklists`).then(r => r.data), { data: [] }),
        ]);

        setFvsData(m => ({ ...m, [o.id]: (fvsRes?.data ?? []).filter((f: any) => f.status === 'pendente').length }));
        const diarios: any[] = diarioRes?.data ?? [];
        setLastDiario(m => ({ ...m, [o.id]: diarios[0]?.data ?? null }));
        const etapas: any[] = seqRes?.data?.etapas ?? [];
        const etapasAtrasadas = etapas.filter((e: any) => e.endDate && new Date(e.endDate) < new Date() && !['aprovada', 'concluida'].includes(e.status)).length;
        setAtrasadasData(m => ({ ...m, [o.id]: etapasAtrasadas }));
        setSeqData(s => ({
          aguardando: s.aguardando + etapas.filter((e: any) => e.status === 'aguardando_aprovacao').length,
          atrasadas: s.atrasadas + etapasAtrasadas,
        }));
        const cls: any[] = checkRes?.data ?? [];
        setNaoConformes(n => n + cls.reduce((s: number, c: any) => s + (c.items ?? []).filter((i: any) => i.answer === 'nao' && !i.correctiveAction).length, 0));
      }));

      setLoading(false);
    }
    load();
  }, []);

  const totalFvs = Object.values(fvsData).reduce((a, b) => a + b, 0);
  const obrasEmRisco = obras.filter(o => ['risco', 'atrasado'].includes(obraHealth(o) ?? '')).length;

  const obrasComPrazo = obras.filter(o => o.expectedEndDate);
  const prazoMedioDias = obrasComPrazo.length
    ? Math.round(obrasComPrazo.reduce((s, o) => s + (diasRestantes(o.expectedEndDate) ?? 0), 0) / obrasComPrazo.length)
    : null;

  type ActionItem = { urgent: boolean; text: string };
  const acoes: ActionItem[] = [
    seqData.atrasadas > 0  && { urgent: true,  text: `${seqData.atrasadas} etapa${seqData.atrasadas > 1 ? 's' : ''} atrasada${seqData.atrasadas > 1 ? 's' : ''}` },
    naoConformes > 0       && { urgent: true,  text: `${naoConformes} não-conformidade${naoConformes > 1 ? 's' : ''} sem plano de ação` },
    seqData.aguardando > 0 && { urgent: false, text: `${seqData.aguardando} etapa${seqData.aguardando > 1 ? 's' : ''} aguardando aprovação` },
    totalFvs > 0           && { urgent: false, text: `${totalFvs} FVS pendente${totalFvs > 1 ? 's' : ''}` },
  ].filter(Boolean) as ActionItem[];

  const obrasOrdenadas = [...obras].sort((a, b) => healthOrder(obraHealth(a)) - healthOrder(obraHealth(b)));

  if (loading) return (
    <div className="flex h-screen items-center justify-center gap-2 text-sm text-ber-gray bg-ber-bg">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-ber-carbon border-t-transparent" />
      Carregando...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-ber-carbon">

      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-ber-border bg-white">
        <div>
          <h1 className="text-sm font-black uppercase tracking-[0.12em] text-ber-carbon">BÈR Command Center</h1>
          <p className="text-[10px] text-ber-gray mt-0.5">
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            {' · '}{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ber-teal opacity-50" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-ber-teal" />
          </span>
          <span className="text-[10px] font-semibold text-ber-gray">Ao vivo</span>
        </div>
      </div>

      {/* KPI ROW */}
      <div className="grid grid-cols-5 divide-x divide-ber-border border-b border-ber-border bg-white">
        {([
          { v: obras.length, label: 'Obras ativas', red: false },
          { v: prazoMedioDias != null ? `${prazoMedioDias}d` : '—', label: 'Prazo médio', red: (prazoMedioDias ?? 1) < 0 },
          { v: obrasEmRisco, label: 'Em risco / atrasadas', red: obrasEmRisco > 0 },
          { v: totalFvs, label: 'FVS pendentes', red: false },
          { v: seqData.aguardando, label: 'Aguard. aprovação', red: false },
        ] as { v: string | number; label: string; red: boolean }[]).map(({ v, label, red }) => (
          <div key={label} className="flex flex-col gap-0.5 px-5 py-4">
            <span className={`text-2xl font-black tracking-tight ${red ? 'text-red-600' : 'text-ber-carbon'}`}>{v}</span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-ber-gray">{label}</span>
          </div>
        ))}
      </div>

      <div className="px-6 py-5 space-y-5">

        {/* AÇÃO NECESSÁRIA */}
        {acoes.length > 0 && (
          <div className="rounded-xl border border-ber-border bg-white overflow-hidden">
            <div className="px-4 py-2.5 border-b border-ber-border">
              <p className="text-[9px] font-bold uppercase tracking-widest text-ber-gray">Ação necessária</p>
            </div>
            <div className="divide-y divide-ber-border">
              {acoes.map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.urgent ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <span className="text-sm text-ber-carbon">{a.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* OBRAS */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-ber-gray mb-3">
            Obras em andamento · {obras.length}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {obrasOrdenadas.map(obra => {
              const physicalPct = obra.progressPercent ?? 0;
              const timePct = calcTimePct(obra);
              const delta = timePct != null ? physicalPct - timePct : null;
              const fvs = fvsData[obra.id] ?? 0;
              const atrasadas = atrasadasData[obra.id] ?? 0;
              const health = obraHealth(obra);
              const dias = diasRestantes(obra.expectedEndDate);
              const diasDiario = daysSince(lastDiario[obra.id] ?? null);

              const leftBorder = health === 'atrasado' ? '#EF4444' : health === 'risco' ? '#F59E0B' : health === 'ok' ? '#10B981' : '#E8E8E4';

              return (
                <button
                  key={obra.id}
                  onClick={() => router.push(`/obras/${obra.id}`)}
                  className="group rounded-xl border border-ber-border bg-white text-left transition-all hover:shadow-sm hover:border-ber-carbon/20"
                  style={{ borderLeftColor: leftBorder, borderLeftWidth: 3 }}
                >
                  <div className="px-4 py-4 space-y-3">

                    {/* Nome + dias restantes */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-ber-carbon leading-snug truncate">{obra.name}</h3>
                        {obra.client && <p className="text-[10px] text-ber-gray mt-0.5 truncate">{obra.client}</p>}
                      </div>
                      {dias != null && (
                        <span className={`shrink-0 text-[11px] font-semibold tabular-nums ${
                          dias < 0      ? 'text-red-600' :
                          dias <= 14    ? 'text-amber-600' :
                          'text-ber-gray'
                        }`}>
                          {dias < 0 ? `${Math.abs(dias)}d atrasada` : `${dias}d`}
                        </span>
                      )}
                    </div>

                    {/* Gap físico vs tempo */}
                    {timePct != null ? (
                      <div>
                        <div className="flex items-center mb-1.5 text-[10px] text-ber-gray gap-1">
                          <span>Físico <span className="font-semibold text-ber-carbon">{physicalPct}%</span></span>
                          <span className="opacity-40">·</span>
                          <span>Tempo <span className="font-semibold text-ber-carbon">{timePct}%</span></span>
                          {delta != null && (
                            <span className={`ml-0.5 font-bold ${
                              delta >= -5  ? 'text-ber-carbon/50' :
                              delta >= -20 ? 'text-amber-600' :
                              'text-red-600'
                            }`}>
                              {delta > 0 ? `+${delta}` : delta}%
                            </span>
                          )}
                        </div>
                        <div className="h-[3px] w-full rounded-full bg-ber-border overflow-hidden">
                          <div className="h-full rounded-full bg-ber-carbon/70 transition-all" style={{ width: `${physicalPct}%` }} />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline justify-between mb-1.5">
                          <span className="text-xl font-black text-ber-carbon">{physicalPct}%</span>
                        </div>
                        <div className="h-[3px] w-full rounded-full bg-ber-border overflow-hidden">
                          <div className="h-full rounded-full bg-ber-carbon/70 transition-all" style={{ width: `${physicalPct}%` }} />
                        </div>
                      </div>
                    )}

                    {/* Atividades atrasadas */}
                    {atrasadas > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                        <span className="text-[11px] font-semibold text-red-600">
                          {atrasadas} atividade{atrasadas > 1 ? 's' : ''} atrasada{atrasadas > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}

                    {/* Diário + FVS */}
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] ${
                        diasDiario == null ? 'text-ber-gray/40' :
                        diasDiario === 0   ? 'text-ber-gray' :
                        diasDiario <= 3    ? 'text-ber-gray' :
                        diasDiario <= 7    ? 'text-amber-600 font-medium' :
                        'text-red-600 font-medium'
                      }`}>
                        {diasDiario == null ? 'Sem diário' :
                         diasDiario === 0   ? 'Diário hoje' :
                         `Diário há ${diasDiario}d`}
                      </span>
                      {fvs > 0 && (
                        <span className="text-[10px] text-ber-gray">{fvs} FVS pend.</span>
                      )}
                    </div>

                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
