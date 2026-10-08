'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { useTabState } from '@/hooks/useTabState';
import { Target, Kanban, Building2, Calendar, BarChart2, TrendingUp, Thermometer } from 'lucide-react';
import TabPipeline from './components/TabPipeline';
import TabEmpresas from './components/TabEmpresas';
import TabContatos from './components/TabContatos';
import TabAtividades from './components/TabAtividades';
import TabFunil from './components/TabFunil';
import TabRelatorios from './components/TabRelatorios';
import TabNutricao from './components/TabNutricao';
import { Oportunidade, Empresa, Atividade, User, Contato, Campanha } from './types';
import { useAuthStore } from '@/stores/authStore';

type Tab = 'pipeline' | 'funil' | 'empresas' | 'contatos' | 'atividades' | 'nutricao' | 'relatorios';

const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: 'pipeline',   label: 'Pipeline',    icon: <Kanban size={15} /> },
  { value: 'funil',      label: 'Funil',        icon: <TrendingUp size={15} /> },
  { value: 'empresas',   label: 'Empresas',     icon: <Building2 size={15} /> },
  { value: 'contatos',   label: 'Contatos',     icon: <Target size={15} /> },
  { value: 'atividades', label: 'Atividades',   icon: <Calendar size={15} /> },
  { value: 'nutricao',   label: 'Nutrição',     icon: <Thermometer size={15} /> },
  { value: 'relatorios', label: 'Relatórios',   icon: <BarChart2 size={15} /> },
];

// Farol Comercial (08/10/26, Bruno: "só pra mim") — banner fixo com a conta
// da meta/run rate, visível apenas pro sócio; mesmo cálculo do e-mail 7h30.
interface Farol {
  ano: number; metaAno: number; realizadoAno: number; pctMeta: number;
  falta: number; runRateAtual: number; runRateNecessario: number;
  multiplicador: number | null; valorFunilQuente: number; pctFunilNecessario: number | null;
}
const fmtM = (v: number): string => {
  const nf = (n: number, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  if (v >= 1_000_000) return `R$ ${nf(v / 1_000_000)} M`;
  if (v >= 1_000) return `R$ ${nf(v / 1_000, 0)} mil`;
  return `R$ ${nf(v, 0)}`;
};

export default function CrmPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [farol, setFarol] = useState<Farol | null>(null);
  const [tab, setTab] = useTabState<Tab>('pipeline');
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [ops, emps, ativs, ctts, camps, usrs] = await Promise.all([
        api.get('/crm/oportunidades'),
        api.get('/crm/empresas'),
        api.get('/crm/atividades'),
        api.get('/crm/contatos'),
        api.get('/crm/campanhas'),
        api.get('/users/responsaveis').catch(() => ({ data: [] })),
      ]);
      setOportunidades(ops.data);
      setEmpresas(emps.data);
      setAtividades(ativs.data);
      setContatos(ctts.data);
      setCampanhas(camps.data);
      setUsers(Array.isArray(usrs.data) ? usrs.data : (usrs.data?.data ?? []));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (currentUser?.role !== 'socio') return;
    api.get('/crm/farol').then((r) => setFarol(r.data.data)).catch(() => { /* sem farol, segue sem banner */ });
  }, [currentUser?.role]);

  const pendentesCount = atividades.filter((a) => !a.concluida && new Date(a.dataHora) < new Date()).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-6 pt-5 pb-3 border-b border-ber-border bg-white">
        <Target size={20} className="text-ber-teal shrink-0" />
        <div>
          <h1 className="font-bold text-ber-carbon text-lg leading-tight">CRM</h1>
          <p className="text-xs text-ber-gray">Gestão Comercial BÈR</p>
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-ber-gray">
          <span>{oportunidades.filter((o) => !['ganho', 'perdido', 'declinado', 'cancelado'].includes(o.etapa)).length} em aberto</span>
          <span className="text-ber-border">|</span>
          <span>{empresas.length} empresas</span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 overflow-x-auto border-b border-ber-border bg-white px-4 md:px-6">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
              tab === t.value
                ? 'border-ber-teal text-ber-teal'
                : 'border-transparent text-ber-gray hover:text-ber-carbon'
            }`}
          >
            {t.icon}
            {t.label}
            {t.value === 'atividades' && pendentesCount > 0 && (
              <span className="ml-1 bg-ber-red text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {pendentesCount > 9 ? '9+' : pendentesCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Farol Comercial — só sócio */}
      {farol && farol.metaAno > 0 && (
        <div className="px-4 md:px-6 py-2 bg-[#F4F1E8] border-b border-ber-border text-[12.5px] text-ber-carbon flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-bold">🎯 Meta {farol.ano}: {fmtM(farol.metaAno)}</span>
          <span>· ganho {fmtM(farol.realizadoAno)} ({farol.pctMeta}%)</span>
          <span>· falta <strong className="text-ber-red">{fmtM(farol.falta)}</strong></span>
          <span>· precisa {fmtM(farol.runRateNecessario)}/mês{farol.runRateAtual > 0 ? ` (atual ${fmtM(farol.runRateAtual)}/mês)` : ''}</span>
          {farol.pctFunilNecessario != null && (
            <span>· {fmtM(farol.valorFunilQuente)} quentes no funil — fechar ~{farol.pctFunilNecessario}% bate a meta</span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-ber-gray text-sm">Carregando...</div>
        ) : (
          <>
            {tab === 'pipeline' && (
              <TabPipeline oportunidades={oportunidades} users={users} onRefresh={fetchAll} />
            )}
            {tab === 'funil' && <TabFunil oportunidades={oportunidades} />}
            {tab === 'empresas' && (
              <TabEmpresas empresas={empresas} onRefresh={fetchAll} />
            )}
            {tab === 'contatos' && (
              <TabContatos empresas={empresas} onRefresh={fetchAll} />
            )}
            {tab === 'atividades' && (
              <TabAtividades atividades={atividades} oportunidades={oportunidades} users={users} currentUserId={currentUser?.id} onRefresh={fetchAll} />
            )}
            {tab === 'nutricao' && (
              <TabNutricao contatos={contatos} users={users} onRefresh={fetchAll} />
            )}
            {tab === 'relatorios' && <TabRelatorios oportunidades={oportunidades} />}
          </>
        )}
      </div>
    </div>
  );
}
