'use client';

import { useState } from 'react';
import api from '@/lib/api';
import {
  Plus, Phone, Mail, MapPin, Users, Clock, X, CheckCircle2, Circle,
  Calendar, Pencil, Trash2, ChevronDown, RotateCcw,
} from 'lucide-react';
import { TIPOS_ATIVIDADE, Atividade, User, Oportunidade } from '../types';

const TIPO_ICON: Record<string, React.ReactNode> = {
  reuniao: <Users size={13} />,
  ligacao: <Phone size={13} />,
  email:   <Mail size={13} />,
  visita:  <MapPin size={13} />,
  outro:   <Clock size={13} />,
};

const TIPO_COLOR: Record<string, string> = {
  reuniao: 'bg-blue-100 text-blue-600',
  ligacao: 'bg-green-100 text-green-600',
  email:   'bg-purple-100 text-purple-600',
  visita:  'bg-orange-100 text-orange-600',
  outro:   'bg-gray-100 text-gray-500',
};

function localNow() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
function localIso(d: Date) {
  const copy = new Date(d);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 16);
}

interface AtividadeDrawerProps {
  atividade?: Atividade;
  oportunidades: Oportunidade[];
  users: User[];
  currentUserId?: string;
  onClose: () => void;
  onSave: () => void;
}

