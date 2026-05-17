'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Target, Kanban, Building2, Calendar, BarChart2, TrendingUp } from 'lucide-react';
import TabPipeline from './components/TabPipeline';
import TabEmpresas from './components/TabEmpresas';
import TabAtividades from './components/TabAtividades';
import TabFunil from './components/TabFunil';
import TabRelatorios from './components/TabRelatorios';
import { Oportunidade, Empresa, Atividade, User } from './types';

type Tab = 'pipeline' | 'funil' | 'empresas' | 'atividades' | 'relatorios';

const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: 'pipeline',   label: 'Pipeline',    icon: <Kanban size={15} /> },
  { value: 'funil',      label: 'Funil',        icon: <TrendingUp size={15} /> },
  { value: 'empresas',   label: 'Empresas',     icon: <Building2 size={15} /> },
  { value: 'atividades', label: 'Atividades',   icon: <Calendar size={15} /> },
  { value: 'relatorios', label: 'Relatórios',   icon: <BarChart2 size={15} /> },
];

export default function CrmPage() {
  const [tab, setTab] = useState<Tab>('pipeline');
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [ops, emps, ativs, usrs] = await Promise.all([
        api.get('/crm/oportunidades'),
        api.get('/crm/empresas'),
        api.get('/crm/atividades'),
        api.get('/users?limit=100'),
      ]);
      setOportunidades(ops.data);
      setEmpresas(emps.data);
      setAtividades(ativs.data);
      setUsers(usrs.data?.users ?? usrs.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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
          <span>{oportunidades.filter((o) => !['ganho', 'perdido'].includes(o.etapa)).length} em aberto</span>
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-ber-gray text-sm">Carregando...</div>
        ) : (
          <>
            {tab === 'pipeline' && (
              <TabPipeline oportunidades={oportunidades} users={users} onRefresh={fetchAll} />
            )}
            {tab === 'funil' && <TabFunil />}
            {tab === 'empresas' && (
              <TabEmpresas empresas={empresas} onRefresh={fetchAll} />
            )}
            {tab === 'atividades' && (
              <TabAtividades atividades={atividades} oportunidades={oportunidades} users={users} onRefresh={fetchAll} />
            )}
            {tab === 'relatorios' && <TabRelatorios />}
          </>
        )}
      </div>
    </div>
  );
}
