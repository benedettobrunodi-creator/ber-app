'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore, UserRole } from '@/stores/authStore';
import {
  Users,
  UserPlus,
  Settings,
  Eye,
  EyeOff,
  Save,
  X,
  Shield,
} from 'lucide-react';

// --- Types ---

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
}

interface UserFormData {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: UserRole;
}

// --- Constants ---

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

const EMPTY_FORM: UserFormData = {
  name: '',
  email: '',
  password: '',
  phone: '',
  role: 'campo',
};

// --- Helpers ---

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// --- Component ---

export default function ConfiguracoesPage() {
  const user = useAuthStore((s) => s.user);
  const isDiretoria = user?.role === 'diretoria';

  const [activeTab, setActiveTab] = useState<'usuarios' | 'perfil'>(
    isDiretoria ? 'usuarios' : 'perfil',
  );

  // Users tab state
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<UserFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Profile tab state
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // --- Fetch users ---

  async function fetchUsers() {
    setLoadingUsers(true);
    try {
      const res = await api.get('/users', { params: { limit: 100 } });
      setUsers(res.data.data);
    } catch {
      /* interceptor */
    } finally {
      setLoadingUsers(false);
    }
  }

  // --- Fetch profile ---

  async function fetchProfile() {
    setLoadingProfile(true);
    try {
      const res = await api.get('/users/me');
      const me = res.data.data;
      setProfileName(me.name ?? '');
      setProfilePhone(me.phone ?? '');
    } catch {
      /* interceptor */
    } finally {
      setLoadingProfile(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'usuarios' && isDiretoria) {
      fetchUsers();
    } else if (activeTab === 'perfil') {
      fetchProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // --- User modal handlers ---

  function openCreateModal() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEditModal(u: UserRecord) {
    setEditingUser(u);
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      phone: u.phone ?? '',
      role: u.role,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingUser(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmitUser(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, {
          name: form.name,
          role: form.role,
          phone: form.phone || undefined,
        });
      } else {
        await api.post('/users', {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          phone: form.phone || undefined,
        });
      }
      closeModal();
      fetchUsers();
    } catch {
      /* interceptor */
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
    } catch {
      /* interceptor */
    }
  }

  // --- Profile handlers ---

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg('');
    try {
      await api.put('/users/me', {
        name: profileName,
        phone: profilePhone || undefined,
      });
      setProfileMsg('Perfil atualizado com sucesso.');
    } catch {
      /* interceptor */
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPasswordMsg('');

    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve ter no minimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas nao coincidem.');
      return;
    }

    setSavingPassword(true);
    try {
      await api.post('/users/me/change-password', {
        currentPassword,
        newPassword,
      });
      setPasswordMsg('Senha alterada com sucesso.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setPasswordError('Erro ao alterar senha. Verifique a senha atual.');
    } finally {
      setSavingPassword(false);
    }
  }

  // --- Tabs ---

  const tabs = isDiretoria
    ? [
        { key: 'usuarios' as const, label: 'Usuarios', icon: Users },
        { key: 'perfil' as const, label: 'Meu Perfil', icon: Settings },
      ]
    : [{ key: 'perfil' as const, label: 'Meu Perfil', icon: Settings }];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-ber-carbon">Configuracoes</h1>
        {activeTab === 'usuarios' && isDiretoria && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-lg bg-ber-olive px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
          >
            <UserPlus size={16} />
            Novo Usuario
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="mt-6 flex gap-6 border-b border-ber-gray/20">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'border-ber-olive text-ber-carbon'
                : 'border-transparent text-ber-gray hover:text-ber-carbon'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'usuarios' && isDiretoria && (
          <>
            {loadingUsers ? (
              <div className="py-12 text-center text-sm text-ber-gray">
                Carregando...
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <Users size={48} className="text-ber-gray/40" />
                <p className="mt-4 text-sm font-medium text-ber-gray">
                  Nenhum usuario encontrado
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-ber-gray/10 text-xs font-semibold uppercase text-ber-gray">
                      <th className="px-6 py-4">Usuario</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Telefone</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-ber-gray/5 last:border-0"
                      >
                        {/* Avatar + Name */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {u.avatarUrl ? (
                              <img
                                src={u.avatarUrl}
                                alt={u.name}
                                className="h-9 w-9 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ber-teal text-xs font-bold text-white">
                                {getInitials(u.name)}
                              </div>
                            )}
                            <span className="font-medium text-ber-carbon">
                              {u.name}
                            </span>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="px-6 py-4 text-ber-gray">{u.email}</td>

                        {/* Role badge */}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE[u.role]}`}
                          >
                            <Shield size={10} />
                            {ROLE_LABELS[u.role]}
                          </span>
                        </td>

                        {/* Phone */}
                        <td className="px-6 py-4 text-ber-gray">
                          {u.phone || '-'}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          {u.isActive ? (
                            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                              Ativo
                            </span>
                          ) : (
                            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                              Inativo
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditModal(u)}
                              className="rounded-lg bg-ber-olive px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleToggleActive(u)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90 ${
                                u.isActive ? 'bg-red-500' : 'bg-green-600'
                              }`}
                            >
                              {u.isActive ? 'Desativar' : 'Reativar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === 'perfil' && (
          <div className="space-y-6">
            {/* Profile form */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-ber-carbon">Meu Perfil</h2>
              {loadingProfile ? (
                <div className="py-8 text-center text-sm text-ber-gray">
                  Carregando...
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-ber-carbon">
                      Nome
                    </label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                      className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-ber-carbon">
                      Telefone
                    </label>
                    <input
                      type="text"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive"
                    />
                  </div>

                  {profileMsg && (
                    <p className="text-sm font-medium text-green-600">
                      {profileMsg}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="flex items-center gap-2 rounded-lg bg-ber-olive px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
                  >
                    <Save size={16} />
                    {savingProfile ? 'Salvando...' : 'Salvar'}
                  </button>
                </form>
              )}
            </div>

            {/* Change password */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-ber-carbon">
                Alterar Senha
              </h2>
              <form
                onSubmit={handleChangePassword}
                className="mt-4 space-y-4"
              >
                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">
                    Senha atual
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPw ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 pr-10 text-sm text-ber-carbon outline-none focus:border-ber-olive"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ber-gray hover:text-ber-carbon"
                    >
                      {showCurrentPw ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">
                    Nova senha
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 pr-10 text-sm text-ber-carbon outline-none focus:border-ber-olive"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ber-gray hover:text-ber-carbon"
                    >
                      {showNewPw ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">
                    Confirmar nova senha
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive"
                  />
                </div>

                {passwordError && (
                  <p className="text-sm font-medium text-red-500">
                    {passwordError}
                  </p>
                )}
                {passwordMsg && (
                  <p className="text-sm font-medium text-green-600">
                    {passwordMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="flex items-center gap-2 rounded-lg bg-ber-olive px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  <Save size={16} />
                  {savingPassword ? 'Alterando...' : 'Alterar Senha'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* User modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ber-carbon">
                {editingUser ? 'Editar Usuario' : 'Novo Usuario'}
              </h2>
              <button
                onClick={closeModal}
                className="rounded p-1 text-ber-gray transition-colors hover:text-ber-carbon"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitUser} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">
                  Nome
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  disabled={!!editingUser}
                  className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive disabled:bg-gray-50 disabled:text-ber-gray"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">
                    Senha
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    required
                    className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">
                  Telefone
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as UserRole })
                  }
                  className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive"
                >
                  <option value="diretoria">Diretoria</option>
                  <option value="coordenacao">Coordenacao</option>
                  <option value="gestor">Gestor</option>
                  <option value="campo">Campo</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-ber-gray/20 px-4 py-2 text-sm font-semibold text-ber-gray transition-colors hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-lg bg-ber-olive px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
                >
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
