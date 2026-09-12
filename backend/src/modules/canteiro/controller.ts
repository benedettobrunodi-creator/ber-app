import { Request, Response } from 'express';
import * as canteiroService from './service';
import { sendSuccess, sendCreated } from '../../utils/response';

export async function getTemplate(_req: Request, res: Response) {
  const template = await canteiroService.getActiveTemplate();
  sendSuccess(res, template);
}

export async function listByObra(req: Request, res: Response) {
  const checklists = await canteiroService.listByObra(req.params.id);
  sendSuccess(res, checklists);
}

export async function createForCurrentWeek(req: Request, res: Response) {
  const checklist = await canteiroService.createForCurrentWeek(req.params.id, req.user!.userId);
  sendCreated(res, checklist);
}

export async function getById(req: Request, res: Response) {
  const checklist = await canteiroService.getById(req.params.id);
  sendSuccess(res, checklist);
}

export async function answerItem(req: Request, res: Response) {
  const item = await canteiroService.answerItem(req.params.id, req.params.itemId, req.user!.userId, req.body);
  sendSuccess(res, item);
}

export async function submitChecklist(req: Request, res: Response) {
  sendSuccess(res, await canteiroService.submitChecklist(req.params.id));
}

export async function approveChecklist(req: Request, res: Response) {
  const checklist = await canteiroService.approveChecklist(req.params.id, req.user!.userId, req.body);
  sendSuccess(res, checklist);
}


/** Resumo agregado pra lista do canteiro (anti-N+1, auditoria 11/09). */
export async function resumoObras(req: Request, res: Response) {
  const { prisma } = await import('../../config/database');
  const weekStart = String(req.query.weekStart ?? '');
  const obras = await prisma.obra.findMany({
    where: { status: 'em_andamento' },
    select: { id: true, name: true, client: true, status: true },
    orderBy: { name: 'asc' },
  });
  const filtroSemana = /^\d{4}-\d{2}-\d{2}$/.test(weekStart)
    ? { weekStart: new Date(`${weekStart}T00:00:00Z`) }
    : {};
  const checklists = await prisma.canteiroChecklist.findMany({
    where: { obraId: { in: obras.map((o) => o.id) }, ...filtroSemana },
    include: {
      items: { select: { answer: true, required: true } },
      creator: { select: { id: true, name: true } },
      approver: { select: { id: true, name: true } },
    },
    orderBy: { weekStart: 'desc' },
  });
  const porObra = new Map<string, (typeof checklists)[number]>();
  for (const c of checklists) if (!porObra.has(c.obraId)) porObra.set(c.obraId, c);
  sendSuccess(res, obras.map((o) => ({ obra: o, checklist: porObra.get(o.id) ?? null })));
}
