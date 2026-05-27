'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Plus, ChevronDown, ChevronUp, Trash2, Download, X, Upload } from 'lucide-react';

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

const STATUS_OPTS = [
  { value: 'no_prazo', label: 'NO PRAZO', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'em_risco', label: 'EM RISCO', color: 'bg-amber-100 text-amber-800' },
  { value: 'atrasado', label: 'ATRASADO', color: 'bg-red-100 text-red-800' },
];

function statusLabel(s: string) {
  return STATUS_OPTS.find(o => o.value === s) ?? STATUS_OPTS[0];
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function weekRange(): { inicio: string; fim: string } {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return {
    inicio: mon.toISOString().slice(0, 10),
    fim: sun.toISOString().slice(0, 10),
  };
}

const emptyForm = (): Omit<Relatorio, 'id' | 'numero' | 'fotos'> & { fotos: RelatorioFoto[] } => {
  const { inicio, fim } = weekRange();
  return {
    periodoInicio: inicio,
    periodoFim: fim,
    status: 'no_prazo',
    avancoPct: 0,
    avancoDelta: null,
    diasTrabalhados: null,
    diasUteis: 5,
    diasImprodutivos: 0,
    motivoImprodutivo: null,
    efetivoMedio: null,
    destaques: '',
    proximosSete: '',
    responsavelNome: '',
    dataContrato: null,
    pendencias: [],
    marcos: [],
    fotos: [],
  };
};

export default function RelatorioTab({ obraId, obra }: { obraId: string; obra: ObraInfo }) {
  const router = useRouter();
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Relatorio | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);

  const cronogramaPct = obra.progressPercent;

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/obras/${obraId}/relatorios`);
      setRelatorios(res.data.data ?? []);
    } catch { /* empty list */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, [obraId]);

  function openNew() {
    const f = emptyForm();
    f.avancoPct = cronogramaPct;
    const prev = relatorios[0];
    if (prev) {
      f.avancoDelta = Math.max(0, +(cronogramaPct - prev.avancoPct).toFixed(1));
    }
    setForm(f);
    setEditing(null);
    setShowForm(true);
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
      pendencias: r.pendencias,
      marcos: r.marcos.map(m => ({ ...m, data: m.data.slice(0, 10) })),
      fotos: r.fotos,
    });
    setEditing(r);
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        avancoPct: +form.avancoPct,
        avancoDelta: form.avancoDelta != null ? +form.avancoDelta : null,
        efetivoMedio: form.efetivoMedio != null ? +form.efetivoMedio : null,
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

  function updatePendencia(i: number, field: keyof RelatorioPendencia, value: string) {
    setForm(f => ({ ...f, pendencias: f.pendencias.map((p, idx) => idx === i ? { ...p, [field]: value } : p) }));
  }

  function removePendencia(i: number) {
    setForm(f => ({ ...f, pendencias: f.pendencias.filter((_, idx) => idx !== i) }));
  }

  function addMarco(tipo: 'concluido' | 'proximo') {
    setForm(f => ({ ...f, marcos: [...f.marcos, { nome: '', data: new Date().toISOString().slice(0, 10), tipo }] }));
  }

  function updateMarco(i: number, field: keyof RelatorioMarco, value: string) {
    setForm(f => ({ ...f, marcos: f.marcos.map((m, idx) => idx === i ? { ...m, [field]: value } : m) }));
  }

  function removeMarco(i: number) {
    setForm(f => ({ ...f, marcos: f.marcos.filter((_, idx) => idx !== i) }));
  }

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
                  {fmt(r.periodoInicio)} — {fmt(r.periodoFim)}
                </span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/obras/${obraId}/relatorios/${r.id}/print`)}
                  className="flex items-center gap-1 text-[11px] text-ber-gray hover:text-ber-carbon transition-colors"
                >
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
                <p className="text-lg font-black text-ber-carbon">
                  {r.avancoDelta != null ? `+${+r.avancoDelta}%` : '—'}
                </p>
                <p className="text-[9px] text-ber-gray uppercase tracking-wide">Na semana</p>
              </div>
              <div>
                <p className="text-lg font-black text-ber-carbon">
                  {r.diasTrabalhados != null && r.diasUteis != null ? `${r.diasTrabalhados}/${r.diasUteis}` : '—'}
                </p>
                <p className="text-[9px] text-ber-gray uppercase tracking-wide">Dias trabalhados</p>
              </div>
              <div>
                <p className="text-lg font-black text-ber-carbon">
                  {r.efetivoMedio != null ? +r.efetivoMedio : '—'}
                </p>
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

          <div className="px-4 py-4 space-y-5">

            {/* Período + Status */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-ber-gray mb-1">Período início</label>
                <input type="date" value={form.periodoInicio} onChange={e => setForm(f => ({ ...f, periodoInicio: e.target.value }))}
                  className="w-full rounded-lg border border-ber-border px-3 py-2 text-sm focus:outline-none focus:border-ber-carbon" />
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-ber-gray mb-1">Período fim</label>
                <input type="date" value={form.periodoFim} onChange={e => setForm(f => ({ ...f, periodoFim: e.target.value }))}
                  className="w-full rounded-lg border border-ber-border px-3 py-2 text-sm focus:outline-none focus:border-ber-carbon" />
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-ber-gray mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full rounded-lg border border-ber-border px-3 py-2 text-sm focus:outline-none focus:border-ber-carbon">
                  {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* Avanço */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-ber-gray mb-1">Avanço acumulado %</label>
                <input type="number" min={0} max={100} step={0.1} value={form.avancoPct}
                  onChange={e => setForm(f => ({ ...f, avancoPct: +e.target.value }))}
                  className="w-full rounded-lg border border-ber-border px-3 py-2 text-sm focus:outline-none focus:border-ber-carbon" />
                <p className="text-[9px] text-ber-gray/60 mt-0.5">Cronograma atual: {cronogramaPct}%</p>
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-ber-gray mb-1">Avanço na semana %</label>
                <input type="number" min={0} max={100} step={0.1} value={form.avancoDelta ?? ''}
                  onChange={e => setForm(f => ({ ...f, avancoDelta: e.target.value ? +e.target.value : null }))}
                  className="w-full rounded-lg border border-ber-border px-3 py-2 text-sm focus:outline-none focus:border-ber-carbon" />
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-ber-gray mb-1">Data contrato</label>
                <input type="date" value={form.dataContrato ?? ''} onChange={e => setForm(f => ({ ...f, dataContrato: e.target.value || null }))}
                  className="w-full rounded-lg border border-ber-border px-3 py-2 text-sm focus:outline-none focus:border-ber-carbon" />
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
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-ber-gray mb-1">{label}</label>
                  <input type="number" min={0} value={(form as any)[key] ?? ''}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value ? +e.target.value : null }))}
                    className="w-full rounded-lg border border-ber-border px-3 py-2 text-sm focus:outline-none focus:border-ber-carbon" />
                </div>
              ))}
            </div>

            {/* Motivo improdutivo */}
            {(form.diasImprodutivos ?? 0) > 0 && (
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-ber-gray mb-1">Motivo dias improdutivos</label>
                <input type="text" value={form.motivoImprodutivo ?? ''} onChange={e => setForm(f => ({ ...f, motivoImprodutivo: e.target.value }))}
                  placeholder="Ex: chuva, feriado, falta de material..."
                  className="w-full rounded-lg border border-ber-border px-3 py-2 text-sm focus:outline-none focus:border-ber-carbon" />
              </div>
            )}

            {/* Responsável */}
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-widest text-ber-gray mb-1">Responsável técnico</label>
              <input type="text" value={form.responsavelNome ?? ''} onChange={e => setForm(f => ({ ...f, responsavelNome: e.target.value }))}
                placeholder="Nome do engenheiro responsável"
                className="w-full rounded-lg border border-ber-border px-3 py-2 text-sm focus:outline-none focus:border-ber-carbon" />
            </div>

            {/* Destaques */}
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-widest text-ber-gray mb-1">Destaques da semana</label>
              <textarea rows={4} value={form.destaques ?? ''} onChange={e => setForm(f => ({ ...f, destaques: e.target.value }))}
                placeholder="Descreva os principais avanços, eventos relevantes e observações do período..."
                className="w-full rounded-lg border border-ber-border px-3 py-2 text-sm focus:outline-none focus:border-ber-carbon resize-none" />
            </div>

            {/* Próximos 7 dias */}
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-widest text-ber-gray mb-1">Próximos 7 dias</label>
              <textarea rows={3} value={form.proximosSete ?? ''} onChange={e => setForm(f => ({ ...f, proximosSete: e.target.value }))}
                placeholder="Atividades e marcos previstos para a próxima semana..."
                className="w-full rounded-lg border border-ber-border px-3 py-2 text-sm focus:outline-none focus:border-ber-carbon resize-none" />
            </div>

            {/* Marcos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[9px] font-bold uppercase tracking-widest text-ber-gray">Marcos</label>
                <div className="flex gap-2">
                  <button onClick={() => addMarco('concluido')} className="text-[10px] text-ber-gray hover:text-ber-carbon flex items-center gap-1"><Plus size={11} /> Concluído</button>
                  <button onClick={() => addMarco('proximo')} className="text-[10px] text-ber-gray hover:text-ber-carbon flex items-center gap-1"><Plus size={11} /> Próximo</button>
                </div>
              </div>
              {form.marcos.map((m, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${m.tipo === 'concluido' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {m.tipo === 'concluido' ? 'CONCL.' : 'PRÓX.'}
                  </span>
                  <input value={m.nome} onChange={e => updateMarco(i, 'nome', e.target.value)} placeholder="Nome do marco"
                    className="flex-1 rounded-lg border border-ber-border px-2 py-1.5 text-sm focus:outline-none focus:border-ber-carbon" />
                  <input type="date" value={m.data} onChange={e => updateMarco(i, 'data', e.target.value)}
                    className="rounded-lg border border-ber-border px-2 py-1.5 text-sm focus:outline-none focus:border-ber-carbon" />
                  <button onClick={() => removeMarco(i)} className="text-ber-gray/40 hover:text-red-500"><X size={14} /></button>
                </div>
              ))}
            </div>

            {/* Pendências do cliente */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[9px] font-bold uppercase tracking-widest text-ber-gray">Pendências do cliente</label>
                <button onClick={addPendencia} className="text-[10px] text-ber-gray hover:text-ber-carbon flex items-center gap-1"><Plus size={11} /> Adicionar</button>
              </div>
              {form.pendencias.map((p, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input value={p.descricao} onChange={e => updatePendencia(i, 'descricao', e.target.value)} placeholder="Descreva a pendência..."
                    className="flex-1 rounded-lg border border-ber-border px-2 py-1.5 text-sm focus:outline-none focus:border-ber-carbon" />
                  <input value={p.responsavel ?? ''} onChange={e => updatePendencia(i, 'responsavel', e.target.value)} placeholder="Responsável"
                    className="w-32 rounded-lg border border-ber-border px-2 py-1.5 text-sm focus:outline-none focus:border-ber-carbon" />
                  <button onClick={() => removePendencia(i)} className="text-ber-gray/40 hover:text-red-500"><X size={14} /></button>
                </div>
              ))}
            </div>

            {/* Fotos — apenas quando editando (precisa do relatorioId para upload) */}
            {editing && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-ber-gray">Fotos do período</label>
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
                {!editing && <p className="text-[10px] text-ber-gray/40 mt-1">Salve o relatório primeiro para adicionar fotos.</p>}
              </div>
            )}

          </div>

          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-ber-border bg-[#F7F7F5]">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-ber-gray hover:text-ber-carbon transition-colors">Cancelar</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-ber-carbon text-white text-sm font-semibold hover:bg-ber-carbon/80 disabled:opacity-50 transition-colors">
              {saving ? 'Salvando...' : 'Salvar relatório'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
