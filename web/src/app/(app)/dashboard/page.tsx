'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

// ─── Paleta Command Center (Light) ───────────────────────────────────────────
const C = {
  bg:       '#F8F8F6',
  card:     '#FFFFFF',
  border:   '#E4E4E0',
  teal:     '#5A7A7A',
  olive:    '#B5B820',
  red:      '#E05555',
  white:    '#2D2D2D',   // texto principal (invertido)
  gray:     '#868686',
  green:    '#3D9E5F',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const safe = async (fn: () => Promise<any>, fallback: any = null) => {
  try { return await Promise.race([fn(), new Promise((_, r) => setTimeout(() => r('timeout'), 4_000))]); }
  catch { return fallback; }
};

const FASE_LABELS: Record<string, string> = {
  kickoff_interno:'Kick-Off Int.',kickoff_externo:'Kick-Off Ext.',
  suprimentos:'Suprimentos',pre_obra:'Pré-Obra',execucao:'Execução',
  pendencias:'Pendências',encerramento:'Encerramento',
};

// ─── Subcomponents ────────────────────────────────────────────────────────────

function LiveDot({ color = C.green }: { color?: string }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }} />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: color }} />
    </span>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-4 w-[3px] rounded-full" style={{ backgroundColor: C.teal }} />
      <span className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: C.gray }}>{label}</span>
    </div>
  );
}

function StatBox({ value, label, accent = C.teal, pulse = false }: { value: string | number; label: string; accent?: string; pulse?: boolean }) {
  return (
    <div className="flex flex-col gap-1 px-6 py-4 border-r last:border-r-0" style={{ borderColor: C.border }}>
      <div className="flex items-center gap-2">
        {pulse && <LiveDot color={accent} />}
        <span className="text-3xl font-black tracking-tight" style={{ color: accent, fontFamily: 'Montserrat, sans-serif' }}>{value}</span>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.gray }}>{label}</span>
    </div>
  );
}

