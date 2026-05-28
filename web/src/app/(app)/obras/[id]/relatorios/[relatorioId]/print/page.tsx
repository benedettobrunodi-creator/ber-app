'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface Relatorio {
  id: string;
  numero: number;
  periodoInicio: string;
  periodoFim: string;
  status: string;
  avancoPct: number;
  avancoDelta?: number | null;
  diasTrabalhados?: number | null;
  diasUteis?: number | null;
  diasImprodutivos?: number | null;
  motivoImprodutivo?: string | null;
  efetivoMedio?: number | null;
  destaques?: string | null;
  proximosSete?: string | null;
  responsavelNome?: string | null;
  dataContrato?: string | null;
  pendencias: { descricao: string; responsavel?: string | null; status: string }[];
  marcos: { nome: string; data: string; tipo: string }[];
  fotos: { id: string; url: string; legenda?: string | null }[];
}

interface ObraInfo {
  id: string;
  name: string;
  client: string | null;
  expectedEndDate: string | null;
  startDate: string | null;
  progressPercent: number;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  no_prazo: { label: 'NO PRAZO', color: '#059669' },
  em_risco: { label: 'EM RISCO', color: '#D97706' },
  atrasado: { label: 'ATRASADO', color: '#DC2626' },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function diasRestantes(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default function RelatorioImpressao() {
  const params = useParams<{ id: string; relatorioId: string }>();
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [obra, setObra] = useState<ObraInfo | null>(null);
  const [rawCurvaS, setRawCurvaS] = useState<{ semana: string; planejadoPct?: number | null; realizadoPct?: number | null }[]>([]);
  const [histData, setHistData] = useState<{ dia: string; data: string; trabalhadores: number }[]>([]);

  const DIAS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  useEffect(() => {
    Promise.all([
      api.get(`/obras/${params.id}/relatorios/${params.relatorioId}`).then(r => {
        const rel: Relatorio = r.data.data;
        setRelatorio(rel);
        // Load period data for histograma
        const inicio = rel.periodoInicio.slice(0, 10);
        const fim = rel.periodoFim.slice(0, 10);
        api.get(`/obras/${params.id}/relatorios/dados-periodo`, { params: { inicio, fim } })
          .then(d => {
            const ef: { data: string; total: number }[] = d.data.data.efetivos ?? [];
            setHistData(ef.map(e => ({
              dia: DIAS_PT[new Date(e.data + 'T12:00:00').getDay()],
              data: new Date(e.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
              trabalhadores: e.total,
            })));
          }).catch(() => {});
      }),
      api.get(`/obras/${params.id}`).then(r => setObra(r.data.data)),
      api.get(`/obras/${params.id}/relatorios/curva-s`).then(r => {
        setRawCurvaS(r.data.data ?? []);
      }),
    ]);
  }, [params.id, params.relatorioId]);

  if (!relatorio || !obra) return (
    <div className="flex h-screen items-center justify-center text-sm text-gray-500">Carregando...</div>
  );

  const st = STATUS_MAP[relatorio.status] ?? STATUS_MAP.no_prazo;
  const dias = diasRestantes(obra.expectedEndDate);
  const marcosConc = relatorio.marcos.filter(m => m.tipo === 'concluido');
  const marcosProx = relatorio.marcos.filter(m => m.tipo === 'proximo');

  const curvaSChartData = (() => {
    const map = new Map<string, { semana: string; planejado?: number; realizado?: number }>();
    rawCurvaS.forEach(p => {
      const k = p.semana.slice(0, 10);
      const entry = map.get(k) ?? { semana: k };
      if (p.planejadoPct != null) entry.planejado = +p.planejadoPct;
      if (p.realizadoPct != null) entry.realizado = +p.realizadoPct;
      map.set(k, entry);
    });
    const startIso = obra.startDate?.slice(0, 10) ?? null;
    const endIso = obra.expectedEndDate?.slice(0, 10) ?? null;
    if (startIso && !map.has(startIso)) map.set(startIso, { semana: startIso });
    if (endIso && !map.has(endIso)) map.set(endIso, { semana: endIso });
    const startMs = startIso ? new Date(startIso + 'T12:00:00').getTime() : null;
    const endMs = endIso ? new Date(endIso + 'T12:00:00').getTime() : null;
    const durationMs = startMs && endMs && endMs > startMs ? endMs - startMs : null;
    return Array.from(map.values())
      .sort((a, b) => a.semana.localeCompare(b.semana))
      .map(p => {
        const pointMs = new Date(p.semana + 'T12:00:00').getTime();
        let label: string;
        if (startMs && pointMs >= startMs) {
          const wk = Math.round((pointMs - startMs) / (7 * 86400000)) + 1;
          label = `Sem. ${wk}`;
        } else {
          label = new Date(p.semana + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        }
        let tendencia: number | undefined;
        if (startMs != null && durationMs) {
          const pct = (pointMs - startMs) / durationMs * 100;
          tendencia = +Math.min(100, Math.max(0, pct)).toFixed(1);
        }
        return { ...p, label, tendencia };
      });
  })();

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 18mm 15mm; }
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { font-family: 'Inter', -apple-system, sans-serif; }
      `}</style>

      {/* Print button — hidden on print */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button onClick={() => window.print()}
          className="rounded-lg bg-gray-900 text-white text-sm font-semibold px-4 py-2 shadow hover:bg-gray-700 transition-colors">
          Imprimir / Salvar PDF
        </button>
        <button onClick={() => window.close()}
          className="rounded-lg border border-gray-200 text-sm px-4 py-2 shadow hover:bg-gray-50 transition-colors">
          Fechar
        </button>
      </div>

      <div className="max-w-[800px] mx-auto px-8 py-8 text-gray-900 text-sm print:px-0 print:py-0">

        {/* CABEÇALHO */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-gray-900">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 mb-1">Relatório Gerencial de Obra</p>
            <h1 className="text-2xl font-black text-gray-900 leading-tight">{obra.name}</h1>
            {obra.client && <p className="text-sm text-gray-500 mt-0.5">{obra.client}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-gray-900">RT-{String(relatorio.numero).padStart(3, '0')}</p>
            <p className="text-xs text-gray-500 mt-0.5">{fmt(relatorio.periodoInicio)} — {fmt(relatorio.periodoFim)}</p>
          </div>
        </div>

        {/* STATUS + PRAZO */}
        <div className="flex items-stretch gap-4 mb-6">
          <div className="flex-1 rounded-xl border-2 flex items-center justify-center py-4" style={{ borderColor: st.color }}>
            <span className="text-lg font-black tracking-wider" style={{ color: st.color }}>{st.label}</span>
          </div>
          <div className="flex-1 rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Previsão de conclusão</p>
            <p className="text-base font-black text-gray-900">
              {obra.expectedEndDate ? fmt(obra.expectedEndDate) : '—'}
            </p>
            {dias != null && (
              <p className="text-xs mt-0.5" style={{ color: dias < 0 ? '#DC2626' : dias <= 14 ? '#D97706' : '#6B7280' }}>
                {dias < 0 ? `${Math.abs(dias)} dias em atraso` : `${dias} dias restantes`}
              </p>
            )}
            {relatorio.dataContrato && obra.expectedEndDate && (() => {
              const varDias = Math.round((new Date(obra.expectedEndDate).getTime() - new Date(relatorio.dataContrato).getTime()) / 86_400_000);
              return varDias !== 0 ? (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Contrato: {fmt(relatorio.dataContrato)} ({varDias > 0 ? `+${varDias}d` : `${varDias}d`})
                </p>
              ) : null;
            })()}
          </div>
        </div>

        {/* AVANÇO FÍSICO */}
        <Section title="Avanço Físico">
          <div className="grid grid-cols-4 gap-3 mb-3">
            <Kpi label="Acumulado" value={`${+relatorio.avancoPct}%`} big />
            <Kpi label="Na semana" value={relatorio.avancoDelta != null ? `+${+relatorio.avancoDelta}%` : '—'} />
            <Kpi label="Dias trab. / úteis" value={
              relatorio.diasTrabalhados != null && relatorio.diasUteis != null
                ? `${relatorio.diasTrabalhados}/${relatorio.diasUteis}`
                : '—'
            } />
            <Kpi label="Efetivo médio/dia" value={relatorio.efetivoMedio != null ? String(+relatorio.efetivoMedio) : '—'} />
          </div>
          <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-gray-900" style={{ width: `${+relatorio.avancoPct}%` }} />
          </div>
          {relatorio.diasImprodutivos != null && relatorio.diasImprodutivos > 0 && (
            <p className="text-xs text-gray-500 mt-1.5">
              {relatorio.diasImprodutivos} dia{relatorio.diasImprodutivos > 1 ? 's' : ''} improdutivo{relatorio.diasImprodutivos > 1 ? 's' : ''}
              {relatorio.motivoImprodutivo ? ` — ${relatorio.motivoImprodutivo}` : ''}
            </p>
          )}
        </Section>

        {/* CURVA S */}
        {rawCurvaS.length >= 1 && (
          <Section title="Curva S — Planejado vs. Realizado">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={curvaSChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip
                  formatter={(v: any) => `${v}%`}
                  labelFormatter={(label: any, payload: any) => {
                    const semana = payload?.[0]?.payload?.semana;
                    return semana ? `${label} (${fmt(semana + 'T12:00:00')})` : label;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Line type="monotone" dataKey="tendencia" stroke="#D1D5DB" strokeDasharray="2 4" strokeWidth={1.5} dot={false} name="Tendência linear" connectNulls />
                <Line type="monotone" dataKey="planejado" stroke="#374151" strokeDasharray="4 2" strokeWidth={2} dot={false} name="Planejado" connectNulls />
                <Line type="monotone" dataKey="realizado" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} name="Realizado" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </Section>
        )}

        {/* HISTOGRAMA */}
        {histData.length > 0 && (
          <Section title="Histograma de efetivos">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={histData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                <Tooltip formatter={(v: any) => [`${v} trabalhadores`, 'Efetivo']} labelFormatter={(l: any, p: any) => p[0]?.payload?.data ?? l} />
                <Bar dataKey="trabalhadores" fill="#374151" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}

        {/* MARCOS */}
        {(marcosConc.length > 0 || marcosProx.length > 0) && (
          <Section title="Marcos">
            <div className="grid grid-cols-2 gap-6">
              {marcosConc.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">Concluídos no período</p>
                  {marcosConc.map((m, i) => (
                    <div key={i} className="flex items-start gap-2 mb-1.5">
                      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 leading-tight">{m.nome}</p>
                        <p className="text-[10px] text-gray-400">{fmt(m.data)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {marcosProx.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">Próximos marcos críticos</p>
                  {marcosProx.map((m, i) => (
                    <div key={i} className="flex items-start gap-2 mb-1.5">
                      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 leading-tight">{m.nome}</p>
                        <p className="text-[10px] text-gray-400">{fmt(m.data)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* DESTAQUES */}
        {relatorio.destaques && (
          <Section title="Destaques da semana">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{relatorio.destaques}</p>
          </Section>
        )}

        {/* FOTOS */}
        {relatorio.fotos.length > 0 && (
          <Section title="Registro fotográfico">
            <div className="grid grid-cols-3 gap-3">
              {relatorio.fotos.map(ft => (
                <div key={ft.id} className="rounded-lg overflow-hidden border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ft.url} alt={ft.legenda ?? ''} className="w-full h-36 object-cover" />
                  {ft.legenda && <p className="text-[10px] text-gray-500 px-2 py-1">{ft.legenda}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* PENDÊNCIAS */}
        {relatorio.pendencias.length > 0 && (
          <Section title="Pendências do cliente">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400">Descrição</th>
                  <th className="text-left py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 w-32">Responsável</th>
                  <th className="text-left py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 w-20">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {relatorio.pendencias.map((p, i) => (
                  <tr key={i}>
                    <td className="py-2 text-gray-800">{p.descricao}</td>
                    <td className="py-2 text-gray-500">{p.responsavel ?? '—'}</td>
                    <td className="py-2">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        p.status === 'resolvida' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {p.status === 'resolvida' ? 'RESOLVIDA' : 'ABERTA'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* PRÓXIMOS 7 DIAS */}
        {relatorio.proximosSete && (
          <Section title="Próximos 7 dias">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{relatorio.proximosSete}</p>
          </Section>
        )}

        {/* RODAPÉ */}
        <div className="mt-8 pt-4 border-t border-gray-200 flex items-end justify-between">
          <div>
            {relatorio.responsavelNome && (
              <>
                <div className="w-40 border-b border-gray-400 mb-1" />
                <p className="text-xs text-gray-600">{relatorio.responsavelNome}</p>
                <p className="text-[10px] text-gray-400">Responsável técnico</p>
              </>
            )}
          </div>
          <p className="text-[10px] text-gray-300">BÈR Engenharia · {fmt(new Date().toISOString())}</p>
        </div>

      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-400 mb-2 pb-1 border-b border-gray-100">{title}</p>
      {children}
    </div>
  );
}

function Kpi({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-100 px-3 py-2 text-center">
      <p className={`font-black text-gray-900 ${big ? 'text-2xl' : 'text-xl'}`}>{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
