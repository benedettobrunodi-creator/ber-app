import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { UpsertKickoffInput } from './types';

const parseDate = (d: string | null | undefined) => (d ? new Date(d) : null);

export async function getByObra(obraId: string) {
  return prisma.obraKickoff.findUnique({ where: { obraId } });
}

export async function upsert(obraId: string, input: UpsertKickoffInput) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!obra) throw AppError.notFound('Obra');
  return prisma.obraKickoff.upsert({
    where: { obraId },
    create: {
      obraId,
      dataRealizada:  parseDate(input.dataRealizada),
      participantes:  input.participantes ?? [],
      pautaCoberta:   input.pautaCoberta ?? null,
      decisoes:       input.decisoes ?? null,
      premissas:      input.premissas ?? null,
      riscosIniciais: input.riscosIniciais ?? null,
    },
    update: {
      dataRealizada:  'dataRealizada' in input ? parseDate(input.dataRealizada) : undefined,
      participantes:  input.participantes,
      pautaCoberta:   input.pautaCoberta,
      decisoes:       input.decisoes,
      premissas:      input.premissas,
      riscosIniciais: input.riscosIniciais,
    },
  });
}
