import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { UpsertKickoffInput, UpdateKickoffItemInput } from './types';
import { KICKOFF_TEMPLATE } from './template';

const parseDate = (d: string | null | undefined) => (d ? new Date(d) : null);

/** Semeia os itens do template padrão pra uma obra (se ainda não tiver nenhum). */
async function seedItens(obraId: string) {
  const rows: { obraId: string; secao: string; item: string; ordem: number }[] = [];
  let ordem = 0;
  for (const secao of KICKOFF_TEMPLATE) {
    for (const item of secao.itens) {
      rows.push({ obraId, secao: secao.secao, item, ordem: ordem++ });
    }
  }
  if (rows.length) await prisma.obraKickoffItem.createMany({ data: rows });
}

export async function getByObra(obraId: string) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true, name: true } });
  if (!obra) throw AppError.notFound('Obra');

  const header = await prisma.obraKickoff.findUnique({ where: { obraId } });

  let itens = await prisma.obraKickoffItem.findMany({ where: { obraId }, orderBy: { ordem: 'asc' } });
  if (itens.length === 0) {
    await seedItens(obraId);
    itens = await prisma.obraKickoffItem.findMany({ where: { obraId }, orderBy: { ordem: 'asc' } });
  }

  return { obra, header, itens };
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
      coordenador:    input.coordenador ?? null,
      engenheiro:     input.engenheiro ?? null,
      supervisor:     input.supervisor ?? null,
      mestreEncarregado: input.mestreEncarregado ?? null,
      inicioObra:     parseDate(input.inicioObra),
      terminoObra:    parseDate(input.terminoObra),
      dataKickoff:    parseDate(input.dataKickoff),
      participantesDeptos: input.participantesDeptos ?? {},
    },
    update: {
      ...(input.dataRealizada  !== undefined && { dataRealizada:  parseDate(input.dataRealizada) }),
      ...(input.participantes  !== undefined && { participantes:  input.participantes }),
      ...(input.pautaCoberta   !== undefined && { pautaCoberta:   input.pautaCoberta }),
      ...(input.decisoes       !== undefined && { decisoes:       input.decisoes }),
      ...(input.premissas      !== undefined && { premissas:      input.premissas }),
      ...(input.riscosIniciais !== undefined && { riscosIniciais: input.riscosIniciais }),
      ...(input.coordenador    !== undefined && { coordenador:    input.coordenador }),
      ...(input.engenheiro     !== undefined && { engenheiro:     input.engenheiro }),
      ...(input.supervisor     !== undefined && { supervisor:     input.supervisor }),
      ...(input.mestreEncarregado !== undefined && { mestreEncarregado: input.mestreEncarregado }),
      ...(input.inicioObra     !== undefined && { inicioObra:     parseDate(input.inicioObra) }),
      ...(input.terminoObra    !== undefined && { terminoObra:    parseDate(input.terminoObra) }),
      ...(input.dataKickoff    !== undefined && { dataKickoff:    parseDate(input.dataKickoff) }),
      ...(input.participantesDeptos !== undefined && { participantesDeptos: input.participantesDeptos }),
    },
  });
}

export async function updateItem(itemId: string, input: UpdateKickoffItemInput) {
  const item = await prisma.obraKickoffItem.findUnique({ where: { id: itemId }, select: { id: true } });
  if (!item) throw AppError.notFound('Item do kickoff');
  return prisma.obraKickoffItem.update({
    where: { id: itemId },
    data: {
      ...(input.responsavel !== undefined && { responsavel: input.responsavel }),
      ...(input.resposta    !== undefined && { resposta:    input.resposta }),
      ...(input.naRede      !== undefined && { naRede:      input.naRede }),
      ...(input.dataAlvo    !== undefined && { dataAlvo:    parseDate(input.dataAlvo) }),
      ...(input.status      !== undefined && { status:      input.status }),
      ...(input.observacoes !== undefined && { observacoes: input.observacoes }),
    },
  });
}
