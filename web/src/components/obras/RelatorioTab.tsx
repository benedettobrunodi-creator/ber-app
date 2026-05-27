'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Plus, Trash2, Download, X, Upload, ChevronDown, ChevronUp } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface ObraInfo {
  id: string;
  name: string;
  client: string | null;
  expectedEndDate: string | null;
  startDate: string | null;
  progressPercent: number;
}

interface RelatorioPendencia {
  id?: string;
  descricao: string;
  responsavel?: string;
  prazo?: string;
  status: string;
  ordem: number;
}

interface RelatorioMarco {
  id?: string;
  nome: string;
  data: string;
  tipo: 'concluido' | 'proximo';
}

interface RelatorioFoto {
  id: string;
  url: string;
  legenda?: string;
  ordem: number;
}

interface CurvaSPonto {
  id?: string;
  semana: string;
  planejadoPct?: number | null;
  realizadoPct?: number | null;
}

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
  pendencias: RelatorioPendencia[];
  marcos: RelatorioMarco[];
  fotos: RelatorioFoto[];
}

interface TarefaCron { wbs: string; nome: string; inicio: string; fim: string; percentualConcluido: number; }
interface EfetivosDia { data: string; total: number; }

const STATUS_OPTS = [
  { value: 'no_prazo', label: 'NO PRAZO', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'em_risco', label: 'EM RISCO', color: 'bg-amber-100 text-amber-800' },
  { value: 'atrasado', label: 'ATRASADO', color: 'bg-red-100 text-red-800' },
];

function statusLabel(s: string) { return STATUS_OPTS.find(o => o.value === s) ?? STATUS_OPTS[0]; }
function fmt(iso: string) { return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }
function fmtFull(iso: string) { return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }

function weekRange(): { inicio: string; fim: string } {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { inicio: mon.toISOString().slice(0, 10), fim: sun.toISOString().slice(0, 10) };
}

const emptyForm = (cronPct = 0, prevPct?: number): Omit<Relatorio, 'id' | 'numero'> => {
  const { inicio, fim } = weekRange();
  return {
    periodoInicio: inicio,
    periodoFim: fim,
    status: 'no_prazo',
    avancoPct: cronPct,
    avancoDelta: prevPct != null ? Math.max(0, +(cronPct - prevPct).toFixed(1)) : null,
    diasTrabalhados: null,
    diasUteis: 5,
    diasImprodutivos: 0,
    motivoImprodutivo: null,
    efetivoMedio: null,
    destaques: '',
    proximosSete: '',
    responsavelNome: '',
    dataContrato: null,
    pendencias: [{ descricao: '', status: 'aberta', ordem: 0 }],
    marcos: [
      { nome: '', data: new Date().toISOString().slice(0, 10), tipo: 'concluido' },
      { nome: '', data: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), tipo: 'proximo' },
    ],
    fotos: [],
  };
};

