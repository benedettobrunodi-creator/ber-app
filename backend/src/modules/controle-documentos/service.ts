import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateDocumentoInput, UpdateDocumentoInput, CreateRevisaoInput } from './types';

const include = {
  revisoes: { orderBy: { data: 'desc' as const } },
  createdBy: { select: { id: true, name: true } },
};

export async function listByObra(obraId: string) {
  return prisma.projetoDocumento.findMany({
    where: { obraId },
    include,
    orderBy: [{ disciplina: 'asc' }, { codigo: 'asc' }],
  });
}

export async function create(obraId: string, data: CreateDocumentoInput, createdById: string) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!obra) throw AppError.notFound('Obra');
  const existing = await prisma.projetoDocumento.findUnique({
    where: { obraId_codigo: { obraId, codigo: data.codigo } },
  });
  if (existing) throw AppError.badRequest(`Já existe um documento com o código "${data.codigo}" nesta obra`);
  return prisma.projetoDocumento.create({
    data: {
      obraId,
      codigo: data.codigo,
      titulo: data.titulo ?? null,
      disciplina: data.disciplina,
      projetista: data.projetista ?? null,
      etapa: data.etapa ?? null,
      createdById,
    },
    include,
  });
}

export async function update(id: string, data: UpdateDocumentoInput) {
  const existing = await prisma.projetoDocumento.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Documento');
  if (data.codigo && data.codigo !== existing.codigo) {
    const dup = await prisma.projetoDocumento.findUnique({
      where: { obraId_codigo: { obraId: existing.obraId, codigo: data.codigo } },
    });
    if (dup) throw AppError.badRequest(`Já existe um documento com o código "${data.codigo}" nesta obra`);
  }
  return prisma.projetoDocumento.update({
    where: { id },
    data: {
      ...(data.codigo !== undefined && { codigo: data.codigo }),
      ...(data.titulo !== undefined && { titulo: data.titulo }),
      ...(data.disciplina !== undefined && { disciplina: data.disciplina }),
      ...(data.projetista !== undefined && { projetista: data.projetista }),
      ...(data.etapa !== undefined && { etapa: data.etapa }),
    },
    include,
  });
}

export async function remove(id: string) {
  const existing = await prisma.projetoDocumento.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Documento');
  await prisma.projetoDocumento.delete({ where: { id } });
}

/** Próxima revisão sugerida: incrementa o número da última (ex: R03 → R04).
 *  Se não seguir o padrão R\d+, sugere vazio (usuário digita na mão). */
export async function sugerirProximaRevisao(documentoId: string): Promise<string> {
  const ultima = await prisma.projetoDocumentoRevisao.findFirst({
    where: { documentoId },
    orderBy: { data: 'desc' },
  });
  if (!ultima) return 'R00';
  const m = ultima.revisao.match(/^([A-Za-z]*)(\d+)$/);
  if (!m) return '';
  const [, prefix, numStr] = m;
  const next = (parseInt(numStr, 10) + 1).toString().padStart(numStr.length, '0');
  return `${prefix}${next}`;
}

export async function addRevisao(
  documentoId: string,
  data: CreateRevisaoInput,
  arquivo: { url: string; nome: string } | null,
  createdById: string,
) {
  const documento = await prisma.projetoDocumento.findUnique({ where: { id: documentoId } });
  if (!documento) throw AppError.notFound('Documento');
  await prisma.projetoDocumentoRevisao.create({
    data: {
      documentoId,
      revisao: data.revisao,
      data: new Date(data.data),
      observacao: data.observacao ?? null,
      arquivoUrl: arquivo?.url ?? null,
      arquivoNome: arquivo?.nome ?? null,
      createdById,
    },
  });
  return prisma.projetoDocumento.findUnique({ where: { id: documentoId }, include });
}

export async function removeRevisao(revisaoId: string) {
  const existing = await prisma.projetoDocumentoRevisao.findUnique({ where: { id: revisaoId } });
  if (!existing) throw AppError.notFound('Revisão');
  await prisma.projetoDocumentoRevisao.delete({ where: { id: revisaoId } });
  return existing.documentoId;
}
