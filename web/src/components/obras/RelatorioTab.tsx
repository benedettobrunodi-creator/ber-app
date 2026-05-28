'use client';

import React, { useEffect, useState, useRef } from 'react';
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
          <div className="flex items-center justify-between px-5 py-4 border-b border-ber-border">
            <div>
              <p className="text-base font-bold text-ber-carbon">
                {editing ? `Editar RT-${String(editing.numero).padStart(3, '0')}` : 'Novo relatório semanal'}
              </p>
              <p className="text-xs text-ber-gray mt-0.5">Preencha as informações do período. Os campos em cinza são opcionais.</p>
            </div>
            <button onClick={() => setShowForm(false)} className="text-ber-gray hover:text-ber-carbon"><X size={18} /></button>
          </div>

          <div className="divide-y divide-ber-border">

            {/* 1. PERÍODO E STATUS */}
            <FormSection title="1. Período e situação da obra" desc="Defina a semana do relatório e como está o andamento geral.">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Início da semana">
                    <input type="date" value={form.periodoInicio}
                      onChange={e => { setForm(f => ({ ...f, periodoInicio: e.target.value })); loadDadosPeriodo(e.target.value, form.periodoFim); }}
                      className="fi" />
                  </Field>
                  <Field label="Fim da semana">
                    <input type="date" value={form.periodoFim}
                      onChange={e => { setForm(f => ({ ...f, periodoFim: e.target.value })); loadDadosPeriodo(form.periodoInicio, e.target.value); }}
                      className="fi" />
                  </Field>
                </div>
                <Field label="Situação da obra">
                  <div className="grid grid-cols-3 gap-2">
                    {STATUS_OPTS.map(o => (
                      <button key={o.value} onClick={() => setForm(f => ({ ...f, status: o.value }))}
                        className={`py-2.5 rounded-lg border-2 text-xs font-bold transition-all ${form.status === o.value ? `${o.color} border-current` : 'border-ber-border text-ber-gray hover:border-ber-carbon/30'}`}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Data prevista no contrato (opcional)" hint="Usada para calcular variação de prazo no relatório">
                  <input type="date" value={form.dataContrato ?? ''}
                    onChange={e => setForm(f => ({ ...f, dataContrato: e.target.value || null }))} className="fi w-48" />
                </Field>
              </div>
            </FormSection>

            {/* 2. AVANÇO FÍSICO */}
            <FormSection title="2. Avanço físico" desc="Quanto a obra avançou — o cronograma atual está pré-preenchido.">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Avanço acumulado da obra (%)" hint={`Cronograma atual: ${obra.progressPercent}%`}>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={100} step={1} value={form.avancoPct}
                      onChange={e => setForm(f => ({ ...f, avancoPct: +e.target.value }))}
                      className="fi w-24 text-center text-lg font-bold" />
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-ber-border overflow-hidden">
                        <div className="h-full rounded-full bg-ber-carbon/70 transition-all" style={{ width: `${form.avancoPct}%` }} />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-ber-carbon w-10 text-right">{form.avancoPct}%</span>
                  </div>
                </Field>
                <Field label="Avanço nesta semana (%)" hint="Quanto avançou só neste período">
                  <input type="number" min={0} max={100} step={0.1} value={form.avancoDelta ?? ''}
                    onChange={e => setForm(f => ({ ...f, avancoDelta: e.target.value ? +e.target.value : null }))}
                    placeholder="Ex: 3.5" className="fi w-32" />
                </Field>
              </div>
            </FormSection>

            {/* 3. EQUIPE E DIAS */}
            <FormSection title="3. Equipe e dias trabalhados" desc="Quantas pessoas trabalharam e quantos dias foram produtivos.">
              <div className="grid grid-cols-4 gap-3">
                <Field label="Dias trabalhados">
                  <input type="number" min={0} max={7} value={form.diasTrabalhados ?? ''}
                    onChange={e => setForm(f => ({ ...f, diasTrabalhados: e.target.value ? +e.target.value : null }))}
                    placeholder="Ex: 4" className="fi text-center" />
                </Field>
                <Field label="Dias úteis na semana">
                  <input type="number" min={0} max={7} value={form.diasUteis ?? ''}
                    onChange={e => setForm(f => ({ ...f, diasUteis: e.target.value ? +e.target.value : null }))}
                    placeholder="Ex: 5" className="fi text-center" />
                </Field>
                <Field label="Dias improdutivos">
                  <input type="number" min={0} max={7} value={form.diasImprodutivos ?? ''}
                    onChange={e => setForm(f => ({ ...f, diasImprodutivos: e.target.value ? +e.target.value : null }))}
                    placeholder="Ex: 1" className="fi text-center" />
                </Field>
                <Field label="Média de pessoas/dia">
                  <input type="number" min={0} step={0.5} value={form.efetivoMedio ?? ''}
                    onChange={e => setForm(f => ({ ...f, efetivoMedio: e.target.value ? +e.target.value : null }))}
                    placeholder="Ex: 12" className="fi text-center" />
                </Field>
              </div>
              {(form.diasImprodutivos ?? 0) > 0 && (
                <div className="mt-3">
                  <Field label="Por que os dias foram improdutivos?">
                    <input type="text" value={form.motivoImprodutivo ?? ''}
                      onChange={e => setForm(f => ({ ...f, motivoImprodutivo: e.target.value }))}
                      placeholder="Ex: chuva forte, falta de material, feriado..." className="fi" />
                  </Field>
                </div>
              )}
              {histogramaData.length > 0 && (
                <div className="mt-4 rounded-lg border border-ber-border bg-[#F7F7F5] px-3 pt-2 pb-1">
                  <p className="text-[10px] text-ber-gray mb-2">Trabalhadores por dia — puxado do diário da semana</p>
                  <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={histogramaData} margin={{ top: 2, right: 8, bottom: 0, left: -28 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" vertical={false} />
                      <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip formatter={(v: any) => [`${v} pessoas`, '']} labelFormatter={(l: any, p: any) => p[0]?.payload?.data ?? l} />
                      <Bar dataKey="trabalhadores" fill="#1a1a1a" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </FormSection>

            {/* 4. DESTAQUES */}
            <FormSection title="4. Destaques da semana" desc="O que aconteceu de mais importante. Será o texto principal do relatório para o cliente.">
              <textarea rows={5} value={form.destaques ?? ''}
                onChange={e => setForm(f => ({ ...f, destaques: e.target.value }))}
                placeholder="Descreva os principais avanços, visitas, entregas, ocorrências e observações relevantes do período..."
                className="fi resize-none w-full" />
            </FormSection>

            {/* 5. MARCOS */}
            <FormSection title="5. Marcos da semana" desc="O que foi concluído neste período e quais são os próximos marcos importantes.">
              {(tarefasPeriodo.length > 0 || tarefasProximo.length > 0) && (
                <div className="mb-4 rounded-lg border border-ber-border overflow-hidden">
                  {tarefasPeriodo.length > 0 && (
                    <div>
                      <div className="bg-emerald-50 px-3 py-2 border-b border-ber-border">
                        <p className="text-xs font-semibold text-emerald-700">Atividades do cronograma — em andamento nesta semana</p>
                      </div>
                      {tarefasPeriodo.map((t, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-white border-b border-ber-border last:border-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-ber-carbon truncate">{t.nome}</p>
                            <p className="text-xs text-ber-gray">{fmt(t.inicio)} → {fmt(t.fim)} · {t.percentualConcluido}% concluído</p>
                          </div>
                          <button onClick={() => addMarcoFromTarefa(t, 'concluido')}
                            className="ml-3 shrink-0 text-xs text-emerald-700 hover:text-emerald-900 font-medium px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors">
                            + Adicionar como concluído
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {tarefasProximo.length > 0 && (
                    <div>
                      <div className="bg-amber-50 px-3 py-2 border-b border-ber-border">
                        <p className="text-xs font-semibold text-amber-700">Próximas atividades do cronograma — 2 semanas à frente</p>
                      </div>
                      {tarefasProximo.map((t, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-white border-b border-ber-border last:border-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-ber-carbon truncate">{t.nome}</p>
                            <p className="text-xs text-ber-gray">{fmt(t.inicio)} → {t.fim ? fmt(t.fim) : '—'}</p>
                          </div>
                          <button onClick={() => addMarcoFromTarefa(t, 'proximo')}
                            className="ml-3 shrink-0 text-xs text-amber-700 hover:text-amber-900 font-medium px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors">
                            + Adicionar como próximo
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-2">
                {form.marcos.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-ber-border bg-[#F7F7F5]">
                    <select value={m.tipo} onChange={e => updateMarco(i, 'tipo', e.target.value)}
                      className={`shrink-0 text-xs font-bold rounded-lg px-2 py-1.5 border-0 cursor-pointer ${m.tipo === 'concluido' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      <option value="concluido">✓ Concluído</option>
                      <option value="proximo">→ Próximo</option>
                    </select>
                    <input value={m.nome} onChange={e => updateMarco(i, 'nome', e.target.value)}
                      placeholder="Nome do marco ou etapa" className="fi flex-1 py-1.5 bg-white" />
                    <input type="date" value={m.data} onChange={e => updateMarco(i, 'data', e.target.value)}
                      className="fi w-36 py-1.5 bg-white" />
                    <button onClick={() => removeMarco(i)} className="text-ber-gray/40 hover:text-red-500 shrink-0"><X size={15} /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => addMarco('concluido')}
                  className="flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-900 font-medium px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors">
                  <Plus size={13} /> Concluído
                </button>
                <button onClick={() => addMarco('proximo')}
                  className="flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 font-medium px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors">
                  <Plus size={13} /> Próximo marco
                </button>
              </div>
            </FormSection>

            {/* 6. PENDÊNCIAS */}
            <FormSection title="6. Pendências do cliente" desc="O que precisa de resposta ou decisão do cliente para a obra avançar.">
              <div className="space-y-2">
                {form.pendencias.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-ber-border bg-[#F7F7F5]">
                    <input value={p.descricao} onChange={e => updatePendencia(i, 'descricao', e.target.value)}
                      placeholder="Descreva a pendência ou decisão necessária..." className="fi flex-1 py-1.5 bg-white" />
                    <input value={p.responsavel ?? ''} onChange={e => updatePendencia(i, 'responsavel', e.target.value)}
                      placeholder="Responsável" className="fi w-36 py-1.5 bg-white" />
                    <button onClick={() => removePendencia(i)} className="text-ber-gray/40 hover:text-red-500 shrink-0"><X size={15} /></button>
                  </div>
                ))}
              </div>
              <button onClick={addPendencia}
                className="flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon font-medium mt-3 px-3 py-1.5 rounded-lg border border-ber-border hover:border-ber-carbon/40 transition-colors">
                <Plus size={13} /> Adicionar pendência
              </button>
            </FormSection>

            {/* 7. PRÓXIMOS 7 DIAS */}
            <FormSection title="7. Próximos 7 dias" desc="O que está previsto para acontecer na semana que vem.">
              <textarea rows={3} value={form.proximosSete ?? ''}
                onChange={e => setForm(f => ({ ...f, proximosSete: e.target.value }))}
                placeholder="Ex: Conclusão da estrutura do 3º pavimento, início das instalações elétricas, visita do cliente na quinta..."
                className="fi resize-none w-full" />
            </FormSection>

            {/* 8. CURVA S */}
            <FormSection title="8. Curva S — cronograma planejado" desc="Registre o % de avanço que estava previsto para cada semana. O realizado é preenchido automaticamente ao salvar.">
              <div className="overflow-hidden rounded-lg border border-ber-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F7F7F5] border-b border-ber-border">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-ber-gray">Semana (data de referência)</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-ber-gray">Previsto (%)</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-ber-gray">Realizado (%)</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ber-border">
                    {curvaSLocal.map((p, i) => (
                      <tr key={i} className="bg-white">
                        <td className="px-3 py-2">
                          <input type="date" value={p.semana} onChange={e => updateCurvaSPonto(i, 'semana', e.target.value)}
                            className="fi py-1.5 w-40" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="number" min={0} max={100} step={1} value={p.planejadoPct ?? ''}
                            onChange={e => updateCurvaSPonto(i, 'planejadoPct', e.target.value)}
                            placeholder="0" className="fi py-1.5 w-20 text-center" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-sm font-semibold ${p.realizadoPct != null ? 'text-ber-carbon' : 'text-ber-gray/30'}`}>
                            {p.realizadoPct != null ? `${p.realizadoPct}%` : '—'}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button onClick={() => removeCurvaSPonto(i)} className="text-ber-gray/30 hover:text-red-500"><X size={14} /></button>
                        </td>
                      </tr>
                    ))}
                    {curvaSLocal.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-sm text-ber-gray/50">
                          Nenhum ponto cadastrado. Adicione as datas e percentuais previstos no cronograma original.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button onClick={addCurvaSponto}
                className="flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon font-medium mt-3 px-3 py-1.5 rounded-lg border border-ber-border hover:border-ber-carbon/40 transition-colors">
                <Plus size={13} /> Adicionar linha
              </button>
            </FormSection>

            {/* 9. FOTOS */}
            <FormSection title="9. Fotos do período" desc={editing ? 'Adicione fotos representativas da semana.' : 'Salve o relatório primeiro para adicionar fotos.'}>
              {editing ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {form.fotos.map(ft => (
                      <div key={ft.id} className="relative group rounded-lg overflow-hidden border border-ber-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ft.url} alt={ft.legenda ?? ''} className="w-full h-32 object-cover" />
                        <button onClick={() => deleteFoto(editing.id, ft.id)}
                          className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => fotoRef.current?.click()} disabled={uploadingFoto}
                      className="h-32 rounded-lg border-2 border-dashed border-ber-border hover:border-ber-carbon/40 flex flex-col items-center justify-center gap-2 text-ber-gray hover:text-ber-carbon transition-colors">
                      <Upload size={20} />
                      <span className="text-xs">{uploadingFoto ? 'Enviando...' : 'Adicionar foto'}</span>
                    </button>
                  </div>
                  <input ref={fotoRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadFoto(f); e.target.value = ''; }} />
                </>
              ) : (
                <p className="text-sm text-ber-gray/50 italic">Salve o relatório para habilitar o upload de fotos.</p>
              )}
            </FormSection>

            {/* 10. RESPONSÁVEL */}
            <FormSection title="10. Responsável técnico" desc="Nome de quem está assinando este relatório.">
              <input type="text" value={form.responsavelNome ?? ''}
                onChange={e => setForm(f => ({ ...f, responsavelNome: e.target.value }))}
                placeholder="Nome completo do engenheiro responsável" className="fi w-full max-w-sm" />
            </FormSection>

          </div>

          <div className="flex items-center justify-between px-5 py-4 border-t border-ber-border bg-[#F7F7F5]">
            <p className="text-xs text-ber-gray">Campos opcionais podem ser deixados em branco.</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-ber-gray hover:text-ber-carbon transition-colors">Cancelar</button>
              <button onClick={save} disabled={saving}
                className="px-5 py-2 rounded-lg bg-ber-carbon text-white text-sm font-semibold hover:bg-ber-carbon/80 disabled:opacity-50 transition-colors">
                {saving ? 'Salvando...' : 'Salvar relatório'}
            </button>
          </div>
        </div>
        </div>
      )}

      <style>{`
        .fi { width: 100%; border-radius: 8px; border: 1px solid #E8E8E4; padding: 8px 12px; font-size: 14px; outline: none; background: white; }
        .fi:focus { border-color: #1a1a1a; }
      `}</style>
    </div>
  );
}

function FormSection({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-5">
      <div className="mb-4">
        <p className="text-sm font-bold text-ber-carbon">{title}</p>
        <p className="text-xs text-ber-gray mt-0.5">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ber-carbon mb-1">{label}</label>
      {hint && <p className="text-xs text-ber-gray/70 mb-1">{hint}</p>}
      {children}
    </div>
  );
}
