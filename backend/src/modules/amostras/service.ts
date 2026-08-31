import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateAmostraInput, UpdateAmostraInput } from './types';

const include = {
  responsavelStakeholder: { select: { id: true, nome: true, empresa: true, email: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

export async function listByObra(obraId: string) {
  return prisma.amostraAprovacao.findMany({
    where: { obraId },
    include,
    orderBy: { createdAt: 'desc' },
  });
}

export async function create(obraId: string, data: CreateAmostraInput, createdById: string) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!obra) throw AppError.notFound('Obra');
  return prisma.amostraAprovacao.create({
    data: {
      obraId,
      item: data.item,
      marca: data.marca ?? null,
      especificacao: data.especificacao ?? null,
      ambiente: data.ambiente ?? null,
      status: data.status ?? 'aprovado',
      dataAprovacao: data.dataAprovacao ? new Date(data.dataAprovacao) : null,
      responsavelStakeholderId: data.responsavelStakeholderId ?? null,
      observacoes: data.observacoes ?? null,
      createdById,
    },
    include,
  });
}

export async function update(id: string, data: UpdateAmostraInput) {
  const existing = await prisma.amostraAprovacao.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Amostra');
  return prisma.amostraAprovacao.update({
    where: { id },
    data: {
      ...(data.item !== undefined && { item: data.item }),
      ...(data.marca !== undefined && { marca: data.marca }),
      ...(data.especificacao !== undefined && { especificacao: data.especificacao }),
      ...(data.ambiente !== undefined && { ambiente: data.ambiente }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.dataAprovacao !== undefined && { dataAprovacao: data.dataAprovacao ? new Date(data.dataAprovacao) : null }),
      ...(data.responsavelStakeholderId !== undefined && { responsavelStakeholderId: data.responsavelStakeholderId }),
      ...(data.observacoes !== undefined && { observacoes: data.observacoes }),
    },
    include,
  });
}

export async function remove(id: string) {
  const existing = await prisma.amostraAprovacao.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Amostra');
  await prisma.amostraAprovacao.delete({ where: { id } });
}

export async function addFoto(id: string, url: string) {
  const existing = await prisma.amostraAprovacao.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Amostra');
  return prisma.amostraAprovacao.update({
    where: { id },
    data: { fotos: { push: url } },
    include,
  });
}

export async function removeFoto(id: string, url: string) {
  const existing = await prisma.amostraAprovacao.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Amostra');
  return prisma.amostraAprovacao.update({
    where: { id },
    data: { fotos: existing.fotos.filter((f) => f !== url) },
    include,
  });
}

export async function marcarEmailEnviado(id: string) {
  return prisma.amostraAprovacao.update({
    where: { id },
    data: { emailEnviadoEm: new Date() },
  });
}
