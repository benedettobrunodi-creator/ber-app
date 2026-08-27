/**
 * Fechamento mensal de folha por centro de custo (27/08/26).
 * Rateio: cada intervalo check-in→check-out é atribuído à obra do check-in;
 * ajuste manual do dia (sem obra) é distribuído proporcionalmente entre as
 * obras daquele dia (ou vira "Sem obra" se o dia não teve batidas com obra).
 */
import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

function brtDayRange(dateStr: string) {
  const startUtc = new Date(new Date(`${dateStr}T00:00:00.000Z`).getTime() + BRT_OFFSET_MS);
  return { start: startUtc, end: new Date(startUtc.getTime() + 24 * 60 * 60 * 1000) };
}

function diasDoMes(competencia: string): string[] {
  const [y, m] = competencia.split('-').map(Number);
  const dias: string[] = [];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let d = 1; d <= last; d++) dias.push(`${competencia}-${String(d).padStart(2, '0')}`);
  return dias;
}

/** Minutos do dia rateados por obra (obraId do check-in; null = sem obra). */
async function minutosPorObraNoDia(userId: string, dateStr: string): Promise<{ porObra: Map<string | null, number>; incompleto: boolean; temRegistro: boolean }> {
  const { start, end } = brtDayRange(dateStr);
  const entries = await prisma.timeEntry.findMany({
    where: { userId, timestamp: { gte: start, lt: end } },
    orderBy: { timestamp: 'asc' },
  });
  const porObra = new Map<string | null, number>();
  let aberto: { ts: Date; obraId: string | null } | null = null;
  let incompleto = false;
  for (const e of entries) {
    if (e.type === 'checkin') {
      if (aberto) incompleto = true;
      aberto = { ts: e.timestamp, obraId: e.obraId };
    } else if (e.type === 'checkout') {
      if (aberto) {
        const min = Math.round((e.timestamp.getTime() - aberto.ts.getTime()) / 60000);
        porObra.set(aberto.obraId, (porObra.get(aberto.obraId) ?? 0) + min);
        aberto = null;
      } else incompleto = true;
    }
  }
  if (aberto) incompleto = true;
  return { porObra, incompleto, temRegistro: entries.length > 0 };
}

export interface PreviewFolha {
  competencia: string;
  fechado: { id: string; fechadoEm: Date; status: string } | null;
  usuarios: {
    userId: string;
    nome: string;
    porObra: { obraId: string | null; obraNome: string; minutos: number }[];
    totalMinutos: number;
    minutosExtras: number;
    diasIncompletos: string[]; // sem ajuste que resolva
    minutosSemObra: number;
  }[];
  obras: { obraId: string | null; nome: string }[];
  pendencias: { userId: string; nome: string; tipo: string; detalhe: string }[];
}

export async function previewFechamento(competencia: string): Promise<PreviewFolha> {
  if (!/^\d{4}-\d{2}$/.test(competencia)) throw AppError.badRequest('Competência inválida (use YYYY-MM)');
  const compDate = new Date(`${competencia}-01T00:00:00.000Z`);
  const fechadoExistente = await prisma.folhaFechamento.findUnique({
    where: { competencia: compDate },
    select: { id: true, fechadoEm: true, status: true },
  });

  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
  const dias = diasDoMes(competencia);
  const [y, m] = competencia.split('-').map(Number);
  const compStart = new Date(Date.UTC(y, m - 1, 1));
  const compEnd = new Date(Date.UTC(y, m, 1));

  const [ajustes, extras] = await Promise.all([
    prisma.ajustePonto.findMany({ where: { data: { gte: compStart, lt: compEnd } } }),
    prisma.horaExtraRegistro.findMany({ where: { data: { gte: compStart, lt: compEnd } } }),
  ]);
  const ajustePorUserDia = new Map(ajustes.map((a) => [`${a.userId}:${a.data.toISOString().slice(0, 10)}`, a]));
  const extrasPorUser = new Map<string, number>();
  for (const e of extras) extrasPorUser.set(e.userId, (extrasPorUser.get(e.userId) ?? 0) + e.minutos);

  const obraIds = new Set<string>();
  const usuarios: PreviewFolha['usuarios'] = [];
  const pendencias: PreviewFolha['pendencias'] = [];

  for (const u of users) {
    const acumulado = new Map<string | null, number>();
    const diasIncompletos: string[] = [];
    for (const dia of dias) {
      const { porObra, incompleto, temRegistro } = await minutosPorObraNoDia(u.id, dia);
      const ajuste = ajustePorUserDia.get(`${u.id}:${dia}`);
      if (ajuste) {
        // Ajuste com obra definida: o total do dia conta inteiro nesse centro de custo.
        if (ajuste.obraId) {
          acumulado.set(ajuste.obraId, (acumulado.get(ajuste.obraId) ?? 0) + ajuste.minutosAjustados);
          continue;
        }
        // Ajuste sem obra: rateia proporcional ao bruto por obra do dia.
        const brutoTotal = [...porObra.values()].reduce((s, v) => s + v, 0);
        if (brutoTotal > 0) {
          for (const [obraId, min] of porObra) {
            const cota = Math.round((min / brutoTotal) * ajuste.minutosAjustados);
            acumulado.set(obraId, (acumulado.get(obraId) ?? 0) + cota);
          }
        } else if (ajuste.minutosAjustados > 0) {
          acumulado.set(null, (acumulado.get(null) ?? 0) + ajuste.minutosAjustados);
        }
      } else {
        if (incompleto && temRegistro) diasIncompletos.push(dia);
        for (const [obraId, min] of porObra) {
          acumulado.set(obraId, (acumulado.get(obraId) ?? 0) + min);
        }
      }
    }
    for (const k of acumulado.keys()) if (k) obraIds.add(k);
    const totalMinutos = [...acumulado.values()].reduce((s, v) => s + v, 0);
    if (totalMinutos === 0 && (extrasPorUser.get(u.id) ?? 0) === 0) continue; // sem atividade no mês
    const minutosSemObra = acumulado.get(null) ?? 0;
    if (diasIncompletos.length) pendencias.push({ userId: u.id, nome: u.name, tipo: 'batida_incompleta', detalhe: `${diasIncompletos.length} dia(s): ${diasIncompletos.slice(0, 5).map((d) => d.slice(8)).join(', ')}${diasIncompletos.length > 5 ? '…' : ''}` });
    if (minutosSemObra > 0) pendencias.push({ userId: u.id, nome: u.name, tipo: 'sem_obra', detalhe: `${Math.round(minutosSemObra / 60 * 10) / 10}h sem centro de custo` });
    usuarios.push({
      userId: u.id,
      nome: u.name,
      porObra: [...acumulado.entries()].map(([obraId, minutos]) => ({ obraId, obraNome: '', minutos })),
      totalMinutos,
      minutosExtras: extrasPorUser.get(u.id) ?? 0,
      diasIncompletos,
      minutosSemObra,
    });
  }

  const obras = await prisma.obra.findMany({ where: { id: { in: [...obraIds] } }, select: { id: true, name: true } });
  const nomePorObra = new Map(obras.map((o) => [o.id, o.name]));
  for (const u of usuarios) for (const po of u.porObra) po.obraNome = po.obraId ? (nomePorObra.get(po.obraId) ?? '?') : 'Sem obra / Interno';

  return {
    competencia,
    fechado: fechadoExistente,
    usuarios,
    obras: [
      ...obras.map((o) => ({ obraId: o.id as string | null, nome: o.name })).sort((a, b) => a.nome.localeCompare(b.nome)),
      ...(usuarios.some((u) => u.minutosSemObra > 0) ? [{ obraId: null, nome: 'Sem obra / Interno' }] : []),
    ],
    pendencias,
  };
}

