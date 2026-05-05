import { Request, Response } from 'express';
import path from 'path';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { sendSuccess, sendCreated } from '../../utils/response';
import { AppError } from '../../utils/errors';
import { uploadToR2, isR2Configured } from '../../services/storage';

/** Ensures a file URL is absolute */
function toFullUrl(urlOrPath: string): string {
  if (urlOrPath.startsWith('http')) return urlOrPath;
  return `${env.backendUrl}${urlOrPath}`;
}

/** Upload a multer file to R2 (memory buffer) or return disk path */
async function uploadFile(file: Express.Multer.File): Promise<string> {
  if (isR2Configured() && file.buffer) {
    return uploadToR2(file.buffer, file.originalname, file.mimetype);
  }
  // Fallback: disk storage
  return toFullUrl(`/uploads/${file.filename}`);
}

const AUTOR_SELECT = { id: true, name: true, avatarUrl: true } as const;

// ─── Plantas ─────────────────────────────────────────────────────────────────

// GET /v1/obras/:id/plantas
export async function listPlantas(req: Request, res: Response) {
  const plantas = await prisma.obraPlanta.findMany({
    where: { obraId: req.params.id },
    include: { ambientes: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  sendSuccess(res, plantas);
}

// POST /v1/obras/:id/plantas  multipart file (PDF/imagem) ou { fileUrl }
export async function createPlanta(req: Request, res: Response) {
  const obraId = req.params.id;
  const file = (req as any).file as Express.Multer.File | undefined;
  const bodyName = (req.body?.name as string | undefined)?.trim();

  let fileUrl: string | undefined;
  let pages: any[] | undefined;
  let sourceType: 'pdf' | 'image' = 'image';

  if (file) {
    const isPdf = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname);
    sourceType = isPdf ? 'pdf' : 'image';

    if (!file.buffer) throw AppError.badRequest('Upload requer R2 configurado');

    if (isPdf) {
      const { convertPdfToPages } = await import('../../services/pdf-converter');
      const converted = await convertPdfToPages(file.buffer, file.originalname);
      pages = converted;
      fileUrl = converted[0]?.imageUrl;
    } else {
      const url = await uploadFile(file);
      fileUrl = url;
      pages = [{ pageIndex: 0, imageUrl: url, width: 0, height: 0 }];
    }
  } else if (req.body?.fileUrl) {
    fileUrl = toFullUrl(req.body.fileUrl);
    pages = [{ pageIndex: 0, imageUrl: fileUrl, width: 0, height: 0 }];
  } else {
    throw AppError.badRequest('Arquivo (file) ou fileUrl obrigatorio');
  }

  const planta = await prisma.obraPlanta.create({
    data: {
      obraId,
      fileUrl: fileUrl!,
      pages: pages as any,
      name: bodyName || null,
      sourceType,
    },
    include: { ambientes: true },
  });
  sendCreated(res, planta);
}

// DELETE /v1/obras/:id/plantas/:plantaId
export async function deletePlanta(req: Request, res: Response) {
  await prisma.obraPlanta.delete({ where: { id: req.params.plantaId } });
  sendSuccess(res, { deleted: true });
}

// ─── Ambientes ────────────────────────────────────────────────────────────────

const AMBIENTE_INCLUDE = {
  planta: true,
  fotos: {
    orderBy: { tiradaEm: 'desc' as const },
    take: 1,
    select: { tiradaEm: true, createdAt: true },
  },
  _count: { select: { fotos: true } },
} as const;

// GET /v1/obras/:id/ambientes
export async function listAmbientes(req: Request, res: Response) {
  const ambientes = await prisma.obraAmbiente.findMany({
    where: { obraId: req.params.id },
    include: AMBIENTE_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });
  sendSuccess(res, ambientes);
}

// POST /v1/obras/:id/ambientes  { nome, posX, posY, cor?, plantaId? }
export async function createAmbiente(req: Request, res: Response) {
  const { nome, posX, posY, cor, plantaId } = req.body;
  if (!nome?.trim()) throw AppError.badRequest('nome obrigatório');
  const ambiente = await prisma.obraAmbiente.create({
    data: {
      obraId: req.params.id,
      nome: nome.trim(),
      posX: posX ?? 50,
      posY: posY ?? 50,
      cor: cor ?? '#6B7280',
      ...(plantaId && { plantaId }),
    },
    include: AMBIENTE_INCLUDE,
  });
  sendCreated(res, ambiente);
}

// PATCH /v1/obras/:id/ambientes/:ambienteId  { nome?, posX?, posY?, cor? }
export async function updateAmbiente(req: Request, res: Response) {
  const { nome, posX, posY, cor } = req.body;
  const ambiente = await prisma.obraAmbiente.update({
    where: { id: req.params.ambienteId },
    data: {
      ...(nome !== undefined && { nome }),
      ...(posX !== undefined && { posX }),
      ...(posY !== undefined && { posY }),
      ...(cor !== undefined && { cor }),
    },
    include: AMBIENTE_INCLUDE,
  });
  sendSuccess(res, ambiente);
}

// DELETE /v1/obras/:id/ambientes/:ambienteId
export async function deleteAmbiente(req: Request, res: Response) {
  await prisma.obraAmbiente.delete({ where: { id: req.params.ambienteId } });
  sendSuccess(res, { deleted: true });
}

// ─── Fotos ────────────────────────────────────────────────────────────────────

const FOTO_INCLUDE = {
  ambiente: true,
  autor: { select: AUTOR_SELECT },
} as const;

// GET /v1/obras/:id/fotos?ambienteId=&categoria=&from=&to=
export async function listFotos(req: Request, res: Response) {
  const { ambienteId, categoria, from, to } = req.query as Record<string, string>;
  const fotos = await prisma.obraFoto.findMany({
    where: {
      obraId: req.params.id,
      ...(ambienteId && { ambienteId }),
      ...(categoria && { categoria }),
      ...(from || to ? {
        tiradaEm: {
          ...(from && { gte: new Date(from) }),
          ...(to   && { lte: new Date(to) }),
        },
      } : {}),
    },
    include: FOTO_INCLUDE,
    orderBy: { tiradaEm: 'desc' },
  });
  sendSuccess(res, fotos);
}

// POST /v1/obras/:id/fotos  { fileUrl, ambienteId?, categoria?, legenda?, tiradaEm? }
export async function createFoto(req: Request, res: Response) {
  let { fileUrl, ambienteId, categoria, legenda, tiradaEm } = req.body;
  const userId = (req as any).user?.id;
  if (!fileUrl && (req as any).file) {
    fileUrl = await uploadFile((req as any).file);
  }
  if (!fileUrl) throw AppError.badRequest('fileUrl obrigatório');
  fileUrl = toFullUrl(fileUrl);

  const foto = await prisma.obraFoto.create({
    data: {
      obraId: req.params.id,
      fileUrl,
      ...(ambienteId && { ambienteId }),
      categoria: categoria ?? 'geral',
      ...(legenda && { legenda }),
      tiradaPor: userId,
      tiradaEm: tiradaEm ? new Date(tiradaEm) : new Date(),
    },
    include: FOTO_INCLUDE,
  });
  sendCreated(res, foto);
}

// POST /v1/obras/:id/fotos/batch  [{ fileUrl, ambienteId?, categoria?, legenda?, tiradaEm? }]
export async function createFotosBatch(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const items: any[] = req.body?.fotos ?? [];
  if (!items.length) throw AppError.badRequest('fotos[] obrigatório');

  const created = await Promise.all(items.map(item =>
    prisma.obraFoto.create({
      data: {
        obraId: req.params.id,
        fileUrl: item.fileUrl,
        ...(item.ambienteId && { ambienteId: item.ambienteId }),
        categoria: item.categoria ?? 'geral',
        ...(item.legenda && { legenda: item.legenda }),
        tiradaPor: userId,
        tiradaEm: item.tiradaEm ? new Date(item.tiradaEm) : new Date(),
      },
      include: FOTO_INCLUDE,
    })
  ));
  sendCreated(res, created);
}

// DELETE /v1/obras/:id/fotos/:fotoId
export async function deleteFoto(req: Request, res: Response) {
  await prisma.obraFoto.delete({ where: { id: req.params.fotoId } });
  sendSuccess(res, { deleted: true });
}

// GET /v1/obras/:id/fotos/referencia?ambienteId=&categoria=
// Returns last foto for ambiente+categoria combo (reference photo)
export async function getFotoReferencia(req: Request, res: Response) {
  const { ambienteId, categoria } = req.query as Record<string, string>;
  if (!ambienteId || !categoria) throw AppError.badRequest('ambienteId e categoria obrigatórios');
  const foto = await prisma.obraFoto.findFirst({
    where: { obraId: req.params.id, ambienteId, categoria },
    include: FOTO_INCLUDE,
    orderBy: { tiradaEm: 'desc' },
  });
  sendSuccess(res, foto ?? null);
}
