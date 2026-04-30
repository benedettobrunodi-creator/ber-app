'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore, UserRole } from '@/stores/authStore';
import {
  Users, UserPlus, ArrowLeft, Save, X, Shield, Search,
} from 'lucide-react';

interface RoleOption { id: string; name: string; isSystem: boolean }

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  customRoleId: string | null;
  customRole?: { id: string; name: string } | null;
}

interface UserFormData {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: UserRole;
  customRoleId: string;
}

const ROLES: UserRole[] = ['diretoria', 'coordenacao', 'gestor', 'campo'];

const ROLE_BADGE: Record<UserRole, string> = {
  diretoria: 'bg-ber-carbon text-white',
  coordenacao: 'bg-ber-teal text-white',
  gestor: 'bg-ber-olive text-white',
  campo: 'bg-ber-gray text-white',
};

const ROLE_LABELS: Record<UserRole, string> = {
  diretoria: 'Diretoria',
  coordenacao: 'Coordenacao',
  gestor: 'Gestor',
  campo: 'Campo',
};

const EMPTY_FORM: UserFormData = { name: '', email: '', password: '', phone: '', role: 'campo', customRoleId: '' };

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function UsuariosPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'diretoria' || user?.role === 'coordenacao';

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [customRoles, setCustomRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<UserRole | 'todas'>('todas');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<UserFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function fetchUsers() {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        api.get('/users', { params: { limit: 200 } }),
        api.get('/roles').catch(() => ({ data: { data: [] } })),
      ]);
      setUsers(usersRes.data.data ?? []);
      setCustomRoles((rolesRes.data.data ?? []).map((r: any) => ({ id: r.id, name: r.name, isSystem: r.isSystem })));
    } catch { /* interceptor */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (canManage) fetchUsers(); }, [canManage]);

  // Redirect if not authorized
  useEffect(() => {
    if (user && !canManage) router.replace('/configuracoes');
  }, [user, canManage, router]);

  const filtered = users.filter((u) => {
    if (filterRole !== 'todas' && u.role !== filterRole) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  function openCreate() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  }

  function openEdit(u: UserRecord) {
    setEditingUser(u);
    setForm({ name: u.name, email: u.email, password: '', phone: u.phone ?? '', role: u.role, customRoleId: u.customRoleId ?? '' });
    setError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, {
          name: form.name,
          role: form.role,
          phone: form.phone || undefined,
          isActive: editingUser.isActive,
          customRoleId: form.customRoleId || null,
        });
      } else {
        if (!form.password || form.password.length < 6) {
          setError('Senha deve ter no minimo 6 caracteres.');
          setSubmitting(false);
          return;
        }
        await api.post('/users', {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          phone: form.phone || undefined,
          customRoleId: form.customRoleId || null,
        });
      }
      closeModal();
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Erro ao salvar usuario.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(u: UserRecord) {
    try {
      if (u.isActive) {
        await api.delete(`/users/${u.id}`);
      } else {
        await api.put(`/users/${u.id}`, { isActive: true });
      }
      fetchUsers();
    } catch { /* interceptor */ }
  }

  if (!canManage) return null;

  const counts = ROLES.reduce((acc, r) => {
    acc[r] = users.filter((u) => u.role === r).length;
    return acc;
  }, {} as Record<UserRole, number>);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/configuracoes')}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-ber-gray hover:bg-ber-offwhite hover:text-ber-carbon transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-black text-ber-carbon">Usuarios</h1>
          <p className="text-xs text-ber-gray">{users.length} usuarios cadastrados</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-ber-olive px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white hover:opacity-90 transition-colors">
          <UserPlus size={16} />
          <span className="hidden sm:inline">Novo Usuario</span>
          <span className="sm:hidden">Novo</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ber-gray" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-ber-gray/20 bg-white pl-9 pr-3 py-2.5 text-sm text-ber-carbon outline-none focus:border-ber-olive"
          />
        </div>

        {/* Role filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFilterRole('todas')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filterRole === 'todas' ? 'bg-ber-carbon text-white' : 'bg-white text-ber-gray border border-ber-gray/20 hover:bg-ber-offwhite'
            }`}>
            Todas ({users.length})
          </button>
          {ROLES.map((r) => (
            <button key={r} onClick={() => setFilterRole(r)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                filterRole === r ? ROLE_BADGE[r] : 'bg-white text-ber-gray border border-ber-gray/20 hover:bg-ber-offwhite'
              }`}>
              {ROLE_LABELS[r]} ({counts[r]})
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center text-sm text-ber-gray">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Users size={48} className="text-ber-gray/30" />
          <p className="mt-4 text-sm text-ber-gray">
            {search || filterRole !== 'todas' ? 'Nenhum usuario encontrado com este filtro.' : 'Nenhum usuario cadastrado.'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((u) => (
              <div key={u.id} className="rounded-lg bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ber-teal text-xs font-bold text-white">
                    {getInitials(u.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ber-carbon truncate">{u.name}</p>
                    <p className="text-xs text-ber-gray truncate">{u.email}</p>
                  </div>
                  {u.isActive
                    ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">Ativo</span>
                    : <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">Inativo</span>
                  }
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE[u.role]}`}>
                    <Shield size={10} />
                    {ROLE_LABELS[u.role]}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(u)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-ber-olive text-xs font-semibold text-white">
                      Editar
                    </button>
                    <button onClick={() => handleToggleActive(u)}
                      className={`min-h-[44px] rounded-lg px-3 text-xs font-semibold text-white ${u.isActive ? 'bg-red-500' : 'bg-green-600'}`}>
                      {u.isActive ? 'Desativar' : 'Reativar'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ber-gray/10 text-xs font-semibold uppercase text-ber-gray">
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-ber-gray/5 last:border-0 hover:bg-ber-offwhite/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ber-teal text-xs font-bold text-white">
                          {getInitials(u.name)}
                        </div>
                        <span className="font-medium text-ber-carbon">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-ber-gray">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE[u.role]}`}>
                        <Shield size={10} />
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.isActive
                        ? <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">Ativo</span>
                        : <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">Inativo</span>
                      }
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(u)}
                          className="rounded-lg bg-ber-olive px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-colors">
                          Editar
                        </button>
                        <button onClick={() => handleToggleActive(u)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-colors ${
                            u.isActive ? 'bg-red-500' : 'bg-green-600'
                          }`}>
                          {u.isActive ? 'Desativar' : 'Reativar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal — criar/editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-2xl md:rounded-lg bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ber-carbon">
                {editingUser ? 'Editar Usuario' : 'Novo Usuario'}
              </h2>
              <button onClick={closeModal} className="rounded p-1 text-ber-gray hover:text-ber-carbon">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Nome</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  className="w-full rounded-lg border border-ber-gray/20 px-3 py-2.5 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required disabled={!!editingUser}
                  className="w-full rounded-lg border border-ber-gray/20 px-3 py-2.5 text-sm text-ber-carbon outline-none focus:border-ber-olive disabled:bg-gray-50 disabled:text-ber-gray" />
              </div>

              {!editingUser && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">Senha</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required
                    className="w-full rounded-lg border border-ber-gray/20 px-3 py-2.5 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  className="w-full rounded-lg border border-ber-gray/20 px-3 py-2.5 text-sm text-ber-carbon outline-none focus:border-ber-olive">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Telefone</label>
                <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-lg border border-ber-gray/20 px-3 py-2.5 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
              </div>

              {/* Custom role (permissions) */}
              {customRoles.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">Permissoes (role customizada)</label>
                  <select value={form.customRoleId} onChange={(e) => setForm({ ...form, customRoleId: e.target.value })}
                    className="w-full rounded-lg border border-ber-gray/20 px-3 py-2.5 text-sm text-ber-carbon outline-none focus:border-ber-olive">
                    <option value="">Usar padrao da role ({ROLE_LABELS[form.role]})</option>
                    {customRoles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}{r.isSystem ? ' (sistema)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Toggle status inline no edit */}
              {editingUser && (
                <div className="flex items-center justify-between rounded-lg border border-ber-gray/20 px-3 py-2.5">
                  <span className="text-sm font-medium text-ber-carbon">Status</span>
                  <button type="button"
                    onClick={() => setEditingUser({ ...editingUser, isActive: !editingUser.isActive })}
                    className={`rounded-full px-3 py-1 text-xs font-semibold text-white transition-colors ${
                      editingUser.isActive ? 'bg-green-600' : 'bg-red-500'
                    }`}>
                    {editingUser.isActive ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
              )}

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
