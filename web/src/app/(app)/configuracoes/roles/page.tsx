'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ArrowLeft, Plus, Save, X, Shield, Lock, Trash2 } from 'lucide-react';

interface RoleRecord {
  id: string;
  name: string;
  description: string | null;
  permissions: Record<string, boolean>;
  isSystem: boolean;
  _count: { users: number };
}

const MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'obras', label: 'Obras' },
  { key: 'kanban', label: 'Kanban' },
  { key: 'sequenciamento', label: 'Sequenciamento' },
  { key: 'checklists', label: 'Checklists' },
  { key: 'recebimentos', label: 'Recebimentos' },
  { key: 'pmo', label: 'PMO' },
  { key: 'seguranca', label: 'Seguranca' },
  { key: 'normas', label: 'Normas Tecnicas' },
  { key: 'instrucoes', label: 'Instrucoes Tecnicas' },
  { key: 'ponto', label: 'Registro de Ponto' },
  { key: 'dre', label: 'DRE (Financeiro)' },
  { key: 'configuracoes', label: 'Configuracoes' },
];

export default function RolesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'diretoria' || user?.role === 'coordenacao';

  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPerms, setFormPerms] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function fetchRoles() {
    setLoading(true);
    try {
      const res = await api.get('/roles');
      setRoles(res.data.data ?? []);
    } catch { /* interceptor */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (canManage) fetchRoles(); }, [canManage]);
  useEffect(() => { if (user && !canManage) router.replace('/configuracoes'); }, [user, canManage, router]);

  function openCreate() {
    setEditingRole(null);
    setFormName('');
    setFormDesc('');
    setFormPerms(Object.fromEntries(MODULES.map(m => [m.key, false])));
    setError('');
    setModalOpen(true);
  }

  function openEdit(r: RoleRecord) {
    setEditingRole(r);
    setFormName(r.name);
    setFormDesc(r.description ?? '');
    setFormPerms({ ...Object.fromEntries(MODULES.map(m => [m.key, false])), ...r.permissions });
    setError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingRole(null);
    setError('');
  }

  function togglePerm(key: string) {
    setFormPerms(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleAll(on: boolean) {
    setFormPerms(Object.fromEntries(MODULES.map(m => [m.key, on])));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (editingRole) {
        await api.put(`/roles/${editingRole.id}`, {
          name: formName,
          description: formDesc || undefined,
          permissions: formPerms,
        });
      } else {
        if (!formName.trim()) { setError('Nome obrigatorio'); setSubmitting(false); return; }
        await api.post('/roles', {
          name: formName.trim(),
          description: formDesc.trim() || undefined,
          permissions: formPerms,
        });
      }
      closeModal();
      fetchRoles();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Erro ao salvar role.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(r: RoleRecord) {
    if (!confirm(`Excluir role "${r.name}"? Esta acao nao pode ser desfeita.`)) return;
    try {
      await api.delete(`/roles/${r.id}`);
      fetchRoles();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Erro ao excluir role.');
    }
  }

  if (!canManage) return null;

  const enabledCount = (perms: Record<string, boolean>) =>
    Object.values(perms).filter(Boolean).length;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/configuracoes')}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-ber-gray hover:bg-ber-offwhite hover:text-ber-carbon transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-black text-ber-carbon">Roles e Permissoes</h1>
          <p className="text-xs text-ber-gray">{roles.length} roles configuradas</p>
        </div>
        {user?.role === 'diretoria' && (
          <button onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-ber-olive px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white hover:opacity-90 transition-colors">
            <Plus size={16} />
            <span className="hidden sm:inline">Nova Role</span>
          </button>
        )}
      </div>

      {/* Roles grid */}
      {loading ? (
        <div className="py-16 text-center text-sm text-ber-gray">Carregando...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <div key={r.id} className="rounded-lg bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {r.isSystem && <Lock size={12} className="text-ber-gray" />}
                  <h3 className="font-bold text-ber-carbon capitalize">{r.name}</h3>
                </div>
                <span className="rounded-full bg-ber-offwhite px-2 py-0.5 text-[10px] font-semibold text-ber-gray">
                  {r._count.users} usuario{r._count.users !== 1 ? 's' : ''}
                </span>
              </div>

              {r.description && (
                <p className="text-xs text-ber-gray mb-3">{r.description}</p>
              )}

              {/* Permission pills */}
              <div className="flex flex-wrap gap-1 mb-4">
                {MODULES.map((m) => (
                  <span key={m.key}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      r.permissions[m.key]
                        ? 'bg-ber-olive/10 text-ber-olive'
                        : 'bg-gray-100 text-gray-400 line-through'
                    }`}>
                    {m.label}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-ber-gray/10 pt-3">
                <span className="text-xs text-ber-gray">
                  {enabledCount(r.permissions)}/{MODULES.length} modulos
                </span>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(r)}
                    className="rounded-lg bg-ber-olive px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-colors">
                    Editar
                  </button>
                  {!r.isSystem && user?.role === 'diretoria' && (
                    <button onClick={() => handleDelete(r)}
                      className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal — criar/editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-t-2xl md:rounded-lg bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-ber-carbon">
                {editingRole ? `Editar: ${editingRole.name}` : 'Nova Role'}
              </h2>
              <button onClick={closeModal} className="rounded p-1 text-ber-gray hover:text-ber-carbon">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Nome</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                  required disabled={editingRole?.isSystem}
                  className="w-full rounded-lg border border-ber-gray/20 px-3 py-2.5 text-sm text-ber-carbon outline-none focus:border-ber-olive disabled:bg-gray-50 disabled:text-ber-gray" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Descricao</label>
                <input type="text" value={formDesc} onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full rounded-lg border border-ber-gray/20 px-3 py-2.5 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
              </div>

              {/* Permissions checkboxes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-ber-carbon">Modulos permitidos</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => toggleAll(true)}
                      className="text-[10px] font-semibold text-ber-olive hover:underline">Marcar todos</button>
                    <button type="button" onClick={() => toggleAll(false)}
                      className="text-[10px] font-semibold text-ber-gray hover:underline">Desmarcar todos</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-ber-gray/20 p-3">
                  {MODULES.map((m) => (
                    <label key={m.key}
                      className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-ber-offwhite cursor-pointer transition-colors">
                      <input type="checkbox" checked={!!formPerms[m.key]}
                        onChange={() => togglePerm(m.key)}
                        className="h-4 w-4 rounded border-ber-gray/30 text-ber-olive focus:ring-ber-olive" />
                      <span className="text-sm text-ber-carbon">{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {error && <p className="text-sm font-medium text-red-500">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="rounded-lg border border-ber-gray/20 px-4 py-2.5 text-sm font-semibold text-ber-gray hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting}
                  className="flex items-center gap-2 rounded-lg bg-ber-olive px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-colors disabled:opacity-50">
                  <Save size={16} />
                  {submitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