export async function fecharMes(competencia: string, userId: string, observacoes?: string) {
  const preview = await previewFechamento(competencia);
  if (preview.fechado && preview.fechado.status === 'fechado') {
    throw AppError.badRequest('Competência já fechada. Reabra antes de fechar de novo.');
  }
  const compDate = new Date(`${competencia}-01T00:00:00.000Z`);

  const linhas = preview.usuarios.flatMap((u) => [
    ...u.porObra.filter((po) => po.minutos > 0).map((po) => ({
      userId: u.userId,
      obraId: po.obraId,
      minutos: po.minutos,
      minutosExtras: 0,
      detalhe: u.diasIncompletos.length ? `atenção: ${u.diasIncompletos.length} dia(s) incompletos no mês` : null,
    })),
    ...(u.minutosExtras > 0 ? [{ userId: u.userId, obraId: null, minutos: 0, minutosExtras: u.minutosExtras, detalhe: 'horas extras remuneradas do mês' }] : []),
  ]);

  const fechamento = await prisma.$transaction(async (tx) => {
    if (preview.fechado) await tx.folhaFechamento.delete({ where: { id: preview.fechado.id } });
    return tx.folhaFechamento.create({
      data: {
        competencia: compDate,
        status: 'fechado',
        fechadoPorId: userId,
        observacoes,
        linhas: { create: linhas },
      },
    });
  });
  return { fechamento, totalLinhas: linhas.length, pendencias: preview.pendencias };
}

export async function reabrirMes(competencia: string, userId: string) {
  const compDate = new Date(`${competencia}-01T00:00:00.000Z`);
  const f = await prisma.folhaFechamento.findUnique({ where: { competencia: compDate } });
  if (!f) throw AppError.notFound('Fechamento');
  return prisma.folhaFechamento.update({
    where: { id: f.id },
    data: { status: 'reaberto', reabertoPorId: userId, reabertoEm: new Date() },
  });
}

export async function listFechamentos() {
  return prisma.folhaFechamento.findMany({
    include: { fechadoPor: { select: { name: true } }, _count: { select: { linhas: true } } },
    orderBy: { competencia: 'desc' },
  });
}

export async function exportCsv(competencia: string): Promise<string> {
  const preview = await previewFechamento(competencia);
  const linhas = ['colaborador;obra;horas_normais;horas_extras'];
  for (const u of preview.usuarios) {
    for (const po of u.porObra.filter((p) => p.minutos > 0)) {
      linhas.push(`${u.nome};${po.obraNome};${(po.minutos / 60).toFixed(2).replace('.', ',')};0`);
    }
    if (u.minutosExtras > 0) {
      linhas.push(`${u.nome};EXTRAS (dom/feriado/teto);0;${(u.minutosExtras / 60).toFixed(2).replace('.', ',')}`);
    }
  }
  return linhas.join('\n');
}
