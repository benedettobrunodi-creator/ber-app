import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateCloseOutItemInput, UpdateCloseOutItemInput } from './types';

/** Checklist padrão BÈR — aplicado sob demanda, sem duplicar títulos existentes. */
const CHECKLIST_PADRAO: { categoria: string; titulo: string }[] = [
  { categoria: 'asbuilt', titulo: 'As-built Arquitetura' },
  { categoria: 'asbuilt', titulo: 'As-built Elétrica / Dados' },
  { categoria: 'asbuilt', titulo: 'As-built Hidráulica' },
  { categoria: 'asbuilt', titulo: 'As-built Ar Condicionado' },
  { categoria: 'asbuilt', titulo: 'As-built SPK / SDAI' },
  { categoria: 'art_licencas', titulo: 'ART/RRT de execução' },
  { categoria: 'art_licencas', titulo: 'Licenças e alvarás' },
  { categoria: 'manuais', titulo: 'Manuais e NFs dos equipamentos instalados' },
  { categoria: 'garantias', titulo: 'Termos de garantia por fornecedor' },
  { categoria: 'acabamentos', titulo: 'Especificação de acabamentos (tintas, revestimentos, códigos de cor)' },
  { categoria: 'contatos', titulo: 'Contatos de manutenção por disciplina' },
  { categoria: 'fotos_finais', titulo: 'Fotos finais dos ambientes' },
  { categoria: 'laudos', titulo: 'Laudos e testes (SPDA, elétrica, estanqueidade)' },
];

export async function listByObra(obraId: string) {
  return prisma.obraCloseOutItem.findMany({
    where: { obraId },
    orderBy: [{ categoria: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function aplicarChecklistPadrao(obraId: string) {
  const existentes = await prisma.obraCloseOutItem.findMany({
    where: { obraId },
    select: { titulo: true },
  });
  const jaTem = new Set(existentes.map((e) => e.titulo));
  const novos = CHECKLIST_PADRAO.filter((c) => !jaTem.has(c.titulo));
  if (novos.length > 0) {
    await prisma.obraCloseOutItem.createMany({
      data: novos.map((c) => ({ obraId, categoria: c.categoria, titulo: c.titulo })),
    });
  }
  return { criados: novos.length, existentes: jaTem.size };
}

export async function create(obraId: string, input: CreateCloseOutItemInput) {
  return prisma.obraCloseOutItem.create({
    data: {
      obraId,
      categoria: input.categoria,
      titulo: input.titulo,
      descricao: input.descricao,
      fornecedor: input.fornecedor,
      validade: input.validade ? new Date(`${input.validade}T12:00:00Z`) : undefined,
    },
  });
}

export async function update(id: string, input: UpdateCloseOutItemInput) {
  const item = await prisma.obraCloseOutItem.findUnique({ where: { id } });
  if (!item) throw AppError.notFound('Item de close out');
  return prisma.obraCloseOutItem.update({
    where: { id },
    data: {
      ...(input.categoria !== undefined ? { categoria: input.categoria } : {}),
      ...(input.titulo !== undefined ? { titulo: input.titulo } : {}),
      ...(input.descricao !== undefined ? { descricao: input.descricao } : {}),
      ...(input.fornecedor !== undefined ? { fornecedor: input.fornecedor } : {}),
      ...(input.validade !== undefined ? { validade: input.validade ? new Date(`${input.validade}T12:00:00Z`) : null } : {}),
      ...(input.status !== undefined
        ? { status: input.status, recebidoEm: input.status === 'recebido' ? new Date() : null }
        : {}),
    },
  });
}

export async function setArquivo(id: string, url: string, nome: string) {
  const item = await prisma.obraCloseOutItem.findUnique({ where: { id } });
  if (!item) throw AppError.notFound('Item de close out');
  // anexar arquivo já marca como recebido — é a evidência
  return prisma.obraCloseOutItem.update({
    where: { id },
    data: { arquivoUrl: url, arquivoNome: nome, status: 'recebido', recebidoEm: new Date() },
  });
}

export async function remove(id: string) {
  const item = await prisma.obraCloseOutItem.findUnique({ where: { id } });
  if (!item) throw AppError.notFound('Item de close out');
  await prisma.obraCloseOutItem.delete({ where: { id } });
}

/** Dados compilados pro Manual do Proprietário (view imprimível no web). */
export async function manualData(obraId: string) {
  const [obra, itens] = await Promise.all([
    prisma.obra.findUnique({ where: { id: obraId }, select: { name: true, client: true, address: true, actualEndDate: true, expectedEndDate: true } }),
    listByObra(obraId),
  ]);
  if (!obra) throw AppError.notFound('Obra');
  return { obra, itens, geradoEm: new Date() };
}
