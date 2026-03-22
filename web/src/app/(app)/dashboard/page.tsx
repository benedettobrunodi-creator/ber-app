'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  HardHat, TrendingUp, AlertTriangle, ClipboardCheck, XCircle,
  CheckCircle2, Tent, ListOrdered, Package, Shield, Clock, Users
} from 'lucide-react';

interface KPI { label: string; value: number | string; icon: any; color: 'green' | 'yellow' | 'red' | 'blue'; unit?: string; }

function KPICard({ kpi }: { kpi: KPI }) {
  const Icon = kpi.icon;
  const colors = {
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  const iconColors = { green: 'text-green-500', yellow: 'text-yellow-500', red: 'text-red-500', blue: 'text-blue-500' };
  return (
    <div className={`rounded-xl border p-4 ${colors[kpi.color]}`}>
      <div className="flex items-start justify-between mb-2">
        <Icon size={20} className={iconColors[kpi.color]} />
      </div>
      <div className="text-2xl font-bold mt-1">{kpi.value}{kpi.unit && <span className="text-sm font-normal ml-1">{kpi.unit}</span>}</div>
      <div className="text-xs mt-1 opacity-80">{kpi.label}</div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: any) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} className="text-[var(--ber-olive)]" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ber-carbon-light)]">{title}</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">{children}</div>
    </div>
  );
}

async function fetchSafe(url: string, fallback: any = null) {
  try { const r = await api.get(url); return r.data; } catch { return fallback; }
}

