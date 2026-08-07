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

/** Próximo aniversário de admissão a partir de hoje — marca o fim do período
 *  aquisitivo corrente (quando um novo período de férias passa a valer). */
function proximoVencimento(dataAdmissao: Date | null): string | null {
  if (!dataAdmissao) return null;
  const hoje = new Date();
  const hojeUTC = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  let ano = hoje.getUTCFullYear();
  let prox = Date.UTC(ano, dataAdmissao.getUTCMonth(), dataAdmissao.getUTCDate());
  if (prox < hojeUTC) prox = Date.UTC(++ano, dataAdmissao.getUTCMonth(), dataAdmissao.getUTCDate());
  return new Date(prox).toISOString().slice(0, 10);
}

/** Mapa role → cargo legível (default do seed; editável depois). */
const ROLE_CARGO: Record<string, string> = {
  socio: 'Sócio', diretoria: 'Diretoria', coordenacao: 'Coordenação', pmo: 'PMO',
  engenharia: 'Engenharia', financeiro: 'Financeiro', gestor: 'Gestor',
  compras: 'Compras', orcamentos: 'Orçamentos', campo: 'Campo',
};

/** Garante que todo usuário do app tenha um Colaborador vinculado (auto-populate
 *  da timeline). Só cria os que faltam — não mexe em quem já existe. */
async function syncFromUsers() {
  const [users, existentes] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, role: true }, orderBy: { name: 'asc' } }),
    prisma.colaborador.findMany({ where: { userId: { not: null } }, select: { userId: true } }),
  ]);
  const jaTem = new Set(existentes.map(c => c.userId));
  const faltantes = users.filter(u => !jaTem.has(u.id));
  if (faltantes.length === 0) return;
  const maxAgg = await prisma.colaborador.aggregate({ _max: { ordem: true } });
  let ordem = (maxAgg._max.ordem ?? -1) + 1;
  await prisma.colaborador.createMany({
    data: faltantes.map(u => ({
      userId: u.id,
      nome: u.name,
      cargo: ROLE_CARGO[u.role] ?? null,
      feriasATirarDias: 30,
      ordem: ordem++,
    })),
  });
}

/** Lista colaboradores (ativos + inativos) com períodos e saldo em aberto calculado. */
export async function listColaboradores() {
  await syncFromUsers();
  const rows = await prisma.colaborador.findMany({
    where: { ativo: true }, // inativos (excluídos) não aparecem na timeline
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    include: { ferias: { orderBy: { dataInicio: 'asc' } } },
  });
  return rows.map(c => {
    const diasUsados = c.ferias.reduce((s, p) => s + p.dias, 0);
    return {
      id: c.id,
      userId: c.userId,
      nome: c.nome,
      cargo: c.cargo,
      dataAdmissao: c.dataAdmissao ? toISO(c.dataAdmissao) : null,
      proximoVencimento: proximoVencimento(c.dataAdmissao),
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
      dataAdmissao: input.dataAdmissao ? new Date(input.dataAdmissao + 'T00:00:00Z') : null,
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
      dataAdmissao:     'dataAdmissao' in input ? (input.dataAdmissao ? new Date(input.dataAdmissao + 'T00:00:00Z') : null) : undefined,
      feriasATirarDias: input.feriasATirarDias,
      ativo:            input.ativo,
      ordem:            input.ordem,
    },
  });
}

export async function removeColaborador(id: string) {
  const existing = await prisma.colaborador.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Colaborador');
  // Colaborador vinculado a usuário do app não é apagado (o sync recriaria) —
  // vira inativo. Manual (terceirizado) é apagado de fato.
  if (existing.userId) {
    await prisma.colaborador.update({ where: { id }, data: { ativo: false } });
  } else {
    await prisma.colaborador.delete({ where: { id } }); // cascade apaga os períodos
  }
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
