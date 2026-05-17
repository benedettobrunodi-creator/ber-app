'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import { Plus, ChevronRight, ChevronLeft, Clock, X, AlertCircle, TriangleAlert, Phone, Mail, MapPin, Users, CheckCircle2, Circle, LayoutGrid, CalendarDays } from 'lucide-react';
import { ETAPAS, ETAPA_MAP, ORIGENS, PROBABILIDADES, SEGMENTOS, TIPOS_ATIVIDADE, Oportunidade, Atividade, Empresa, User, fmt, fmtDate, diasAtras } from '../types';

const KANBAN_ETAPAS = ETAPAS.filter((e) => e.value !== 'perdido');

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

function MoneyInput({ value, onChange, placeholder, className }: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const n = Number(value.replace(',', '.'));
  const display = editing || !value ? value : BRL.format(isNaN(n) ? 0 : n);
  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      value={display}
      placeholder={placeholder ?? 'R$ 0,00'}
      onFocus={(e) => { setEditing(true); e.target.select(); }}
      onBlur={() => setEditing(false)}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ''))}
    />
  );
}

interface Props {
  oportunidades: Oportunidade[];
  empresas: Empresa[];
  users: User[];
  onRefresh: () => void;
}

const ETAPAS_FORECAST = ['qualificacao', 'proposta_producao', 'proposta_enviada', 'negociacao', 'ganho'];

function forecastGaps(op: Oportunidade): string[] {
  if (!ETAPAS_FORECAST.includes(op.etapa)) return [];
  const gaps: string[] = [];
  if (!op.valor) gaps.push('valor');
  if (!op.dataFechamentoPrevisto) gaps.push('fechamento');
  if (!op.probabilidade) gaps.push('prob.');
  return gaps;
}

