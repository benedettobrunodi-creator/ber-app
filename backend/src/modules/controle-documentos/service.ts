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

/**
 * Extrai código + revisão do nome do arquivo, pro fluxo de arrastar-e-soltar
 * em massa. Ex: "319-EDW-CV-CD_R01.pdf" → { codigo: "319-EDW-CV-CD", revisao: "R01" }.
 * Sem sufixo de revisão reconhecível → revisão R00, código = nome sem extensão.
 */
export function parseNomeArquivo(filename: string): { codigo: string; revisao: string } {
  const base = filename.replace(/\.[^./\\]+$/, '');
  const m = base.match(/^(.+?)[-_ ]+[Rr](?:ev)?\.?\s*(\d+)$/);
  if (m) {
    const [, codigoBruto, numStr] = m;
    return { codigo: codigoBruto.trim(), revisao: `R${numStr.padStart(2, '0')}` };
  }
  return { codigo: base.trim(), revisao: 'R00' };
}

/**
 * Upload em massa: cada arquivo vira um documento novo (disciplina "Outra"
 * até o usuário corrigir) OU uma revisão nova se já existir documento com
 * esse código na obra (ex: reenviar revisão atualizada de um doc existente).
 */
export async function bulkUpload(
  obraId: string,
  files: { buffer: Buffer; originalname: string; mimetype: string }[],
  createdById: string,
) {
  const { uploadToR2, isR2Configured } = await import('../../services/storage');
  if (!isR2Configured()) throw AppError.badRequest('Storage de arquivos não configurado no servidor');

  const criados: string[] = [];
  const atualizados: string[] = [];
  const hoje = new Date();

  for (const file of files) {
    const { codigo, revisao } = parseNomeArquivo(file.originalname);
    const url = await uploadToR2(file.buffer, `documentos/${obraId}-${codigo}-${revisao}-${file.originalname}`, file.mimetype);

    const existing = await prisma.projetoDocumento.findUnique({
      where: { obraId_codigo: { obraId, codigo } },
    });

    if (existing) {
      await prisma.projetoDocumentoRevisao.create({
        data: {
          documentoId: existing.id,
          revisao,
          data: hoje,
          arquivoUrl: url,
          arquivoNome: file.originalname,
          createdById,
        },
      });
      atualizados.push(codigo);
    } else {
      await prisma.projetoDocumento.create({
        data: {
          obraId,
          codigo,
          disciplina: 'Outra',
          createdById,
          revisoes: {
            create: { revisao, data: hoje, arquivoUrl: url, arquivoNome: file.originalname, createdById },
          },
        },
      });
      criados.push(codigo);
    }
  }

  return { criados, atualizados, documentos: await listByObra(obraId) };
}