function MetricRow({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: C.border }}>
      <span className="text-xs" style={{ color: C.gray }}>{label}</span>
      <span className="text-sm font-bold" style={{ color: accent ?? C.white }}>{value}</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [obras, setObras] = useState<any[]>([]);
  const [fvsData, setFvsData] = useState<Record<string, number>>({});
  const [seqData, setSeqData] = useState<{ aguardando: number; atrasadas: number }>({ aguardando: 0, atrasadas: 0 });
  const [qualidade, setQualidade] = useState<{ pendentes: number; naoConformes: number }>({ pendentes: 0, naoConformes: 0 });
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    async function load() {
      // Obras
      const obrasRes = await safe(() => api.get('/obras').then(r => r.data), { data: [] });
      const all: any[] = obrasRes?.data ?? [];
      const ativas = all.filter((o: any) => o.status === 'em_andamento');
      setObras(ativas);

      // FVS por obra
      const fvsMap: Record<string, number> = {};
      await Promise.all(ativas.map(async (o: any) => {
        const r = await safe(() => api.get(`/obras/${o.id}/fvs`).then(r => r.data), { data: [] });
        const list: any[] = r?.data ?? [];
        fvsMap[o.id] = list.filter((f: any) => f.status === 'pendente').length;
      }));
      setFvsData(fvsMap);

      // Sequenciamento global
      let aguardando = 0, atrasadas = 0;
      await Promise.all(ativas.map(async (o: any) => {
        const r = await safe(() => api.get(`/obras/${o.id}/sequenciamento`).then(r => r.data), null);
        const etapas: any[] = r?.data?.etapas ?? [];
        aguardando += etapas.filter((e: any) => e.status === 'aguardando_aprovacao').length;
        atrasadas += etapas.filter((e: any) =>
          e.endDate && new Date(e.endDate) < new Date() && !['aprovada','concluida'].includes(e.status)
        ).length;
      }));
      setSeqData({ aguardando, atrasadas });

      // Checklists qualidade
      let pendentes = 0, naoConformes = 0;
      await Promise.all(ativas.map(async (o: any) => {
        const r = await safe(() => api.get(`/obras/${o.id}/checklists`).then(r => r.data), { data: [] });
        const list: any[] = r?.data ?? [];
        pendentes += list.filter((c: any) => c.status === 'nao_iniciado' || c.status === 'em_andamento').length;
        for (const c of list) {
          naoConformes += (c.items ?? []).filter((i: any) => i.answer === 'nao' && !i.correctiveAction).length;
        }
      }));
      setQualidade({ pendentes, naoConformes });

      setLoading(false);
    }
    load();
  }, []);

  const totalFvsPendentes = Object.values(fvsData).reduce((a, b) => a + b, 0);
  const totalAlertas = seqData.atrasadas + qualidade.naoConformes + (totalFvsPendentes > 0 ? 1 : 0);
  const progressoMedio = obras.length
    ? Math.round(obras.reduce((s, o) => s + (o.progress ?? 0), 0) / obras.length)
    : 0;

  if (loading) return (
    <div className="flex h-screen items-center justify-center gap-3 text-sm" style={{ backgroundColor: C.bg, color: C.gray }}>
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: C.teal }} />
      Carregando Command Center...
    </div>
  );

  return (
    <div className="min-h-screen -m-0 p-0" style={{ backgroundColor: C.bg, color: C.white }}>

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: C.border }}>
        <div>
          <h1 className="text-lg font-black uppercase tracking-[0.1em]" style={{ color: C.white, fontFamily: 'Montserrat, sans-serif' }}>
            BÈR Command Center
          </h1>
          <p className="text-[10px] mt-0.5" style={{ color: C.gray }}>
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} · {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full px-3 py-1.5 border" style={{ borderColor: C.teal, backgroundColor: C.teal + '18' }}>
          <LiveDot color={C.teal} />
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.teal }}>Ao Vivo</span>
        </div>
      </div>

      {/* ── KPI STRIP ── */}
      <div className="flex flex-wrap border-b" style={{ backgroundColor: '#F0F0EE', borderColor: C.border }}>
        <StatBox
          value={obras.length}
          label="Obras Ativas"
          accent={C.teal}
          pulse
        />
        <StatBox
          value={`${progressoMedio}%`}
          label="Progresso Médio"
          accent={progressoMedio >= 50 ? C.teal : C.olive}
        />
        <StatBox
          value={totalAlertas}
          label="Alertas"
          accent={totalAlertas > 0 ? C.red : C.teal}
          pulse={totalAlertas > 0}
        />
        <StatBox
          value={totalFvsPendentes}
          label="FVS Pendentes"
          accent={totalFvsPendentes > 0 ? C.olive : C.teal}
        />
        <StatBox
          value={seqData.aguardando}
          label="Aguard. Aprovação"
          accent={seqData.aguardando > 0 ? C.olive : C.teal}
        />
      </div>

      <div className="p-6 space-y-8">

        {/* ── RADAR DE OBRAS ── */}
        <div>
          <SectionTitle label="Radar de Obras" />
          {obras.length === 0 ? (
            <p className="text-sm" style={{ color: C.gray }}>Nenhuma obra ativa.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {obras.map(obra => {
                const pct = obra.progress ?? 0;
                const fvsPend = fvsData[obra.id] ?? 0;
                const barColor = pct >= 50 ? C.teal : pct >= 20 ? C.olive : C.red;
                const topBorder = barColor;
                return (
                  <button
                    key={obra.id}
                    onClick={() => router.push(`/obras/${obra.id}`)}
                    className="rounded-xl text-left transition-all hover:shadow-md"
                    style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderTopColor: topBorder, borderTopWidth: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                  >
                    <div className="p-4">
                      {/* Nome + dot pulsando */}
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="text-sm font-black leading-tight" style={{ color: C.white, fontFamily: 'Montserrat, sans-serif' }}>
                          {obra.name}
                        </h3>
                        <LiveDot color={C.teal} />
                      </div>
                      {obra.client && <p className="text-[10px] mb-3" style={{ color: C.gray }}>{obra.client}</p>}

                      {/* % destaque */}
                      <div className="mb-2 flex items-end gap-2">
                        <span className="text-4xl font-black leading-none" style={{ color: barColor, fontFamily: 'Montserrat, sans-serif' }}>
                          {pct}%
                        </span>
                        <span className="text-[10px] mb-1" style={{ color: C.gray }}>concluído</span>
                      </div>

                      {/* Barra de progresso */}
                      <div className="h-1.5 w-full rounded-full mb-3" style={{ backgroundColor: C.border }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide"
                          style={{ backgroundColor: C.teal + '22', color: C.teal }}>
                          EM ANDAMENTO
                        </span>
                        {obra.fase && (
                          <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                            style={{ backgroundColor: C.border, color: C.gray }}>
                            {FASE_LABELS[obra.fase] ?? obra.fase}
                          </span>
                        )}
                        {fvsPend > 0 && (
                          <span className="rounded-full px-2 py-0.5 text-[9px] font-black"
                            style={{ backgroundColor: C.olive + '22', color: C.olive }}>
                            {fvsPend} FVS
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

        {/* ── LINHA INFERIOR: QUALIDADE + PENDÊNCIAS ── */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

          {/* QUALIDADE */}
          <div className="rounded-xl p-5" style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderTopColor: C.teal, borderTopWidth: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <SectionTitle label="Qualidade" />
            <MetricRow label="FVS pendentes (total)" value={totalFvsPendentes} accent={totalFvsPendentes > 0 ? C.olive : C.teal} />
            <MetricRow label="Checklists em aberto" value={qualidade.pendentes} accent={qualidade.pendentes > 0 ? C.olive : C.teal} />
            <MetricRow label="NCs sem resolução" value={qualidade.naoConformes} accent={qualidade.naoConformes > 0 ? C.red : C.teal} />
            <MetricRow label="Obras monitoradas" value={obras.length} />
          </div>

          {/* PENDÊNCIAS */}
          <div className="rounded-xl p-5" style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderTopColor: C.olive, borderTopWidth: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <SectionTitle label="Pendências" />
            <MetricRow label="Etapas aguard. aprovação" value={seqData.aguardando} accent={seqData.aguardando > 0 ? C.olive : C.teal} />
            <MetricRow label="Etapas atrasadas" value={seqData.atrasadas} accent={seqData.atrasadas > 0 ? C.red : C.teal} />
            <MetricRow label="Alertas críticos" value={totalAlertas} accent={totalAlertas > 0 ? C.red : C.teal} />
            <MetricRow label="Status geral" value={totalAlertas === 0 ? '✓ OK' : `${totalAlertas} pendência${totalAlertas > 1 ? 's' : ''}`} accent={totalAlertas === 0 ? C.teal : C.red} />
          </div>
        </div>

      </div>
    </div>
  );
}
