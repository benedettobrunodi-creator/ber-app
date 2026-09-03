import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import { uploadToR2, deleteFromR2, isR2Configured } from '../../services/storage';
import { parseQuantitativoPDFs, QuantitativoParseResult } from '../../services/quantitativo-parser';
import { CreateItemInput, UpdateItemInput, UpdateQuantitativoInput } from './types';

const ENTITY_TYPE = 'quantitativo';

export async function createQuantitativo(orcamentoId: string, userId: string | undefined, observacoes?: string) {
  const orc = await prisma.orcamento.findUnique({ where: { id: orcamentoId } });
  if (!orc) throw AppError.notFound('Orçamento não encontrado');
  return prisma.quantitativo.create({
    data: { orcamentoId, createdById: userId ?? null, observacoes: observacoes ?? null },
  });
}

export async function listByOrcamento(orcamentoId: string) {
  return prisma.quantitativo.findMany({
    where: { orcamentoId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, status: true, observacoes: true, errorMsg: true,
      createdAt: true, updatedAt: true, processadoEm: true,
      _count: { select: { itens: true } },
    },
  });
}

export async function getQuantitativo(id: string) {
  const q = await prisma.quantitativo.findUnique({
    where: { id },
    include: {
      itens: { orderBy: [{ etapa: 'asc' }, { createdAt: 'asc' }] },
    },
  });
  if (!q) throw AppError.notFound('Quantitativo não encontrado');
  // Anexa PDFs (attachments com entityType='quantitativo')
  const pdfs = await prisma.attachment.findMany({
    where: { entityType: ENTITY_TYPE, entityId: id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, fileName: true, fileUrl: true, mimeType: true, sizeBytes: true, createdAt: true },
  });
  return { ...q, pdfs };
}

export async function updateQuantitativo(id: string, input: UpdateQuantitativoInput) {
  await getQuantitativo(id); // 404 se não existe
  return prisma.quantitativo.update({
    where: { id },
    data: {
      ...(input.observacoes !== undefined && { observacoes: input.observacoes || null }),
      ...(input.status !== undefined && { status: input.status }),
    },
  });
}

export async function deleteQuantitativo(id: string) {
  await getQuantitativo(id);
  // Limpa attachments (PDFs) do R2
  const pdfs = await prisma.attachment.findMany({
    where: { entityType: ENTITY_TYPE, entityId: id },
    select: { id: true, fileUrl: true },
  });
  for (const p of pdfs) {
    try { await deleteFromR2(p.fileUrl); } catch { /* silent */ }
  }
  await prisma.attachment.deleteMany({ where: { entityType: ENTITY_TYPE, entityId: id } });
  await prisma.quantitativo.delete({ where: { id } });
}

export async function attachPdf(
  quantitativoId: string,
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  userId: string | undefined,
) {
  await getQuantitativo(quantitativoId);
  if (!isR2Configured()) throw AppError.badRequest('R2 não configurado — impossível anexar PDF');
  if (mimeType !== 'application/pdf') throw AppError.badRequest('Envie apenas arquivos PDF');
  const fileUrl = await uploadToR2(buffer, fileName, mimeType);
  return prisma.attachment.create({
    data: {
      entityType: ENTITY_TYPE, entityId: quantitativoId,
      fileName, fileUrl, mimeType, sizeBytes: buffer.length,
      uploadedById: userId ?? null,
    },
    select: { id: true, fileName: true, fileUrl: true, mimeType: true, sizeBytes: true, createdAt: true },
  });
}

export async function removePdf(quantitativoId: string, attachmentId: string) {
  const att = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!att || att.entityId !== quantitativoId || att.entityType !== ENTITY_TYPE) {
    throw AppError.notFound('PDF não encontrado neste quantitativo');
  }
  try { await deleteFromR2(att.fileUrl); } catch { /* silent */ }
  await prisma.attachment.delete({ where: { id: attachmentId } });
}

