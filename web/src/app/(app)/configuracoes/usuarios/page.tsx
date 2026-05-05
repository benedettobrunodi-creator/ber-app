'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore, UserRole } from '@/stores/authStore';
import {
  Users, UserPlus, ArrowLeft, Save, X, Shield, Search, KeyRound,
} from 'lucide-react';

const MODULES = [
  { key: 'dashboard',     label: 'Dashboard' },
  { key: 'obras',         label: 'Obras' },
  { key: 'kanban',        label: 'Kanban' },
  { key: 'sequenciamento',label: 'Sequenciamento' },
  { key: 'checklists',    label: 'Checklists' },
  { key: 'recebimentos',  label: 'Recebimentos' },
  { key: 'pmo',           label: 'PMO' },
  { key: 'seguranca',     label: 'Segurança' },
  { key: 'normas',        label: 'Normas Técnicas' },
  { key: 'instrucoes',    label: 'Instruções Técnicas' },
  { key: 'ponto',         label: 'Registro de Ponto' },
  { key: 'orcamentos',    label: 'Esteira de Orçamentos' },
  { key: 'dre',           label: 'DRE' },
  { key: 'configuracoes', label: 'Configurações' },
];

const CARGO_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'diretoria',   label: 'Diretoria' },
  { value: 'coordenacao', label: 'Coordenação' },
  { value: 'pmo',         label: 'PMO' },
  { value: 'engenharia',  label: 'Engenharia' },
  { value: 'financeiro',  label: 'Financeiro' },
  { value: 'gestor',      label: 'Gestor de Obras' },
  { value: 'compras',     label: 'Compras' },
  { value: 'orcamentos',  label: 'Orçamentos' },
  { value: 'campo',       label: 'Campo' },
];

const CARGO_BADGE: Partial<Record<UserRole, string>> = {
  diretoria:   'bg-ber-carbon text-white',
  coordenacao: 'bg-ber-teal text-white',
  pmo:         'bg-purple-600 text-white',
  engenharia:  'bg-blue-600 text-white',
  financeiro:  'bg-emerald-600 text-white',
  gestor:      'bg-ber-olive text-white',
  compras:     'bg-orange-500 text-white',
  orcamentos:  'bg-amber-500 text-white',
  campo:       'bg-ber-gray text-white',
};

const EMPTY_PERMS = () => Object.fromEntries(MODULES.map(m => [m.key, false]));

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  permissions: Record<string, boolean>;
}

interface UserFormData {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: UserRole;
  permissions: Record<string, boolean>;
}

