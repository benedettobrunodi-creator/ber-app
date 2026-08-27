import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreatePendenciaInput, UpdatePendenciaInput, MudarStatusInput } from './types';

const dateOrNull = (s?: string) => (s ? new Date(`${s}T12:00:00Z`) : undefined);

export async function listByObra(obraId: string, filtros: { status?: string; tipo?: string }) {
  return prisma.obraPendencia.findMany({
    where: {
      obraId,
      ...(filtros.status ? { status: filtros.status } : {}),
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
    },
    include: {
      responsavel: { select: { id: true, name: true } },
      criador: { select: { id: true, name: true } },
    },
    orderBy: [{ status: 'asc' }, { dataTermino: 'asc' }, { createdAt: 'desc' }],
  });
}

/** Resumo calculado AO VIVO (nunca desatualiza — correção da planilha). */
export async function resumoByObra(obraId: string) {
  const todas = await prisma.obraPendencia.findMany({
    where: { obraId },
    select: { ambiente: true, fornecedor: true, status: true, tipo: true, criticidade: true, dataTermino: true },
  });
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const aberta = (p: { status: string }) => p.status !== 'concluida';
  const atrasada = (p: { status: string; dataTermino: Date | null }) =>
    aberta(p) && !!p.dataTermino && p.dataTermino < hoje;

  const porChave = (chave: 'ambiente' | 'fornecedor') => {
    const m = new Map<string, { total: number; abertas: number; atrasadas: number }>();
    for (const p of todas) {
      const k = (p[chave] ?? '— sem fornecedor —') || '— sem fornecedor —';
      const cur = m.get(k) ?? { total: 0, abertas: 0, atrasadas: 0 };
      cur.total++;
      if (aberta(p)) cur.abertas++;
      if (atrasada(p)) cur.atrasadas++;
      m.set(k, cur);
    }
    return [...m.entries()]
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.abertas - a.abertas || b.total - a.total);
  };

  return {
    total: todas.length,
    concluidas: todas.filter((p) => p.status === 'concluida').length,
    abertas: todas.filter(aberta).length,
    atrasadas: todas.filter(atrasada).length,
    bloqueadas: todas.filter((p) => p.status === 'bloqueada').length,
    solicitacoesCliente: todas.filter((p) => p.tipo === 'solicitacao' && aberta(p)).length,
    criticidadeAlta: todas.filter((p) => p.criticidade === 'alta' && aberta(p)).length,
    porAmbiente: porChave('ambiente'),
    porFornecedor: porChave('fornecedor'),
  };
}

export async function create(obraId: string, userId: string, input: CreatePendenciaInput) {
  return prisma.obraPendencia.create({
    data: {
      obraId,
      ambiente: input.ambiente,
      atividade: input.atividade,
      disciplina: input.disciplina,
      fornecedor: input.fornecedor,
      apontadoPor: input.apontadoPor,
      responsavelId: input.responsavelId,
      tipo: input.tipo,
      criticidade: input.criticidade,
      dataInicio: dateOrNull(input.dataInicio),
      dataTermino: dateOrNull(input.dataTermino),
      observacoes: input.observacoes,
      createdBy: userId,
    },
  });
}

export async function update(id: string, input: UpdatePendenciaInput) {
  const existing = await prisma.obraPendencia.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Pendência não encontrada');
  return prisma.obraPendencia.update({
    where: { id },
    data: {
      ...(input.ambiente !== undefined ? { ambiente: input.ambiente } : {}),
      ...(input.atividade !== undefined ? { atividade: input.atividade } : {}),
      ...(input.disciplina !== undefined ? { disciplina: input.disciplina } : {}),
      ...(input.fornecedor !== undefined ? { fornecedor: input.fornecedor } : {}),
      ...(input.apontadoPor !== undefined ? { apontadoPor: input.apontadoPor } : {}),
      ...(input.responsavelId !== undefined ? { responsavelId: input.responsavelId } : {}),
      ...(input.tipo !== undefined ? { tipo: input.tipo } : {}),
      ...(input.criticidade !== undefined ? { criticidade: input.criticidade } : {}),
      ...(input.dataInicio !== undefined ? { dataInicio: dateOrNull(input.dataInicio) } : {}),
      ...(input.dataTermino !== undefined ? { dataTermino: dateOrNull(input.dataTermino) } : {}),
      ...(input.observacoes !== undefined ? { observacoes: input.observacoes } : {}),
    },
  });
}

/**
 * Transições de status. Regra do Bruno: CONCLUIR exige foto de conclusão
 * (evidência do serviço feito) — sem foto, a baixa é recusada.
 */
export async function mudarStatus(id: string, input: MudarStatusInput) {
  const p = await prisma.obraPendencia.findUnique({ where: { id } });
  if (!p) throw AppError.notFound('Pendência não encontrada');
  if (input.status === 'concluida' && !p.fotoConclusaoUrl) {
    throw AppError.badRequest('Anexe a foto do serviço concluído antes de dar baixa');
  }
  if (input.status === 'bloqueada' && !input.motivoBloqueio?.trim()) {
    throw AppError.badRequest('Informe o motivo do bloqueio');
  }
  return prisma.obraPendencia.update({
    where: { id },
    data: {
      status: input.status,
      motivoBloqueio: input.status === 'bloqueada' ? input.motivoBloqueio : null,
      concluidaEm: input.status === 'concluida' ? new Date() : null,
    },
  });
}

export async function setFoto(id: string, tipo: 'abertura' | 'conclusao', url: string) {
  const p = await prisma.obraPendencia.findUnique({ where: { id } });
  if (!p) throw AppError.notFound('Pendência não encontrada');
  return prisma.obraPendencia.update({
    where: { id },
    data: tipo === 'abertura' ? { fotoAberturaUrl: url } : { fotoConclusaoUrl: url },
  });
}

export async function remove(id: string) {
  const p = await prisma.obraPendencia.findUnique({ where: { id } });
  if (!p) throw AppError.notFound('Pendência não encontrada');
  await prisma.obraPendencia.delete({ where: { id } });
}
