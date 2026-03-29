import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { sendSuccess, sendCreated } from '../../utils/response';
import { AppError } from '../../utils/errors';

const INCLUDE = {
  creator: { select: { id: true, name: true } },
  items: {
    orderBy: { createdAt: 'asc' as const },
    include: { responsible: { select: { id: true, name: true } } },
  },
};

export async function listByObra(req: Request, res: Response) {
  const lists = await prisma.punchList.findMany({
    where: { obraId: req.params.id },
    include: INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  sendSuccess(res, lists);
}

export async function getOne(req: Request, res: Response) {
  const pl = await prisma.punchList.findUnique({ where: { id: req.params.id }, include: INCLUDE });
  if (!pl) throw new AppError(404, 'NOT_FOUND', 'Punch list não encontrado');
  sendSuccess(res, pl);
}

export async function create(req: Request, res: Response) {
  const { type } = req.body;
  if (!['interno', 'cliente'].includes(type))
    throw new AppError(400, 'VALIDATION', 'type deve ser interno ou cliente');

  const pl = await prisma.punchList.create({
    data: { obraId: req.params.id, type, createdBy: req.user!.userId },
    include: INCLUDE,
  });
  sendCreated(res, pl);
}

export async function updateStatus(req: Request, res: Response) {
  const { status } = req.body;
  if (!['pendente', 'em_andamento', 'concluido'].includes(status))
    throw new AppError(400, 'VALIDATION', 'status inválido');
  const pl = await prisma.punchList.update({
    where: { id: req.params.id }, data: { status }, include: INCLUDE,
  });
  sendSuccess(res, pl);
}

export async function addItem(req: Request, res: Response) {
  const { descricao, responsibleId } = req.body;
  if (!descricao?.trim()) throw new AppError(400, 'VALIDATION', 'descricao obrigatória');
  const item = await prisma.punchListItem.create({
    data: { punchListId: req.params.id, descricao: descricao.trim(), responsibleId: responsibleId || undefined },
    include: { responsible: { select: { id: true, name: true } } },
  });
  // auto-set punch list to em_andamento
  await prisma.punchList.update({ where: { id: req.params.id }, data: { status: 'em_andamento' } });
  sendCreated(res, item);
}

export async function updateItem(req: Request, res: Response) {
  const { status, descricao } = req.body;
  const data: Record<string, any> = {};
  if (descricao) data.descricao = descricao;
  if (status) {
    if (!['aberto', 'resolvido'].includes(status))
      throw new AppError(400, 'VALIDATION', 'status inválido');
    data.status = status;
    data.resolvedAt = status === 'resolvido' ? new Date() : null;
  }
  const item = await prisma.punchListItem.update({
    where: { id: req.params.itemId },
    data,
    include: { responsible: { select: { id: true, name: true } } },
  });

  // check if all items resolved → auto-complete punch list
  const pl = await prisma.punchList.findUnique({
    where: { id: item.punchListId },
    include: { items: { select: { status: true } } },
  });
  if (pl && pl.items.length > 0 && pl.items.every(i => i.status === 'resolvido')) {
    await prisma.punchList.update({ where: { id: pl.id }, data: { status: 'concluido' } });
  }

  sendSuccess(res, item);
}
