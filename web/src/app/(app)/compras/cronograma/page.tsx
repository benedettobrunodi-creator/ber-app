'use client';

/**
 * Cronograma de Contratações — visão GLOBAL (hub de Compras, Bruno 24/09/26):
 * todas as obras numa tabela só, sem entrar obra por obra. MESMA fonte de
 * dados das telas por obra — editar aqui é editar lá (PATCH /contratacao-plano/:id,
 * que já era usado pela tela da obra). Regra permanente: NUNCA mostrar valor
 * aqui (tela visível a mais papéis que Metas de Compra).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarRange, Search, ExternalLink } from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/lib/toast';
import FornecedorInput from '@/components/FornecedorInput';

const STATUS_META: Record<string, { label: string; color: string }> = {
  a_contratar: { label: 'A contratar',  color: 'bg-gray-200 text-gray-700' },
  em_cotacao:  { label: 'Em cotação',   color: 'bg-amber-100 text-amber-700' },
  contratado:  { label: 'Contratado',   color: 'bg-green-100 text-green-700' },
  atrasado:    { label: 'Atrasado ⚠',  color: 'bg-red-100 text-red-700' },
};

interface PlanoGlobal {
  id: string;
  obraId: string;
  obraNome: string;
  obraStatus: string;
  pacote: string;
  status: keyof typeof STATUS_META;
  statusEfetivo: keyof typeof STATUS_META;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  responsavel: string | null;
  empresaContratada: string | null;
  fornecedorId: string | null;
  dataIdeal: string | null;
  dataLimite: string | null;
  numerosOc: string[];
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const fmtData = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';

// Obras ativas primeiro no filtro (arquivada/concluída só se selecionar)
const OBRA_ATIVA = new Set(['nao_iniciada', 'planejamento', 'em_andamento', 'pos_obra', 'pausada']);

export default function CronogramaGlobalPage() {
  const [planos, setPlanos] = useState<PlanoGlobal[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [busca, setBusca] = useState('');
  const [obraSel, setObraSel] = useState('');
  const [statusSel, setStatusSel] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(false);
    try {
      const r = await api.get<{ data: PlanoGlobal[] }>('/contratacao-plano');
      setPlanos(r.data.data);
    } catch {
      setErro(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function saveField(id: string, patch: Record<string, string | null>) {
    // otimista: aplica local e persiste; erro → recarrega
    setPlanos(prev => prev.map(p => (p.id === id ? { ...p, ...patch } as PlanoGlobal : p)));
    try {
      await api.patch(`/contratacao-plano/${id}`, patch);
    } catch (e) {
      toast((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Erro ao salvar', 'erro');
      carregar();
    }
  }

  const obras = useMemo(() => {
    const m = new Map<string, { nome: string; ativa: boolean }>();
    for (const p of planos) m.set(p.obraId, { nome: p.obraNome, ativa: OBRA_ATIVA.has(p.obraStatus) });
    return Array.from(m.entries()).sort((a, b) => a[1].nome.localeCompare(b[1].nome, 'pt-BR'));
  }, [planos]);

  const filtrados = useMemo(() => {
    const q = norm(busca.trim());
    return planos.filter(p => {
      // por padrão, esconde obras arquivadas/concluídas (aparecem se selecionadas no filtro)
      if (!obraSel && !OBRA_ATIVA.has(p.obraStatus)) return false;
      if (obraSel && p.obraId !== obraSel) return false;
      if (statusSel && p.statusEfetivo !== statusSel) return false;
      if (q && !norm(`${p.obraNome} ${p.pacote} ${p.empresaContratada ?? ''} ${p.responsavel ?? ''}`).includes(q)) return false;
      return true;
    });
  }, [planos, busca, obraSel, statusSel]);

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <h1 className="flex items-center gap-2 text-xl font-bold text-ber-carbon mb-1">
        <CalendarRange size={20} className="text-ber-teal" /> Cronograma de Contratações — todas as obras
      </h1>
      <p className="mb-4 text-xs text-ber-gray max-w-2xl">
        Mesma fonte das telas por obra: o que você editar aqui aparece lá (e vice-versa).
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ber-gray/60" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar pacote, empresa, obra…"
            className="text-sm pl-8 pr-3 py-1.5 border border-ber-border rounded-lg w-64" />
        </div>
        <select value={obraSel} onChange={e => setObraSel(e.target.value)} className="text-sm px-2 py-1.5 border border-ber-border rounded-lg bg-white">
          <option value="">Obras ativas</option>
          {obras.map(([id, o]) => <option key={id} value={id}>{o.nome}{o.ativa ? '' : ' (arquivada/concluída)'}</option>)}
        </select>
        <select value={statusSel} onChange={e => setStatusSel(e.target.value)} className="text-sm px-2 py-1.5 border border-ber-border rounded-lg bg-white">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span className="text-xs text-ber-gray ml-auto">{filtrados.length} linha{filtrados.length === 1 ? '' : 's'}</span>
      </div>

      {loading ? (
        <p className="text-sm text-ber-gray">Carregando…</p>
      ) : erro ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          Não consegui carregar. <button onClick={carregar} className="underline font-medium">Tentar de novo</button>
        </div>
      ) : (
        <div className="bg-white border border-ber-border rounded-xl overflow-x-auto">
          <table className="w-full text-xs min-w-[1000px]">
            <thead>
              <tr className="border-b border-ber-border text-left text-[10px] uppercase tracking-wide text-ber-gray">
                <th className="px-3 py-2">Obra</th>
                <th className="px-3 py-2">Pacote</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Empresa contratada</th>
                <th className="px-3 py-2">Contato</th>
                <th className="px-3 py-2">Telefone</th>
                <th className="px-3 py-2">Data ideal</th>
                <th className="px-3 py-2">Data limite</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ber-border/60">
              {filtrados.map(p => {
                const st = STATUS_META[p.statusEfetivo] ?? STATUS_META.a_contratar;
                return (
                  <tr key={p.id} className="hover:bg-ber-bg/40">
                    <td className="px-3 py-2 max-w-44">
                      <p className="truncate font-medium text-ber-carbon" title={p.obraNome}>{p.obraNome}</p>
                    </td>
                    <td className="px-3 py-2 max-w-44"><p className="truncate" title={p.pacote}>{p.pacote}</p></td>
                    <td className="px-3 py-2">
                      <select
                        value={p.status}
                        onChange={e => saveField(p.id, { status: e.target.value })}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold border-0 ${st.color}`}
                      >
                        {Object.entries(STATUS_META).filter(([k]) => k !== 'atrasado').map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 min-w-44">
                      <FornecedorInput
                        value={p.empresaContratada || ''}
                        placeholder="Empresa…"
                        onSave={(nome, fid) => saveField(p.id, { empresaContratada: nome || null, fornecedorId: fid })}
                        className="w-full rounded border border-transparent hover:border-ber-gray/30 focus:border-ber-teal bg-transparent px-1 py-0.5 text-xs focus:outline-none"
                      />
                      {p.numerosOc.length > 0 && (
                        <p className="px-1 text-[10px] text-ber-gray">OC {p.numerosOc.join(' · ')}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input defaultValue={p.contato ?? ''} placeholder="Nome…"
                        onBlur={e => { if (e.target.value !== (p.contato ?? '')) saveField(p.id, { contato: e.target.value || null }); }}
                        className="w-28 rounded border border-transparent hover:border-ber-gray/30 focus:border-ber-teal bg-transparent px-1 py-0.5 text-xs focus:outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <input defaultValue={p.telefone ?? ''} placeholder="WhatsApp…"
                        onBlur={e => { if (e.target.value !== (p.telefone ?? '')) saveField(p.id, { telefone: e.target.value || null }); }}
                        className="w-28 rounded border border-transparent hover:border-ber-gray/30 focus:border-ber-teal bg-transparent px-1 py-0.5 text-xs focus:outline-none" />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-ber-gray">{fmtData(p.dataIdeal)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-ber-gray">{fmtData(p.dataLimite)}</td>
                    <td className="px-3 py-2">
                      <Link href={`/obras/${p.obraId}/cronograma-contratacoes`} title="Abrir na obra (edição completa)"
                        className="text-ber-gray/60 hover:text-ber-teal">
                        <ExternalLink size={14} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-ber-gray">Nenhuma linha com esses filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
