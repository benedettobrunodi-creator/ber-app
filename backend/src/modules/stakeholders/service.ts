import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateStakeholderInput, UpdateStakeholderInput } from './types';

const emptyToNull = (v: string | null | undefined) => (v && v.length > 0 ? v : null);

export async function listByObra(obraId: string) {
  return prisma.obraStakeholder.findMany({
    where: { obraId },
    orderBy: [{ ordem: 'asc' }, { empresa: 'asc' }, { nome: 'asc' }],
  });
}

export async function create(obraId: string, input: CreateStakeholderInput) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!obra) throw AppError.notFound('Obra');
  return prisma.obraStakeholder.create({
    data: {
      obraId,
      empresa:  input.empresa,
      nome:     input.nome,
      cargo:    emptyToNull(input.cargo),
      email:    emptyToNull(input.email),
      telefone: emptyToNull(input.telefone),
      funcao:   emptyToNull(input.funcao),
      ordem:    input.ordem ?? 0,
    },
  });
}

export async function update(id: string, input: UpdateStakeholderInput) {
  const existing = await prisma.obraStakeholder.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Stakeholder');
  return prisma.obraStakeholder.update({
    where: { id },
    data: {
      empresa:  input.empresa,
      nome:     input.nome,
      cargo:    'cargo'    in input ? emptyToNull(input.cargo)    : undefined,
      email:    'email'    in input ? emptyToNull(input.email)    : undefined,
      telefone: 'telefone' in input ? emptyToNull(input.telefone) : undefined,
      funcao:   'funcao'   in input ? emptyToNull(input.funcao)   : undefined,
      ordem:    input.ordem,
    },
  });
}

export async function remove(id: string) {
  const existing = await prisma.obraStakeholder.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Stakeholder');
  await prisma.obraStakeholder.delete({ where: { id } });
}
