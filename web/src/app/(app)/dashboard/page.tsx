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
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

function obraHealth(obra: any): 'ok' | 'risco' | 'atrasado' | 'desconhecido' {
  const start = obra.startDate;
  const end = obra.expectedEndDate;
  const pct = obra.progressPercent ?? 0;
  if (!start || !end) return 'desconhecido';
  const total = new Date(end).getTime() - new Date(start).getTime();
  const elapsed = Date.now() - new Date(start).getTime();
  if (total <= 0) return 'desconhecido';
  const timePct = Math.min(100, Math.round((elapsed / total) * 100));
  const delta = pct - timePct;
  if (delta >= -5) return 'ok';
  if (delta >= -20) return 'risco';
  return 'atrasado';
}

const HEALTH_CONFIG = {
  ok:          { label: 'No prazo',    dot: 'bg-emerald-500', bar: '#10B981', border: '#10B98130' },
  risco:       { label: 'Em risco',    dot: 'bg-amber-400',   bar: '#F59E0B', border: '#F59E0B30' },
  atrasado:    { label: 'Atrasado',    dot: 'bg-red-500',     bar: '#EF4444', border: '#EF444430' },
  desconhecido:{ label: '',            dot: 'bg-gray-300',    bar: '#B5B820', border: '#E8E8E4' },
};

