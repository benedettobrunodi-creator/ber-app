'use client';

import { useState, useCallback, useEffect, Component, useMemo } from 'react';
import type { ReactNode } from 'react';
import api from '@/lib/api';
import { Plus, Clock, X, AlertCircle, Trash2, LayoutGrid, LayoutList, User as UserIcon, ChevronUp, ChevronDown, ChevronsUpDown, Search, SlidersHorizontal } from 'lucide-react';
import { ETAPAS, ETAPA_MAP, ORIGENS, PROBABILIDADES, SEGMENTOS, TIPOS_ATIVIDADE, Oportunidade, Atividade, Contato, User, fmt, fmtDate, diasAtras } from '../types';

class DrawerBoundary extends Component<{ children: ReactNode; onClose: () => void }, { err: string | null }> {
  state = { err: null };
  static getDerivedStateFromError(e: Error) { return { err: e.message }; }
  render() {
    if (this.state.err) {
      return (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={this.props.onClose} />
          <div className="relative z-10 w-full max-w-md bg-white shadow-xl p-6 flex flex-col gap-4">
            <p className="font-bold text-red-600">Erro ao abrir</p>
            <p className="text-sm text-red-500 font-mono break-all">{this.state.err}</p>
            <button onClick={this.props.onClose} className="self-start px-4 py-2 bg-gray-100 rounded-lg text-sm">Fechar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const TERMINAL_ETAPAS = ['ganho', 'perdido', 'declinado', 'cancelado'];
const ETAPAS_PERDIDAS = ['perdido', 'declinado', 'cancelado'];
const KANBAN_ETAPAS = ETAPAS.filter((e) => !TERMINAL_ETAPAS.includes(e.value));

interface Props {
  oportunidades: Oportunidade[];
  users: User[];
  onRefresh: () => void;
}

function CardOportunidade({
  op,
  onClick,
}: {
  op: Oportunidade;
  onClick: () => void;
}) {
  const proximaAtividade = op.atividades?.[0];
  const vencida = proximaAtividade && new Date(proximaAtividade.dataHora) < new Date();

  return (
    <div
      onClick={onClick}
      className="bg-white border border-ber-border rounded-lg p-3 cursor-pointer hover:shadow-md hover:border-ber-teal/40 transition-all group"
    >
      <p className="text-sm font-semibold text-ber-carbon leading-tight line-clamp-2 group-hover:text-ber-teal">
        {op.titulo}
      </p>
      <div className="mt-1 flex items-center gap-1.5 min-w-0">
        {op.empresa && (
          <p className="text-xs text-ber-gray truncate">{op.empresa.razaoSocial}</p>
        )}
        {op.empresa?.segmento && (
          <span className="text-[10px] bg-ber-surface text-ber-gray px-1 py-0.5 rounded shrink-0">{op.empresa.segmento}</span>
        )}
      </div>
      {op.contato && (
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ber-gray/80">
          <UserIcon size={10} className="shrink-0" />
          <span className="truncate">{op.contato.nome}{op.contato.cargo ? ` · ${op.contato.cargo}` : ''}</span>
        </div>
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
      {op.orcamento && (
        <div className="mt-2 flex items-center gap-1">
          <span className="text-[10px] font-semibold bg-[#06A99D]/10 text-[#06A99D] px-2 py-0.5 rounded-full">
            ORC {op.orcamento.numero}
          </span>
        </div>
      )}
      {op.motivoPerda && (
        <p className="mt-2 text-[11px] text-ber-red/80 italic line-clamp-2">"{op.motivoPerda}"</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-ber-gray/60">toque {diasAtras(op.updatedAt)}</span>
        {op.dataFechamentoPrevisto && (
          <span className="text-[10px] text-ber-gray/60">↗ {fmtDate(op.dataFechamentoPrevisto)}</span>
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
}

function OportunidadeDrawer({
  op,
  users,
  onClose,
  onSave,
}: {
  op: Oportunidade | null;
  users: User[];
  onClose: () => void;
  onSave: () => void;
}) {
  const isNew = !op?.id;
  const [form, setForm] = useState({
    titulo: op?.titulo ?? '',
    valor: op?.valor?.toString() ?? '',
    etapa: op?.etapa ?? 'lead',
    origem: op?.origem ?? '',
    probabilidade: op?.probabilidade ?? '',
    responsavelId: op?.responsavel?.id ?? '',
    contatoId: op?.contato?.id ?? '',
    dataFechamentoPrevisto: op?.dataFechamentoPrevisto?.slice(0, 10) ?? '',
    dataGanho: op?.dataGanho?.slice(0, 10) ?? '',
    motivoPerda: op?.motivoPerda ?? '',
    observacoes: op?.observacoes ?? '',
    segmento: op?.empresa?.segmento ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [err, setErr] = useState('');
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [showCriarOrc, setShowCriarOrc] = useState(false);
  const [novoOrcNumero, setNovoOrcNumero] = useState('');
  const [criandoOrc, setCriandoOrc] = useState(false);
  const [orcamentoVinculado, setOrcamentoVinculado] = useState(op?.orcamento ?? null);
  const [historico, setHistorico] = useState<Atividade[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [novaAtiv, setNovaAtiv] = useState({ tipo: 'ligacao', notas: '', dataHora: new Date().toISOString().slice(0, 16) });
  const [savingAtiv, setSavingAtiv] = useState(false);

  useEffect(() => {
    if (op?.empresa?.id) {
      api.get(`/crm/contatos?empresaId=${op.empresa.id}`)
        .then((r) => setContatos(r.data))
        .catch(() => {});
    }
  }, [op?.empresa?.id]);

  useEffect(() => {
    if (!op?.id) return;
    setLoadingHist(true);
    api.get(`/crm/atividades?oportunidadeId=${op.id}`)
      .then(r => setHistorico(r.data.data ?? r.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingHist(false));
  }, [op?.id]);

  async function registrarAtividade() {
    if (!op?.id || !novaAtiv.notas.trim()) return;
    setSavingAtiv(true);
    try {
      const res = await api.post('/crm/atividades', {
        oportunidadeId: op.id,
        tipo: novaAtiv.tipo,
        dataHora: new Date(novaAtiv.dataHora).toISOString(),
        notas: novaAtiv.notas.trim(),
        concluida: true,
      });
      setHistorico(prev => [res.data.data ?? res.data, ...prev]);
      setNovaAtiv(f => ({ ...f, notas: '', dataHora: new Date().toISOString().slice(0, 16) }));
    } catch { setErr('Erro ao registrar atividade'); }
    setSavingAtiv(false);
  }

  const handleDelete = async () => {
    if (!op?.id) return;
    setDeleting(true);
    try {
      await api.delete(`/crm/oportunidades/${op.id}`);
      onSave();
    } catch {
      setErr('Erro ao excluir');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleCriarOrcamento = async () => {
    if (!op?.id || !novoOrcNumero.trim()) return;
    setCriandoOrc(true);
    try {
      const res = await api.post(`/crm/oportunidades/${op.id}/criar-orcamento`, {
        numero: novoOrcNumero.trim(),
      });
      setOrcamentoVinculado(res.data);
      setShowCriarOrc(false);
      setNovoOrcNumero('');
      onSave();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Erro ao criar orçamento');
    } finally {
      setCriandoOrc(false);
    }
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) { setErr('Título obrigatório'); return; }
    setSaving(true);
    try {
      const valorNum = form.valor ? Number(form.valor) : null;
      const isPerdido = form.etapa === 'perdido';
      if (isPerdido && !form.motivoPerda.trim()) {
        setErr('Informe o motivo da perda'); setSaving(false); return;
      }
      const payload = {
        titulo: form.titulo,
        etapa: form.etapa,
        valor: valorNum && valorNum > 0 ? valorNum : null,
        origem: form.origem || null,
        probabilidade: form.probabilidade || null,
        responsavelId: form.responsavelId || null,
        contatoId: form.contatoId || null,
        dataFechamentoPrevisto: form.dataFechamentoPrevisto || null,
        dataGanho: form.dataGanho || null,
        motivoPerda: isPerdido ? (form.motivoPerda.trim() || null) : null,
        observacoes: form.observacoes || null,
      };
      if (isNew) {
        await api.post('/crm/oportunidades', payload);
      } else {
        await api.patch(`/crm/oportunidades/${op!.id}`, payload);
        // Atualiza segmento da empresa se mudou
        if (op?.empresa?.id && form.segmento !== (op.empresa.segmento ?? '')) {
          await api.patch(`/crm/empresas/${op.empresa.id}`, {
            segmento: form.segmento || null,
          });
        }
      }
      onSave();
    } catch (e: any) {
      const details = e?.response?.data?.error?.details;
      if (details?.length) {
        setErr(details.map((d: any) => `${d.field}: ${d.message}`).join(' · '));
      } else {
        setErr(e?.response?.data?.error?.message ?? e?.message ?? 'Erro ao salvar');
      }
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Valor</label>
              <input
                type="number"
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                placeholder="R$"
                value={form.valor}
                onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Fechamento Previsto</label>
              <input
                type="date"
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                value={form.dataFechamentoPrevisto}
                onChange={(e) => setForm((f) => ({ ...f, dataFechamentoPrevisto: e.target.value }))}
              />
            </div>
          </div>
          {form.etapa === 'ganho' && (
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Data de Ganho</label>
              <input
                type="date"
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                value={form.dataGanho}
                onChange={(e) => setForm((f) => ({ ...f, dataGanho: e.target.value }))}
              />
              <p className="text-[10px] text-ber-gray mt-0.5">Usado no gráfico de Meta. Preenchido automaticamente ao marcar como Ganho.</p>
            </div>
          )}
          {form.etapa === 'perdido' && (
            <div>
              <label className="text-xs font-semibold text-ber-red uppercase tracking-wide">Motivo da Perda *</label>
              <select
                className="mt-1 w-full border border-ber-red/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-red bg-red-50/30"
                value={form.motivoPerda}
                onChange={(e) => setForm((f) => ({ ...f, motivoPerda: e.target.value }))}
              >
                <option value="">-- Selecione o motivo --</option>
                <option value="Preço">Preço</option>
                <option value="Escopo não aderente">Escopo não aderente</option>
                <option value="Relacionamento com concorrente">Relacionamento com concorrente</option>
                <option value="Apresentação / Proposta fraca">Apresentação / Proposta fraca</option>
                <option value="Decisão adiada">Decisão adiada</option>
                <option value="Sem resposta">Sem resposta</option>
              </select>
            </div>
          )}
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
          {/* Segmento — atualiza a empresa vinculada */}
          {(op?.empresa?.id || !isNew) && op?.empresa && (
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">
                Segmento
                <span className="ml-1 font-normal normal-case text-ber-gray/60">({op.empresa.razaoSocial})</span>
              </label>
              <select
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                value={form.segmento}
                onChange={(e) => setForm((f) => ({ ...f, segmento: e.target.value }))}
              >
                <option value="">-- Não definido --</option>
                {SEGMENTOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
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
            <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Contato</label>
            {contatos.length > 0 ? (
              <select
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                value={form.contatoId}
                onChange={(e) => setForm((f) => ({ ...f, contatoId: e.target.value }))}
              >
                <option value="">-- Sem contato --</option>
                {contatos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}{c.cargo ? ` · ${c.cargo}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-xs text-ber-gray/60 italic">
                {op?.empresa ? 'Nenhum contato cadastrado para esta empresa' : 'Vincule uma empresa para selecionar o contato'}
              </p>
            )}
          </div>
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
            <div className="rounded-lg border border-ber-border bg-ber-surface p-3 space-y-2">
              <p className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Orçamento</p>
              {orcamentoVinculado ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-ber-carbon">{orcamentoVinculado.numero}</p>
                    <p className="text-xs text-ber-gray">{orcamentoVinculado.cliente} · {orcamentoVinculado.status}</p>
                  </div>
                  <a
                    href="/comercial/orcamentos"
                    className="text-[11px] text-ber-teal hover:underline font-medium"
                  >
                    Ver esteira ↗
                  </a>
                </div>
              ) : showCriarOrc ? (
                <div className="space-y-2">
                  <input
                    className="w-full border border-ber-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-ber-teal"
                    placeholder="Número (ex: 582.26)"
                    value={novoOrcNumero}
                    onChange={(e) => setNovoOrcNumero(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCriarOrcamento}
                      disabled={criandoOrc || !novoOrcNumero.trim()}
                      className="flex-1 py-1.5 bg-ber-teal text-white rounded-lg text-xs font-semibold hover:bg-ber-teal/80 disabled:opacity-50"
                    >
                      {criandoOrc ? 'Criando...' : 'Criar orçamento'}
                    </button>
                    <button
                      onClick={() => { setShowCriarOrc(false); setNovoOrcNumero(''); }}
                      className="px-3 py-1.5 border border-ber-border rounded-lg text-xs text-ber-gray hover:bg-ber-surface"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCriarOrc(true)}
                  className="flex items-center gap-1 text-xs text-ber-teal hover:underline font-medium"
                >
                  <Plus size={11} /> Criar orçamento vinculado
                </button>
              )}
            </div>
          )}
          {/* ── Histórico de atividades ───────────────────────────────────── */}
          {!isNew && (
            <div className="border-t border-ber-border pt-4 mt-2">
              <p className="text-xs font-semibold text-ber-gray uppercase tracking-wide mb-3">Histórico de atividades</p>

              {/* Formulário para nova atividade */}
              <div className="rounded-lg border border-ber-border bg-[#F7F7F5] p-3 mb-3 space-y-2">
                <div className="flex gap-2">
                  <select value={novaAtiv.tipo} onChange={e => setNovaAtiv(f => ({ ...f, tipo: e.target.value }))}
                    className="border border-ber-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-ber-teal bg-white">
                    {TIPOS_ATIVIDADE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input type="datetime-local" value={novaAtiv.dataHora}
                    onChange={e => setNovaAtiv(f => ({ ...f, dataHora: e.target.value }))}
                    className="border border-ber-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-ber-teal bg-white flex-1" />
                </div>
                <textarea rows={2} value={novaAtiv.notas}
                  onChange={e => setNovaAtiv(f => ({ ...f, notas: e.target.value }))}
                  placeholder="Descreva o que foi feito..."
                  className="w-full border border-ber-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-ber-teal bg-white resize-none" />
                <button onClick={registrarAtividade} disabled={savingAtiv || !novaAtiv.notas.trim()}
                  className="w-full py-1.5 bg-ber-teal text-white rounded-lg text-xs font-semibold hover:bg-ber-teal/80 disabled:opacity-40">
                  {savingAtiv ? 'Registrando...' : 'Registrar atividade'}
                </button>
              </div>

              {/* Lista do histórico */}
              {loadingHist ? (
                <p className="text-xs text-ber-gray/50 text-center py-2">Carregando...</p>
              ) : historico.length === 0 ? (
                <p className="text-xs text-ber-gray/40 italic text-center py-2">Nenhuma atividade registrada ainda.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {historico.map(a => {
                    const tipo = TIPOS_ATIVIDADE.find(t => t.value === a.tipo);
                    return (
                      <div key={a.id} className="rounded-lg border border-ber-border bg-white px-3 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-ber-teal">{tipo?.label ?? a.tipo}</span>
                          <span className="text-[10px] text-ber-gray/60 ml-auto">{fmtDate(a.dataHora)}</span>
                          {a.usuario && <span className="text-[10px] text-ber-gray/50">{a.usuario.name.split(' ')[0]}</span>}
                        </div>
                        {a.notas && <p className="text-xs text-ber-carbon leading-relaxed">{a.notas}</p>}
                        {a.resultado && <p className="text-[10px] text-ber-gray mt-1 italic">Resultado: {a.resultado}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-ber-border space-y-2">
          {confirmDelete ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              <p className="font-semibold mb-2">Confirmar exclusão?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 py-1.5 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100">Cancelar</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50">
                  {deleting ? 'Excluindo...' : 'Excluir definitivamente'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {!isNew && (
                <button onClick={() => setConfirmDelete(true)} className="p-2 rounded-lg text-ber-gray hover:text-red-600 hover:bg-red-50 border border-ber-border transition-colors">
                  <Trash2 size={15} />
                </button>
              )}
              <button onClick={onClose} className="flex-1 py-2 border border-ber-border rounded-lg text-sm text-ber-gray hover:bg-ber-surface">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-ber-teal text-white rounded-lg text-sm font-semibold hover:bg-ber-teal/80 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type SortCol = 'titulo' | 'etapa' | 'empresa' | 'responsavel' | 'probabilidade' | 'valor';
type SortDir = 'asc' | 'desc';

const PROB_ORDER: Record<string, number> = { alta: 3, media: 2, baixa: 1 };
const ETAPA_ORDER = Object.fromEntries(ETAPAS.map((e, i) => [e.value, i]));

function sortOportunidades(ops: Oportunidade[], col: SortCol, dir: SortDir): Oportunidade[] {
  const d = dir === 'asc' ? 1 : -1;
  return [...ops].sort((a, b) => {
    switch (col) {
      case 'titulo':
        return d * (a.titulo ?? '').localeCompare(b.titulo ?? '', 'pt-BR');
      case 'etapa':
        return d * ((ETAPA_ORDER[a.etapa] ?? 99) - (ETAPA_ORDER[b.etapa] ?? 99));
      case 'empresa':
        return d * (a.empresa?.razaoSocial ?? '').localeCompare(b.empresa?.razaoSocial ?? '', 'pt-BR');
      case 'responsavel':
        return d * (a.responsavel?.name ?? '').localeCompare(b.responsavel?.name ?? '', 'pt-BR');
      case 'probabilidade':
        return d * ((PROB_ORDER[a.probabilidade ?? ''] ?? 0) - (PROB_ORDER[b.probabilidade ?? ''] ?? 0));
      case 'valor':
        return d * ((a.valor ?? 0) - (b.valor ?? 0));
      default:
        return 0;
    }
  });
}

interface Filters {
  search: string;
  etapa: string;
  responsavelId: string;
  probabilidade: string;
}

export default function TabPipeline({ oportunidades, users, onRefresh }: Props) {
  const [drawerOp, setDrawerOp] = useState<Oportunidade | null | 'new'>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'lista'>('kanban');
  const [sortCol, setSortCol] = useState<SortCol>('etapa');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filters, setFilters] = useState<Filters>({ search: '', etapa: '', responsavelId: '', probabilidade: '' });
  const [showFilters, setShowFilters] = useState(false);

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const filteredOps = useMemo(() => {
    let ops = oportunidades;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      ops = ops.filter(o =>
        o.titulo.toLowerCase().includes(q) ||
        (o.empresa?.razaoSocial ?? '').toLowerCase().includes(q)
      );
    }
    if (filters.etapa) ops = ops.filter(o => o.etapa === filters.etapa);
    if (filters.responsavelId) ops = ops.filter(o => o.responsavel?.id === filters.responsavelId);
    if (filters.probabilidade) ops = ops.filter(o => o.probabilidade === filters.probabilidade);
    return ops;
  }, [oportunidades, filters]);

  const activeFilterCount = [filters.etapa, filters.responsavelId, filters.probabilidade].filter(Boolean).length;

  const grouped = useCallback(() => {
    const map: Record<string, Oportunidade[]> = {};
    for (const e of KANBAN_ETAPAS) map[e.value] = [];
    for (const op of oportunidades) {
      if (map[op.etapa]) map[op.etapa].push(op);
      else if (!TERMINAL_ETAPAS.includes(op.etapa)) map['lead'].push(op);
    }
    return map;
  }, [oportunidades]);

  const byEtapa = grouped();
  const byTerminal = (etapa: string) =>
    oportunidades
      .filter((o) => o.etapa === etapa)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const ganhos     = byTerminal('ganho');
  const perdidos   = byTerminal('perdido');
  const declinados = byTerminal('declinado');
  const cancelados = byTerminal('cancelado');

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
            {oportunidades.filter((o) => !TERMINAL_ETAPAS.includes(o.etapa)).length} ativos
          </span>
          <span className="text-sm font-semibold text-ber-teal">
            {fmt(oportunidades.filter((o) => !TERMINAL_ETAPAS.includes(o.etapa)).reduce((s, o) => s + Number(o.valor ?? 0), 0))}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'lista' && (
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${showFilters || activeFilterCount > 0 ? 'border-ber-teal bg-ber-teal/10 text-ber-teal' : 'border-ber-border bg-white text-ber-gray hover:text-ber-carbon'}`}
            >
              <SlidersHorizontal size={13} />
              Filtros
              {activeFilterCount > 0 && (
                <span className="ml-0.5 rounded-full bg-ber-teal text-white text-[10px] w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>
              )}
            </button>
          )}
          <div className="flex items-center rounded-lg border border-ber-border bg-white p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              title="Kanban"
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${viewMode === 'kanban' ? 'bg-ber-teal text-white' : 'text-ber-gray hover:text-ber-carbon'}`}
            >
              <LayoutGrid size={12} /> Kanban
            </button>
            <button
              onClick={() => setViewMode('lista')}
              title="Lista"
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${viewMode === 'lista' ? 'bg-ber-teal text-white' : 'text-ber-gray hover:text-ber-carbon'}`}
            >
              <LayoutList size={12} /> Lista
            </button>
          </div>
          <button
            onClick={() => setDrawerOp('new')}
            className="flex items-center gap-1.5 bg-ber-teal text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-ber-teal/80"
          >
            <Plus size={14} /> Nova Oportunidade
          </button>
        </div>
      </div>

      {viewMode === 'lista' && (
        <>
          {/* Filter bar */}
          {showFilters && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-ber-border bg-white px-4 py-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ber-gray/50 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar título ou empresa…"
                  value={filters.search}
                  onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                  className="w-full rounded-lg border border-ber-border pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-ber-teal"
                />
              </div>
              <select
                value={filters.etapa}
                onChange={e => setFilters(f => ({ ...f, etapa: e.target.value }))}
                className="rounded-lg border border-ber-border px-2.5 py-1.5 text-xs focus:outline-none focus:border-ber-teal text-ber-carbon min-w-[130px]"
              >
                <option value="">Todas as etapas</option>
                {ETAPAS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
              <select
                value={filters.responsavelId}
                onChange={e => setFilters(f => ({ ...f, responsavelId: e.target.value }))}
                className="rounded-lg border border-ber-border px-2.5 py-1.5 text-xs focus:outline-none focus:border-ber-teal text-ber-carbon min-w-[130px]"
              >
                <option value="">Todos responsáveis</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <select
                value={filters.probabilidade}
                onChange={e => setFilters(f => ({ ...f, probabilidade: e.target.value }))}
                className="rounded-lg border border-ber-border px-2.5 py-1.5 text-xs focus:outline-none focus:border-ber-teal text-ber-carbon"
              >
                <option value="">Todas probabilidades</option>
                {PROBABILIDADES.map(p => <option key={p.value} value={p.value}>{p.label} ({p.pct}%)</option>)}
              </select>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => setFilters({ search: '', etapa: '', responsavelId: '', probabilidade: '' })}
                  className="text-xs text-ber-gray hover:text-red-500 whitespace-nowrap"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}

          <div className="rounded-xl border border-ber-border bg-white overflow-hidden mb-4">
            {/* Sortable header */}
            <div className="grid grid-cols-[1fr_130px_110px_90px_90px_80px] gap-3 px-4 py-2.5 bg-ber-surface border-b border-ber-border">
              {([
                ['titulo',       'Oportunidade',  'text-left'],
                ['etapa',        'Etapa',         'text-left'],
                ['empresa',      'Empresa',       'text-left'],
                ['responsavel',  'Responsável',   'text-left'],
                ['probabilidade','Probabilidade', 'text-left'],
                ['valor',        'Valor',         'text-right'],
              ] as [SortCol, string, string][]).map(([col, label, align]) => (
                <button
                  key={col}
                  onClick={() => toggleSort(col)}
                  className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-ber-gray hover:text-ber-carbon transition-colors ${align === 'text-right' ? 'justify-end' : 'justify-start'}`}
                >
                  {align === 'text-right' && (sortCol === col
                    ? (sortDir === 'asc' ? <ChevronUp size={11} className="text-ber-teal" /> : <ChevronDown size={11} className="text-ber-teal" />)
                    : <ChevronsUpDown size={11} className="opacity-30" />
                  )}
                  <span className={sortCol === col ? 'text-ber-carbon' : ''}>{label}</span>
                  {align !== 'text-right' && (sortCol === col
                    ? (sortDir === 'asc' ? <ChevronUp size={11} className="text-ber-teal" /> : <ChevronDown size={11} className="text-ber-teal" />)
                    : <ChevronsUpDown size={11} className="opacity-30" />
                  )}
                </button>
              ))}
            </div>

            {filteredOps.length === 0 && (
              <p className="text-center text-xs text-ber-gray py-10">Nenhuma oportunidade.</p>
            )}
            {sortOportunidades(filteredOps, sortCol, sortDir).map((op) => {
              const etapaCfg = ETAPA_MAP[op.etapa];
              const probCfg = PROBABILIDADES.find((p) => p.value === op.probabilidade);
              return (
                <div
                  key={op.id}
                  onClick={() => setDrawerOp(op)}
                  className="cursor-pointer grid grid-cols-[1fr_130px_110px_90px_90px_80px] gap-3 px-4 py-2.5 items-center text-xs hover:bg-ber-surface transition-colors border-b border-ber-border/50 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ber-carbon truncate">{op.titulo}</p>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: etapaCfg?.color ?? '#aaa' }} />
                    <span className="text-ber-gray truncate">{etapaCfg?.label ?? op.etapa}</span>
                  </div>
                  <span className="text-ber-gray truncate">{op.empresa?.razaoSocial ?? '—'}</span>
                  <span className="text-ber-gray truncate">{op.responsavel?.name ?? '—'}</span>
                  <span>
                    {probCfg
                      ? <span className="rounded-full bg-ber-surface px-2 py-0.5 text-[10px] font-semibold text-ber-carbon">{probCfg.label} ({probCfg.pct}%)</span>
                      : <span className="text-ber-gray/40">—</span>}
                  </span>
                  <span className="text-right font-bold text-ber-carbon">{fmt(op.valor)}</span>
                </div>
              );
            })}
            <div className="grid grid-cols-[1fr_130px_110px_90px_90px_80px] gap-3 px-4 py-2.5 border-t border-ber-border bg-ber-surface text-xs font-bold text-ber-carbon">
              <span>{filteredOps.length}{filteredOps.length !== oportunidades.length ? ` de ${oportunidades.length}` : ''} itens</span>
              <span /><span /><span /><span />
              <span className="text-right">{fmt(filteredOps.reduce((s, o) => s + Number(o.valor ?? 0), 0))}</span>
            </div>
          </div>
        </>
      )}

      <div className={`flex gap-3 overflow-x-auto pb-4 ${viewMode === 'lista' ? 'hidden' : ''}`} style={{ minHeight: '70vh' }}>
        {KANBAN_ETAPAS.map((etapa) => {
          const cards = byEtapa[etapa.value] ?? [];
          const totalValor = cards.reduce((s, c) => s + Number(c.valor ?? 0), 0);
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
                {cards.map((op) => (
                  <CardOportunidade key={op.id} op={op} onClick={() => setDrawerOp(op)} />
                ))}
                {cards.length === 0 && (
                  <p className="text-center text-xs text-ber-gray/50 py-4">Vazio</p>
                )}
              </div>
            </div>
          );
        })}

        {/* Coluna Ganhos */}
        <div className="flex-shrink-0 w-60 flex flex-col opacity-90">
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#3D9E5F' }} />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#3D9E5F' }}>Ganhos</span>
            <span className="ml-auto text-xs text-ber-gray bg-ber-surface rounded-full px-1.5">{ganhos.length}</span>
          </div>
          {ganhos.length > 0 && (
            <p className="text-[11px] text-ber-gray px-1 mb-2">{fmt(ganhos.reduce((s, o) => s + Number(o.valor ?? 0), 0))}</p>
          )}
          <div className="flex-1 bg-green-50/50 border border-green-200/40 rounded-xl p-2 space-y-2 overflow-y-auto">
            {ganhos.map((op) => (
              <CardOportunidade key={op.id} op={op} onClick={() => setDrawerOp(op)} />
            ))}
            {ganhos.length === 0 && (
              <p className="text-center text-xs text-ber-gray/50 py-4">Nenhum</p>
            )}
          </div>
        </div>

        {/* ── Separador antes das colunas de perdas ── */}
        <div className="flex-shrink-0 w-1 self-stretch mx-1 bg-ber-border/40 rounded-full" />

        {/* Coluna Perdidos */}
        <div className="flex-shrink-0 w-60 flex flex-col opacity-80">
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#E05555' }} />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#E05555' }}>Perdidos</span>
            <span className="ml-auto text-xs text-ber-gray bg-ber-surface rounded-full px-1.5">{perdidos.length}</span>
          </div>
          {perdidos.length > 0 && (
            <p className="text-[11px] text-ber-gray px-1 mb-2">{fmt(perdidos.reduce((s, o) => s + Number(o.valor ?? 0), 0))}</p>
          )}
          <div className="flex-1 bg-red-50/50 border border-red-200/40 rounded-xl p-2 space-y-2 overflow-y-auto">
            {perdidos.map((op) => (
              <CardOportunidade key={op.id} op={op} onClick={() => setDrawerOp(op)} />
            ))}
            {perdidos.length === 0 && (
              <p className="text-center text-xs text-ber-gray/50 py-4">Nenhum</p>
            )}
          </div>
        </div>

        {/* Coluna Declinados */}
        <div className="flex-shrink-0 w-60 flex flex-col opacity-80">
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#F97316' }} />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#F97316' }}>Declinados</span>
            <span className="ml-auto text-xs text-ber-gray bg-ber-surface rounded-full px-1.5">{declinados.length}</span>
          </div>
          {declinados.length > 0 && (
            <p className="text-[11px] text-ber-gray px-1 mb-2">{fmt(declinados.reduce((s, o) => s + Number(o.valor ?? 0), 0))}</p>
          )}
          <div className="flex-1 bg-orange-50/50 border border-orange-200/40 rounded-xl p-2 space-y-2 overflow-y-auto">
            {declinados.map((op) => (
              <CardOportunidade key={op.id} op={op} onClick={() => setDrawerOp(op)} />
            ))}
            {declinados.length === 0 && (
              <p className="text-center text-xs text-ber-gray/50 py-4">Nenhum</p>
            )}
          </div>
        </div>

        {/* Coluna Cancelados */}
        <div className="flex-shrink-0 w-60 flex flex-col opacity-80">
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#6B7280' }} />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#6B7280' }}>Cancelados</span>
            <span className="ml-auto text-xs text-ber-gray bg-ber-surface rounded-full px-1.5">{cancelados.length}</span>
          </div>
          {cancelados.length > 0 && (
            <p className="text-[11px] text-ber-gray px-1 mb-2">{fmt(cancelados.reduce((s, o) => s + Number(o.valor ?? 0), 0))}</p>
          )}
          <div className="flex-1 bg-gray-50/50 border border-gray-200/40 rounded-xl p-2 space-y-2 overflow-y-auto">
            {cancelados.map((op) => (
              <CardOportunidade key={op.id} op={op} onClick={() => setDrawerOp(op)} />
            ))}
            {cancelados.length === 0 && (
              <p className="text-center text-xs text-ber-gray/50 py-4">Nenhum</p>
            )}
          </div>
        </div>
      </div>

      {drawerOp !== null && (
        <DrawerBoundary onClose={() => setDrawerOp(null)}>
          <OportunidadeDrawer
            op={drawerOp === 'new' ? null : drawerOp}
            users={users}
            onClose={() => setDrawerOp(null)}
            onSave={() => { setDrawerOp(null); onRefresh(); }}
          />
        </DrawerBoundary>
      )}
    </div>
  );
}