const DIAS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function RelatorioTab({ obraId, obra }: { obraId: string; obra: ObraInfo }) {
  const router = useRouter();
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [curvaS, setCurvaS] = useState<CurvaSPonto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Relatorio | null>(null);
  const [form, setForm] = useState(emptyForm(obra.progressPercent));
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [tarefasPeriodo, setTarefasPeriodo] = useState<TarefaCron[]>([]);
  const [tarefasProximo, setTarefasProximo] = useState<TarefaCron[]>([]);
  const [efetivos, setEfetivos] = useState<EfetivosDia[]>([]);
  const [curvaSLocal, setCurvaSLocal] = useState<CurvaSPonto[]>([]);
  const [curvaSExpanded, setCurvaSExpanded] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const [rRes, cRes] = await Promise.all([
        api.get(`/obras/${obraId}/relatorios`),
        api.get(`/obras/${obraId}/relatorios/curva-s`),
      ]);
      setRelatorios(rRes.data.data ?? []);
      setCurvaS(cRes.data.data ?? []);
    } catch { /* empty */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, [obraId]);

  async function loadDadosPeriodo(inicio: string, fim: string) {
    try {
      const res = await api.get(`/obras/${obraId}/relatorios/dados-periodo`, { params: { inicio, fim } });
      const d = res.data.data;
      setTarefasPeriodo(d.tarefasPeriodo ?? []);
      setTarefasProximo(d.tarefasProximo ?? []);
      setEfetivos(d.efetivos ?? []);
    } catch { /* ok */ }
  }

  function openNew() {
    const prev = relatorios[0];
    const f = emptyForm(obra.progressPercent, prev ? +prev.avancoPct : undefined);
    setForm(f);
    setEditing(null);
    setCurvaSLocal(curvaS.map(p => ({ ...p, semana: p.semana.slice(0, 10) })));
    setShowForm(true);
    loadDadosPeriodo(f.periodoInicio, f.periodoFim);
  }

  function openEdit(r: Relatorio) {
    setForm({
      periodoInicio: r.periodoInicio.slice(0, 10),
      periodoFim: r.periodoFim.slice(0, 10),
      status: r.status,
      avancoPct: +r.avancoPct,
      avancoDelta: r.avancoDelta != null ? +r.avancoDelta : null,
      diasTrabalhados: r.diasTrabalhados ?? null,
      diasUteis: r.diasUteis ?? null,
      diasImprodutivos: r.diasImprodutivos ?? null,
      motivoImprodutivo: r.motivoImprodutivo ?? null,
      efetivoMedio: r.efetivoMedio != null ? +r.efetivoMedio : null,
      destaques: r.destaques ?? '',
      proximosSete: r.proximosSete ?? '',
      responsavelNome: r.responsavelNome ?? '',
      dataContrato: r.dataContrato ? r.dataContrato.slice(0, 10) : null,
      pendencias: r.pendencias.length ? r.pendencias : [{ descricao: '', status: 'aberta', ordem: 0 }],
      marcos: r.marcos.length ? r.marcos.map(m => ({ ...m, data: m.data.slice(0, 10) })) : [
        { nome: '', data: new Date().toISOString().slice(0, 10), tipo: 'concluido' },
        { nome: '', data: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), tipo: 'proximo' },
      ],
      fotos: r.fotos,
    });
    setEditing(r);
    setCurvaSLocal(curvaS.map(p => ({ ...p, semana: p.semana.slice(0, 10) })));
    setShowForm(true);
    loadDadosPeriodo(r.periodoInicio.slice(0, 10), r.periodoFim.slice(0, 10));
  }

  async function saveCurvaS() {
    for (const p of curvaSLocal) {
      if (p.semana && p.planejadoPct != null) {
        await api.post(`/obras/${obraId}/relatorios/curva-s`, { semana: p.semana, planejadoPct: p.planejadoPct });
      }
    }
    const cRes = await api.get(`/obras/${obraId}/relatorios/curva-s`);
    setCurvaS(cRes.data.data ?? []);
  }

  async function save() {
    setSaving(true);
    try {
      await saveCurvaS();
      const payload = {
        ...form,
        avancoPct: +form.avancoPct,
        avancoDelta: form.avancoDelta != null ? +form.avancoDelta : null,
        efetivoMedio: form.efetivoMedio != null ? +form.efetivoMedio : null,
        pendencias: form.pendencias.filter(p => p.descricao.trim()),
        marcos: form.marcos.filter(m => m.nome.trim()),
      };
      if (editing) {
        const res = await api.patch(`/obras/${obraId}/relatorios/${editing.id}`, payload);
        setRelatorios(prev => prev.map(r => r.id === editing.id ? res.data.data : r));
      } else {
        const res = await api.post(`/obras/${obraId}/relatorios`, payload);
        setRelatorios(prev => [res.data.data, ...prev]);
      }
      setShowForm(false);
    } catch (e: any) {
      alert(e?.response?.data?.error?.message ?? 'Erro ao salvar');
    }
    setSaving(false);
  }

  async function deleteRelatorio(id: string) {
    if (!confirm('Excluir relatório?')) return;
    await api.delete(`/obras/${obraId}/relatorios/${id}`);
    setRelatorios(prev => prev.filter(r => r.id !== id));
  }

  async function uploadFoto(file: File) {
    if (!editing) return;
    setUploadingFoto(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(`/obras/${obraId}/relatorios/${editing.id}/fotos`, fd);
      const foto = res.data.data as RelatorioFoto;
      setForm(f => ({ ...f, fotos: [...f.fotos, foto] }));
      setRelatorios(prev => prev.map(r => r.id === editing.id ? { ...r, fotos: [...r.fotos, foto] } : r));
    } catch { alert('Erro ao enviar foto'); }
    setUploadingFoto(false);
  }

  async function deleteFoto(relatorioId: string, fotoId: string) {
    await api.delete(`/obras/${obraId}/relatorios/${relatorioId}/fotos/${fotoId}`);
    setForm(f => ({ ...f, fotos: f.fotos.filter(ft => ft.id !== fotoId) }));
    setRelatorios(prev => prev.map(r => r.id === relatorioId ? { ...r, fotos: r.fotos.filter(ft => ft.id !== fotoId) } : r));
  }

  function addPendencia() {
    setForm(f => ({ ...f, pendencias: [...f.pendencias, { descricao: '', status: 'aberta', ordem: f.pendencias.length }] }));
  }

  function updatePendencia(i: number, field: string, value: string) {
    setForm(f => ({ ...f, pendencias: f.pendencias.map((p, idx) => idx === i ? { ...p, [field]: value } : p) }));
  }

  function removePendencia(i: number) {
    setForm(f => ({ ...f, pendencias: f.pendencias.filter((_, idx) => idx !== i) }));
  }

  function addMarco(tipo: 'concluido' | 'proximo') {
    const data = tipo === 'proximo'
      ? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    setForm(f => ({ ...f, marcos: [...f.marcos, { nome: '', data, tipo }] }));
  }

  function addMarcoFromTarefa(t: TarefaCron, tipo: 'concluido' | 'proximo') {
    const data = tipo === 'concluido' ? (t.fim ?? t.inicio) : (t.inicio ?? t.fim);
    setForm(f => ({
      ...f,
      marcos: f.marcos.some(m => m.nome === t.nome)
        ? f.marcos
        : [...f.marcos, { nome: t.nome, data: data.slice(0, 10), tipo }],
    }));
  }

  function updateMarco(i: number, field: string, value: string) {
    setForm(f => ({ ...f, marcos: f.marcos.map((m, idx) => idx === i ? { ...m, [field]: value } : m) }));
  }

  function removeMarco(i: number) {
    setForm(f => ({ ...f, marcos: f.marcos.filter((_, idx) => idx !== i) }));
  }

  function addCurvaSponto() {
    setCurvaSLocal(prev => [...prev, { semana: form.periodoFim, planejadoPct: null }]);
  }

  function updateCurvaSPonto(i: number, field: 'semana' | 'planejadoPct', value: string) {
    setCurvaSLocal(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: field === 'planejadoPct' ? (value ? +value : null) : value } : p));
  }

  function removeCurvaSPonto(i: number) {
    setCurvaSLocal(prev => prev.filter((_, idx) => idx !== i));
  }

  // Chart data: merge curva S planejado + realizado from saved relatorios
  const curvaSChartData = (() => {
    const map = new Map<string, { semana: string; planejado?: number; realizado?: number }>();
    curvaS.forEach(p => {
      const k = p.semana.slice(0, 10);
      const entry = map.get(k) ?? { semana: k };
      if (p.planejadoPct != null) entry.planejado = +p.planejadoPct;
      if (p.realizadoPct != null) entry.realizado = +p.realizadoPct;
      map.set(k, entry);
    });
    return Array.from(map.values()).sort((a, b) => a.semana.localeCompare(b.semana))
      .map(p => ({ ...p, semana: fmt(p.semana) }));
  })();

  const histogramaData = efetivos.map(e => ({
    dia: DIAS_PT[new Date(e.data + 'T12:00:00').getDay()],
    data: fmt(e.data.slice(0, 10)),
    trabalhadores: e.total,
  }));

  const marcosConc = form.marcos.filter(m => m.tipo === 'concluido');
  const marcosProx = form.marcos.filter(m => m.tipo === 'proximo');

  if (loading) return (
    <div className="flex justify-center py-16 text-sm text-ber-gray">Carregando relatórios...</div>
  );

  return (
    <div className="px-6 py-5 space-y-4 max-w-4xl">

      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold uppercase tracking-widest text-ber-gray">
          Relatórios gerenciais · {relatorios.length}
        </p>
        <button onClick={openNew} className="flex items-center gap-1.5 rounded-lg bg-ber-carbon text-white text-xs font-semibold px-3 py-1.5 hover:bg-ber-carbon/80 transition-colors">
          <Plus size={13} /> Novo relatório
        </button>
      </div>

      {/* Curva S chart — sempre visível se tiver dados */}
      {curvaSChartData.length >= 2 && !showForm && (
        <div className="rounded-xl border border-ber-border bg-white px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-ber-gray mb-3">Curva S — Planejado vs. Realizado</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={curvaSChartData} margin={{ top: 4, right: 12, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" />
              <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v: any) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="planejado" stroke="#1a1a1a" strokeDasharray="4 2" strokeWidth={2} dot={false} name="Planejado" />
              <Line type="monotone" dataKey="realizado" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} name="Realizado" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* LIST */}
      {relatorios.length === 0 && !showForm && (
        <div className="rounded-xl border border-ber-border bg-white px-6 py-10 text-center">
          <p className="text-sm text-ber-gray">Nenhum relatório criado.</p>
          <p className="text-xs text-ber-gray/60 mt-1">Clique em "Novo relatório" para começar.</p>
        </div>
      )}

      {!showForm && relatorios.map(r => {
        const st = statusLabel(r.status);
        return (
          <div key={r.id} className="rounded-xl border border-ber-border bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-ber-border">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-ber-gray">RT-{String(r.numero).padStart(3, '0')}</span>
                <span className="text-xs text-ber-carbon font-medium">
                  {fmtFull(r.periodoInicio.slice(0, 10))} — {fmtFull(r.periodoFim.slice(0, 10))}
                </span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => window.open(`/obras/${obraId}/relatorios/${r.id}/print`, '_blank')}
                  className="flex items-center gap-1 text-[11px] text-ber-gray hover:text-ber-carbon transition-colors">
                  <Download size={12} /> PDF
                </button>
                <button onClick={() => openEdit(r)} className="text-[11px] text-ber-gray hover:text-ber-carbon transition-colors">Editar</button>
                <button onClick={() => deleteRelatorio(r.id)} className="text-ber-gray/40 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
              </div>
            </div>
            <div className="px-4 py-3 grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-lg font-black text-ber-carbon">{+r.avancoPct}%</p>
                <p className="text-[9px] text-ber-gray uppercase tracking-wide">Avanço acumulado</p>
              </div>
              <div>
                <p className="text-lg font-black text-ber-carbon">{r.avancoDelta != null ? `+${+r.avancoDelta}%` : '—'}</p>
                <p className="text-[9px] text-ber-gray uppercase tracking-wide">Na semana</p>
              </div>
              <div>
                <p className="text-lg font-black text-ber-carbon">
                  {r.diasTrabalhados != null && r.diasUteis != null ? `${r.diasTrabalhados}/${r.diasUteis}` : '—'}
                </p>
                <p className="text-[9px] text-ber-gray uppercase tracking-wide">Dias trabalhados</p>
              </div>
              <div>
                <p className="text-lg font-black text-ber-carbon">{r.efetivoMedio != null ? +r.efetivoMedio : '—'}</p>
                <p className="text-[9px] text-ber-gray uppercase tracking-wide">Efetivo médio</p>
              </div>
            </div>
          </div>
        );
      })}

      {/* FORM */}
      {showForm && (
        <div className="rounded-xl border border-ber-border bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-ber-border">
            <p className="text-sm font-semibold text-ber-carbon">
              {editing ? `Editar RT-${String(editing.numero).padStart(3, '0')}` : 'Novo relatório semanal'}
            </p>
            <button onClick={() => setShowForm(false)} className="text-ber-gray hover:text-ber-carbon"><X size={16} /></button>
          </div>

          <div className="px-4 py-4 space-y-6">

            {/* Período + Status */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="form-label">Período início</label>
                <input type="date" value={form.periodoInicio}
                  onChange={e => { setForm(f => ({ ...f, periodoInicio: e.target.value })); loadDadosPeriodo(e.target.value, form.periodoFim); }}
                  className="form-input" />
              </div>
              <div>
                <label className="form-label">Período fim</label>
                <input type="date" value={form.periodoFim}
                  onChange={e => { setForm(f => ({ ...f, periodoFim: e.target.value })); loadDadosPeriodo(form.periodoInicio, e.target.value); }}
                  className="form-input" />
              </div>
              <div>
                <label className="form-label">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="form-input">
                  {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* Avanço */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="form-label">Avanço acumulado %</label>
                <input type="number" min={0} max={100} step={0.1} value={form.avancoPct}
                  onChange={e => setForm(f => ({ ...f, avancoPct: +e.target.value }))} className="form-input" />
                <p className="text-[9px] text-ber-gray/60 mt-0.5">Cronograma atual: {obra.progressPercent}%</p>
              </div>
              <div>
                <label className="form-label">Avanço na semana %</label>
                <input type="number" min={0} max={100} step={0.1} value={form.avancoDelta ?? ''}
                  onChange={e => setForm(f => ({ ...f, avancoDelta: e.target.value ? +e.target.value : null }))} className="form-input" />
              </div>
              <div>
                <label className="form-label">Data contrato</label>
                <input type="date" value={form.dataContrato ?? ''}
                  onChange={e => setForm(f => ({ ...f, dataContrato: e.target.value || null }))} className="form-input" />
              </div>
            </div>

            {/* Dias + Efetivo */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { key: 'diasTrabalhados', label: 'Dias trabalhados' },
                { key: 'diasUteis', label: 'Dias úteis' },
                { key: 'diasImprodutivos', label: 'Dias improdutivos' },
                { key: 'efetivoMedio', label: 'Efetivo médio' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="form-label">{label}</label>
                  <input type="number" min={0} value={(form as any)[key] ?? ''}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value ? +e.target.value : null }))} className="form-input" />
                </div>
              ))}
            </div>

            {(form.diasImprodutivos ?? 0) > 0 && (
              <div>
                <label className="form-label">Motivo dias improdutivos</label>
                <input type="text" value={form.motivoImprodutivo ?? ''}
                  onChange={e => setForm(f => ({ ...f, motivoImprodutivo: e.target.value }))}
                  placeholder="Ex: chuva, feriado, falta de material..." className="form-input" />
              </div>
            )}

            {/* Histograma de efetivos — puxado do diário */}
            {histogramaData.length > 0 && (
              <div>
                <label className="form-label">Histograma de efetivos — diário do período</label>
                <div className="rounded-lg border border-ber-border bg-[#F7F7F5] px-3 py-3">
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={histogramaData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" vertical={false} />
                      <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip formatter={(v: any) => [`${v} trab.`, 'Efetivo']} labelFormatter={(l: any, p: any) => p[0]?.payload?.data ?? l} />
                      <Bar dataKey="trabalhadores" fill="#1a1a1a" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Responsável */}
            <div>
              <label className="form-label">Responsável técnico</label>
              <input type="text" value={form.responsavelNome ?? ''}
                onChange={e => setForm(f => ({ ...f, responsavelNome: e.target.value }))}
                placeholder="Nome do engenheiro responsável" className="form-input" />
            </div>

            {/* Destaques */}
            <div>
              <label className="form-label">Destaques da semana</label>
              <textarea rows={4} value={form.destaques ?? ''}
                onChange={e => setForm(f => ({ ...f, destaques: e.target.value }))}
                placeholder="Descreva os principais avanços, eventos relevantes e observações do período..."
                className="form-input resize-none" />
            </div>

            {/* Atividades do cronograma — período atual */}
            {tarefasPeriodo.length > 0 && (
              <div>
                <label className="form-label">Atividades do cronograma — período atual</label>
                <div className="rounded-lg border border-ber-border divide-y divide-ber-border overflow-hidden">
                  {tarefasPeriodo.map((t, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 bg-white">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-ber-carbon truncate">{t.nome}</p>
                        <p className="text-[10px] text-ber-gray">{fmt(t.inicio)} → {fmt(t.fim)} · {t.percentualConcluido}%</p>
                      </div>
                      <button onClick={() => addMarcoFromTarefa(t, 'concluido')}
                        className="ml-3 shrink-0 text-[10px] text-ber-gray hover:text-ber-carbon px-2 py-1 rounded border border-ber-border transition-colors">
                        + Marco concluído
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Atividades do cronograma — próximo período */}
            {tarefasProximo.length > 0 && (
              <div>
                <label className="form-label">Atividades do cronograma — próximas 2 semanas</label>
                <div className="rounded-lg border border-ber-border divide-y divide-ber-border overflow-hidden">
                  {tarefasProximo.map((t, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 bg-white">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-ber-carbon truncate">{t.nome}</p>
                        <p className="text-[10px] text-ber-gray">{fmt(t.inicio)} → {t.fim ? fmt(t.fim) : '—'}</p>
                      </div>
                      <button onClick={() => addMarcoFromTarefa(t, 'proximo')}
                        className="ml-3 shrink-0 text-[10px] text-ber-gray hover:text-ber-carbon px-2 py-1 rounded border border-ber-border transition-colors">
                        + Marco próximo
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MARCOS */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="form-label mb-0">Marcos</label>
                <div className="flex gap-2">
                  <button onClick={() => addMarco('concluido')} className="text-[10px] text-ber-gray hover:text-ber-carbon flex items-center gap-1"><Plus size={11} /> Concluído</button>
                  <button onClick={() => addMarco('proximo')} className="text-[10px] text-ber-gray hover:text-ber-carbon flex items-center gap-1"><Plus size={11} /> Próximo</button>
                </div>
              </div>
              <div className="space-y-2">
                {form.marcos.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${m.tipo === 'concluido' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {m.tipo === 'concluido' ? 'CONCL.' : 'PRÓX.'}
                    </span>
                    <input value={m.nome} onChange={e => updateMarco(i, 'nome', e.target.value)}
                      placeholder="Nome do marco" className="flex-1 form-input py-1.5" />
                    <input type="date" value={m.data} onChange={e => updateMarco(i, 'data', e.target.value)}
                      className="form-input py-1.5 w-36" />
                    <button onClick={() => removeMarco(i)} className="text-ber-gray/40 hover:text-red-500"><X size={14} /></button>
                  </div>
                ))}
              </div>
            </div>

            {/* PENDÊNCIAS */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="form-label mb-0">Pendências do cliente</label>
                <button onClick={addPendencia} className="text-[10px] text-ber-gray hover:text-ber-carbon flex items-center gap-1"><Plus size={11} /> Adicionar</button>
              </div>
              <div className="space-y-2">
                {form.pendencias.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={p.descricao} onChange={e => updatePendencia(i, 'descricao', e.target.value)}
                      placeholder="Descreva a pendência..." className="flex-1 form-input py-1.5" />
                    <input value={p.responsavel ?? ''} onChange={e => updatePendencia(i, 'responsavel', e.target.value)}
                      placeholder="Responsável" className="w-32 form-input py-1.5" />
                    <button onClick={() => removePendencia(i)} className="text-ber-gray/40 hover:text-red-500"><X size={14} /></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Próximos 7 dias */}
            <div>
              <label className="form-label">Próximos 7 dias</label>
              <textarea rows={3} value={form.proximosSete ?? ''}
                onChange={e => setForm(f => ({ ...f, proximosSete: e.target.value }))}
                placeholder="Atividades e marcos previstos para a próxima semana..."
                className="form-input resize-none" />
            </div>

            {/* CURVA S PLANEJADO */}
            <div>
              <button onClick={() => setCurvaSExpanded(e => !e)}
                className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-ber-gray hover:text-ber-carbon transition-colors w-full text-left mb-2">
                {curvaSExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                Curva S — pontos planejados
              </button>
              {curvaSExpanded && (
                <div className="space-y-2">
                  {curvaSLocal.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="date" value={p.semana} onChange={e => updateCurvaSPonto(i, 'semana', e.target.value)}
                        className="form-input py-1.5 w-40" />
                      <div className="flex items-center gap-1 flex-1">
                        <input type="number" min={0} max={100} step={1} value={p.planejadoPct ?? ''}
                          onChange={e => updateCurvaSPonto(i, 'planejadoPct', e.target.value)}
                          placeholder="% planejado" className="form-input py-1.5 flex-1" />
                        <span className="text-xs text-ber-gray shrink-0">% plan.</span>
                      </div>
                      {p.realizadoPct != null && (
                        <span className="text-[10px] text-ber-gray shrink-0">{p.realizadoPct}% real.</span>
                      )}
                      <button onClick={() => removeCurvaSPonto(i)} className="text-ber-gray/40 hover:text-red-500"><X size={14} /></button>
                    </div>
                  ))}
                  <button onClick={addCurvaSponto}
                    className="text-[10px] text-ber-gray hover:text-ber-carbon flex items-center gap-1">
                    <Plus size={11} /> Adicionar ponto
                  </button>
                </div>
              )}
            </div>

            {/* FOTOS */}
            {editing && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="form-label mb-0">Fotos do período</label>
                  <button onClick={() => fotoRef.current?.click()} disabled={uploadingFoto}
                    className="text-[10px] text-ber-gray hover:text-ber-carbon flex items-center gap-1">
                    <Upload size={11} /> {uploadingFoto ? 'Enviando...' : 'Adicionar foto'}
                  </button>
                  <input ref={fotoRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadFoto(f); e.target.value = ''; }} />
                </div>
                {form.fotos.length === 0 && <p className="text-[11px] text-ber-gray/40">Nenhuma foto adicionada.</p>}
                <div className="grid grid-cols-3 gap-2">
                  {form.fotos.map(ft => (
                    <div key={ft.id} className="relative group rounded-lg overflow-hidden border border-ber-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ft.url} alt={ft.legenda ?? ''} className="w-full h-24 object-cover" />
                      <button onClick={() => deleteFoto(editing.id, ft.id)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-ber-border bg-[#F7F7F5]">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-ber-gray hover:text-ber-carbon transition-colors">Cancelar</button>
            <button onClick={save} disabled={saving}
              className="px-4 py-2 rounded-lg bg-ber-carbon text-white text-sm font-semibold hover:bg-ber-carbon/80 disabled:opacity-50 transition-colors">
              {saving ? 'Salvando...' : 'Salvar relatório'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .form-label { display: block; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #888; margin-bottom: 4px; }
        .form-input { width: 100%; border-radius: 8px; border: 1px solid #E8E8E4; padding: 8px 12px; font-size: 14px; outline: none; background: white; }
        .form-input:focus { border-color: #1a1a1a; }
      `}</style>
    </div>
  );
}
