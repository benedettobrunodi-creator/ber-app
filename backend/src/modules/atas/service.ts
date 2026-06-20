import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateAtaInput, UpdateAtaInput, AddPendenciaInput } from './types';
import type { Prisma } from '@prisma/client';

const parseDate = (d: string | null | undefined) => (d ? new Date(d) : null);

/** Lazy-cria (ou recupera) o PunchList do tipo "geral" da obra,
 *  usado pra alojar pendências unificadas (ata, diário, vistoria). */
async function getOrCreateGeralPunchList(obraId: string, userId?: string) {
  const existing = await prisma.punchList.findFirst({
    where: { obraId, type: 'geral' },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.punchList.create({
    data: { obraId, type: 'geral', createdBy: userId },
    select: { id: true },
  });
  return created.id;
}

export async function listByObra(obraId: string, tipo?: string) {
  const where: Prisma.ObraAtaWhereInput = { obraId };
  if (tipo) where.tipo = tipo;
  return prisma.obraAta.findMany({
    where,
    include: {
      pendencias: {
        select: {
          id: true,
          descricao: true,
          status: true,
          prazo: true,
          responsible: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { data: 'desc' },
  });
}

export async function getOne(id: string) {
  const a = await prisma.obraAta.findUnique({
    where: { id },
    include: {
      pendencias: {
        include: { responsible: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!a) throw AppError.notFound('Ata');
  return a;
}

export async function create(obraId: string, input: CreateAtaInput, userId?: string) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!obra) throw AppError.notFound('Obra');

  const pendenciasToCreate = input.pendencias ?? [];
  const needPunchList = pendenciasToCreate.length > 0;
  const punchListId = needPunchList ? await getOrCreateGeralPunchList(obraId, userId) : null;

  return prisma.obraAta.create({
    data: {
      obraId,
      tipo:          input.tipo,
      numero:        input.numero,
      data:          new Date(input.data),
      local:         input.local ?? null,
      participantes: input.participantes,
      pauta:         input.pauta,
      decisoes:      input.decisoes ?? null,
      pendencias: needPunchList ? {
        create: pendenciasToCreate.map(p => ({
          punchListId: punchListId!,
          descricao: p.descricao,
          responsibleId: p.responsibleId ?? null,
          prazo: parseDate(p.prazo),
          origem: 'ata',
        })),
      } : undefined,
    },
    include: {
      pendencias: {
        include: { responsible: { select: { id: true, name: true } } },
      },
    },
  });
}

export async function update(id: string, input: UpdateAtaInput) {
  const existing = await prisma.obraAta.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Ata');
  return prisma.obraAta.update({
    where: { id },
    data: {
      tipo:          input.tipo,
      numero:        input.numero,
      data:          input.data ? new Date(input.data) : undefined,
      local:         input.local,
      participantes: input.participantes,
      pauta:         input.pauta,
      decisoes:      input.decisoes,
    },
  });
}

export async function addPendencia(ataId: string, input: AddPendenciaInput, userId?: string) {
  const ata = await prisma.obraAta.findUnique({ where: { id: ataId }, select: { obraId: true } });
  if (!ata) throw AppError.notFound('Ata');
  const punchListId = await getOrCreateGeralPunchList(ata.obraId, userId);
  return prisma.punchListItem.create({
    data: {
      punchListId,
      descricao: input.descricao,
      responsibleId: input.responsibleId ?? null,
      prazo: parseDate(input.prazo),
      origem: 'ata',
      ataOrigemId: ataId,
    },
    include: { responsible: { select: { id: true, name: true } } },
  });
}

export async function remove(id: string) {
  const existing = await prisma.obraAta.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Ata');
  await prisma.attachment.deleteMany({ where: { entityType: 'ata', entityId: id } });
  // PunchListItems com ataOrigemId apontando pra essa ata: ataOrigemId vira null (onDelete SetNull no schema)
  await prisma.obraAta.delete({ where: { id } });
}
