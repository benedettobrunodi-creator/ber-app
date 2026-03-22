'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { HardHat, TrendingUp, AlertTriangle, ClipboardCheck, XCircle, CheckCircle2, Shield, Clock, Users, Package, ListOrdered, Tent } from 'lucide-react';

function KPICard({ label, value, icon: Icon, color, unit }: any) {
  const colors: any = {
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  const iconColors: any = { green: 'text-green-500', yellow: 'text-yellow-500', red: 'text-red-500', blue: 'text-blue-500' };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <Icon size={20} className={iconColors[color]} />
      <div className="text-2xl font-bold mt-2">{value ?? '—'}{unit && <span className="text-sm font-normal ml-1">{unit}</span>}</div>
      <div className="text-xs mt-1 opacity-80">{label}</div>
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

const safe = async (fn: () => Promise<any>, fallback: any = null) => {
  try { return await Promise.race([fn(), new Promise((_, r) => setTimeout(() => r('timeout'), 4000))]); }
  catch { return fallback; }
};

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function load() {
      // Buscar obras
      const obrasRes = await safe(() => api.get('/obras').then(r => r.data), {});
      const obras = obrasRes?.obras || (Array.isArray(obrasRes) ? obrasRes : []);
      const ativas = obras.filter((o: any) => o.status === 'em_andamento');
      const progressoMedio = ativas.length ? Math.round(ativas.reduce((s: number, o: any) => s + (o.progress || 0), 0) / ativas.length) : 0;
      const prazoVencido = ativas.filter((o: any) => o.endDate && new Date(o.endDate) < new Date()).length;

      // Buscar dados por obra em paralelo
      const obraIds = ativas.map((o: any) => o.id);
      const [clsResults, canteiroResults, etapasResults, recResults] = await Promise.all([
        Promise.all(obraIds.map((id: string) => safe(() => api.get(`/obras/${id}/checklists`).then(r => r.data), []))),
        Promise.all(obraIds.map((id: string) => safe(() => api.get(`/obras/${id}/canteiro`).then(r => r.data), []))),
        Promise.all(obraIds.map((id: string) => safe(() => api.get(`/obras/${id}/sequenciamento`).then(r => r.data), []))),
        Promise.all(obraIds.map((id: string) => safe(() => api.get(`/obras/${id}/recebimentos`).then(r => r.data), []))),
      ]);

      // Checklists
      let checklistsPendentes = 0, naoConformes = 0, concluidos = 0, total = 0;
      for (const cls of clsResults) {
        const list = Array.isArray(cls) ? cls : cls?.checklists || [];
        for (const cl of list) {
          total++;
          if (cl.status === 'concluido') concluidos++;
          if (cl.status === 'em_andamento') {
            const resp = (cl.items || []).filter((i: any) => i.answer !== 'pendente').length;
            if (resp === 0) checklistsPendentes++;
            naoConformes += (cl.items || []).filter((i: any) => i.answer === 'nao' && !i.correctiveAction).length;
          }
        }
      }

      // Canteiro
      let semCanteiro = 0, canteiroReprovados = 0;
      const semanaInicio = new Date(); semanaInicio.setDate(semanaInicio.getDate() - semanaInicio.getDay());
      for (const ct of canteiroResults) {
        const list = Array.isArray(ct) ? ct : ct?.checklists || [];
        const estaSemana = list.filter((c: any) => new Date(c.weekStart) >= semanaInicio);
        if (estaSemana.length === 0) semCanteiro++;
        for (const c of estaSemana) canteiroReprovados += (c.items || []).filter((i: any) => i.status === 'reprovado').length;
      }

      // Sequenciamento
      let aguardando = 0, atrasadas = 0;
      for (const et of etapasResults) {
        const list = Array.isArray(et) ? et : et?.etapas || [];
        aguardando += list.filter((e: any) => e.status === 'aguardando_aprovacao').length;
        atrasadas += list.filter((e: any) => e.endDate && new Date(e.endDate) < new Date() && !['aprovada','concluida'].includes(e.status)).length;
      }

      // Recebimentos
      let ressalvas = 0, reprovados = 0;
      const semanaAtras = new Date(); semanaAtras.setDate(semanaAtras.getDate() - 7);
      for (const rec of recResults) {
        const list = Array.isArray(rec) ? rec : rec?.recebimentos || [];
        ressalvas += list.filter((r: any) => r.condition === 'ressalva' && new Date(r.createdAt) >= semanaAtras).length;
        reprovados += list.filter((r: any) => r.condition === 'reprovado').length;
      }

      // Segurança e Ponto em paralelo
      const [treinamentos, incidentes, epis, ponto] = await Promise.all([
        safe(() => api.get('/seguranca/treinamentos').then(r => r.data), []),
        safe(() => api.get('/seguranca/incidentes').then(r => r.data), []),
        safe(() => api.get('/seguranca/epis').then(r => r.data), []),
        safe(() => api.get('/time-entries/today').then(r => r.data), {}),
      ]);

      const em30 = new Date(); em30.setDate(em30.getDate() + 30);
      const tList = Array.isArray(treinamentos) ? treinamentos : treinamentos?.trainings || [];
      const iList = Array.isArray(incidentes) ? incidentes : incidentes?.incidents || [];
      const eList = Array.isArray(epis) ? epis : epis?.epis || [];
      const inicioMes = new Date(); inicioMes.setDate(1);

      setData({
        obras: { ativas: ativas.length, progressoMedio, prazoVencido },
        qualidade: { checklistsPendentes, naoConformes, pct: total ? Math.round(concluidos/total*100) : 0 },
        canteiro: { semCanteiro, canteiroReprovados },
        seq: { aguardando, atrasadas },
        rec: { ressalvas, reprovados },
        seg: {
          treinamentos: tList.filter((t: any) => t.expiresAt && new Date(t.expiresAt) <= em30 && new Date(t.expiresAt) >= new Date()).length,
          incidentes: iList.filter((i: any) => new Date(i.createdAt) >= inicioMes).length,
          epis: eList.filter((e: any) => e.expiresAt && new Date(e.expiresAt) <= em30 && new Date(e.expiresAt) >= new Date()).length,
        },
        ponto: { hoje: ponto?.entries?.length || ponto?.count || 0, horas: ponto?.hoursThisWeek || 0 },
      });
    }
    load();
  }, []);

  if (!data) return (
    <div className="p-8 flex items-center gap-3 text-[var(--ber-carbon-light)]">
      <div className="w-5 h-5 border-2 border-[var(--ber-olive)] border-t-transparent rounded-full animate-spin" />
      Carregando dashboard...
    </div>
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--ber-carbon)]">Dashboard</h1>
        <p className="text-sm text-[var(--ber-carbon-light)] mt-1">Visão operacional em tempo real</p>
      </div>

      <Section title="Obras" icon={HardHat}>
        <KPICard label="Obras ativas" value={data.obras.ativas} icon={HardHat} color="blue" />
        <KPICard label="Progresso médio" value={data.obras.progressoMedio} icon={TrendingUp} color={data.obras.progressoMedio >= 50 ? 'green' : 'yellow'} unit="%" />
        <KPICard label="Prazo vencido" value={data.obras.prazoVencido} icon={AlertTriangle} color={data.obras.prazoVencido > 0 ? 'red' : 'green'} />
      </Section>

      <Section title="Qualidade" icon={ClipboardCheck}>
        <KPICard label="Checklists pendentes" value={data.qualidade.checklistsPendentes} icon={ClipboardCheck} color={data.qualidade.checklistsPendentes > 0 ? 'yellow' : 'green'} />
        <KPICard label="Itens não conformes" value={data.qualidade.naoConformes} icon={XCircle} color={data.qualidade.naoConformes > 0 ? 'red' : 'green'} />
        <KPICard label="Concluídos no mês" value={data.qualidade.pct} icon={CheckCircle2} color={data.qualidade.pct >= 70 ? 'green' : 'yellow'} unit="%" />
      </Section>

      <Section title="Canteiro" icon={Tent}>
        <KPICard label="Obras sem checklist esta semana" value={data.canteiro.semCanteiro} icon={Tent} color={data.canteiro.semCanteiro > 0 ? 'red' : 'green'} />
        <KPICard label="Itens reprovados" value={data.canteiro.canteiroReprovados} icon={XCircle} color={data.canteiro.canteiroReprovados > 0 ? 'yellow' : 'green'} />
      </Section>

      <Section title="Sequenciamento" icon={ListOrdered}>
        <KPICard label="Aguardando aprovação" value={data.seq.aguardando} icon={AlertTriangle} color={data.seq.aguardando > 0 ? 'yellow' : 'green'} />
        <KPICard label="Etapas atrasadas" value={data.seq.atrasadas} icon={XCircle} color={data.seq.atrasadas > 0 ? 'red' : 'green'} />
      </Section>

      <Section title="Recebimentos" icon={Package}>
        <KPICard label="Com ressalva esta semana" value={data.rec.ressalvas} icon={AlertTriangle} color={data.rec.ressalvas > 0 ? 'yellow' : 'green'} />
        <KPICard label="Reprovados sem resolução" value={data.rec.reprovados} icon={XCircle} color={data.rec.reprovados > 0 ? 'red' : 'green'} />
      </Section>

      <Section title="Segurança" icon={Shield}>
        <KPICard label="Treinamentos vencendo (30d)" value={data.seg.treinamentos} icon={AlertTriangle} color={data.seg.treinamentos > 0 ? 'yellow' : 'green'} />
        <KPICard label="Incidentes no mês" value={data.seg.incidentes} icon={XCircle} color={data.seg.incidentes > 0 ? 'red' : 'green'} />
        <KPICard label="EPIs vencendo (30d)" value={data.seg.epis} icon={Shield} color={data.seg.epis > 0 ? 'yellow' : 'green'} />
      </Section>

      <Section title="Registro de Ponto" icon={Clock}>
        <KPICard label="Check-ins hoje" value={data.ponto.hoje} icon={Users} color="blue" />
        <KPICard label="Horas esta semana" value={data.ponto.horas} icon={Clock} color="blue" unit="h" />
      </Section>
    </div>
  );
}
