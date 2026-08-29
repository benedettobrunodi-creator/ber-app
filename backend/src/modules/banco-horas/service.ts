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
// Regra Bruno/Carol 28/08/26: o expediente conta a partir das 09:00 (chegada
// antes não conta) e a jornada 9h-18h embute 1h de almoço. Como a pausa quase
// nunca é batida, descontamos 1h automaticamente em jornadas > 6h SEM pausa
// registrada (gap ≥ 30min entre intervalos = almoço batido, não desconta).
export const INICIO_EXPEDIENTE_MS = 9 * 60 * 60 * 1000; // 09:00 após o início do dia BRT
export const ALMOCO_MS = 60 * 60 * 1000;
export const LIMIAR_ALMOCO_MS = 6 * 60 * 60 * 1000;
export const GAP_PAUSA_MS = 30 * 60 * 1000;

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
      obraId: input.obraId ?? null,
      motivo: input.motivo,
      ajustadoPorId,
    },
    update: {
      minutosOriginais: bruto.minutos,
      minutosAjustados: input.minutosAjustados,
      obraId: input.obraId ?? null,
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

  const inicioExpediente = start.getTime() + INICIO_EXPEDIENTE_MS;
  let aberto: Date | null = null;
  let incompleto = false;
  const intervalos: Array<{ ini: number; fim: number }> = [];
  for (const e of entries) {
    if (e.type === 'checkin') {
      if (aberto) incompleto = true; // dois checkins seguidos sem checkout
      aberto = e.timestamp;
    } else if (e.type === 'checkout') {
      if (aberto) {
        // Chegada antes das 09:00 conta a partir das 09:00.
        const ini = Math.max(aberto.getTime(), inicioExpediente);
        const fim = e.timestamp.getTime();
        if (fim > ini) intervalos.push({ ini, fim });
        aberto = null;
      } else {
        incompleto = true; // checkout sem checkin correspondente
      }
    }
  }
  if (aberto) incompleto = true; // checkin sem checkout até o fim do dia

  let ms = intervalos.reduce((s2, i) => s2 + (i.fim - i.ini), 0);
  // Almoço: desconta 1h se jornada > 6h e nenhuma pausa ≥ 30min foi batida.
  const temPausa = intervalos.some((i, idx) => idx > 0 && i.ini - intervalos[idx - 1].fim >= GAP_PAUSA_MS);
  if (ms > LIMIAR_ALMOCO_MS && !temPausa) ms -= ALMOCO_MS;

  return { minutos: Math.round(ms / 60000), incompleto, temRegistro: entries.length > 0 };
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
/** Obra predominante do dia: prioriza ajuste com obra; senão, a obra com mais
 *  minutos entre os pares checkin/checkout (intervalo atribuído à obra do checkin). */
async function obraPredominanteDoDia(userId: string, dateStr: string): Promise<string | null> {
  const ajuste = await prisma.ajustePonto.findUnique({
    where: { userId_data: { userId, data: toDateOnlyUTC(dateStr) } },
  });
  if (ajuste?.obraId) return ajuste.obraId;

  const { start, end } = brtDayRange(dateStr);
  const entries = await prisma.timeEntry.findMany({
    where: { userId, timestamp: { gte: start, lt: end } },
    orderBy: { timestamp: 'asc' },
  });
  const porObra = new Map<string | null, number>();
  let aberto: { ts: Date; obraId: string | null } | null = null;
  for (const e of entries) {
    if (e.type === 'checkin') aberto = { ts: e.timestamp, obraId: e.obraId ?? null };
    else if (e.type === 'checkout' && aberto) {
      const min = (e.timestamp.getTime() - aberto.ts.getTime()) / 60000;
      porObra.set(aberto.obraId, (porObra.get(aberto.obraId) ?? 0) + min);
      aberto = null;
    }
  }
  let melhor: string | null = null;
  let melhorMin = 0;
  for (const [obraId, min] of porObra) {
    if (obraId && min > melhorMin) { melhor = obraId; melhorMin = min; }
  }
  return melhor;
}

/** Reverte o processamento automático de falta de um dia (consumos motivo
 *  "falta AAAA-MM-DD" + desconto salarial residual) para reprocessar idempotente. */
async function desfazerFaltaAutomatica(userId: string, dateStr: string) {
  const dataDate = toDateOnlyUTC(dateStr);
  const consumos = await prisma.bancoHorasConsumo.findMany({
    where: { data: dataDate, motivo: `falta ${dateStr}`, lote: { userId } },
    include: { lote: true },
  });
  for (const c of consumos) {
    const novoConsumido = Math.max(0, c.lote.minutosConsumidos - c.minutos);
    await prisma.bancoHorasLote.update({
      where: { id: c.loteId },
      data: {
        minutosConsumidos: novoConsumido,
        status: novoConsumido === 0 ? 'pendente' : novoConsumido >= c.lote.minutosCredito ? 'consumido' : 'parcial',
      },
    });
    await prisma.bancoHorasConsumo.delete({ where: { id: c.id } });
  }
  await prisma.faltaDesconto.deleteMany({ where: { userId, data: dataDate } });
  return consumos.length;
}

export async function processarDia(userId: string, dateStr: string) {
  const dia = await calcularDia(userId, dateStr);
  const dataDate = toDateOnlyUTC(dateStr);

  const loteExistente = await prisma.bancoHorasLote.findFirst({ where: { userId, data: dataDate } });
  if (loteExistente && loteExistente.minutosConsumidos > 0) {
    return { ...dia, skip: 'lote já consumido parcialmente — ajuste manual necessário', loteId: loteExistente.id };
  }
  if (loteExistente) await prisma.bancoHorasLote.delete({ where: { id: loteExistente.id } });
  await prisma.horaExtraRegistro.deleteMany({ where: { userId, data: dataDate, pago: false } });
  await desfazerFaltaAutomatica(userId, dateStr);

  if (dia.diffMinutos === 0) return { ...dia, resultado: 'neutro' };

  if (dia.diffMinutos < 0) {
    // Política (Bruno 27/08/2026): falta desconta primeiro do banco;
    // sem saldo suficiente, o residual vira desconto em folha.
    // Dia útil sem NENHUM registro não desconta automático (pode ser férias/
    // atestado) — fica como pendência para ajuste manual.
    if (!dia.temRegistro) return { ...dia, resultado: 'sem_registro' };

    const falta = -dia.diffMinutos;
    let restante = falta;
    const lotes = await prisma.bancoHorasLote.findMany({
      where: { userId, status: { in: ['pendente', 'parcial'] }, dataExpiracao: { gte: dataDate } },
      orderBy: { data: 'asc' }, // FIFO
    });
    for (const lote of lotes) {
      if (restante <= 0) break;
      const disponivel = lote.minutosCredito - lote.minutosConsumidos;
      if (disponivel <= 0) continue;
      const usar = Math.min(disponivel, restante);
      await prisma.bancoHorasConsumo.create({
        data: { loteId: lote.id, data: dataDate, minutos: usar, motivo: `falta ${dateStr}`, registradoPorId: userId },
      });
      const novoConsumido = lote.minutosConsumidos + usar;
      await prisma.bancoHorasLote.update({
        where: { id: lote.id },
        data: { minutosConsumidos: novoConsumido, status: novoConsumido >= lote.minutosCredito ? 'consumido' : 'parcial' },
      });
      restante -= usar;
    }
    if (restante > 0) {
      await prisma.faltaDesconto.create({
        data: {
          userId,
          data: dataDate,
          minutos: restante,
          detalhe: `falta de ${Math.round(falta / 60 * 10) / 10}h — banco cobriu ${Math.round((falta - restante) / 60 * 10) / 10}h`,
        },
      });
    }
    return { ...dia, resultado: 'falta', faltaMinutos: falta, cobertoPeloBanco: falta - restante, descontoSalarialMinutos: restante };
  }

  if (dia.ehDomingoOuFeriado) {
    const motivo = dia.ehFeriado ? 'feriado' : 'domingo';
    const obraId = await obraPredominanteDoDia(userId, dateStr);
    await prisma.horaExtraRegistro.create({
      data: { userId, data: dataDate, minutos: dia.diffMinutos, motivo, obraId },
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
    const obraId = await obraPredominanteDoDia(userId, dateStr);
    await prisma.horaExtraRegistro.create({
      data: { userId, data: dataDate, minutos: paraExtra, motivo: 'teto_banco_atingido', obraId },
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
    // usuários desativados saem do painel (o histórico/lotes continuam no banco)
    where: { status: { in: ['pendente', 'parcial'] }, user: { isActive: true } },
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
