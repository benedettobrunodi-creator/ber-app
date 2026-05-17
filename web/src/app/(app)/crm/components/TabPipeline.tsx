'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { Plus, ChevronRight, ChevronLeft, Clock, X, AlertCircle } from 'lucide-react';
import { ETAPAS, ETAPA_MAP, ORIGENS, PROBABILIDADES, SEGMENTOS, Oportunidade, Empresa, User, fmt, fmtDate, diasAtras } from '../types';

const KANBAN_ETAPAS = ETAPAS.filter((e) => e.value !== 'perdido');

interface Props {
  oportunidades: Oportunidade[];
  empresas: Empresa[];
  users: User[];
  onRefresh: () => void;
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

  return (
    <div className="bg-white border border-ber-border rounded-lg p-3 hover:shadow-md hover:border-ber-teal/40 transition-all group">
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

  const empresaSelecionada = empresas.find((e) => e.id === form.empresaId);
  const contatosDaEmpresa = empresaSelecionada?.contatos ?? [];

  const handleSave = async () => {
    if (!form.titulo.trim()) { setErr('Título obrigatório'); return; }
    setSaving(true);
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
        if (op?.orcamento?.id) {
          await api.patch(`/orcamentos/${op.orcamento.id}`, {
            cliente: form.titulo,
            valorVenda: form.valor ? Number(form.valor) : null,
            m2: form.m2 ? Number(form.m2) : null,
          });
        }
      }
      onSave();
    } catch {
      setErr('Erro ao salvar');
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
              <input
                type="number"
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                placeholder="R$"
                value={form.valor}
                onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
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
              onChange={(e) => setForm((f) => ({ ...f, empresaId: e.target.value, contatoId: '' }))}
            >
              <option value="">-- nenhuma --</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.razaoSocial}{e.segmento ? ` · ${e.segmento}` : ''}</option>
              ))}
            </select>
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

export default function TabPipeline({ oportunidades, empresas, users, onRefresh }: Props) {
  const [drawerOp, setDrawerOp] = useState<Oportunidade | null | 'new'>(null);

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
        <button
          onClick={() => setDrawerOp('new')}
          className="flex items-center gap-1.5 bg-ber-teal text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-ber-teal/80"
        >
          <Plus size={14} /> Nova Oportunidade
        </button>
      </div>

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
