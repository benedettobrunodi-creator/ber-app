'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore, UserRole } from '@/stores/authStore';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  Settings,
  Eye,
  EyeOff,
  Save,
  X,
  Shield,
  ArrowRight,
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Terminal,
  Bot,
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

const ROLE_LABELS: Record<UserRole, string> = {
  diretoria:   'Diretoria',
  coordenacao: 'Coordenação',
  pmo:         'PMO',
  engenharia:  'Engenharia',
  financeiro:  'Financeiro',
  gestor:      'Gestor de Obras',
  compras:     'Compras',
  orcamentos:  'Orçamentos',
  campo:       'Campo',
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
  const canManageUsers = user?.role === 'diretoria' || user?.role === 'coordenacao';

  const [activeTab, setActiveTab] = useState<'usuarios' | 'perfil' | 'api'>(
    canManageUsers ? 'usuarios' : 'perfil',
  );

  // API Keys state
  interface ApiKeyRecord { id: string; name: string; keyPrefix: string; active: boolean; lastUsedAt: string | null; createdAt: string }
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [apiCreating, setApiCreating] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);

  async function loadApiKeys() {
    setApiLoading(true);
    try {
      const res = await api.get('/api-keys');
      setApiKeys(res.data.data ?? []);
    } finally { setApiLoading(false); }
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setApiCreating(true);
    try {
      const res = await api.post('/api-keys', { name: newKeyName.trim() });
      setGeneratedKey(res.data.data.key);
      setNewKeyName('');
      loadApiKeys();
    } finally { setApiCreating(false); }
  }

  async function handleRevokeKey(id: string) {
    if (!confirm('Revogar esta chave? Agentes que usam ela vão parar de funcionar.')) return;
    await api.delete(`/api-keys/${id}`);
    loadApiKeys();
  }

  function copyToClipboard(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  const mcpConfig = `{
  "mcpServers": {
    "ber-app": {
      "command": "node",
      "args": ["/Users/assistentebruno/ber-app/mcp/dist/index.js"],
      "env": {
        "BER_API_URL": "https://ber-app-production.up.railway.app/v1",
        "BER_API_KEY": "<sua-chave-aqui>"
      }
    }
  }
}`;

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
    if (activeTab === 'usuarios' && canManageUsers) {
      fetchUsers();
    } else if (activeTab === 'perfil') {
      fetchProfile();
    } else if (activeTab === 'api') {
      loadApiKeys();
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

  const tabs = [
    ...(canManageUsers ? [{ key: 'usuarios' as const, label: 'Usuarios', icon: Users }] : []),
    { key: 'perfil' as const, label: 'Meu Perfil', icon: Settings },
    { key: 'api' as const, label: 'API & Agentes', icon: Bot },
  ];

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-black text-ber-carbon">Configuracoes</h1>
        {activeTab === 'usuarios' && canManageUsers && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-lg bg-ber-olive px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white transition-colors hover:opacity-90"
          >
            <UserPlus size={16} />
            <span className="hidden sm:inline">Novo Usuario</span>
            <span className="sm:hidden">Novo</span>
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
        {activeTab === 'usuarios' && canManageUsers && (
          <div className="space-y-4">
            <Link href="/configuracoes/usuarios"
              className="flex items-center justify-between rounded-lg bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-ber-olive/10">
                  <Users size={24} className="text-ber-olive" />
                </div>
                <div>
                  <h3 className="font-bold text-ber-carbon">Gestao de Usuarios</h3>
                  <p className="text-sm text-ber-gray">Criar, editar roles e gerenciar status dos usuarios</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-ber-gray" />
            </Link>
            <Link href="/configuracoes/roles"
              className="flex items-center justify-between rounded-lg bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-ber-teal/10">
                  <Shield size={24} className="text-ber-teal" />
                </div>
                <div>
                  <h3 className="font-bold text-ber-carbon">Roles e Permissoes</h3>
                  <p className="text-sm text-ber-gray">Configurar permissoes por modulo para cada role</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-ber-gray" />
            </Link>
          </div>
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

        {/* ── API & Agentes ── */}
        {activeTab === 'api' && (
          <div className="space-y-6">

            {/* Gerar nova chave */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#06A99D]/10">
                  <Key size={20} className="text-[#06A99D]" />
                </div>
                <div>
                  <h2 className="font-bold text-ber-carbon">API Keys</h2>
                  <p className="text-xs text-ber-gray">Chaves para autenticar agentes Claude Code via header <code className="bg-gray-100 px-1 rounded">X-Api-Key</code></p>
                </div>
              </div>

              <form onSubmit={handleCreateKey} className="flex gap-2 mb-5">
                <input
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#06A99D] focus:outline-none"
                  placeholder="Nome da chave (ex: Agente Orçamentos)"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                />
                <button type="submit" disabled={apiCreating || !newKeyName.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-[#06A99D] px-4 py-2 text-sm font-bold text-white hover:bg-[#058e83] disabled:opacity-50">
                  <Plus size={14} /> Gerar
                </button>
              </form>

              {/* Chave recém gerada */}
              {generatedKey && (
                <div className="mb-5 rounded-lg border-2 border-green-200 bg-green-50 p-4">
                  <p className="text-xs font-bold text-green-700 mb-2">Chave gerada — copie agora, não será exibida novamente</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all rounded bg-white px-3 py-2 text-xs font-mono text-gray-800 border border-green-200">{generatedKey}</code>
                    <button onClick={() => copyToClipboard(generatedKey, setCopiedKey)}
                      className="shrink-0 rounded-lg p-2 hover:bg-green-100 text-green-700">
                      {copiedKey ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                  <button onClick={() => setGeneratedKey('')} className="mt-2 text-xs text-green-600 hover:underline">Fechar</button>
                </div>
              )}

              {/* Lista de chaves */}
              {apiLoading ? (
                <p className="text-sm text-gray-400">Carregando…</p>
              ) : apiKeys.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Nenhuma chave criada ainda</p>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map(k => (
                    <div key={k.id} className={`flex items-center justify-between rounded-lg border px-4 py-3 ${k.active ? 'border-gray-100 bg-gray-50' : 'border-gray-100 bg-gray-50 opacity-50'}`}>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{k.name}</p>
                        <p className="text-xs text-gray-400">
                          <code className="bg-gray-200 px-1 rounded">{k.keyPrefix}…</code>
                          {' · '}
                          {k.lastUsedAt ? `Último uso: ${new Date(k.lastUsedAt).toLocaleDateString('pt-BR')}` : 'Nunca usada'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${k.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                          {k.active ? 'Ativa' : 'Revogada'}
                        </span>
                        {k.active && (
                          <button onClick={() => handleRevokeKey(k.id)}
                            className="rounded p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MCP Config */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                  <Terminal size={20} className="text-purple-600" />
                </div>
                <div>
                  <h2 className="font-bold text-ber-carbon">Configuração MCP</h2>
                  <p className="text-xs text-ber-gray">Cole em <code className="bg-gray-100 px-1 rounded">~/.claude/settings.json</code> e substitua <code className="bg-gray-100 px-1 rounded">&lt;sua-chave-aqui&gt;</code></p>
                </div>
              </div>
              <div className="relative">
                <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-green-400 font-mono leading-relaxed">{mcpConfig}</pre>
                <button onClick={() => copyToClipboard(mcpConfig, setCopiedConfig)}
                  className="absolute top-3 right-3 flex items-center gap-1 rounded px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs">
                  {copiedConfig ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> Copiar</>}
                </button>
              </div>
            </div>

            {/* Ferramentas disponíveis */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  <Bot size={20} className="text-blue-600" />
                </div>
                <h2 className="font-bold text-ber-carbon">Ferramentas disponíveis</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { name: 'list_orcamentos', desc: 'Lista orçamentos com filtros' },
                  { name: 'get_orcamento', desc: 'Detalhes + histórico de um orçamento' },
                  { name: 'create_orcamento', desc: 'Cria novo orçamento' },
                  { name: 'update_orcamento', desc: 'Atualiza status, probabilidade, etc.' },
                  { name: 'get_pipeline_orcamentos', desc: 'Pipeline agrupado por probabilidade' },
                  { name: 'list_obras', desc: 'Lista obras ativas' },
                  { name: 'get_obra', desc: 'Detalhes de uma obra' },
                  { name: 'list_users', desc: 'Lista usuários do sistema' },
                ].map(t => (
                  <div key={t.name} className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2">
                    <code className="shrink-0 text-[11px] font-mono font-bold text-[#06A99D]">{t.name}</code>
                    <span className="text-xs text-gray-500">{t.desc}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* User modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-2xl md:rounded-lg bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
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
