import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type {
  CreateColaboradorInput, UpdateColaboradorInput,
  CreatePeriodoInput, UpdatePeriodoInput,
} from './types';

/** Dias corridos inclusivos entre duas datas YYYY-MM-DD (fim incluído). */
export function diasCorridos(inicio: string, fim: string): number {
  const a = new Date(inicio + 'T00:00:00Z').getTime();
  const b = new Date(fim + 'T00:00:00Z').getTime();
  return Math.floor((b - a) / 86_400_000) + 1;
}

const toISO = (d: Date) => d.toISOString().slice(0, 10);

/** Lista colaboradores (ativos + inativos) com períodos e saldo em aberto calculado. */
export async function listColaboradores() {
  const rows = await prisma.colaborador.findMany({
    orderBy: [{ ativo: 'desc' }, { ordem: 'asc' }, { nome: 'asc' }],
    include: { ferias: { orderBy: { dataInicio: 'asc' } } },
  });
  return rows.map(c => {
    const diasUsados = c.ferias.reduce((s, p) => s + p.dias, 0);
    return {
      id: c.id,
      nome: c.nome,
      cargo: c.cargo,
      feriasATirarDias: c.feriasATirarDias,
      ativo: c.ativo,
      ordem: c.ordem,
      diasUsados,
      saldoEmAberto: c.feriasATirarDias - diasUsados,
      ferias: c.ferias.map(p => ({
        id: p.id,
        colaboradorId: p.colaboradorId,
        dataInicio: toISO(p.dataInicio),
        dataFim: toISO(p.dataFim),
        dias: p.dias,
        observacoes: p.observacoes,
      })),
    };
  });
}

export async function createColaborador(input: CreateColaboradorInput) {
  const max = await prisma.colaborador.aggregate({ _max: { ordem: true } });
  return prisma.colaborador.create({
    data: {
      nome: input.nome.trim(),
      cargo: input.cargo?.trim() || null,
      feriasATirarDias: input.feriasATirarDias ?? 30,
      ativo: input.ativo ?? true,
      ordem: (max._max.ordem ?? -1) + 1,
    },
  });
}

export async function updateColaborador(id: string, input: UpdateColaboradorInput) {
  const existing = await prisma.colaborador.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Colaborador');
  return prisma.colaborador.update({
    where: { id },
    data: {
      nome:             input.nome?.trim(),
      cargo:            'cargo' in input ? (input.cargo?.trim() || null) : undefined,
      feriasATirarDias: input.feriasATirarDias,
      ativo:            input.ativo,
      ordem:            input.ordem,
    },
  });
}

export async function removeColaborador(id: string) {
  const existing = await prisma.colaborador.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Colaborador');
  await prisma.colaborador.delete({ where: { id } }); // cascade apaga os períodos
}

export async function createPeriodo(input: CreatePeriodoInput) {
  const colab = await prisma.colaborador.findUnique({ where: { id: input.colaboradorId }, select: { id: true } });
  if (!colab) throw AppError.notFound('Colaborador');
  if (input.dataFim < input.dataInicio) throw AppError.badRequest('Data final anterior à inicial');
  const dias = diasCorridos(input.dataInicio, input.dataFim);
  return prisma.feriasPeriodo.create({
    data: {
      colaboradorId: input.colaboradorId,
      dataInicio: new Date(input.dataInicio + 'T00:00:00Z'),
      dataFim: new Date(input.dataFim + 'T00:00:00Z'),
      dias,
      observacoes: input.observacoes?.trim() || null,
    },
  });
}

export async function updatePeriodo(id: string, input: UpdatePeriodoInput) {
  const existing = await prisma.feriasPeriodo.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Período de férias');
  const inicio = input.dataInicio ?? toISO(existing.dataInicio);
  const fim    = input.dataFim ?? toISO(existing.dataFim);
  if (fim < inicio) throw AppError.badRequest('Data final anterior à inicial');
  return prisma.feriasPeriodo.update({
    where: { id },
    data: {
      dataInicio: input.dataInicio ? new Date(input.dataInicio + 'T00:00:00Z') : undefined,
      dataFim:    input.dataFim ? new Date(input.dataFim + 'T00:00:00Z') : undefined,
      dias:       (input.dataInicio || input.dataFim) ? diasCorridos(inicio, fim) : undefined,
      observacoes: 'observacoes' in input ? (input.observacoes?.trim() || null) : undefined,
    },
  });
}

export async function removePeriodo(id: string) {
  const existing = await prisma.feriasPeriodo.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Período de férias');
  await prisma.feriasPeriodo.delete({ where: { id } });
}
