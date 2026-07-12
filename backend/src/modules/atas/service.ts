import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type {
  CreateTopicoInput,
  UpdateTopicoInput,
  CreateAtualizacaoInput,
} from './types';

const topicoSelect = {
  id: true,
  ordem: true,
  status: true,
  impacto: true,
  changeOrder: true,
  disciplina: true,
  tema: true,
  observacoes: true,
  responsavelId: true,
  dataInfo: true,
  dataAlvo: true,
  dataFinal: true,
  responsavel: { select: { id: true, name: true } },
  atualizacoes: {
    orderBy: { data: 'desc' as const },
    select: { id: true, data: true, texto: true, createdAt: true },
  },
} as const;

export async function getAtaCorrida(obraId: string) {
  const [obra, stakeholders, topicos] = await Promise.all([
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
  ]);

  if (!obra) throw AppError.notFound('Obra');

  return { obra, stakeholders, topicos };
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
      disciplina: input.disciplina ?? null,
      tema: input.tema ?? null,
      observacoes: input.observacoes ?? null,
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
      ...(input.disciplina !== undefined && { disciplina: input.disciplina }),
      ...(input.tema !== undefined && { tema: input.tema }),
      ...(input.observacoes !== undefined && { observacoes: input.observacoes }),
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

export async function addAtualizacao(topicoId: string, input: CreateAtualizacaoInput) {
  const texto = input.texto.trim();
  if (!texto) throw AppError.badRequest('Texto da atualização é obrigatório');
  return prisma.obraAtaTopicoAtualizacao.create({
    data: { topicoId, data: new Date(input.data), texto },
    select: { id: true, data: true, texto: true, createdAt: true },
  });
}

export async function updateAtualizacao(atualizacaoId: string, input: Partial<CreateAtualizacaoInput>) {
  return prisma.obraAtaTopicoAtualizacao.update({
    where: { id: atualizacaoId },
    data: {
      ...(input.data !== undefined && { data: new Date(input.data) }),
      ...(input.texto !== undefined && { texto: input.texto.trim() }),
    },
    select: { id: true, data: true, texto: true, createdAt: true },
  });
}

export async function removeAtualizacao(atualizacaoId: string) {
  await prisma.obraAtaTopicoAtualizacao.delete({ where: { id: atualizacaoId } });
}
