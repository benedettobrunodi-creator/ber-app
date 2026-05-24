'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, Plus, X, Check, Linkedin, Phone, Mail, Building2, Star, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import api from '@/lib/api';
import { Contato, Empresa, CLASSIFICACOES } from '../types';

interface Props {
  empresas: Empresa[];
  onRefresh?: () => void;
}

const CAMPOS_CARGO = [
  'CEO / Sócio',
  'Diretor',
  'Gerente',
  'Engenheiro',
  'Arquiteto',
  'Comprador',
  'Financeiro',
  'Outro',
];

function initForm() {
  return {
    empresaId: '',
    nome: '',
    cargo: '',
    email: '',
    telefone: '',
    whatsapp: '',
    linkedin: '',
    aniversario: '',
    principal: false,
  };
}

// ── Drawer de criar/editar contato ──────────────────────────────────────────

function ContatoDrawer({
  contato,
  empresas,
  onClose,
  onSaved,
}: {
  contato: Contato | null;
  empresas: Empresa[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(
    contato
      ? {
          empresaId: contato.empresaId ?? '',
          nome: contato.nome,
          cargo: contato.cargo ?? '',
          email: contato.email ?? '',
          telefone: contato.telefone ?? '',
          whatsapp: contato.whatsapp ?? '',
          linkedin: contato.linkedin ?? '',
          aniversario: contato.aniversario ? contato.aniversario.split('T')[0] : '',
          principal: contato.principal,
        }
      : initForm(),
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function set(k: keyof typeof form, v: string | boolean) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        empresaId: form.empresaId || null,
        cargo: form.cargo || null,
        email: form.email || null,
        telefone: form.telefone || null,
        whatsapp: form.whatsapp || null,
        linkedin: form.linkedin || null,
        aniversario: form.aniversario || null,
      };
      if (contato) {
        await api.patch(`/crm/contatos/${contato.id}`, payload);
      } else {
        await api.post('/crm/contatos', payload);
      }
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-[440px] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-bold text-gray-900">
            {contato ? 'Editar Contato' : 'Novo Contato'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-6">
          {/* Empresa */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Empresa</label>
            <select
              value={form.empresaId}
              onChange={(e) => set('empresaId', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
            >
              <option value="">Sem empresa</option>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.razaoSocial}
                </option>
              ))}
            </select>
          </div>

          {/* Nome */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Nome *</label>
            <input
              required
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Nome completo"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
            />
          </div>

          {/* Cargo */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Cargo</label>
            <input
              list="cargos-list"
              value={form.cargo}
              onChange={(e) => set('cargo', e.target.value)}
              placeholder="Cargo ou função"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
            />
            <datalist id="cargos-list">
              {CAMPOS_CARGO.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>

          {/* Email */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="email@empresa.com"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
            />
          </div>

          {/* Telefone + WhatsApp */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Telefone</label>
              <input
                value={form.telefone}
                onChange={(e) => set('telefone', e.target.value)}
                placeholder="(11) 9xxxx-xxxx"
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">WhatsApp</label>
              <input
                value={form.whatsapp}
                onChange={(e) => set('whatsapp', e.target.value)}
                placeholder="(11) 9xxxx-xxxx"
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
              />
            </div>
          </div>

          {/* LinkedIn */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">LinkedIn</label>
            <input
              value={form.linkedin}
              onChange={(e) => set('linkedin', e.target.value)}
              placeholder="linkedin.com/in/nome"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
            />
          </div>

          {/* Aniversário */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Aniversário</label>
            <input
              type="date"
              value={form.aniversario}
              onChange={(e) => set('aniversario', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
            />
          </div>

          {/* Principal */}
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50">
            <input
              type="checkbox"
              checked={form.principal}
              onChange={(e) => set('principal', e.target.checked)}
              className="h-4 w-4 rounded accent-green-600"
            />
            <div>
              <p className="text-sm font-medium text-gray-700">Contato principal</p>
              <p className="text-xs text-gray-400">Aparece em destaque no card da empresa</p>
            </div>
          </label>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 min-h-[44px] rounded-lg bg-green-700 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : contato ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tab principal ─────────────────────────────────────────────────────────────

export default function TabContatos({ empresas, onRefresh }: Props) {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [drawer, setDrawer] = useState<{ open: boolean; contato: Contato | null }>({
    open: false,
    contato: null,
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterClassificacao, setFilterClassificacao] = useState('');
  const [sortCol, setSortCol] = useState<'nome' | 'empresa' | 'classificacao' | 'cargo' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async (q?: string, empId?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('search', q);
      if (empId) params.set('empresaId', empId);
      const res = await api.get(`/crm/contatos?${params.toString()}`);
      setContatos(res.data.data ?? res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  function handleSearch(val: string) {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(val, filterEmpresa), 400);
  }

  function handleEmpresaFilter(val: string) {
    setFilterEmpresa(val);
    load(search, val);
  }

  function openNew() { setDrawer({ open: true, contato: null }); }
  function openEdit(c: Contato) { setDrawer({ open: true, contato: c }); }
  function closeDrawer() { setDrawer({ open: false, contato: null }); }
  async function onSaved() {
    closeDrawer();
    await load(search, filterEmpresa);
    onRefresh?.();
  }

  async function handleDelete(e: React.MouseEvent, c: Contato) {
    e.stopPropagation();
    if (deletingId === c.id) {
      try {
        await api.delete(`/crm/contatos/${c.id}`);
        setContatos((prev) => prev.filter((x) => x.id !== c.id));
        onRefresh?.();
      } finally {
        setDeletingId(null);
      }
    } else {
      setDeletingId(c.id);
    }
  }

  const whatsappHref = (w: string) =>
    `https://wa.me/55${w.replace(/\D/g, '')}`;

  function handleSort(col: 'nome' | 'empresa' | 'classificacao' | 'cargo') {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  function SortIcon({ col }: { col: 'nome' | 'empresa' | 'classificacao' | 'cargo' }) {
    if (sortCol !== col) return <ArrowUpDown size={11} className="ml-1 opacity-40 inline" />;
    return sortDir === 'asc'
      ? <ArrowUp size={11} className="ml-1 inline" />
      : <ArrowDown size={11} className="ml-1 inline" />;
  }

  const sortedContatos = useMemo(() => {
    const base = filterClassificacao
      ? contatos.filter((c) => c.empresa?.classificacao === filterClassificacao)
      : contatos;
    if (!sortCol) return base;
    return [...base].sort((a, b) => {
      let av = '', bv = '';
      if (sortCol === 'nome') { av = a.nome; bv = b.nome; }
      else if (sortCol === 'empresa') { av = a.empresa?.razaoSocial ?? ''; bv = b.empresa?.razaoSocial ?? ''; }
      else if (sortCol === 'classificacao') { av = a.empresa?.classificacao ?? ''; bv = b.empresa?.classificacao ?? ''; }
      else if (sortCol === 'cargo') { av = a.cargo ?? ''; bv = b.cargo ?? ''; }
      return sortDir === 'asc' ? av.localeCompare(bv, 'pt-BR') : bv.localeCompare(av, 'pt-BR');
    });
  }, [contatos, filterClassificacao, sortCol, sortDir]);

  async function handleToggleAllStars() {
    const allOn = sortedContatos.length > 0 && sortedContatos.every((c) => c.principal);
    const next = !allOn;
    await Promise.all(
      sortedContatos
        .filter((c) => c.principal !== next)
        .map((c) => api.patch(`/crm/contatos/${c.id}`, { principal: next }))
    );
    setContatos((prev) =>
      prev.map((c) =>
        sortedContatos.some((s) => s.id === c.id) ? { ...c, principal: next } : c
      )
    );
    onRefresh?.();
  }

  async function handleTogglePrincipal(e: React.MouseEvent, c: Contato) {
    e.stopPropagation();
    const next = !c.principal;
    await api.patch(`/crm/contatos/${c.id}`, { principal: next });
    setContatos((prev) => prev.map((x) => (x.id === c.id ? { ...x, principal: next } : x)));
    onRefresh?.();
  }

  return (
    <div className="flex h-full flex-col" onClick={() => setDeletingId(null)}>
      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-white px-4 py-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por nome, cargo, empresa..."
            className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm focus:border-green-500 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          value={filterEmpresa}
          onChange={(e) => handleEmpresaFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
        >
          <option value="">Todas as empresas</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>{e.razaoSocial}</option>
          ))}
        </select>

        <select
          value={filterClassificacao}
          onChange={(e) => setFilterClassificacao(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
        >
          <option value="">Todas as categorias</option>
          {CLASSIFICACOES.map((cl) => (
            <option key={cl} value={cl}>{cl}</option>
          ))}
        </select>

        <span className="text-xs text-gray-400">{sortedContatos.length} contato{sortedContatos.length !== 1 ? 's' : ''}</span>

        <button
          onClick={handleToggleAllStars}
          title={sortedContatos.every((c) => c.principal) ? 'Remover todas as estrelas' : 'Marcar todas como principal'}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 min-h-[36px] hover:bg-amber-50 hover:border-amber-300 hover:text-amber-600"
        >
          <Star size={13} className={sortedContatos.length > 0 && sortedContatos.every((c) => c.principal) ? 'text-amber-500' : 'text-gray-400'} fill={sortedContatos.length > 0 && sortedContatos.every((c) => c.principal) ? 'currentColor' : 'none'} />
          Estrelas
        </button>

        <button
          onClick={openNew}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white min-h-[36px] hover:bg-green-800"
        >
          <Plus size={14} /> Novo Contato
        </button>
      </div>

      {/* ── Lista ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-sm text-gray-400">
            Carregando...
          </div>
        ) : contatos.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-medium text-gray-500">Nenhum contato encontrado</p>
            {!search && !filterEmpresa && (
              <button onClick={openNew} className="text-xs text-green-700 underline">
                Criar primeiro contato
              </button>
            )}
          </div>
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-gray-800 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold">
                  <button onClick={() => handleSort('nome')} className="flex items-center hover:text-gray-300">
                    Nome<SortIcon col="nome" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold">
                  <button onClick={() => handleSort('empresa')} className="flex items-center hover:text-gray-300">
                    Empresa<SortIcon col="empresa" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold w-36">
                  <button onClick={() => handleSort('classificacao')} className="flex items-center hover:text-gray-300">
                    Classificação<SortIcon col="classificacao" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold w-36">
                  <button onClick={() => handleSort('cargo')} className="flex items-center hover:text-gray-300">
                    Cargo<SortIcon col="cargo" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold w-48">Contato</th>
                <th className="px-4 py-3 text-center text-xs font-semibold w-20">Links</th>
                <th className="px-2 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {sortedContatos.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer border-b border-gray-100 hover:bg-green-50/40"
                  onClick={() => openEdit(c)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleTogglePrincipal(e, c)}
                        title={c.principal ? 'Remover destaque' : 'Marcar como principal'}
                        className="shrink-0"
                      >
                        <Star
                          size={12}
                          className={c.principal ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}
                          fill={c.principal ? 'currentColor' : 'none'}
                        />
                      </button>
                      <span className="font-medium text-gray-900">{c.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {c.empresa ? (
                      <div className="flex items-center gap-1.5">
                        <Building2 size={12} className="shrink-0 text-gray-400" />
                        <span className="text-gray-700">{c.empresa.razaoSocial}</span>
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {c.empresa ? (
                      <select
                        value={c.empresa.classificacao ?? ''}
                        onChange={async (e) => {
                          const val = e.target.value || null;
                          await api.patch(`/crm/empresas/${c.empresa!.id}`, { classificacao: val });
                          setContatos((prev) => prev.map((x) =>
                            x.id === c.id && x.empresa
                              ? { ...x, empresa: { ...x.empresa, classificacao: val } }
                              : x
                          ));
                        }}
                        className="rounded border border-gray-200 px-2 py-1 text-xs focus:border-green-500 focus:outline-none bg-white"
                      >
                        <option value="">—</option>
                        {CLASSIFICACOES.map((cl) => <option key={cl} value={cl}>{cl}</option>)}
                      </select>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.cargo ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{c.cargo}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs text-gray-600 hover:text-green-700"
                        >
                          <Mail size={11} className="shrink-0" />
                          <span className="truncate max-w-[160px]">{c.email}</span>
                        </a>
                      )}
                      {(c.whatsapp || c.telefone) && (
                        <a
                          href={c.whatsapp ? whatsappHref(c.whatsapp) : `tel:${c.telefone}`}
                          target={c.whatsapp ? '_blank' : undefined}
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs text-gray-600 hover:text-green-700"
                        >
                          <Phone size={11} className="shrink-0" />
                          <span>{c.whatsapp ?? c.telefone}</span>
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.linkedin && (
                      <a
                        href={c.linkedin.startsWith('http') ? c.linkedin : `https://${c.linkedin}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center rounded p-1 text-blue-600 hover:bg-blue-50"
                        title="LinkedIn"
                      >
                        <Linkedin size={14} />
                      </a>
                    )}
                  </td>
                  <td className="px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleDelete(e, c)}
                      title={deletingId === c.id ? 'Clique novamente para confirmar' : 'Excluir contato'}
                      className={`inline-flex items-center justify-center rounded p-1 transition-colors ${
                        deletingId === c.id
                          ? 'bg-red-100 text-red-600 hover:bg-red-200'
                          : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                      }`}
                    >
                      {deletingId === c.id ? <Check size={14} /> : <Trash2 size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Drawer ── */}
      {drawer.open && (
        <ContatoDrawer
          contato={drawer.contato}
          empresas={empresas}
          onClose={closeDrawer}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
