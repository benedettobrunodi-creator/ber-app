'use client';

/**
 * Fornecedores — gestão do cadastro único (hub de Compras, Bruno 24/09/26).
 * Os 152+ fornecedores canônicos usados por Metas de Compra, Cronograma de
 * Contratações e Medição de Fornecedores. Aqui dá pra completar contato,
 * telefone, e-mail e CNPJ — o e-mail daqui é o que a Medição de Fornecedores
 * usa na autorização de faturamento.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, Search } from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/lib/toast';

interface Fornecedor {
  id: string;
  nome: string;
  cnpj: string | null;
  contato: string | null;
  telefone: string | null;
  email: string | null;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function FornecedoresPage() {
  const [lista, setLista] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(false);
    try {
      const r = await api.get<{ data: Fornecedor[] }>('/fornecedores');
      setLista(r.data.data);
    } catch {
      setErro(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvar(id: string, campo: keyof Fornecedor, valor: string) {
    setLista(prev => prev.map(f => (f.id === id ? { ...f, [campo]: valor || null } : f)));
    try {
      await api.patch(`/fornecedores/${id}`, { [campo]: valor || null });
    } catch (e) {
      toast((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Erro ao salvar', 'erro');
      carregar();
    }
  }

  const filtrados = useMemo(() => {
    const q = norm(busca.trim());
    if (!q) return lista;
    return lista.filter(f => norm(`${f.nome} ${f.contato ?? ''} ${f.email ?? ''} ${f.cnpj ?? ''}`).includes(q));
  }, [lista, busca]);

  const semEmail = useMemo(() => lista.filter(f => !f.email).length, [lista]);

  const celula = 'w-full rounded border border-transparent hover:border-ber-gray/30 focus:border-ber-teal bg-transparent px-1 py-0.5 text-xs focus:outline-none';

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <h1 className="flex items-center gap-2 text-xl font-bold text-ber-carbon mb-1">
        <Package size={20} className="text-ber-teal" /> Fornecedores
      </h1>
      <p className="mb-4 text-xs text-ber-gray max-w-2xl">
        Cadastro único usado por Metas de Compra, Cronograma de Contratações e Medição de Fornecedores.
        O e-mail daqui é o usado na autorização automática de faturamento.
        {semEmail > 0 && <span className="text-amber-700 font-medium"> {semEmail} fornecedor{semEmail === 1 ? '' : 'es'} ainda sem e-mail.</span>}
      </p>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ber-gray/60" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar fornecedor, contato, e-mail…"
            className="text-sm pl-8 pr-3 py-1.5 border border-ber-border rounded-lg w-72" />
        </div>
        <span className="text-xs text-ber-gray ml-auto">{filtrados.length} de {lista.length}</span>
      </div>

      {loading ? (
        <p className="text-sm text-ber-gray">Carregando…</p>
      ) : erro ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          Não consegui carregar. <button onClick={carregar} className="underline font-medium">Tentar de novo</button>
        </div>
      ) : (
        <div className="bg-white border border-ber-border rounded-xl overflow-x-auto">
          <table className="w-full text-xs min-w-[820px]">
            <thead>
              <tr className="border-b border-ber-border text-left text-[10px] uppercase tracking-wide text-ber-gray">
                <th className="px-3 py-2">Fornecedor</th>
                <th className="px-3 py-2">Contato</th>
                <th className="px-3 py-2">Telefone</th>
                <th className="px-3 py-2">E-mail</th>
                <th className="px-3 py-2">CNPJ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ber-border/60">
              {filtrados.map(f => (
                <tr key={f.id} className="hover:bg-ber-bg/40">
                  <td className="px-3 py-2 font-medium text-ber-carbon max-w-56">
                    <input defaultValue={f.nome}
                      onBlur={e => { const v = e.target.value.trim(); if (v && v !== f.nome) salvar(f.id, 'nome', v); }}
                      className={`${celula} font-medium`} />
                  </td>
                  <td className="px-3 py-2">
                    <input defaultValue={f.contato ?? ''} placeholder="Nome…"
                      onBlur={e => { if (e.target.value !== (f.contato ?? '')) salvar(f.id, 'contato', e.target.value); }}
                      className={celula} />
                  </td>
                  <td className="px-3 py-2">
                    <input defaultValue={f.telefone ?? ''} placeholder="WhatsApp…"
                      onBlur={e => { if (e.target.value !== (f.telefone ?? '')) salvar(f.id, 'telefone', e.target.value); }}
                      className={celula} />
                  </td>
                  <td className="px-3 py-2">
                    <input defaultValue={f.email ?? ''} placeholder="email@…" type="email"
                      onBlur={e => { if (e.target.value !== (f.email ?? '')) salvar(f.id, 'email', e.target.value); }}
                      className={`${celula} ${!f.email ? 'placeholder:text-amber-500' : ''}`} />
                  </td>
                  <td className="px-3 py-2">
                    <input defaultValue={f.cnpj ?? ''} placeholder="00.000.000/0001-00"
                      onBlur={e => { if (e.target.value !== (f.cnpj ?? '')) salvar(f.id, 'cnpj', e.target.value); }}
                      className={celula} />
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-ber-gray">Nenhum fornecedor encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
