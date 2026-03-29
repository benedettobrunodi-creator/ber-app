import { Request, Response } from 'express';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { prisma } from '../../config/database';
import { sendSuccess, sendCreated } from '../../utils/response';
import { AppError } from '../../utils/errors';

function convertPdfToImage(pdfPath: string): string {
  const dir = path.dirname(pdfPath);
  const base = path.basename(pdfPath, '.pdf');
  const outPath = path.join(dir, `${base}.png`);
  try {
    execSync(`magick -density 150 "${pdfPath}[0]" -quality 90 -background white -alpha remove "${outPath}"`, { timeout: 30000 });
    if (fs.existsSync(outPath)) {
      fs.unlinkSync(pdfPath); // remover PDF original
      return outPath;
    }
  } catch (e) {
    console.error('PDF conversion failed:', e);
  }
  return pdfPath; // fallback: retorna o PDF se conversão falhar
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

// POST /v1/obras/:id/plantas  { fileUrl }
export async function createPlanta(req: Request, res: Response) {
  // Aceita fileUrl no body OU arquivo multipart (req.file)
  let fileUrl = req.body?.fileUrl;
  if (!fileUrl && (req as any).file) {
    let filePath = (req as any).file.path || path.join(process.env.UPLOAD_DIR || './uploads', (req as any).file.filename);
    // Converter PDF para imagem automaticamente
    if ((req as any).file.mimetype === 'application/pdf' || (req as any).file.originalname?.endsWith('.pdf')) {
      const converted = convertPdfToImage(filePath);
      fileUrl = `/uploads/${path.basename(converted)}`;
    } else {
      fileUrl = `/uploads/${(req as any).file.filename}`;
    }
  }
  if (!fileUrl) throw AppError.badRequest('fileUrl ou arquivo obrigatório');
  const planta = await prisma.obraPlanta.create({
    data: { obraId: req.params.id, fileUrl },
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
    fileUrl = `/uploads/${(req as any).file.filename}`;
  }
  if (!fileUrl) throw AppError.badRequest('fileUrl obrigatório');

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
