'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

interface EfetivoDisciplina { disciplina: string; quantidade: number; }
interface AtividadeSemana { wbs: string; nome: string; tipo: 'andamento' | 'proximo'; }
interface PontoAtencao { descricao: string; severidade: string; }
interface PlanoAcaoItem { atividadeAtrasada: string; acaoCorretiva: string; responsavel?: string; prazo?: string; }

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
  efetivoPorDisciplina?: EfetivoDisciplina[] | null;
  atividadesSemana?: AtividadeSemana[] | null;
  pontosAtencao?: PontoAtencao[] | null;
  planoAcao?: PlanoAcaoItem[] | null;
  pendencias: { descricao: string; responsavel?: string | null; status: string; prazo?: string | null }[];
  marcos: { nome: string; data: string; tipo: string }[];
  fotos: { id: string; url: string; legenda?: string | null; anguloId?: string | null; angulo?: { id: string; nome: string } | null }[];
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
  em_risco: { label: 'ATENÇÃO', color: '#D97706' },
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
  const [prevRelatorio, setPrevRelatorio] = useState<Relatorio | null>(null);
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
      api.get(`/obras/${params.id}/relatorios`).then(r => {
        const all: Relatorio[] = r.data.data ?? [];
        const curr = all.find(r => r.id === params.relatorioId);
        if (curr) {
          const prev = all.find(r => r.numero === curr.numero - 1) ?? null;
          setPrevRelatorio(prev);
        }
      }),
    ]);
  }, [params.id, params.relatorioId]);

  useEffect(() => {
    if (!relatorio || !obra) return;
    const d1 = new Date(relatorio.periodoInicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }).replace('/', '.');
    const d2 = new Date(relatorio.periodoFim).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }).replace('/', '.');
    const nomeObra = obra.name.replace(/[/\\:*?"<>|]/g, '-');
    document.title = `RT-${String(relatorio.numero).padStart(3, '0')}_${nomeObra}_${d1}-${d2}`;
  }, [relatorio, obra]);

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
          @page { size: A4; margin: 20mm; }
          .no-print { display: none !important; }
          header, aside, nav { display: none !important; }
          [class~="fixed"], [class~="sticky"] { position: static !important; }
          main { overflow: visible !important; height: auto !important; max-height: none !important; padding-bottom: 0 !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: 'Inter', -apple-system, sans-serif; }
          .recharts-wrapper, .recharts-surface { max-width: 100% !important; overflow: hidden !important; }
        }
        @media screen {
          header { display: none !important; }
          body > div > nav { display: none !important; }
          main.flex-1 { overflow: visible !important; padding-bottom: 0 !important; }
        }
        body { font-family: 'Inter', -apple-system, sans-serif; }
      `}</style>

      {/* Toolbar — screen only, hidden on print */}
      <div className="no-print sticky top-0 z-50 flex items-center justify-between bg-gray-900 px-6 py-3 shadow">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">Relatório Gerencial</p>
          <p className="text-sm font-black text-white">{obra.name} · RT-{String(relatorio.numero).padStart(3, '0')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.close()}
            className="rounded-lg border border-white/20 text-sm px-4 py-2 text-gray-300 hover:bg-white/10 transition-colors">
            Fechar
          </button>
          <PdfDownloadButton obraId={params.id} relatorioId={params.relatorioId} />
        </div>
      </div>

      <div className="max-w-[800px] mx-auto px-8 py-8 text-gray-900 text-sm print:px-6 print:py-4 print:max-w-none">

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
          <div className="w-40 shrink-0 rounded-lg border flex items-center justify-center py-3" style={{ borderColor: st.color }}>
            <span className="text-sm font-black tracking-wider" style={{ color: st.color }}>{st.label}</span>
          </div>
          <div className="flex-1 rounded-lg border border-gray-200 px-4 py-3">
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
          <div className="mt-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Avanço físico acumulado</span>
              <span className="text-xs font-black text-gray-900">{+relatorio.avancoPct}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-gray-900" style={{ width: `${+relatorio.avancoPct}%` }} />
            </div>
          </div>
        </Section>

        {/* CURVA S */}
        {rawCurvaS.length >= 1 && (
          <Section title="Curva S — Planejado vs. Realizado (acumulado)">
            <LineChart width={660} height={160} data={curvaSChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
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
              <Line type="monotone" dataKey="planejado" stroke="#3B82F6" strokeDasharray="4 2" strokeWidth={2} dot={false} name="Planejado acumulado" connectNulls />
              <Line type="monotone" dataKey="realizado" stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} name="Realizado acumulado" connectNulls />
            </LineChart>
          </Section>
        )}

        {/* HISTOGRAMA */}
        {histData.length > 0 && (
          <Section title="Histograma de efetivos">
            <BarChart width={660} height={130} data={histData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip formatter={(v: any) => [`${v} trabalhadores`, 'Efetivo']} labelFormatter={(l: any, p: any) => p[0]?.payload?.data ?? l} />
              <Bar dataKey="trabalhadores" fill="#374151" radius={[3, 3, 0, 0]} />
            </BarChart>
          </Section>
        )}

        {/* EFETIVO POR DISCIPLINA */}
        {(relatorio.efetivoPorDisciplina ?? []).length > 0 && (
          <Section title="Efetivo por disciplina">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400">Disciplina</th>
                  <th className="text-right py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 w-24">Pessoas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(relatorio.efetivoPorDisciplina ?? []).map((d, i) => (
                  <tr key={i}>
                    <td className="py-1.5 text-gray-800">{d.disciplina}</td>
                    <td className="py-1.5 text-right font-medium text-gray-900">{d.quantidade}</td>
                  </tr>
                ))}
                <tr className="border-t border-gray-300">
                  <td className="py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Total</td>
                  <td className="py-1.5 text-right font-black text-gray-900">
                    {(relatorio.efetivoPorDisciplina ?? []).reduce((s, d) => s + d.quantidade, 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>
        )}

        {/* ATIVIDADES DA SEMANA */}
        {(relatorio.atividadesSemana ?? []).length > 0 && (
          <Section title="Atividades da semana">
            {['andamento', 'proximo'].map(tipo => {
              const items = (relatorio.atividadesSemana ?? []).filter(a => a.tipo === tipo);
              if (!items.length) return null;
              return (
                <div key={tipo} className="mb-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                    {tipo === 'andamento' ? 'Em andamento' : 'Próximos'}
                  </p>
                  {items.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 mb-1">
                      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${tipo === 'andamento' ? 'bg-blue-500' : 'bg-amber-400'}`} />
                      <p className="text-xs text-gray-700">{a.wbs ? `[${a.wbs}] ` : ''}{a.nome}</p>
                    </div>
                  ))}
                </div>
              );
            })}
          </Section>
        )}

        {/* PONTOS DE ATENÇÃO */}
        {(relatorio.pontosAtencao ?? []).length > 0 && (
          <Section title="Pontos de atenção">
            <div className="space-y-1.5">
              {(relatorio.pontosAtencao ?? []).map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`mt-0.5 shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded ${p.severidade === 'critico' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {p.severidade === 'critico' ? 'CRÍTICO' : 'ATENÇÃO'}
                  </span>
                  <p className="text-sm text-gray-700">{p.descricao}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* PLANO DE AÇÃO */}
        {(relatorio.planoAcao ?? []).length > 0 && (
          <Section title="Plano de ação para atividades em atraso">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400">Atividade atrasada</th>
                  <th className="text-left py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400">Ação corretiva</th>
                  <th className="text-left py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 w-28">Responsável</th>
                  <th className="text-left py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 w-24">Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(relatorio.planoAcao ?? []).map((p, i) => (
                  <tr key={i}>
                    <td className="py-2 text-gray-800">{p.atividadeAtrasada}</td>
                    <td className="py-2 text-gray-700">{p.acaoCorretiva}</td>
                    <td className="py-2 text-gray-500">{p.responsavel || '—'}</td>
                    <td className="py-2 text-gray-500">{p.prazo ? new Date(p.prazo + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        {relatorio.fotos.length > 0 && (() => {
          // Group by ângulo
          const angulosMap = new Map<string, { nome: string; fotos: typeof relatorio.fotos }>();
          const semAngulo: typeof relatorio.fotos = [];
          relatorio.fotos.forEach(ft => {
            if (ft.anguloId && ft.angulo) {
              const entry = angulosMap.get(ft.anguloId) ?? { nome: ft.angulo.nome, fotos: [] };
              entry.fotos.push(ft);
              angulosMap.set(ft.anguloId, entry);
            } else {
              semAngulo.push(ft);
            }
          });
          return (
            <Section title="Registro fotográfico">
              {Array.from(angulosMap.entries()).map(([anguloId, { nome, fotos }]) => {
                const prevFoto = prevRelatorio?.fotos.find(f => f.anguloId === anguloId) ?? null;
                return (
                  <div key={anguloId} className="mb-5 break-inside-avoid">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">{nome}</p>
                    {(() => {
                      const totalSlots = fotos.length + (prevFoto ? 1 : 0);
                      const cols = totalSlots === 1 ? 'grid-cols-1' : 'grid-cols-2';
                      const imgH = totalSlots === 1 ? '240px' : '180px';
                      return (
                        <div className={`grid ${cols} gap-2`}>
                          {fotos.map((ft) => (
                            <div key={ft.id}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={ft.url} alt="" className="w-full rounded object-cover" style={{ height: imgH }} />
                              {ft.legenda && <p className="text-[9px] text-gray-400 mt-0.5">{ft.legenda}</p>}
                            </div>
                          ))}
                          {prevFoto && (
                            <div className="opacity-60">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={prevFoto.url} alt="" className="w-full rounded object-cover" style={{ height: imgH }} />
                              <p className="text-[9px] text-gray-400 mt-0.5">RT-{String(relatorio.numero - 1).padStart(3, '0')} (anterior)</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
              {semAngulo.length > 0 && (
                <div className="break-inside-avoid">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">Fotos gerais</p>
                  <div className="grid grid-cols-3 gap-2">
                    {semAngulo.map(ft => (
                      <div key={ft.id} className="rounded overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ft.url} alt={ft.legenda ?? ''} className="w-full object-cover" style={{ height: '120px' }} />
                        {ft.legenda && <p className="text-[9px] text-gray-400 mt-0.5">{ft.legenda}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          );
        })()}

        {/* PENDÊNCIAS */}
        {relatorio.pendencias.length > 0 && (
          <Section title="Itens em aberto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400">Item</th>
                  <th className="text-left py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 w-32">Responsável</th>
                  <th className="text-left py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 w-24">Status</th>
                  <th className="text-left py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 w-24">Data limite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {relatorio.pendencias.map((p, i) => (
                  <tr key={i}>
                    <td className="py-2 text-gray-800">{p.descricao}</td>
                    <td className="py-2 text-gray-500">{p.responsavel ?? '—'}</td>
                    <td className="py-2">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        p.status === 'critico'      ? 'bg-red-100 text-red-700' :
                        p.status === 'atencao'      ? 'bg-amber-100 text-amber-700' :
                                                      'bg-green-100 text-green-700'
                      }`}>
                        {p.status === 'critico' ? 'CRÍTICO' : p.status === 'atencao' ? 'ATENÇÃO' : 'SOB CONTROLE'}
                      </span>
                    </td>
                    <td className="py-2 text-gray-500">
                      {(p as any).prazo ? new Date((p as any).prazo).toLocaleDateString('pt-BR') : '—'}
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

function PdfDownloadButton({ obraId, relatorioId }: { obraId: string; relatorioId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('accessToken');
      const base = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1').replace(/\/v1$/, '');
      const res = await fetch(`${base}/v1/obras/${obraId}/relatorios/${relatorioId}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') ?? '';
      const match = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i);
      const filename = match ? decodeURIComponent(match[1]) : 'relatorio.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar PDF');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleDownload}
        disabled={loading}
        className="rounded-lg bg-white text-gray-900 text-sm font-semibold px-4 py-2 hover:bg-gray-100 transition-colors disabled:opacity-50"
      >
        {loading ? 'Gerando PDF…' : 'Baixar PDF'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 break-inside-avoid">
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
