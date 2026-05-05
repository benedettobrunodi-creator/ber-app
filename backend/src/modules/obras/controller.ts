import { Request, Response } from 'express';
import * as obraService from './service';
import { prisma } from '../../config/database';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated, parsePagination, buildPagination } from '../../utils/response';
import { syncProgressoFromClickUp } from '../../services/clickup';
import { syncAllTasksFromClickUp } from '../../services/clickup-tasks-sync';

export async function listObras(req: Request, res: Response) {
  const { page, limit } = parsePagination(req.query as any);
  const status = req.query.status as string | undefined;
  const { obras, total } = await obraService.listObras(page, limit, status, req.user!.userId, req.user!.role);
  sendPaginated(res, obras, buildPagination(page, limit, total));
}

export async function getObra(req: Request, res: Response) {
  const obra = await obraService.getObraById(req.params.id);
  sendSuccess(res, obra);
}

export async function createObra(req: Request, res: Response) {
  const obra = await obraService.createObra(req.body);
  sendCreated(res, obra);
}

export async function updateObra(req: Request, res: Response) {
  const obra = await obraService.updateObra(req.params.id, req.body);
  sendSuccess(res, obra);
}

export async function getMembers(req: Request, res: Response) {
  const members = await obraService.getMembers(req.params.id);
  sendSuccess(res, members);
}

export async function addMember(req: Request, res: Response) {
  const member = await obraService.addMember(req.params.id, req.body);
  sendCreated(res, member);
}

export async function removeMember(req: Request, res: Response) {
  await obraService.removeMember(req.params.id, req.params.userId);
  sendNoContent(res);
}

export async function deleteObraPermanent(req: Request, res: Response) {
  await obraService.deleteObraPermanent(req.params.id);
  sendNoContent(res);
}

export async function archiveObra(req: Request, res: Response) {
  const obra = await obraService.archiveObra(req.params.id);
  sendSuccess(res, obra);
}

export async function syncClickUp(req: Request, res: Response) {
  const result = await syncProgressoFromClickUp();
  sendSuccess(res, result);
}

export async function syncClickUpTasks(req: Request, res: Response) {
  const result = await syncAllTasksFromClickUp();
  sendSuccess(res, result);
}

export async function getCounts(req: Request, res: Response) {
  const counts = await obraService.getCounts(req.user!.userId, req.user!.role);
  sendSuccess(res, counts);
}

export async function getStats(req: Request, res: Response) {
  const stats = await obraService.getStats(req.params.id);
  sendSuccess(res, stats);
}

export async function updateProgresso(req: Request, res: Response) {
  const { obraName, progresso } = req.body;
  if (!obraName || progresso === undefined) {
    return res.status(400).json({ error: 'obraName e progresso são obrigatórios' });
  }
  const valor = Math.min(100, Math.max(0, parseInt(progresso, 10)));
  
  const obra = await prisma.obra.findFirst({
    where: { name: { contains: obraName, mode: 'insensitive' } },
  });
  if (!obra) return res.status(404).json({ error: `Obra "${obraName}" não encontrada` });

  // Atualizar banco
  await prisma.obra.update({ where: { id: obra.id }, data: { progressPercent: valor } });

  // Atualizar Trello
  let trelloAtualizado = false;
  if (obra.trelloBoardId) {
    try {
      const { getBoardCards } = await import('../../services/trello');
      const key = process.env.TRELLO_API_KEY || '';
      const token = process.env.TRELLO_TOKEN || '';
      const cards = await getBoardCards(obra.trelloBoardId);
      const progressCard = cards.find((c: any) => c.name.toLowerCase().includes('progresso geral'));
      if (progressCard) {
        await fetch(`https://api.trello.com/1/cards/${progressCard.id}?key=${key}&token=${token}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ desc: `Progresso: ${valor}%` }),
        });
        trelloAtualizado = true;
      }
    } catch (err) {
      console.error('[updateProgresso] Erro Trello:', err);
    }
  }

  return res.json({ obra: obra.name, progresso: valor, trelloAtualizado });
}
