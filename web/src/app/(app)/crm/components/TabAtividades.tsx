'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { Plus, Phone, Mail, MapPin, Users, Clock, X, CheckCircle2, Circle, Calendar } from 'lucide-react';
import { TIPOS_ATIVIDADE, Atividade, User, Oportunidade, fmtDate } from '../types';

const TIPO_ICON: Record<string, React.ReactNode> = {
  reuniao:  <Users size={14} />,
  ligacao:  <Phone size={14} />,
  email:    <Mail size={14} />,
  visita:   <MapPin size={14} />,
  outro:    <Clock size={14} />,
};

const TIPO_COLOR: Record<string, string> = {
  reuniao:  'bg-blue-100 text-blue-600',
  ligacao:  'bg-green-100 text-green-600',
  email:    'bg-purple-100 text-purple-600',
  visita:   'bg-orange-100 text-orange-600',
  outro:    'bg-gray-100 text-gray-500',
};

interface Props {
  atividades: Atividade[];
  oportunidades: Oportunidade[];
  users: User[];
  onRefresh: () => void;
}

function AtividadeDrawer({
  onClose,
  onSave,
  oportunidades,
}: {
  onClose: () => void;
  onSave: () => void;
  oportunidades: Oportunidade[];
}) {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const [form, setForm] = useState({
    tipo: 'reuniao',
    dataHora: now.toISOString().slice(0, 16),
    duracao: '',
    notas: '',
    oportunidadeId: '',
    concluida: false,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/crm/atividades', {
        ...form,
        duracao: form.duracao ? Number(form.duracao) : null,
        oportunidadeId: form.oportunidadeId || null,
      });
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md bg-white rounded-t-2xl md:rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-ber-carbon">Nova Atividade</h2>
          <button onClick={onClose} className="text-ber-gray hover:text-ber-carbon"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Tipo</label>
            <select className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
              {TIPOS_ATIVIDADE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Duração (min)</label>
            <input type="number" className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" placeholder="30" value={form.duracao} onChange={(e) => setForm((f) => ({ ...f, duracao: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Data e Hora</label>
          <input type="datetime-local" className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={form.dataHora} onChange={(e) => setForm((f) => ({ ...f, dataHora: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Oportunidade</label>
          <select className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={form.oportunidadeId} onChange={(e) => setForm((f) => ({ ...f, oportunidadeId: e.target.value }))}>
            <option value="">-- nenhuma --</option>
            {oportunidades.map((o) => <option key={o.id} value={o.id}>{o.titulo} ({o.empresa?.razaoSocial ?? '--'})</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Notas</label>
          <textarea className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal resize-none" rows={3} value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="concluida" checked={form.concluida} onChange={(e) => setForm((f) => ({ ...f, concluida: e.target.checked }))} className="w-4 h-4" />
          <label htmlFor="concluida" className="text-sm text-ber-carbon">Marcar como concluída</label>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-ber-border rounded-lg text-sm text-ber-gray hover:bg-ber-surface">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-ber-teal text-white rounded-lg text-sm font-semibold hover:bg-ber-teal/80 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TabAtividades({ atividades, oportunidades, users, onRefresh }: Props) {
  const [showDrawer, setShowDrawer] = useState(false);
  const [filtro, setFiltro] = useState<'todas' | 'pendentes' | 'concluidas'>('pendentes');

  const filtered = atividades.filter((a) => {
    if (filtro === 'pendentes') return !a.concluida;
    if (filtro === 'concluidas') return a.concluida;
    return true;
  });

  const toggleConcluida = async (a: Atividade) => {
    await api.patch(`/crm/atividades/${a.id}`, { concluida: !a.concluida });
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
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const vencidas = atividades.filter((a) => !a.concluida && new Date(a.dataHora) < hoje);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex rounded-lg border border-ber-border overflow-hidden text-sm">
          {(['pendentes', 'todas', 'concluidas'] as const).map((f) => (
            <button key={f} onClick={() => setFiltro(f)} className={`px-3 py-2 capitalize ${filtro === f ? 'bg-ber-teal text-white' : 'text-ber-gray hover:bg-ber-surface'}`}>{f}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {vencidas.length > 0 && (
            <span className="text-xs bg-red-100 text-ber-red px-2 py-1 rounded-full font-semibold">{vencidas.length} vencida{vencidas.length > 1 ? 's' : ''}</span>
          )}
          <button onClick={() => setShowDrawer(true)} className="flex items-center gap-1.5 bg-ber-teal text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-ber-teal/80">
            <Plus size={14} /> Nova
          </button>
        </div>
      </div>

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
                      {a.notas && <p className={`mt-1 text-sm ${a.concluida ? 'line-through text-ber-gray' : 'text-ber-carbon'}`}>{a.notas}</p>}
                      <div className="mt-1 flex items-center gap-3 text-xs text-ber-gray">
                        <span>{new Date(a.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        {a.duracao && <span>{a.duracao} min</span>}
                        {a.usuario && <span>{a.usuario.name}</span>}
                      </div>
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

      {showDrawer && (
        <AtividadeDrawer
          oportunidades={oportunidades}
          onClose={() => setShowDrawer(false)}
          onSave={() => { setShowDrawer(false); onRefresh(); }}
        />
      )}
    </div>
  );
}
