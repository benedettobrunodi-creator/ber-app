import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type {
  CreateTopicoInput,
  UpdateTopicoInput,
  CreateReuniaoInput,
  UpsertNotaInput,
} from './types';

const topicoSelect = {
  id: true,
  ordem: true,
  status: true,
  impacto: true,
  changeOrder: true,
  tema: true,
  area: true,
  responsavelId: true,
  dataInfo: true,
  dataAlvo: true,
  dataFinal: true,
  responsavel: { select: { id: true, name: true } },
} as const;

export async function getAtaCorrida(obraId: string) {
  const [obra, stakeholders, topicos, reunioes, notas] = await Promise.all([
    prisma.obra.findUnique({
      where: { id: obraId },
      select: {
        id: true,
        name: true,
        client: true,
        address: true,
        arquiteturaEscritorio: true,
        gerenciadora: true,
        areaM2: true,
        dataInicioObra: true,
        dataFimObra: true,
      },
    }),
    prisma.obraStakeholder.findMany({
      where: { obraId },
      orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, empresa: true, nome: true, funcao: true, email: true, telefone: true },
    }),
    prisma.obraAtaTopico.findMany({
      where: { obraId },
      orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
      select: topicoSelect,
    }),
    prisma.obraAtaReuniao.findMany({
      where: { obraId },
      orderBy: { data: 'asc' },
      select: { id: true, data: true },
    }),
    prisma.obraAtaNota.findMany({
      where: { topico: { obraId } },
      select: { topicoId: true, reuniaoId: true, texto: true },
    }),
  ]);

  if (!obra) throw AppError.notFound('Obra');

  return { obra, stakeholders, topicos, reunioes, notas };
}

export async function createTopico(obraId: string, input: CreateTopicoInput) {
  const maxOrdem = await prisma.obraAtaTopico.aggregate({
    where: { obraId },
    _max: { ordem: true },
  });
  const ordem = (maxOrdem._max.ordem ?? 0) + 1;
  return prisma.obraAtaTopico.create({
    data: {
      obraId,
      ordem,
      status: input.status ?? 'em_andamento',
      impacto: input.impacto ?? 'sem_impacto',
      changeOrder: input.changeOrder ?? false,
      tema: input.tema ?? null,
      area: input.area ?? null,
      responsavelId: input.responsavelId ?? null,
      dataInfo: input.dataInfo ? new Date(input.dataInfo) : null,
      dataAlvo: input.dataAlvo ? new Date(input.dataAlvo) : null,
      dataFinal: input.dataFinal ? new Date(input.dataFinal) : null,
    },
    select: topicoSelect,
  });
}

export async function updateTopico(topicoId: string, input: UpdateTopicoInput) {
  return prisma.obraAtaTopico.update({
    where: { id: topicoId },
    data: {
      ...(input.ordem !== undefined && { ordem: input.ordem }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.impacto !== undefined && { impacto: input.impacto }),
      ...(input.changeOrder !== undefined && { changeOrder: input.changeOrder }),
      ...(input.tema !== undefined && { tema: input.tema }),
      ...(input.area !== undefined && { area: input.area }),
      ...(input.responsavelId !== undefined && { responsavelId: input.responsavelId }),
      ...(input.dataInfo !== undefined && { dataInfo: input.dataInfo ? new Date(input.dataInfo) : null }),
      ...(input.dataAlvo !== undefined && { dataAlvo: input.dataAlvo ? new Date(input.dataAlvo) : null }),
      ...(input.dataFinal !== undefined && { dataFinal: input.dataFinal ? new Date(input.dataFinal) : null }),
    },
    select: topicoSelect,
  });
}

export async function removeTopico(topicoId: string) {
  await prisma.obraAtaTopico.delete({ where: { id: topicoId } });
}

export async function reorderTopicos(obraId: string, ids: string[]) {
  await prisma.$transaction(
    ids.map((id, idx) =>
      prisma.obraAtaTopico.update({
        where: { id },
        data: { ordem: idx + 1 },
      }),
    ),
  );
  return prisma.obraAtaTopico.findMany({
    where: { obraId },
    orderBy: { ordem: 'asc' },
    select: topicoSelect,
  });
}

export async function createReuniao(obraId: string, input: CreateReuniaoInput) {
  try {
    return await prisma.obraAtaReuniao.create({
      data: { obraId, data: new Date(input.data) },
      select: { id: true, data: true },
    });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      throw AppError.conflict('Já existe reunião nessa data');
    }
    throw err;
  }
}

export async function removeReuniao(reuniaoId: string) {
  await prisma.obraAtaReuniao.delete({ where: { id: reuniaoId } });
}

export async function upsertNota(input: UpsertNotaInput) {
  const texto = input.texto.trim();
  if (texto.length === 0) {
    await prisma.obraAtaNota.deleteMany({
      where: { topicoId: input.topicoId, reuniaoId: input.reuniaoId },
    });
    return null;
  }
  return prisma.obraAtaNota.upsert({
    where: {
      topicoId_reuniaoId: { topicoId: input.topicoId, reuniaoId: input.reuniaoId },
    },
    create: { topicoId: input.topicoId, reuniaoId: input.reuniaoId, texto },
    update: { texto },
    select: { topicoId: true, reuniaoId: true, texto: true },
  });
}