function LiveDot({ className = 'bg-emerald-500' }: { className?: string }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${className}`} />
      <span className={`relative inline-flex rounded-full h-2 w-2 ${className}`} />
    </span>
  );
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
      const all: any[] = obrasRes?.data ?? [];
      const ativas = all.filter((o: any) => o.status === 'em_andamento');
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
        const ag = etapas.filter((e: any) => e.status === 'aguardando_aprovacao').length;
        const at = etapas.filter((e: any) => e.endDate && new Date(e.endDate) < new Date() && !['aprovada','concluida'].includes(e.status)).length;
        setSeqData(s => ({ aguardando: s.aguardando + ag, atrasadas: s.atrasadas + at }));

        const cls: any[] = checkRes?.data ?? [];
        const pend = cls.filter((c: any) => ['nao_iniciado','em_andamento'].includes(c.status)).length;
        const nc = cls.reduce((s: number, c: any) => s + (c.items ?? []).filter((i: any) => i.answer === 'nao' && !i.correctiveAction).length, 0);
        setQualidade(q => ({ pendentes: q.pendentes + pend, naoConformes: q.naoConformes + nc }));
      }));

      setLoading(false);
    }
    load();
  }, []);

  const totalFvs = Object.values(fvsData).reduce((a, b) => a + b, 0);
  const progressoMedio = obras.length
    ? Math.round(obras.reduce((s, o) => s + (o.progressPercent ?? 0), 0) / obras.length)
    : 0;

  const alertas = [
    seqData.atrasadas > 0 && { severity: 'critical', label: `${seqData.atrasadas} etapa${seqData.atrasadas > 1 ? 's' : ''} atrasada${seqData.atrasadas > 1 ? 's' : ''}`, tab: '' },
    qualidade.naoConformes > 0 && { severity: 'critical', label: `${qualidade.naoConformes} não-conformidade${qualidade.naoConformes > 1 ? 's' : ''} sem ação`, tab: '' },
    totalFvs > 0 && { severity: 'warning', label: `${totalFvs} FVS pendente${totalFvs > 1 ? 's' : ''}`, tab: '' },
    seqData.aguardando > 0 && { severity: 'warning', label: `${seqData.aguardando} etapa${seqData.aguardando > 1 ? 's' : ''} aguard. aprovação`, tab: '' },
    qualidade.pendentes > 0 && { severity: 'info', label: `${qualidade.pendentes} checklist${qualidade.pendentes > 1 ? 's' : ''} em aberto`, tab: '' },
  ].filter(Boolean) as { severity: string; label: string; tab: string }[];

  if (loading) return (
    <div className="flex h-screen items-center justify-center gap-2 text-sm text-ber-gray bg-ber-bg">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-ber-olive border-t-transparent" />
      Carregando...
    </div>
  );

  return (
    <div className="min-h-screen bg-ber-bg text-ber-carbon">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-ber-border bg-white">
        <div>
          <h1 className="text-base font-black uppercase tracking-widest text-ber-carbon">BÈR Command Center</h1>
          <p className="text-[10px] text-ber-gray mt-0.5">
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            {' · '}{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-ber-teal/40 bg-ber-teal/8 px-3 py-1.5">
          <LiveDot className="bg-ber-teal" />
          <span className="text-[10px] font-black uppercase tracking-widest text-ber-teal">Ao vivo</span>
        </div>
      </div>

      {/* ── KPI STRIP ── */}
      <div className="grid grid-cols-5 border-b border-ber-border bg-ber-offwhite/60 divide-x divide-ber-border">
        {[
          { v: obras.length, label: 'Obras ativas', accent: 'text-ber-teal', pulse: true },
          { v: `${progressoMedio}%`, label: 'Progresso médio', accent: progressoMedio >= 50 ? 'text-emerald-600' : 'text-amber-500', pulse: false },
          { v: alertas.filter(a => a.severity === 'critical').length, label: 'Críticos', accent: alertas.some(a => a.severity === 'critical') ? 'text-red-500' : 'text-ber-gray', pulse: alertas.some(a => a.severity === 'critical') },
          { v: totalFvs, label: 'FVS pendentes', accent: totalFvs > 0 ? 'text-amber-500' : 'text-ber-gray', pulse: false },
          { v: seqData.aguardando, label: 'Aguard. aprovação', accent: seqData.aguardando > 0 ? 'text-amber-500' : 'text-ber-gray', pulse: false },
        ].map(({ v, label, accent, pulse }) => (
          <div key={label} className="flex flex-col gap-0.5 px-5 py-4">
            <div className="flex items-center gap-2">
              {pulse && <LiveDot className={alertas.some(a => a.severity === 'critical') ? 'bg-red-500' : 'bg-ber-teal'} />}
              <span className={`text-2xl font-black ${accent}`}>{v}</span>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-ber-gray">{label}</span>
          </div>
        ))}
      </div>

      <div className="px-6 py-6 space-y-6">

        {/* ── ALERTAS ── */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-ber-gray mb-3">Alertas</p>
          {alertas.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-semibold text-emerald-700">Tudo em dia — nenhuma pendência crítica</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {alertas.map((a, i) => (
                <span key={i} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border ${
                  a.severity === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
                  a.severity === 'warning'  ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    a.severity === 'critical' ? 'bg-red-500' :
                    a.severity === 'warning'  ? 'bg-amber-400' : 'bg-blue-400'
                  }`} />
                  {a.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── OBRAS ── */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-ber-gray mb-3">
            Obras em andamento
            <span className="ml-2 font-medium normal-case tracking-normal text-ber-gray/60">({obras.length})</span>
          </p>
          {obras.length === 0 ? (
            <p className="text-sm text-ber-gray">Nenhuma obra ativa.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {obras.map(obra => {
                const pct = obra.progressPercent ?? 0;
                const cronPct = cronogramaData[obra.id];
                const fvs = fvsData[obra.id] ?? 0;
                const health = obraHealth(obra);
                const hc = HEALTH_CONFIG[health];
                const diasDiario = daysSince(lastDiario[obra.id] ?? null);

                return (
                  <button
                    key={obra.id}
                    onClick={() => router.push(`/obras/${obra.id}`)}
                    className="group rounded-xl border bg-white text-left transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
                    style={{ borderColor: hc.border, borderTopColor: hc.bar, borderTopWidth: 3 }}
                  >
                    <div className="p-4">
                      {/* Nome + health */}
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <h3 className="text-sm font-bold text-ber-carbon leading-snug line-clamp-2">{obra.name}</h3>
                        {health !== 'desconhecido' && (
                          <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold mt-0.5 ${
                            health === 'ok' ? 'bg-emerald-50 text-emerald-700' :
                            health === 'risco' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${hc.dot}`} />
                            {hc.label}
                          </span>
                        )}
                      </div>

                      {obra.client && (
                        <p className="text-[10px] text-ber-gray mb-3">{obra.client}</p>
                      )}

                      {/* Progress */}
                      <div className="mb-3">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-3xl font-black" style={{ color: hc.bar }}>{pct}%</span>
                          {cronPct != null && cronPct !== pct && (
                            <span className="text-[10px] text-ber-gray">
                              Cronograma: <span className="font-semibold text-ber-carbon">{cronPct}%</span>
                            </span>
                          )}
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-ber-border overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: hc.bar }} />
                        </div>
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center justify-between text-[10px] text-ber-gray">
                        <span className={`font-medium ${
                          diasDiario == null ? 'text-ber-gray/50' :
                          diasDiario === 0 ? 'text-emerald-600' :
                          diasDiario <= 2 ? 'text-ber-gray' : 'text-amber-600'
                        }`}>
                          {diasDiario == null ? 'Sem diário'
                           : diasDiario === 0 ? 'Diário hoje'
                           : `Diário há ${diasDiario}d`}
                        </span>
                        {fvs > 0 && (
                          <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-amber-700 font-semibold">
                            {fvs} FVS
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
