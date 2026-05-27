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

function obraHealth(obra: any): 'ok' | 'risco' | 'atrasado' | null {
  const { startDate, expectedEndDate, progressPercent } = obra;
  if (!startDate || !expectedEndDate) return null;
  const total = new Date(expectedEndDate).getTime() - new Date(startDate).getTime();
  const elapsed = Date.now() - new Date(startDate).getTime();
  if (total <= 0) return null;
  const timePct = Math.min(100, Math.round((elapsed / total) * 100));
  const delta = (progressPercent ?? 0) - timePct;
  if (delta >= -5) return 'ok';
  if (delta >= -20) return 'risco';
  return 'atrasado';
}

export default function DashboardPage() {
  const router = useRouter();
  const [obras, setObras] = useState<any[]>([]);
  const [fvsData, setFvsData] = useState<Record<string, number>>({});
  const [lastDiario, setLastDiario] = useState<Record<string, string | null>>({});
  const [cronogramaData, setCronogramaData] = useState<Record<string, number | null>>({});
  const [seqData, setSeqData] = useState({ aguardando: 0, atrasadas: 0 });
  const [qualidade, setQualidade] = useState({ pendentes: 0, naoConformes: 0 });
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
        const [fvsRes, diarioRes, cronRes, seqRes, checkRes] = await Promise.all([
          safe(() => api.get(`/obras/${o.id}/fvs`).then(r => r.data), { data: [] }),
          safe(() => api.get(`/obras/${o.id}/diario`).then(r => r.data), { data: [] }),
          safe(() => api.get(`/obras/${o.id}/cronograma`).then(r => r.data), { data: null }),
          safe(() => api.get(`/obras/${o.id}/sequenciamento`).then(r => r.data), null),
          safe(() => api.get(`/obras/${o.id}/checklists`).then(r => r.data), { data: [] }),
        ]);

        setFvsData(m => ({ ...m, [o.id]: (fvsRes?.data ?? []).filter((f: any) => f.status === 'pendente').length }));
        const diarios: any[] = diarioRes?.data ?? [];
        setLastDiario(m => ({ ...m, [o.id]: diarios[0]?.data ?? null }));
        const cron = cronRes?.data;
        setCronogramaData(m => ({ ...m, [o.id]: cron?.progressPct ?? cron?.parsedData?.progressoGeral ?? null }));
        const etapas: any[] = seqRes?.data?.etapas ?? [];
        setSeqData(s => ({
          aguardando: s.aguardando + etapas.filter((e: any) => e.status === 'aguardando_aprovacao').length,
          atrasadas: s.atrasadas + etapas.filter((e: any) => e.endDate && new Date(e.endDate) < new Date() && !['aprovada','concluida'].includes(e.status)).length,
        }));
        const cls: any[] = checkRes?.data ?? [];
        setQualidade(q => ({
          pendentes: q.pendentes + cls.filter((c: any) => ['nao_iniciado','em_andamento'].includes(c.status)).length,
          naoConformes: q.naoConformes + cls.reduce((s: number, c: any) => s + (c.items ?? []).filter((i: any) => i.answer === 'nao' && !i.correctiveAction).length, 0),
        }));
      }));

      setLoading(false);
    }
    load();
  }, []);

  const totalFvs = Object.values(fvsData).reduce((a, b) => a + b, 0);
  const progressoMedio = obras.length ? Math.round(obras.reduce((s, o) => s + (o.progressPercent ?? 0), 0) / obras.length) : 0;

  const alertas = [
    seqData.atrasadas > 0     && { critical: true,  text: `${seqData.atrasadas} etapa${seqData.atrasadas > 1 ? 's' : ''} atrasada${seqData.atrasadas > 1 ? 's' : ''}` },
    qualidade.naoConformes > 0 && { critical: true,  text: `${qualidade.naoConformes} não-conformidade${qualidade.naoConformes > 1 ? 's' : ''} sem ação` },
    totalFvs > 0              && { critical: false, text: `${totalFvs} FVS pendente${totalFvs > 1 ? 's' : ''}` },
    seqData.aguardando > 0    && { critical: false, text: `${seqData.aguardando} etapa${seqData.aguardando > 1 ? 's' : ''} aguardando aprovação` },
    qualidade.pendentes > 0   && { critical: false, text: `${qualidade.pendentes} checklist${qualidade.pendentes > 1 ? 's' : ''} em aberto` },
  ].filter(Boolean) as { critical: boolean; text: string }[];

  const hasCritical = alertas.some(a => a.critical);

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
        {[
          { v: obras.length,        label: 'Obras ativas' },
          { v: `${progressoMedio}%`, label: 'Progresso médio' },
          { v: alertas.filter(a => a.critical).length, label: 'Alertas críticos', red: hasCritical },
          { v: totalFvs,            label: 'FVS pendentes' },
          { v: seqData.aguardando,  label: 'Aguard. aprovação' },
        ].map(({ v, label, red }) => (
          <div key={label} className="flex flex-col gap-0.5 px-5 py-4">
            <span className={`text-2xl font-black tracking-tight ${red ? 'text-red-600' : 'text-ber-carbon'}`}>{v}</span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-ber-gray">{label}</span>
          </div>
        ))}
      </div>

      <div className="px-6 py-5 space-y-6">

        {/* ALERTAS */}
        {alertas.length > 0 && (
          <div className="rounded-xl border border-ber-border bg-white divide-y divide-ber-border overflow-hidden">
            {alertas.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.critical ? 'bg-red-500' : 'bg-amber-400'}`} />
                <span className="text-sm text-ber-carbon">{a.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* OBRAS */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-ber-gray mb-3">
            Obras em andamento · {obras.length}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {obras.map(obra => {
              const pct = obra.progressPercent ?? 0;
              const cronPct = cronogramaData[obra.id];
              const fvs = fvsData[obra.id] ?? 0;
              const health = obraHealth(obra);
              const diasDiario = daysSince(lastDiario[obra.id] ?? null);

              // 3px left border as sole color signal
              const leftBorder = health === 'atrasado' ? '#EF4444' : health === 'risco' ? '#F59E0B' : health === 'ok' ? '#10B981' : '#E8E8E4';

              return (
                <button
                  key={obra.id}
                  onClick={() => router.push(`/obras/${obra.id}`)}
                  className="group rounded-xl border border-ber-border bg-white text-left transition-all hover:shadow-sm hover:border-ber-carbon/20"
                  style={{ borderLeftColor: leftBorder, borderLeftWidth: 3 }}
                >
                  <div className="px-4 py-4">
                    {/* Nome */}
                    <div className="mb-0.5">
                      <h3 className="text-sm font-semibold text-ber-carbon leading-snug">{obra.name}</h3>
                      {obra.client && <p className="text-[10px] text-ber-gray mt-0.5">{obra.client}</p>}
                    </div>

                    {/* Progress */}
                    <div className="mt-3 mb-3">
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-2xl font-black text-ber-carbon">{pct}%</span>
                        {cronPct != null && cronPct !== pct && (
                          <span className="text-[10px] text-ber-gray">
                            Cronograma <span className="font-medium text-ber-carbon">{cronPct}%</span>
                          </span>
                        )}
                      </div>
                      <div className="h-[3px] w-full rounded-full bg-ber-border overflow-hidden">
                        <div className="h-full rounded-full bg-ber-carbon/70 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] ${
                        diasDiario == null  ? 'text-ber-gray/40' :
                        diasDiario === 0    ? 'text-ber-gray' :
                        diasDiario <= 2     ? 'text-ber-gray' :
                        'text-amber-600 font-medium'
                      }`}>
                        {diasDiario == null   ? 'Sem diário' :
                         diasDiario === 0     ? 'Diário hoje' :
                         `Diário há ${diasDiario}d`}
                      </span>
                      {fvs > 0 && (
                        <span className="text-[10px] text-ber-gray">
                          {fvs} FVS pend.
                        </span>
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
