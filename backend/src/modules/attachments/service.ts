import { prisma } from '../../config/database';
import { uploadToR2, deleteFromR2, isR2Configured } from '../../services/storage';
import fs from 'fs';
import path from 'path';
import { AppError } from '../../utils/errors';

export const ALLOWED_ENTITY_TYPES = [
  'aditivo',
  'ata',
  'contratacao',
  'ordem_compra',
  'documento',
  'kickoff',
  'pendencia',
  'stakeholder',
] as const;
export type EntityType = (typeof ALLOWED_ENTITY_TYPES)[number];

interface MulterFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
  filename?: string;
}

function assertEntityType(t: string): asserts t is EntityType {
  if (!(ALLOWED_ENTITY_TYPES as readonly string[]).includes(t)) {
    throw AppError.badRequest(`entityType inválido: ${t}`);
  }
}

async function persistFile(file: MulterFile): Promise<string> {
  if (isR2Configured()) {
    if (!file.buffer) throw AppError.internal('Arquivo sem buffer em modo R2');
    return uploadToR2(file.buffer, file.originalname, file.mimetype);
  }
  if (!file.filename) throw AppError.internal('Arquivo sem filename em modo disk');
  return `/uploads/${file.filename}`;
}

async function removeFile(fileUrl: string) {
  if (fileUrl.startsWith('/uploads/')) {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const filePath = path.join(uploadDir, path.basename(fileUrl));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return;
  }
  await deleteFromR2(fileUrl);
}

export async function createAttachment(args: {
  entityType: string;
  entityId: string;
  file: MulterFile;
  uploadedById?: string;
}) {
  assertEntityType(args.entityType);
  const fileUrl = await persistFile(args.file);
  return prisma.attachment.create({
    data: {
      entityType: args.entityType,
      entityId: args.entityId,
      fileName: args.file.originalname,
      fileUrl,
      mimeType: args.file.mimetype,
      sizeBytes: args.file.size,
      uploadedById: args.uploadedById,
    },
  });
}

export async function listAttachments(entityType: string, entityId: string) {
  assertEntityType(entityType);
  return prisma.attachment.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deleteAttachment(id: string) {
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) throw AppError.notFound('Anexo');
  await removeFile(att.fileUrl).catch(err => {
    console.error('[attachments] falha ao remover arquivo físico:', err);
  });
  await prisma.attachment.delete({ where: { id } });
}
