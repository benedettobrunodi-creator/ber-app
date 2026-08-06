import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type {
  CreateFeriadoInput, UpdateFeriadoInput, UpsertAjusteInput, ConsumirInput,
} from './types';

// ─── Constantes da regra (validadas com o Bruno em 06/08/2026) ────────────
// Jornada CLT 44h/semana: seg-sex 8h, sáb 4h, dom 0h esperado.
const JORNADA_MINUTOS: Record<number, number> = {
  0: 0,   // domingo
  1: 480, // segunda
  2: 480,
  3: 480,
  4: 480,
  5: 480, // sexta
  6: 240, // sábado
};
export const TETO_BANCO_MINUTOS = 24 * 60; // 24h
export const PRAZO_EXPIRACAO_MESES = 6;
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000; // America/Sao_Paulo = UTC-3, sem horário de verão

// ─── Helpers de data ───────────────────────────────────────────────────────
/** Limites [início, fim) do dia calendário em BRT, dado "YYYY-MM-DD", como Date UTC. */
function brtDayRange(dateStr: string) {
  const startUtc = new Date(new Date(`${dateStr}T00:00:00.000Z`).getTime() + BRT_OFFSET_MS);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { start: startUtc, end: endUtc };
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function toDateOnlyUTC(dateStr: string) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

// ─── Feriados ───────────────────────────────────────────────────────────
export async function listFeriados(ano?: number) {
  const where = ano
    ? { data: { gte: new Date(Date.UTC(ano, 0, 1)), lt: new Date(Date.UTC(ano + 1, 0, 1)) } }
    : {};
  return prisma.feriado.findMany({ where, orderBy: { data: 'asc' } });
}

export async function createFeriado(input: CreateFeriadoInput) {
  return prisma.feriado.create({
    data: { data: toDateOnlyUTC(input.data), nome: input.nome, tipo: input.tipo },
  });
}

export async function updateFeriado(id: string, input: UpdateFeriadoInput) {
  const existing = await prisma.feriado.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Feriado');
  return prisma.feriado.update({
    where: { id },
    data: {
      data: input.data ? toDateOnlyUTC(input.data) : undefined,
      nome: input.nome,
      tipo: input.tipo,
      ativo: input.ativo,
    },
  });
}

export async function removeFeriado(id: string) {
  const existing = await prisma.feriado.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Feriado');
  await prisma.feriado.delete({ where: { id } });
}

async function isFeriado(dateStr: string): Promise<boolean> {
  const f = await prisma.feriado.findFirst({
    where: { data: toDateOnlyUTC(dateStr), ativo: true },
  });
  return !!f;
}

// ─── Ajustes de ponto (correção manual da Carol, auditada) ────────────────
export async function upsertAjuste(input: UpsertAjusteInput, ajustadoPorId: string) {
  const bruto = await minutosTrabalhadosDoPonto(input.userId, input.data);
  return prisma.ajustePonto.upsert({
    where: { userId_data: { userId: input.userId, data: toDateOnlyUTC(input.data) } },
    create: {
      userId: input.userId,
      data: toDateOnlyUTC(input.data),
      minutosOriginais: bruto.minutos,
      minutosAjustados: input.minutosAjustados,
      motivo: input.motivo,
      ajustadoPorId,
    },
    update: {
      minutosOriginais: bruto.minutos,
      minutosAjustados: input.minutosAjustados,
      motivo: input.motivo,
      ajustadoPorId,
    },
  });
}

export async function listAjustes(startDate: string, endDate: string, userId?: string) {
  return prisma.ajustePonto.findMany({
    where: {
      data: { gte: toDateOnlyUTC(startDate), lte: toDateOnlyUTC(endDate) },
      userId,
    },
    include: {
      user: { select: { id: true, name: true } },
      ajustadoPor: { select: { id: true, name: true } },
    },
    orderBy: { data: 'desc' },
  });
}

// ─── Cálculo do dia (a partir do ponto bruto) ─────────────────────────────
/** Pareia checkin/checkout do dia. Se sobrar checkin sem checkout (ou
 *  vice-versa), marca `incompleto` — sinal de que precisa de um AjustePonto. */
async function minutosTrabalhadosDoPonto(userId: string, dateStr: string) {
  const { start, end } = brtDayRange(dateStr);
  const entries = await prisma.timeEntry.findMany({
    where: { userId, timestamp: { gte: start, lt: end } },
    orderBy: { timestamp: 'asc' },
  });

  let minutos = 0;
  let aberto: Date | null = null;
  let incompleto = false;
  for (const e of entries) {
    if (e.type === 'checkin') {
      if (aberto) incompleto = true; // dois checkins seguidos sem checkout
      aberto = e.timestamp;
    } else if (e.type === 'checkout') {
      if (aberto) {
        minutos += (e.timestamp.getTime() - aberto.getTime()) / 60000;
        aberto = null;
      } else {
        incompleto = true; // checkout sem checkin correspondente
      }
    }
  }
  if (aberto) incompleto = true; // checkin sem checkout até o fim do dia

  return { minutos: Math.round(minutos), incompleto, temRegistro: entries.length > 0 };
}

/** Visão de um dia: quanto foi trabalhado (ajuste tem prioridade sobre o ponto
 *  bruto), jornada esperada, e o diff. Não grava nada — é só leitura/preview. */
export async function calcularDia(userId: string, dateStr: string) {
  const date = toDateOnlyUTC(dateStr);
  const weekday = date.getUTCDay();
  const feriado = await isFeriado(dateStr);
  const ajuste = await prisma.ajustePonto.findUnique({
    where: { userId_data: { userId, data: date } },
  });
  const bruto = await minutosTrabalhadosDoPonto(userId, dateStr);

  const minutosTrabalhados = ajuste ? ajuste.minutosAjustados : bruto.minutos;
  const origem = ajuste ? 'ajuste' : 'ponto';
  const jornadaEsperada = feriado ? 0 : JORNADA_MINUTOS[weekday];
  const ehDomingoOuFeriado = weekday === 0 || feriado;

  return {
    userId,
    data: dateStr,
    weekday,
    ehFeriado: feriado,
    ehDomingoOuFeriado,
    jornadaEsperada,
    minutosTrabalhados,
    origem,
    incompleto: !ajuste && bruto.incompleto,
    temRegistro: bruto.temRegistro || !!ajuste,
    diffMinutos: minutosTrabalhados - jornadaEsperada,
  };
}

/** Saldo de banco de horas em aberto (lotes pendentes/parciais, não expirados). */
async function saldoAtualMinutos(userId: string, referencia: Date) {
  const lotes = await prisma.bancoHorasLote.findMany({
    where: {
      userId,
      status: { in: ['pendente', 'parcial'] },
      dataExpiracao: { gte: referencia },
    },
  });
  return lotes.reduce((s, l) => s + (l.minutosCredito - l.minutosConsumidos), 0);
}

/** Processa um dia: gera BancoHorasLote (crédito) e/ou HoraExtraRegistro,
 *  respeitando o teto de 24h do banco. Idempotente pra lotes/extras ainda não
 *  consumidos (apaga e recria); NÃO mexe em lote já parcialmente consumido —
 *  nesse caso loga e pula (exige ajuste manual).
 *  NOTA: dia com déficit (faltou) não gera débito automático no banco — a
 *  política de desconto de falta ainda não foi definida com o Bruno. */
export async function processarDia(userId: string, dateStr: string) {
  const dia = await calcularDia(userId, dateStr);
  const dataDate = toDateOnlyUTC(dateStr);

  const loteExistente = await prisma.bancoHorasLote.findFirst({ where: { userId, data: dataDate } });
  if (loteExistente && loteExistente.minutosConsumidos > 0) {
    return { ...dia, skip: 'lote já consumido parcialmente — ajuste manual necessário', loteId: loteExistente.id };
  }
  if (loteExistente) await prisma.bancoHorasLote.delete({ where: { id: loteExistente.id } });
  await prisma.horaExtraRegistro.deleteMany({ where: { userId, data: dataDate, pago: false } });

  if (dia.diffMinutos <= 0) {
    return { ...dia, resultado: dia.diffMinutos < 0 ? 'falta' : 'neutro' };
  }

  if (dia.ehDomingoOuFeriado) {
    const motivo = dia.ehFeriado ? 'feriado' : 'domingo';
    await prisma.horaExtraRegistro.create({
      data: { userId, data: dataDate, minutos: dia.diffMinutos, motivo },
    });
    return { ...dia, resultado: 'hora_extra', motivo };
  }

  // Dia normal com excedente — respeita o teto de 24h do banco.
  const saldoAtual = await saldoAtualMinutos(userId, dataDate);
  const espacoDisponivel = Math.max(0, TETO_BANCO_MINUTOS - saldoAtual);
  const paraBanco = Math.min(dia.diffMinutos, espacoDisponivel);
  const paraExtra = dia.diffMinutos - paraBanco;

  if (paraBanco > 0) {
    await prisma.bancoHorasLote.create({
      data: {
        userId,
        data: dataDate,
        minutosCredito: paraBanco,
        dataExpiracao: addMonths(dataDate, PRAZO_EXPIRACAO_MESES),
      },
    });
  }
  if (paraExtra > 0) {
    await prisma.horaExtraRegistro.create({
      data: { userId, data: dataDate, minutos: paraExtra, motivo: 'teto_banco_atingido' },
    });
  }
  return { ...dia, resultado: 'processado', paraBanco, paraExtra };
}

export async function processarPeriodo(startDate: string, endDate: string, userId?: string) {
  const userIds = userId
    ? [userId]
    : (await prisma.user.findMany({ where: { isActive: true }, select: { id: true } })).map((u) => u.id);

  const dates: string[] = [];
  const cursor = toDateOnlyUTC(startDate);
  const end = toDateOnlyUTC(endDate);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const results = [];
  for (const uid of userIds) {
    for (const d of dates) {
      results.push(await processarDia(uid, d));
    }
  }
  return { totalDias: dates.length, totalUsuarios: userIds.length, processados: results.length };
}

// ─── Consumo (compensação) — sempre FIFO no lote mais antigo ──────────────
export async function consumir(input: ConsumirInput, registradoPorId: string) {
  let restante = input.minutos;
  const lotes = await prisma.bancoHorasLote.findMany({
    where: { userId: input.userId, status: { in: ['pendente', 'parcial'] } },
    orderBy: { data: 'asc' }, // FIFO: mais antigo primeiro
  });

  const saldo = lotes.reduce((s, l) => s + (l.minutosCredito - l.minutosConsumidos), 0);
  if (saldo < input.minutos) {
    throw AppError.badRequest(`Saldo insuficiente: ${Math.round(saldo / 60 * 10) / 10}h disponíveis, pediu ${Math.round(input.minutos / 60 * 10) / 10}h`);
  }

  const consumos = [];
  for (const lote of lotes) {
    if (restante <= 0) break;
    const disponivelNoLote = lote.minutosCredito - lote.minutosConsumidos;
    if (disponivelNoLote <= 0) continue;
    const usar = Math.min(disponivelNoLote, restante);

    const consumo = await prisma.bancoHorasConsumo.create({
      data: {
        loteId: lote.id,
        data: toDateOnlyUTC(input.data),
        minutos: usar,
        motivo: input.motivo ?? null,
        registradoPorId,
      },
    });
    const novoConsumido = lote.minutosConsumidos + usar;
    await prisma.bancoHorasLote.update({
      where: { id: lote.id },
      data: {
        minutosConsumidos: novoConsumido,
        status: novoConsumido >= lote.minutosCredito ? 'consumido' : 'parcial',
      },
    });
    consumos.push(consumo);
    restante -= usar;
  }
  return consumos;
}

// ─── Painel: saldo por colaborador ─────────────────────────────────────────
export async function painel() {
  const hoje = new Date();
  const lotes = await prisma.bancoHorasLote.findMany({
    where: { status: { in: ['pendente', 'parcial'] } },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { data: 'asc' },
  });

  const porUsuario = new Map<string, { userId: string; nome: string; saldoMinutos: number; loteMaisAntigo: Date | null; expiraEm: Date | null }>();
  for (const l of lotes) {
    const disponivel = l.minutosCredito - l.minutosConsumidos;
    if (disponivel <= 0) continue;
    const key = l.userId;
    const e = porUsuario.get(key) ?? { userId: l.userId, nome: l.user.name, saldoMinutos: 0, loteMaisAntigo: null, expiraEm: null };
    e.saldoMinutos += disponivel;
    if (!e.loteMaisAntigo || l.data < e.loteMaisAntigo) {
      e.loteMaisAntigo = l.data;
      e.expiraEm = l.dataExpiracao;
    }
    porUsuario.set(key, e);
  }

  return [...porUsuario.values()].map((e) => {
    const idadeDias = e.loteMaisAntigo ? Math.floor((hoje.getTime() - e.loteMaisAntigo.getTime()) / 86_400_000) : 0;
    // Cor: verde <3 meses, amarelo 3-4, laranja ~5, vermelho perto de vencer (6 meses) ou no teto.
    let cor: 'verde' | 'amarelo' | 'laranja' | 'vermelho' = 'verde';
    if (e.saldoMinutos >= TETO_BANCO_MINUTOS) cor = 'vermelho';
    else if (idadeDias >= 150) cor = 'vermelho'; // ~5 meses
    else if (idadeDias >= 120) cor = 'laranja'; // ~4 meses
    else if (idadeDias >= 90) cor = 'amarelo'; // ~3 meses
    return { ...e, idadeDias, cor, saldoHoras: Math.round((e.saldoMinutos / 60) * 10) / 10 };
  }).sort((a, b) => b.idadeDias - a.idadeDias);
}

export async function lotesPorUsuario(userId: string) {
  return prisma.bancoHorasLote.findMany({
    where: { userId },
    include: { consumos: true },
    orderBy: { data: 'desc' },
  });
}

// ─── Horas extras a pagar ──────────────────────────────────────────────────
export async function listExtras(pago?: boolean) {
  return prisma.horaExtraRegistro.findMany({
    where: pago === undefined ? {} : { pago },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { data: 'desc' },
  });
}

export async function marcarExtraPago(id: string, pago: boolean) {
  const existing = await prisma.horaExtraRegistro.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Registro de hora extra');
  return prisma.horaExtraRegistro.update({ where: { id }, data: { pago } });
}