const EMPTY_FORM: UserFormData = {
  name: '', email: '', password: '', phone: '', role: 'campo',
  permissions: EMPTY_PERMS(),
};

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export default function UsuariosPage() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const canManage = user?.role === 'diretoria' || user?.role === 'coordenacao';

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCargo, setFilterCargo] = useState<UserRole | 'todas'>('todas');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<UserFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pwdModal, setPwdModal] = useState<UserRecord | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await api.get('/users', { params: { limit: 200 } });
      setUsers(res.data.data ?? []);
    } catch { /* interceptor */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (canManage) fetchUsers(); }, [canManage]);
  useEffect(() => { if (user && !canManage) router.replace('/configuracoes'); }, [user, canManage, router]);

  const filtered = users.filter(u => {
    if (filterCargo !== 'todas' && u.role !== filterCargo) return false;
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
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      phone: u.phone ?? '',
      role: u.role,
      permissions: { ...EMPTY_PERMS(), ...u.permissions },
    });
    setError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  function togglePerm(key: string) {
    setForm(prev => ({ ...prev, permissions: { ...prev.permissions, [key]: !prev.permissions[key] } }));
  }

  function toggleAll(on: boolean) {
    setForm(prev => ({ ...prev, permissions: Object.fromEntries(MODULES.map(m => [m.key, on])) }));
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
          permissions: form.permissions,
        });
      } else {
        if (!form.password || form.password.length < 6) {
          setError('Senha deve ter no mínimo 6 caracteres.');
          setSubmitting(false);
          return;
        }
        await api.post('/users', {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          phone: form.phone || undefined,
          permissions: form.permissions,
        });
      }
      closeModal();
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Erro ao salvar usuário.');
    } finally {
      setSubmitting(false);
    }
  }

  function openPwdModal(u: UserRecord) {
    setPwdModal(u);
    setNewPassword('');
    setPwdError('');
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwdModal) return;
    if (newPassword.length < 6) { setPwdError('Senha deve ter no mínimo 6 caracteres.'); return; }
    setPwdSubmitting(true);
    setPwdError('');
    try {
      await api.put(`/users/${pwdModal.id}/password`, { newPassword });
      setPwdModal(null);
    } catch (err: any) {
      setPwdError(err.response?.data?.error?.message || 'Erro ao redefinir senha.');
    } finally {
      setPwdSubmitting(false);
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

  const cargoLabel = (role: UserRole) =>
    CARGO_OPTIONS.find(c => c.value === role)?.label ?? role;

  const badgeClass = (role: UserRole) =>
    CARGO_BADGE[role] ?? 'bg-ber-gray text-white';

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/configuracoes')}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-ber-gray hover:bg-ber-offwhite hover:text-ber-carbon transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-black text-ber-carbon">Usuários</h1>
          <p className="text-xs text-ber-gray">{users.length} usuários cadastrados</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-ber-olive px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white hover:opacity-90 transition-colors">
          <UserPlus size={16} />
          <span className="hidden sm:inline">Novo Usuário</span>
          <span className="sm:hidden">Novo</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ber-gray" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-ber-gray/20 bg-white pl-9 pr-3 py-2.5 text-sm text-ber-carbon outline-none focus:border-ber-olive"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFilterCargo('todas')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filterCargo === 'todas' ? 'bg-ber-carbon text-white' : 'bg-white text-ber-gray border border-ber-gray/20 hover:bg-ber-offwhite'
            }`}>
            Todos ({users.length})
          </button>
          {CARGO_OPTIONS.filter(c => users.some(u => u.role === c.value)).map(c => (
            <button key={c.value} onClick={() => setFilterCargo(c.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                filterCargo === c.value ? badgeClass(c.value) : 'bg-white text-ber-gray border border-ber-gray/20 hover:bg-ber-offwhite'
              }`}>
              {c.label} ({users.filter(u => u.role === c.value).length})
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
            {search || filterCargo !== 'todas' ? 'Nenhum usuário encontrado com este filtro.' : 'Nenhum usuário cadastrado.'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map(u => (
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
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass(u.role)}`}>
                    <Shield size={10} />
                    {cargoLabel(u.role)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(u)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-ber-olive text-xs font-semibold text-white">
                      Editar
                    </button>
                    <button onClick={() => openPwdModal(u)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-ber-teal text-white"
                      title="Redefinir senha">
                      <KeyRound size={16} />
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
                  <th className="px-6 py-4">Usuário</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Cargo</th>
                  <th className="px-6 py-4">Módulos</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const activeModules = MODULES.filter(m => u.permissions?.[m.key]);
                  return (
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
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass(u.role)}`}>
                          <Shield size={10} />
                          {cargoLabel(u.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {activeModules.length === 0 ? (
                          <span className="text-xs text-ber-gray italic">Padrão do cargo</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {activeModules.map(m => (
                              <span key={m.key} className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-ber-olive/10 text-ber-olive">
                                {m.label}
                              </span>
                            ))}
                          </div>
                        )}
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
                          <button onClick={() => openPwdModal(u)}
                            className="rounded-lg bg-ber-teal p-1.5 text-white hover:opacity-90 transition-colors"
                            title="Redefinir senha">
                            <KeyRound size={14} />
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal — redefinir senha */}
      {pwdModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-t-2xl md:rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-ber-carbon">Redefinir Senha</h2>
                <p className="text-xs text-ber-gray">{pwdModal.name}</p>
              </div>
              <button onClick={() => setPwdModal(null)} className="rounded p-1 text-ber-gray hover:text-ber-carbon">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Nova senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoFocus
                  className="w-full rounded-lg border border-ber-gray/20 px-3 py-2.5 text-sm text-ber-carbon outline-none focus:border-ber-teal"
                />
              </div>
              {pwdError && <p className="text-sm font-medium text-red-500">{pwdError}</p>}
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setPwdModal(null)}
                  className="rounded-lg border border-ber-gray/20 px-4 py-2.5 text-sm font-semibold text-ber-gray hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={pwdSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-ber-teal px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-colors disabled:opacity-50">
                  <KeyRound size={16} />
                  {pwdSubmitting ? 'Salvando...' : 'Salvar Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal — criar/editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-t-2xl md:rounded-lg bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-ber-carbon">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h2>
              <button onClick={closeModal} className="rounded p-1 text-ber-gray hover:text-ber-carbon">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Nome</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                  className="w-full rounded-lg border border-ber-gray/20 px-3 py-2.5 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  required disabled={!!editingUser}
                  className="w-full rounded-lg border border-ber-gray/20 px-3 py-2.5 text-sm text-ber-carbon outline-none focus:border-ber-olive disabled:bg-gray-50 disabled:text-ber-gray" />
              </div>

              {!editingUser && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">Senha</label>
                  <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required
                    className="w-full rounded-lg border border-ber-gray/20 px-3 py-2.5 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Cargo</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as UserRole })}
                  className="w-full rounded-lg border border-ber-gray/20 px-3 py-2.5 text-sm text-ber-carbon outline-none focus:border-ber-olive">
                  {CARGO_OPTIONS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Telefone</label>
                <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-lg border border-ber-gray/20 px-3 py-2.5 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
              </div>

              {/* Module permissions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-ber-carbon">Módulos permitidos</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => toggleAll(true)}
                      className="text-[10px] font-semibold text-ber-olive hover:underline">Marcar todos</button>
                    <button type="button" onClick={() => toggleAll(false)}
                      className="text-[10px] font-semibold text-ber-gray hover:underline">Desmarcar todos</button>
                  </div>
                </div>
                <p className="mb-2 text-[11px] text-ber-gray">
                  Se nenhum módulo for marcado, o usuário usa as permissões padrão do cargo.
                </p>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-ber-gray/20 p-3">
                  {MODULES.map(m => (
                    <label key={m.key}
                      className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-ber-offwhite cursor-pointer transition-colors">
                      <input type="checkbox" checked={!!form.permissions[m.key]}
                        onChange={() => togglePerm(m.key)}
                        className="h-4 w-4 rounded border-ber-gray/30 text-ber-olive focus:ring-ber-olive" />
                      <span className="text-sm text-ber-carbon">{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Status toggle — edit only */}
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