function AtividadeDrawer({ atividade, oportunidades, users, currentUserId, onClose, onSave }: AtividadeDrawerProps) {
  const isEdit = !!atividade;
  const [form, setForm] = useState({
    tipo:           atividade?.tipo ?? 'reuniao',
    dataHora:       atividade ? localIso(new Date(atividade.dataHora)) : localNow(),
    duracao:        String(atividade?.duracao ?? ''),
    notas:          atividade?.notas ?? '',
    oportunidadeId: atividade?.oportunidade?.id ?? '',
    concluida:      atividade?.concluida ?? false,
    resultado:      atividade?.resultado ?? '',
    usuarioId:      atividade?.usuario?.id ?? currentUserId ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        tipo:           form.tipo,
        dataHora:       form.dataHora,
        duracao:        form.duracao ? Number(form.duracao) : null,
        notas:          form.notas || null,
        oportunidadeId: form.oportunidadeId || null,
        concluida:      form.concluida,
        resultado:      form.resultado || null,
        usuarioId:      form.usuarioId || undefined,
      };
      if (isEdit) {
        await api.patch(`/crm/atividades/${atividade.id}`, payload);
      } else {
        await api.post('/crm/atividades', payload);
      }
      onSave();
    } finally {
      setSaving(false);
    }
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md bg-white rounded-t-2xl md:rounded-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-ber-carbon">{isEdit ? 'Editar Atividade' : 'Nova Atividade'}</h2>
          <button onClick={onClose} className="text-ber-gray hover:text-ber-carbon"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Tipo</label>
            <select className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={form.tipo} onChange={f('tipo')}>
              {TIPOS_ATIVIDADE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Duração (min)</label>
            <input type="number" className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" placeholder="30" value={form.duracao} onChange={f('duracao')} />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Data e Hora</label>
          <input type="datetime-local" className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={form.dataHora} onChange={f('dataHora')} />
        </div>

        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Responsável</label>
          <select className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={form.usuarioId} onChange={f('usuarioId')}>
            <option value="">-- selecione --</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Oportunidade</label>
          <select className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={form.oportunidadeId} onChange={f('oportunidadeId')}>
            <option value="">-- nenhuma --</option>
            {oportunidades.map((o) => <option key={o.id} value={o.id}>{o.titulo} ({o.empresa?.razaoSocial ?? '--'})</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Notas</label>
          <textarea className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal resize-none" rows={3} value={form.notas} onChange={f('notas')} />
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="concluida" checked={form.concluida} onChange={(e) => setForm((prev) => ({ ...prev, concluida: e.target.checked }))} className="w-4 h-4" />
          <label htmlFor="concluida" className="text-sm text-ber-carbon">Marcar como concluída</label>
        </div>

        {form.concluida && (
          <div>
            <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Resultado / Observações</label>
            <textarea
              className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal resize-none"
              rows={3}
              placeholder="O que aconteceu? Próximos passos..."
              value={form.resultado}
              onChange={f('resultado')}
            />
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-ber-border rounded-lg text-sm text-ber-gray hover:bg-ber-surface">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-ber-teal text-white rounded-lg text-sm font-semibold hover:bg-ber-teal/80 disabled:opacity-50">
            {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ProximaAcaoPromptProps {
  atividade: Atividade;
  oportunidades: Oportunidade[];
  users: User[];
  currentUserId?: string;
  onClose: () => void;
  onSave: () => void;
}

function ProximaAcaoPrompt({ atividade, oportunidades, users, currentUserId, onClose, onSave }: ProximaAcaoPromptProps) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const [form, setForm] = useState({
    tipo:      atividade.tipo,
    dataHora:  localIso(tomorrow),
    notas:     '',
    usuarioId: atividade.usuario?.id ?? currentUserId ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post('/crm/atividades', {
        tipo:           form.tipo,
        dataHora:       form.dataHora,
        notas:          form.notas || null,
        oportunidadeId: atividade.oportunidade?.id ?? null,
        concluida:      false,
        usuarioId:      form.usuarioId || undefined,
      });
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm bg-white rounded-t-2xl md:rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-ber-carbon text-sm">Próxima ação</h2>
            <p className="text-xs text-ber-gray mt-0.5">Criar atividade de follow-up?</p>
          </div>
          <button onClick={onClose} className="text-ber-gray hover:text-ber-carbon"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Tipo</label>
            <select className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}>
              {TIPOS_ATIVIDADE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Data/Hora</label>
            <input type="datetime-local" className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={form.dataHora} onChange={(e) => setForm((p) => ({ ...p, dataHora: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Responsável</label>
          <select className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={form.usuarioId} onChange={(e) => setForm((p) => ({ ...p, usuarioId: e.target.value }))}>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Notas</label>
          <textarea className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal resize-none" rows={2} value={form.notas} onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))} />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-ber-border rounded-lg text-sm text-ber-gray hover:bg-ber-surface">Não, obrigado</button>
          <button onClick={handleCreate} disabled={saving} className="flex-1 py-2 bg-ber-teal text-white rounded-lg text-sm font-semibold hover:bg-ber-teal/80 disabled:opacity-50">
            {saving ? '...' : 'Criar follow-up'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  atividades: Atividade[];
  oportunidades: Oportunidade[];
  users: User[];
  currentUserId?: string;
  onRefresh: () => void;
}

export default function TabAtividades({ atividades, oportunidades, users, currentUserId, onRefresh }: Props) {
  const [showDrawer, setShowDrawer]             = useState(false);
  const [editingAtividade, setEditingAtividade] = useState<Atividade | null>(null);
  const [deletingId, setDeletingId]             = useState<string | null>(null);
  const [proximaAcao, setProximaAcao]           = useState<Atividade | null>(null);

  const [filtroStatus, setFiltroStatus]           = useState<'todas' | 'pendentes' | 'concluidas'>('pendentes');
  const [filtroTipo, setFiltroTipo]               = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [showFiltros, setShowFiltros]             = useState(false);

  const filtered = atividades.filter((a) => {
    if (filtroStatus === 'pendentes' && a.concluida) return false;
    if (filtroStatus === 'concluidas' && !a.concluida) return false;
    if (filtroTipo && a.tipo !== filtroTipo) return false;
    if (filtroResponsavel && a.usuario?.id !== filtroResponsavel) return false;
    return true;
  });

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencidas = atividades.filter((a) => !a.concluida && new Date(a.dataHora) < hoje);

  const toggleConcluida = async (a: Atividade) => {
    const nowDone = !a.concluida;
    await api.patch(`/crm/atividades/${a.id}`, { concluida: nowDone });
    onRefresh();
    if (nowDone) setProximaAcao(a);
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/crm/atividades/${id}`);
    setDeletingId(null);
    onRefresh();
  };

  const groupByDay = (list: Atividade[]) => {
    const groups: Record<string, Atividade[]> = {};
    for (const a of list) {
      const day = new Date(a.dataHora).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
      groups[day] ??= [];
      groups[day].push(a);
    }
    return groups;
  };

  const grouped = groupByDay(filtered);
  const filtrosAtivos = (filtroTipo ? 1 : 0) + (filtroResponsavel ? 1 : 0);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex rounded-lg border border-ber-border overflow-hidden text-sm">
          {(['pendentes', 'todas', 'concluidas'] as const).map((f) => (
            <button key={f} onClick={() => setFiltroStatus(f)} className={`px-3 py-2 capitalize ${filtroStatus === f ? 'bg-ber-teal text-white' : 'text-ber-gray hover:bg-ber-surface'}`}>{f}</button>
          ))}
        </div>

        <button
          onClick={() => setShowFiltros((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm ${filtrosAtivos > 0 ? 'border-ber-teal text-ber-teal bg-ber-teal/5' : 'border-ber-border text-ber-gray hover:bg-ber-surface'}`}
        >
          Filtros {filtrosAtivos > 0 && <span className="bg-ber-teal text-white text-xs rounded-full px-1.5">{filtrosAtivos}</span>}
          <ChevronDown size={13} className={`transition-transform ${showFiltros ? 'rotate-180' : ''}`} />
        </button>

        <div className="ml-auto flex items-center gap-2">
          {vencidas.length > 0 && (
            <span className="text-xs bg-red-100 text-ber-red px-2 py-1 rounded-full font-semibold">{vencidas.length} vencida{vencidas.length > 1 ? 's' : ''}</span>
          )}
          <button onClick={() => setShowDrawer(true)} className="flex items-center gap-1.5 bg-ber-teal text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-ber-teal/80">
            <Plus size={14} /> Nova
          </button>
        </div>
      </div>

      {/* Filtros expandidos */}
      {showFiltros && (
        <div className="mb-4 flex gap-3 flex-wrap p-3 bg-ber-surface rounded-xl border border-ber-border">
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Tipo</label>
            <select className="mt-1 w-full border border-ber-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-ber-teal bg-white" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="">Todos os tipos</option>
              {TIPOS_ATIVIDADE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Responsável</label>
            <select className="mt-1 w-full border border-ber-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-ber-teal bg-white" value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)}>
              <option value="">Todos</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          {filtrosAtivos > 0 && (
            <button onClick={() => { setFiltroTipo(''); setFiltroResponsavel(''); }} className="self-end flex items-center gap-1 text-xs text-ber-gray hover:text-ber-red px-2 py-1.5 rounded-lg border border-ber-border">
              <RotateCcw size={12} /> Limpar
            </button>
          )}
        </div>
      )}

      {/* Lista */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([day, items]) => (
          <div key={day}>
            <p className="text-xs font-bold text-ber-gray uppercase tracking-wide mb-2 flex items-center gap-2">
              <Calendar size={12} /> {day}
            </p>
            <div className="space-y-2">
              {items.map((a) => {
                const vencida = !a.concluida && new Date(a.dataHora) < hoje;
                return (
                  <div key={a.id} className={`bg-white border rounded-xl p-3 flex items-start gap-3 transition-all ${vencida ? 'border-red-200 bg-red-50/50' : 'border-ber-border'}`}>
                    <button onClick={() => toggleConcluida(a)} className={`mt-0.5 shrink-0 ${a.concluida ? 'text-ber-green' : 'text-ber-gray/40 hover:text-ber-teal'}`}>
                      {a.concluida ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_COLOR[a.tipo] ?? 'bg-gray-100 text-gray-500'}`}>
                          {TIPO_ICON[a.tipo]}
                          {TIPOS_ATIVIDADE.find((t) => t.value === a.tipo)?.label ?? a.tipo}
                        </span>
                        {a.oportunidade && (
                          <span className="text-xs text-ber-gray truncate max-w-[180px]">
                            {a.oportunidade.empresa?.razaoSocial ?? ''} — {a.oportunidade.titulo}
                          </span>
                        )}
                      </div>
                      {a.notas && (
                        <p className={`mt-1 text-sm ${a.concluida ? 'line-through text-ber-gray' : 'text-ber-carbon'}`}>{a.notas}</p>
                      )}
                      {a.resultado && (
                        <div className="mt-1.5 text-xs text-ber-gray bg-green-50 border border-green-100 rounded-lg px-2 py-1.5">
                          <span className="font-semibold text-ber-green">Resultado: </span>{a.resultado}
                        </div>
                      )}
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-ber-gray">
                        <span>{new Date(a.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        {a.duracao && <span>{a.duracao} min</span>}
                        {a.usuario && (
                          <span className="flex items-center gap-1">
                            {a.usuario.avatarUrl
                              ? <img src={a.usuario.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                              : <span className="w-4 h-4 rounded-full bg-ber-teal/20 text-ber-teal flex items-center justify-center text-[9px] font-bold">{a.usuario.name[0]}</span>
                            }
                            {a.usuario.name}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEditingAtividade(a)} className="p-1.5 rounded-lg text-ber-gray hover:text-ber-teal hover:bg-ber-teal/5 transition-colors">
                        <Pencil size={13} />
                      </button>
                      {deletingId === a.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(a.id)} className="text-xs text-white bg-ber-red px-2 py-1 rounded-lg hover:opacity-80">Sim</button>
                          <button onClick={() => setDeletingId(null)} className="text-xs text-ber-gray px-2 py-1 rounded-lg border border-ber-border hover:bg-ber-surface">Não</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeletingId(a.id)} className="p-1.5 rounded-lg text-ber-gray hover:text-ber-red hover:bg-red-50 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <div className="text-center py-12 text-ber-gray">
            <Calendar size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma atividade</p>
          </div>
        )}
      </div>

      {/* Drawer nova/editar */}
      {(showDrawer || editingAtividade) && (
        <AtividadeDrawer
          atividade={editingAtividade ?? undefined}
          oportunidades={oportunidades}
          users={users}
          currentUserId={currentUserId}
          onClose={() => { setShowDrawer(false); setEditingAtividade(null); }}
          onSave={() => { setShowDrawer(false); setEditingAtividade(null); onRefresh(); }}
        />
      )}

      {/* Próxima ação */}
      {proximaAcao && (
        <ProximaAcaoPrompt
          atividade={proximaAcao}
          oportunidades={oportunidades}
          users={users}
          currentUserId={currentUserId}
          onClose={() => setProximaAcao(null)}
          onSave={() => { setProximaAcao(null); onRefresh(); }}
        />
      )}
    </div>
  );
}