export default function DashboardPage() {
  const [obras, setObras] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const obrasData = await fetchSafe('/obras', { obras: [] });
      const obrasList = obrasData?.obras || obrasData || [];
      setObras(obrasList);

      const ativas = obrasList.filter((o: any) => o.status === 'em_andamento');
      const progressoMedio = ativas.length ? Math.round(ativas.reduce((s: number, o: any) => s + (o.progress || 0), 0) / ativas.length) : 0;
      const prazoVencido = ativas.filter((o: any) => o.endDate && new Date(o.endDate) < new Date()).length;

      // Checklists
      let checklistsPendentes = 0, naoConformes = 0, checklistsConcluidos = 0, checklistsTotal = 0;
      for (const obra of ativas) {
        const cls = await fetchSafe(`/obras/${obra.id}/checklists`, []);
        const list = Array.isArray(cls) ? cls : cls?.checklists || [];
        for (const cl of list) {
          checklistsTotal++;
          if (cl.status === 'concluido') checklistsConcluidos++;
          if (cl.status === 'em_andamento') {
            const respondidos = (cl.items || []).filter((i: any) => i.answer !== 'pendente').length;
            if (respondidos === 0) checklistsPendentes++;
            naoConformes += (cl.items || []).filter((i: any) => i.answer === 'nao' && !i.correctiveAction).length;
          }
        }
      }
      const pctConcluidos = checklistsTotal ? Math.round(checklistsConcluidos / checklistsTotal * 100) : 0;

      // Canteiro
      let semCanteiro = 0, canteiroReprovados = 0;
      const hoje = new Date();
      const semanaInicio = new Date(hoje); semanaInicio.setDate(hoje.getDate() - hoje.getDay());
      for (const obra of ativas) {
        const ct = await fetchSafe(`/obras/${obra.id}/canteiro`, []);
        const list = Array.isArray(ct) ? ct : ct?.checklists || [];
        const estaSemana = list.filter((c: any) => new Date(c.weekStart) >= semanaInicio);
        if (estaSemana.length === 0) semCanteiro++;
        for (const c of estaSemana) {
          canteiroReprovados += (c.items || []).filter((i: any) => i.status === 'reprovado').length;
        }
      }

      // Sequenciamento
      let aguardandoAprovacao = 0, etapasAtrasadas = 0;
      for (const obra of ativas) {
        const etapas = await fetchSafe(`/obras/${obra.id}/sequenciamento`, []);
        const list = Array.isArray(etapas) ? etapas : etapas?.etapas || [];
        aguardandoAprovacao += list.filter((e: any) => e.status === 'aguardando_aprovacao').length;
        etapasAtrasadas += list.filter((e: any) => e.endDate && new Date(e.endDate) < new Date() && !['aprovada','concluida'].includes(e.status)).length;
      }

      // Recebimentos
      let ressalvas = 0, reprovados = 0;
      const semanaAtras = new Date(); semanaAtras.setDate(semanaAtras.getDate() - 7);
      for (const obra of ativas) {
        const rec = await fetchSafe(`/obras/${obra.id}/recebimentos`, []);
        const list = Array.isArray(rec) ? rec : rec?.recebimentos || [];
        ressalvas += list.filter((r: any) => r.condition === 'ressalva' && new Date(r.createdAt) >= semanaAtras).length;
        reprovados += list.filter((r: any) => r.condition === 'reprovado').length;
      }

      // Segurança
      const treinamentos = await fetchSafe('/seguranca/treinamentos', []);
      const tList = Array.isArray(treinamentos) ? treinamentos : treinamentos?.trainings || [];
      const em30dias = new Date(); em30dias.setDate(em30dias.getDate() + 30);
      const treinamentosVencendo = tList.filter((t: any) => t.expiresAt && new Date(t.expiresAt) <= em30dias && new Date(t.expiresAt) >= new Date()).length;
      
      const incidentes = await fetchSafe('/seguranca/incidentes', []);
      const iList = Array.isArray(incidentes) ? incidentes : incidentes?.incidents || [];
      const inicioMes = new Date(); inicioMes.setDate(1);
      const incidentesMes = iList.filter((i: any) => new Date(i.createdAt) >= inicioMes).length;

      const epis = await fetchSafe('/seguranca/epis', []);
      const eList = Array.isArray(epis) ? epis : epis?.epis || [];
      const episVencendo = eList.filter((e: any) => e.expiresAt && new Date(e.expiresAt) <= em30dias && new Date(e.expiresAt) >= new Date()).length;

      // Ponto
      const ponto = await fetchSafe('/time-entries/today', { entries: [], hoursThisWeek: 0 });
      const checkinsHoje = ponto?.entries?.length || ponto?.count || 0;
      const horasSemana = ponto?.hoursThisWeek || 0;

      setKpis({
        obras: { ativas: ativas.length, progressoMedio, prazoVencido },
        qualidade: { checklistsPendentes, naoConformes, pctConcluidos },
        canteiro: { semCanteiro, canteiroReprovados },
        sequenciamento: { aguardandoAprovacao, etapasAtrasadas },
        recebimentos: { ressalvas, reprovados },
        seguranca: { treinamentosVencendo, incidentesMes, episVencendo },
        ponto: { checkinsHoje, horasSemana },
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="p-8 text-[var(--ber-carbon-light)]">Carregando dashboard...</div>;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--ber-carbon)]">Dashboard</h1>
        <p className="text-sm text-[var(--ber-carbon-light)] mt-1">Visão operacional em tempo real</p>
      </div>

      <Section title="Obras" icon={HardHat}>
        <KPICard kpi={{ label: 'Obras ativas', value: kpis.obras?.ativas, icon: HardHat, color: 'blue' }} />
        <KPICard kpi={{ label: 'Progresso médio', value: kpis.obras?.progressoMedio, icon: TrendingUp, color: kpis.obras?.progressoMedio >= 50 ? 'green' : 'yellow', unit: '%' }} />
        <KPICard kpi={{ label: 'Prazo vencido', value: kpis.obras?.prazoVencido, icon: AlertTriangle, color: kpis.obras?.prazoVencido > 0 ? 'red' : 'green' }} />
      </Section>

      <Section title="Qualidade" icon={ClipboardCheck}>
        <KPICard kpi={{ label: 'Checklists pendentes', value: kpis.qualidade?.checklistsPendentes, icon: ClipboardCheck, color: kpis.qualidade?.checklistsPendentes > 0 ? 'yellow' : 'green' }} />
        <KPICard kpi={{ label: 'Itens não conformes', value: kpis.qualidade?.naoConformes, icon: XCircle, color: kpis.qualidade?.naoConformes > 0 ? 'red' : 'green' }} />
        <KPICard kpi={{ label: 'Checklists concluídos', value: kpis.qualidade?.pctConcluidos, icon: CheckCircle2, color: kpis.qualidade?.pctConcluidos >= 70 ? 'green' : 'yellow', unit: '%' }} />
      </Section>

      <Section title="Canteiro" icon={Tent}>
        <KPICard kpi={{ label: 'Obras sem checklist esta semana', value: kpis.canteiro?.semCanteiro, icon: Tent, color: kpis.canteiro?.semCanteiro > 0 ? 'red' : 'green' }} />
        <KPICard kpi={{ label: 'Itens reprovados no canteiro', value: kpis.canteiro?.canteiroReprovados, icon: XCircle, color: kpis.canteiro?.canteiroReprovados > 0 ? 'yellow' : 'green' }} />
      </Section>

      <Section title="Sequenciamento" icon={ListOrdered}>
        <KPICard kpi={{ label: 'Aguardando aprovação', value: kpis.sequenciamento?.aguardandoAprovacao, icon: AlertTriangle, color: kpis.sequenciamento?.aguardandoAprovacao > 0 ? 'yellow' : 'green' }} />
        <KPICard kpi={{ label: 'Etapas atrasadas', value: kpis.sequenciamento?.etapasAtrasadas, icon: XCircle, color: kpis.sequenciamento?.etapasAtrasadas > 0 ? 'red' : 'green' }} />
      </Section>

      <Section title="Recebimentos" icon={Package}>
        <KPICard kpi={{ label: 'Com ressalva esta semana', value: kpis.recebimentos?.ressalvas, icon: AlertTriangle, color: kpis.recebimentos?.ressalvas > 0 ? 'yellow' : 'green' }} />
        <KPICard kpi={{ label: 'Reprovados sem resolução', value: kpis.recebimentos?.reprovados, icon: XCircle, color: kpis.recebimentos?.reprovados > 0 ? 'red' : 'green' }} />
      </Section>

      <Section title="Segurança" icon={Shield}>
        <KPICard kpi={{ label: 'Treinamentos vencendo (30d)', value: kpis.seguranca?.treinamentosVencendo, icon: AlertTriangle, color: kpis.seguranca?.treinamentosVencendo > 0 ? 'yellow' : 'green' }} />
        <KPICard kpi={{ label: 'Incidentes no mês', value: kpis.seguranca?.incidentesMes, icon: XCircle, color: kpis.seguranca?.incidentesMes > 0 ? 'red' : 'green' }} />
        <KPICard kpi={{ label: 'EPIs vencendo (30d)', value: kpis.seguranca?.episVencendo, icon: Shield, color: kpis.seguranca?.episVencendo > 0 ? 'yellow' : 'green' }} />
      </Section>

      <Section title="Registro de Ponto" icon={Clock}>
        <KPICard kpi={{ label: 'Check-ins hoje', value: kpis.ponto?.checkinsHoje, icon: Users, color: 'blue' }} />
        <KPICard kpi={{ label: 'Horas esta semana', value: kpis.ponto?.horasSemana, icon: Clock, color: 'blue', unit: 'h' }} />
      </Section>
    </div>
  );
}