/**
 * Dispara o processamento IA. Baixa os PDFs anexados, envia ao Gemini,
 * salva os itens no banco. É síncrono (o front mostra loading).
 * Se o processamento for mais lento no futuro, migrar pra fila.
 */
export async function processarQuantitativo(id: string): Promise<QuantitativoParseResult> {
  const q = await getQuantitativo(id);
  if (q.pdfs.length === 0) throw AppError.badRequest('Nenhum PDF anexado — anexe pelo menos 1 PDF antes de processar');

  // marca como processando
  await prisma.quantitativo.update({ where: { id }, data: { status: 'processando', errorMsg: null } });

  try {
    // Baixa PDFs do R2 (via fetch)
    const buffers: Array<{ buffer: Buffer; fileName: string }> = [];
    for (const p of q.pdfs) {
      const res = await fetch(p.fileUrl);
      if (!res.ok) throw new Error(`Falha ao baixar ${p.fileName}: ${res.status}`);
      const arr = new Uint8Array(await res.arrayBuffer());
      buffers.push({ buffer: Buffer.from(arr), fileName: p.fileName });
    }

    const result = await parseQuantitativoPDFs(buffers);

    // Zera itens anteriores (reprocessamento = novo levantamento)
    await prisma.quantitativoItem.deleteMany({ where: { quantitativoId: id } });
    if (result.itens.length > 0) {
      await prisma.quantitativoItem.createMany({
        data: result.itens.map(it => ({
          quantitativoId: id,
          etapa: it.etapa,
          descricao: it.descricao,
          unidade: it.unidade,
          quantidade: it.quantidade,
          origem: it.origem ?? null,
          confianca: it.confianca ?? null,
        })),
      });
    }

    await prisma.quantitativo.update({
      where: { id },
      data: {
        status: 'concluido',
        errorMsg: null,
        resultadoJson: result as unknown as object,
        processadoEm: new Date(),
      },
    });

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.quantitativo.update({
      where: { id },
      data: { status: 'erro', errorMsg: msg.slice(0, 2000) },
    });
    throw err;
  }
}

export async function createItem(quantitativoId: string, input: CreateItemInput) {
  await getQuantitativo(quantitativoId);
  return prisma.quantitativoItem.create({
    data: {
      quantitativoId,
      etapa: input.etapa,
      descricao: input.descricao,
      unidade: input.unidade,
      quantidade: input.quantidade,
      origem: input.origem ?? null,
      confianca: input.confianca ?? null,
    },
  });
}

export async function updateItem(quantitativoId: string, itemId: string, userId: string | undefined, input: UpdateItemInput) {
  const item = await prisma.quantitativoItem.findUnique({ where: { id: itemId } });
  if (!item || item.quantitativoId !== quantitativoId) throw AppError.notFound('Item não encontrado');
  const revisadoPatch = input.marcarRevisado
    ? { revisadoPorId: userId ?? null, revisadoEm: new Date() }
    : input.marcarRevisado === false
      ? { revisadoPorId: null, revisadoEm: null }
      : {};
  return prisma.quantitativoItem.update({
    where: { id: itemId },
    data: {
      ...(input.etapa !== undefined && { etapa: input.etapa }),
      ...(input.descricao !== undefined && { descricao: input.descricao }),
      ...(input.unidade !== undefined && { unidade: input.unidade }),
      ...(input.quantidade !== undefined && { quantidade: input.quantidade }),
      ...(input.origem !== undefined && { origem: input.origem }),
      ...(input.confianca !== undefined && { confianca: input.confianca }),
      ...revisadoPatch,
    },
  });
}

export async function deleteItem(quantitativoId: string, itemId: string) {
  const item = await prisma.quantitativoItem.findUnique({ where: { id: itemId } });
  if (!item || item.quantitativoId !== quantitativoId) throw AppError.notFound('Item não encontrado');
  await prisma.quantitativoItem.delete({ where: { id: itemId } });
}