function CardOportunidade({
  op,
  onClick,
  onMove,
  canMoveLeft,
  canMoveRight,
}: {
  op: Oportunidade;
  onClick: () => void;
  onMove: (dir: 'left' | 'right') => void;
  canMoveLeft: boolean;
  canMoveRight: boolean;
}) {
  const proximaAtividade = op.atividades?.[0];
  const vencida = proximaAtividade && new Date(proximaAtividade.dataHora) < new Date();
  const gaps = forecastGaps(op);

  return (
    <div className={`bg-white border rounded-lg p-3 hover:shadow-md transition-all group ${gaps.length ? 'border-amber-300 hover:border-amber-400' : 'border-ber-border hover:border-ber-teal/40'}`}>
      <div onClick={onClick} className="cursor-pointer">
        <p className="text-sm font-semibold text-ber-carbon leading-tight line-clamp-2 group-hover:text-ber-teal">
          {op.titulo}
        </p>
        {op.empresa && (
          <p className="mt-1 text-xs text-ber-gray truncate">{op.empresa.razaoSocial}</p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs font-bold text-ber-carbon">{fmt(op.valor)}</span>
          {op.origem && (
            <span className="text-[10px] bg-ber-surface text-ber-gray px-1.5 py-0.5 rounded capitalize">
              {ORIGENS.find((o) => o.value === op.origem)?.label ?? op.origem}
            </span>
          )}
        </div>
        {proximaAtividade && (
          <div className={`mt-2 flex items-center gap-1 text-[11px] ${vencida ? 'text-ber-red' : 'text-ber-gray'}`}>
            {vencida ? <AlertCircle size={11} /> : <Clock size={11} />}
            <span className="truncate">{proximaAtividade.notas ?? proximaAtividade.tipo}</span>
            <span className="ml-auto shrink-0">{fmtDate(proximaAtividade.dataHora)}</span>
          </div>
        )}
        {op.responsavel && (
          <div className="mt-2 flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-ber-teal/20 flex items-center justify-center text-[9px] font-bold text-ber-teal shrink-0">
              {op.responsavel.name.charAt(0)}
            </div>
            <span className="text-[10px] text-ber-gray truncate">{op.responsavel.name}</span>
          </div>
        )}
        {gaps.length > 0 && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-600">
            <TriangleAlert size={10} className="shrink-0" />
            <span>Forecast incompleto: {gaps.join(', ')}</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onMove('left'); }}
          disabled={!canMoveLeft}
          className="p-1 rounded hover:bg-ber-surface disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={14} className="text-ber-gray" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMove('right'); }}
          disabled={!canMoveRight}
          className="p-1 rounded hover:bg-ber-surface disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronRight size={14} className="text-ber-gray" />
        </button>
      </div>
    </div>
  );
}

function OportunidadeDrawer({
  op,
  empresas,
  users,
  onClose,
  onSave,
}: {
  op: Oportunidade | null;
  empresas: Empresa[];
  users: User[];
  onClose: () => void;
  onSave: () => void;
}) {
  const isNew = !op?.id;
  const [form, setForm] = useState({
    titulo: op?.titulo ?? op?.orcamento?.cliente ?? '',
    valor: op?.valor != null ? String(Number(op.valor) || '') : (op?.orcamento?.valorVenda != null ? String(Number(op.orcamento.valorVenda) || '') : ''),
    m2: op?.orcamento?.m2 != null ? String(op.orcamento.m2) : '',
    etapa: op?.etapa ?? 'lead',
    origem: op?.origem ?? '',
    probabilidade: op?.probabilidade ?? '',
    responsavelId: op?.responsavel?.id ?? '',
    empresaId: op?.empresa?.id ?? '',
    contatoId: op?.contato?.id ?? '',
    dataFechamentoPrevisto: op?.dataFechamentoPrevisto ? String(op.dataFechamentoPrevisto).slice(0, 10) : '',
    motivoPerda: op?.motivoPerda ?? '',
    observacoes: op?.observacoes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [empresasLocal, setEmpresasLocal] = useState<Empresa[]>(empresas);
  const [novaEmpresaMode, setNovaEmpresaMode] = useState(false);
  const [novaEmpresaForm, setNovaEmpresaForm] = useState({ razaoSocial: '', segmento: '' });
  const [criandoEmpresa, setCriandoEmpresa] = useState(false);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [novaAtividade, setNovaAtividade] = useState(false);
  const [atForm, setAtForm] = useState({ tipo: 'reuniao', dataHora: '', notas: '', concluida: false });
  const [savingAt, setSavingAt] = useState(false);

  useEffect(() => {
    if (!op?.id) return;
    api.get(`/crm/atividades?oportunidadeId=${op.id}`).then((res) => {
      setAtividades(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {});
    // default datetime to now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setAtForm((f) => ({ ...f, dataHora: now.toISOString().slice(0, 16) }));
  }, [op?.id]);

  const handleSaveAtividade = async () => {
    if (!atForm.dataHora) return;
    setSavingAt(true);
    try {
      const res = await api.post('/crm/atividades', { ...atForm, oportunidadeId: op!.id, duracao: null });
      setAtividades((prev) => [res.data, ...prev]);
      setNovaAtividade(false);
    } finally {
      setSavingAt(false);
    }
  };

  const toggleAtividade = async (a: Atividade) => {
    await api.patch(`/crm/atividades/${a.id}`, { concluida: !a.concluida });
    setAtividades((prev) => prev.map((x) => x.id === a.id ? { ...x, concluida: !x.concluida } : x));
  };

  const handleCriarEmpresa = async () => {
    if (!novaEmpresaForm.razaoSocial.trim()) return;
    setCriandoEmpresa(true);
    try {
      const res = await api.post('/crm/empresas', {
        razaoSocial: novaEmpresaForm.razaoSocial.trim(),
        segmento: novaEmpresaForm.segmento || null,
      });
      const criada: Empresa = res.data;
      setEmpresasLocal((prev) => [...prev, { ...criada, contatos: [] }]);
      setForm((f) => ({ ...f, empresaId: criada.id, contatoId: '' }));
      setNovaEmpresaMode(false);
      setNovaEmpresaForm({ razaoSocial: '', segmento: '' });
    } catch {
      /* silently ignore — empresa create failure shouldn't block oportunidade save */
    } finally {
      setCriandoEmpresa(false);
    }
  };

  const empresaSelecionada = empresasLocal.find((e) => e.id === form.empresaId);
  const contatosDaEmpresa = empresaSelecionada?.contatos ?? [];

  const handleSave = async () => {
    if (!form.titulo.trim()) { setErr('Título obrigatório'); return; }
    setSaving(true);
    setErr('');
    try {
      const payload = {
        titulo: form.titulo,
        valor: form.valor ? Number(form.valor) : null,
        etapa: form.etapa,
        origem: form.origem || null,
        probabilidade: form.probabilidade || null,
        responsavelId: form.responsavelId || null,
        empresaId: form.empresaId || null,
        contatoId: form.contatoId || null,
        dataFechamentoPrevisto: form.dataFechamentoPrevisto || null,
        motivoPerda: form.etapa === 'perdido' ? (form.motivoPerda || null) : null,
        observacoes: form.observacoes || null,
      };
      if (isNew) {
        await api.post('/crm/oportunidades', payload);
      } else {
        await api.patch(`/crm/oportunidades/${op!.id}`, payload);
        // Sync orcamento vinculado — non-fatal; schema rejeita 0 e null
        if (op?.orcamento?.id) {
          try {
            const orcPayload: Record<string, unknown> = { cliente: form.titulo };
            const v = Number(form.valor); if (v > 0) orcPayload.valorVenda = v;
            const m = Number(form.m2);   if (m > 0) orcPayload.m2 = m;
            await api.patch(`/orcamentos/${op.orcamento.id}`, orcPayload);
          } catch { /* não bloqueia */ }
        }
      }
      onSave();
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white shadow-xl flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-ber-border">
          <h2 className="font-bold text-ber-carbon">{isNew ? 'Nova Oportunidade' : 'Editar Oportunidade'}</h2>
          <button onClick={onClose} className="text-ber-gray hover:text-ber-carbon"><X size={18} /></button>
        </div>
        <div className="flex-1 p-4 space-y-4">
          {err && <p className="text-xs text-ber-red">{err}</p>}
          <div>
            <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Título *</label>
            <input
              className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Valor</label>
              <MoneyInput
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                value={form.valor}
                onChange={(v) => setForm((f) => ({ ...f, valor: v }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">M²</label>
              <input
                type="number"
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                placeholder="0"
                value={form.m2}
                onChange={(e) => setForm((f) => ({ ...f, m2: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Fechamento</label>
              <input
                type="date"
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                value={form.dataFechamentoPrevisto}
                onChange={(e) => setForm((f) => ({ ...f, dataFechamentoPrevisto: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Etapa</label>
              <select
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                value={form.etapa}
                onChange={(e) => setForm((f) => ({ ...f, etapa: e.target.value }))}
              >
                {ETAPAS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Origem</label>
              <select
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                value={form.origem}
                onChange={(e) => setForm((f) => ({ ...f, origem: e.target.value }))}
              >
                <option value="">--</option>
                {ORIGENS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Probabilidade</label>
              <select
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                value={form.probabilidade}
                onChange={(e) => setForm((f) => ({ ...f, probabilidade: e.target.value }))}
              >
                <option value="">--</option>
                {PROBABILIDADES.map((p) => <option key={p.value} value={p.value}>{p.label} ({p.pct}%)</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Responsável</label>
              <select
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                value={form.responsavelId}
                onChange={(e) => setForm((f) => ({ ...f, responsavelId: e.target.value }))}
              >
                <option value="">--</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Empresa</label>
            <select
              className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
              value={form.empresaId}
              onChange={(e) => {
                if (e.target.value === '__nova__') {
                  setNovaEmpresaMode(true);
                  setForm((f) => ({ ...f, empresaId: '', contatoId: '' }));
                } else {
                  setNovaEmpresaMode(false);
                  setForm((f) => ({ ...f, empresaId: e.target.value, contatoId: '' }));
                }
              }}
            >
              <option value="">-- nenhuma --</option>
              {empresasLocal.map((e) => (
                <option key={e.id} value={e.id}>{e.razaoSocial}{e.segmento ? ` · ${e.segmento}` : ''}</option>
              ))}
              <option value="__nova__">➕ Nova empresa...</option>
            </select>

            {novaEmpresaMode && (
              <div className="mt-2 p-3 bg-ber-surface border border-ber-border rounded-xl space-y-2">
                <p className="text-[10px] font-semibold text-ber-gray uppercase tracking-wide">Nova empresa</p>
                <input
                  autoFocus
                  className="w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                  placeholder="Razão social *"
                  value={novaEmpresaForm.razaoSocial}
                  onChange={(e) => setNovaEmpresaForm((f) => ({ ...f, razaoSocial: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleCriarEmpresa()}
                />
                <select
                  className="w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                  value={novaEmpresaForm.segmento}
                  onChange={(e) => setNovaEmpresaForm((f) => ({ ...f, segmento: e.target.value }))}
                >
                  <option value="">Segmento (opcional)</option>
                  {SEGMENTOS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setNovaEmpresaMode(false); setNovaEmpresaForm({ razaoSocial: '', segmento: '' }); }}
                    className="flex-1 py-1.5 text-xs text-ber-gray border border-ber-border rounded-lg hover:bg-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCriarEmpresa}
                    disabled={criandoEmpresa || !novaEmpresaForm.razaoSocial.trim()}
                    className="flex-1 py-1.5 text-xs text-white bg-ber-teal rounded-lg font-semibold hover:bg-ber-teal/80 disabled:opacity-50"
                  >
                    {criandoEmpresa ? 'Criando...' : 'Criar empresa'}
                  </button>
                </div>
              </div>
            )}
          </div>
          {contatosDaEmpresa.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Contato</label>
              <select
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                value={form.contatoId}
                onChange={(e) => setForm((f) => ({ ...f, contatoId: e.target.value }))}
              >
                <option value="">-- nenhum --</option>
                {contatosDaEmpresa.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}{c.cargo ? ` · ${c.cargo}` : ''}</option>
                ))}
              </select>
            </div>
          )}
          {form.etapa === 'perdido' && (
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Motivo da perda</label>
              <textarea
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal resize-none"
                rows={2}
                placeholder="Ex: preço, concorrente, prazo..."
                value={form.motivoPerda}
                onChange={(e) => setForm((f) => ({ ...f, motivoPerda: e.target.value }))}
              />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Observações</label>
            <textarea
              className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal resize-none"
              rows={3}
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            />
          </div>
          {!isNew && (
            <div className="border-t border-ber-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Atividades</p>
                {!novaAtividade && (
                  <button onClick={() => setNovaAtividade(true)} className="flex items-center gap-1 text-xs text-ber-teal hover:underline">
                    <Plus size={12} /> Nova
                  </button>
                )}
              </div>

              {novaAtividade && (
                <div className="mb-3 p-3 bg-ber-surface border border-ber-border rounded-xl space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-ber-gray uppercase">Tipo</label>
                      <select className="mt-1 w-full border border-ber-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-ber-teal" value={atForm.tipo} onChange={(e) => setAtForm((f) => ({ ...f, tipo: e.target.value }))}>
                        {TIPOS_ATIVIDADE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-ber-gray uppercase">Data e Hora</label>
                      <input type="datetime-local" className="mt-1 w-full border border-ber-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-ber-teal" value={atForm.dataHora} onChange={(e) => setAtForm((f) => ({ ...f, dataHora: e.target.value }))} />
                    </div>
                  </div>
                  <textarea className="w-full border border-ber-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-ber-teal resize-none" rows={2} placeholder="Notas..." value={atForm.notas} onChange={(e) => setAtForm((f) => ({ ...f, notas: e.target.value }))} />
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="at-concluida" checked={atForm.concluida} onChange={(e) => setAtForm((f) => ({ ...f, concluida: e.target.checked }))} className="w-3.5 h-3.5" />
                    <label htmlFor="at-concluida" className="text-xs text-ber-carbon">Já concluída</label>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setNovaAtividade(false)} className="flex-1 py-1.5 text-xs border border-ber-border rounded-lg text-ber-gray hover:bg-white">Cancelar</button>
                    <button onClick={handleSaveAtividade} disabled={savingAt || !atForm.dataHora} className="flex-1 py-1.5 text-xs bg-ber-teal text-white rounded-lg font-semibold disabled:opacity-50">
                      {savingAt ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {atividades.slice(0, 5).map((a) => (
                  <div key={a.id} className="flex items-start gap-2">
                    <button onClick={() => toggleAtividade(a)} className={`mt-0.5 shrink-0 ${a.concluida ? 'text-ber-green' : 'text-ber-gray/40 hover:text-ber-teal'}`}>
                      {a.concluida ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${a.concluida ? 'line-through text-ber-gray' : 'text-ber-carbon'}`}>
                        {TIPOS_ATIVIDADE.find((t) => t.value === a.tipo)?.label ?? a.tipo}
                        <span className="ml-2 font-normal text-ber-gray">{fmtDate(a.dataHora)}</span>
                      </p>
                      {a.notas && <p className="text-xs text-ber-gray truncate">{a.notas}</p>}
                    </div>
                  </div>
                ))}
                {atividades.length === 0 && !novaAtividade && (
                  <p className="text-xs text-ber-gray/50">Nenhuma atividade registrada</p>
                )}
              </div>
            </div>
          )}

          {op?.orcamento && (
            <div className="rounded-lg border border-ber-border bg-ber-surface p-3">
              <p className="text-xs font-semibold text-ber-gray uppercase tracking-wide mb-1">Orçamento Vinculado</p>
              <p className="text-sm font-bold text-ber-carbon">{op.orcamento.numero}</p>
              <p className="text-xs text-ber-gray">{op.orcamento.status}</p>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-ber-border flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 border border-ber-border rounded-lg text-sm text-ber-gray hover:bg-ber-surface">Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-ber-teal text-white rounded-lg text-sm font-semibold hover:bg-ber-teal/80 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function MesAMesView({
  oportunidades,
  onCardClick,
}: {
  oportunidades: Oportunidade[];
  onCardClick: (op: Oportunidade) => void;
}) {
  const ativas = oportunidades.filter((o) => !['ganho', 'perdido'].includes(o.etapa));
  const ano = new Date().getFullYear();

  const meses = useMemo(() => {
    const map: Record<number, Oportunidade[]> = {};
    for (let i = 1; i <= 12; i++) map[i] = [];

    for (const op of ativas) {
      if (!op.dataFechamentoPrevisto) {
        (map[0] ??= []).push(op);
        continue;
      }
      const d = new Date(op.dataFechamentoPrevisto);
      const m = d.getMonth() + 1;
      (map[m] ??= []).push(op);
    }
    return map;
  }, [ativas]);

  const semData = meses[0] ?? [];

  return (
    <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => {
        const cards = meses[mes] ?? [];
        const totalValor = cards.reduce((s, c) => s + Number(c.valor ?? 0), 0);
        const label = `${MESES_LABEL[mes - 1]} ${ano}`;
        const isPassado = mes < new Date().getMonth() + 1;
        return (
          <div key={mes} className="flex-shrink-0 w-64 flex flex-col">
            <div className={`mb-2 px-3 py-2 rounded-xl border ${isPassado ? 'bg-ber-surface border-ber-border' : 'bg-white border-ber-border'}`}>
              <p className={`text-xs font-bold uppercase tracking-wide ${isPassado ? 'text-ber-gray' : 'text-ber-carbon'}`}>{label}</p>
              <p className="text-base font-bold text-ber-teal mt-0.5">{totalValor > 0 ? fmt(totalValor) : <span className="text-ber-gray/40 font-normal text-xs">sem valor</span>}</p>
              <p className="text-[10px] text-ber-gray">{cards.length} oportunidade{cards.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex-1 bg-ber-surface rounded-xl p-2 space-y-2 overflow-y-auto">
              {cards.map((op) => {
                const etapa = ETAPA_MAP[op.etapa as keyof typeof ETAPA_MAP];
                return (
                  <div
                    key={op.id}
                    onClick={() => onCardClick(op)}
                    className="bg-white border border-ber-border rounded-lg p-3 cursor-pointer hover:border-ber-teal/40 hover:shadow-sm transition-all"
                  >
                    <p className="text-sm font-semibold text-ber-carbon leading-tight line-clamp-2">{op.titulo}</p>
                    {op.empresa && <p className="mt-1 text-xs text-ber-gray truncate">{op.empresa.razaoSocial}</p>}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-ber-carbon">{op.valor != null ? fmt(op.valor) : '--'}</span>
                      {etapa && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ backgroundColor: etapa.color + '20', color: etapa.color }}
                        >
                          {etapa.label}
                        </span>
                      )}
                    </div>
                    {op.responsavel && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-ber-teal/20 flex items-center justify-center text-[9px] font-bold text-ber-teal shrink-0">
                          {op.responsavel.name.charAt(0)}
                        </div>
                        <span className="text-[10px] text-ber-gray truncate">{op.responsavel.name}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {cards.length === 0 && (
                <p className="text-center text-xs text-ber-gray/40 py-4">—</p>
              )}
            </div>
          </div>
        );
      })}

      {semData.length > 0 && (
        <div className="flex-shrink-0 w-64 flex flex-col">
          <div className="mb-2 px-3 py-2 rounded-xl border bg-amber-50 border-amber-200">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Sem data</p>
            <p className="text-base font-bold text-amber-600 mt-0.5">
              {fmt(semData.reduce((s, c) => s + Number(c.valor ?? 0), 0))}
            </p>
            <p className="text-[10px] text-amber-600">{semData.length} oportunidade{semData.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex-1 bg-amber-50/50 rounded-xl p-2 space-y-2 overflow-y-auto">
            {semData.map((op) => (
              <div
                key={op.id}
                onClick={() => onCardClick(op)}
                className="bg-white border border-amber-200 rounded-lg p-3 cursor-pointer hover:border-amber-400 hover:shadow-sm transition-all"
              >
                <p className="text-sm font-semibold text-ber-carbon leading-tight line-clamp-2">{op.titulo}</p>
                {op.empresa && <p className="mt-1 text-xs text-ber-gray truncate">{op.empresa.razaoSocial}</p>}
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs font-bold text-ber-carbon">{op.valor != null ? fmt(op.valor) : '--'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TabPipeline({ oportunidades, empresas, users, onRefresh }: Props) {
  const [drawerOp, setDrawerOp] = useState<Oportunidade | null | 'new'>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'mes'>('kanban');

  const semForecast = oportunidades.filter(
    (op) => !['ganho', 'perdido'].includes(op.etapa) && forecastGaps(op).length > 0
  ).length;

  const grouped = useCallback(() => {
    const map: Record<string, Oportunidade[]> = {};
    for (const e of KANBAN_ETAPAS) map[e.value] = [];
    for (const op of oportunidades) {
      if (map[op.etapa]) map[op.etapa].push(op);
      else if (op.etapa !== 'perdido') map['lead'].push(op);
    }
    return map;
  }, [oportunidades]);

  const byEtapa = grouped();

  const handleMoveEtapa = async (opId: string, etapa: string) => {
    await api.patch(`/crm/oportunidades/${opId}`, { etapa });
    onRefresh();
  };

  return (
    <div className="flex-1 min-h-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-ber-carbon">Pipeline</h2>
          <span className="text-xs text-ber-gray bg-ber-surface px-2 py-0.5 rounded-full">
            {oportunidades.filter((o) => !['ganho', 'perdido'].includes(o.etapa)).length} ativos
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-ber-surface border border-ber-border rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${viewMode === 'kanban' ? 'bg-white text-ber-carbon shadow-sm' : 'text-ber-gray hover:text-ber-carbon'}`}
            >
              <LayoutGrid size={13} /> Etapas
            </button>
            <button
              onClick={() => setViewMode('mes')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${viewMode === 'mes' ? 'bg-white text-ber-carbon shadow-sm' : 'text-ber-gray hover:text-ber-carbon'}`}
            >
              <CalendarDays size={13} /> Mês a mês
            </button>
          </div>
          <button
            onClick={() => setDrawerOp('new')}
            className="flex items-center gap-1.5 bg-ber-teal text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-ber-teal/80"
          >
            <Plus size={14} /> Nova
          </button>
        </div>
      </div>

      {semForecast > 0 && !alertDismissed && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
          <TriangleAlert size={14} className="shrink-0 text-amber-500" />
          <span>
            <strong>{semForecast}</strong> oportunidade{semForecast > 1 ? 's' : ''} sem dados completos para o forecast
            {' '}(valor, data de fechamento ou probabilidade). Abra o card e preencha.
          </span>
          <button onClick={() => setAlertDismissed(true)} className="ml-auto shrink-0 text-amber-400 hover:text-amber-600">
            <X size={14} />
          </button>
        </div>
      )}

      {viewMode === 'mes' ? (
        <MesAMesView oportunidades={oportunidades} onCardClick={(op) => setDrawerOp(op)} />
      ) : (
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
        {KANBAN_ETAPAS.map((etapa) => {
          const cards = byEtapa[etapa.value] ?? [];
          const totalValor = cards.reduce((s, c) => s + (c.valor ?? 0), 0);
          return (
            <div key={etapa.value} className="flex-shrink-0 w-64 flex flex-col">
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: etapa.color }} />
                <span className="text-xs font-bold text-ber-carbon uppercase tracking-wide">{etapa.label}</span>
                <span className="ml-auto text-xs text-ber-gray bg-ber-surface rounded-full px-1.5">{cards.length}</span>
              </div>
              {totalValor > 0 && (
                <p className="text-[11px] text-ber-gray px-1 mb-2">{fmt(totalValor)}</p>
              )}
              <div className="flex-1 bg-ber-surface rounded-xl p-2 space-y-2 overflow-y-auto">
                {cards.map((op) => {
                  const idx = KANBAN_ETAPAS.findIndex((e) => e.value === etapa.value);
                  return (
                    <CardOportunidade
                      key={op.id}
                      op={op}
                      onClick={() => setDrawerOp(op)}
                      onMove={(dir) => handleMoveEtapa(op.id, KANBAN_ETAPAS[dir === 'left' ? idx - 1 : idx + 1].value)}
                      canMoveLeft={idx > 0}
                      canMoveRight={idx < KANBAN_ETAPAS.length - 1}
                    />
                  );
                })}
                {cards.length === 0 && (
                  <p className="text-center text-xs text-ber-gray/50 py-4">Vazio</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {drawerOp !== null && (
        <OportunidadeDrawer
          op={drawerOp === 'new' ? null : drawerOp}
          empresas={empresas}
          users={users}
          onClose={() => setDrawerOp(null)}
          onSave={() => { setDrawerOp(null); onRefresh(); }}
        />
      )}
    </div>
  );
}
