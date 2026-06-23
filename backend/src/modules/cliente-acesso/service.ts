import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import { randomUUID } from 'node:crypto';
import type { IssueAcessoInput, AprovarInput, ContestarInput } from './types';

export async function issueAcesso(obraId: string, input: IssueAcessoInput) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!obra) throw AppError.notFound('Obra');
  const token = randomUUID();
  return prisma.clienteAcesso.create({
    data: {
      obraId,
      email: input.email,
      nome:  input.nome,
      token,
      expiraEm: input.expiraEm ? new Date(input.expiraEm) : null,
    },
  });
}

export async function listAcessosByObra(obraId: string) {
  return prisma.clienteAcesso.findMany({
    where: { obraId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function revogarAcesso(id: string) {
  const a = await prisma.clienteAcesso.findUnique({ where: { id } });
  if (!a) throw AppError.notFound('Acesso');
  await prisma.clienteAcesso.delete({ where: { id } });
}

/**
 * Cliente abre /v1/cliente/medicao/:token — busca a medição vinculada
 * (qualquer medição enviada da obra cujo tokenPublico bata).
 * Sem auth — só validação de token.
 */
export async function getMedicaoPorToken(token: string) {
  const m = await prisma.medicao.findUnique({
    where: { tokenPublico: token },
    include: {
      obra: { select: { id: true, name: true, client: true, valorContrato: true, prazoPagamentoDias: true } },
      itens: {
        include: {
          etapaFornecedor: {
            include: {
              etapa: true,
              fornecedor: true,
            },
          },
        },
      },
      pagamentosDiretos: true,
      transicoes: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!m) throw AppError.notFound('Medição');
  // só expõe medições enviadas em diante (não rascunho)
  if (m.status === 'rascunho') throw AppError.notFound('Medição');
  return m;
}

export async function clienteAprovar(token: string, _input: AprovarInput) {
  const m = await prisma.medicao.findUnique({ where: { tokenPublico: token } });
  if (!m) throw AppError.notFound('Medição');
  if (m.status !== 'enviada') {
    throw AppError.badRequest(`Medição não está em estado enviada (atual: ${m.status})`);
  }
  return prisma.$transaction(async (tx) => {
    const upd = await tx.medicao.update({
      where: { id: m.id },
      data: { status: 'aprovada' },
    });
    await tx.medicaoTransicao.create({
      data: {
        medicaoId: m.id,
        userId: null,
        deStatus: 'enviada',
        paraStatus: 'aprovada',
        comentario: 'Aprovada pelo cliente via portal',
      },
    });
    return upd;
  });
}

export async function clienteContestar(token: string, input: ContestarInput) {
  const m = await prisma.medicao.findUnique({ where: { tokenPublico: token } });
  if (!m) throw AppError.notFound('Medição');
  if (m.status !== 'enviada') {
    throw AppError.badRequest(`Medição não está em estado enviada (atual: ${m.status})`);
  }
  return prisma.$transaction(async (tx) => {
    const upd = await tx.medicao.update({
      where: { id: m.id },
      data: { status: 'contestada' },
    });
    await tx.medicaoTransicao.create({
      data: {
        medicaoId: m.id,
        userId: null,
        deStatus: 'enviada',
        paraStatus: 'contestada',
        comentario: `Contestada pelo cliente: ${input.comentario}`,
      },
    });
    return upd;
  });
}
