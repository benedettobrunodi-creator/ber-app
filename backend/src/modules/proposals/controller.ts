import { Request, Response } from 'express';
import * as proposalService from './service';
import { sendSuccess, sendCreated, sendPaginated, parsePagination, buildPagination } from '../../utils/response';

export async function listProposals(req: Request, res: Response) {
  const { page, limit } = parsePagination(req.query as any);
  const status = req.query.status as string | undefined;
  const { proposals, total } = await proposalService.listProposals(page, limit, status);
  sendPaginated(res, proposals, buildPagination(page, limit, total));
}

export async function getProposal(req: Request, res: Response) {
  const proposal = await proposalService.getProposalById(req.params.id);
  sendSuccess(res, proposal);
}

export async function createProposal(req: Request, res: Response) {
  const proposal = await proposalService.createProposal(req.user!.userId, req.body);
  sendCreated(res, proposal);
}

export async function updateProposal(req: Request, res: Response) {
  const proposal = await proposalService.updateProposal(req.params.id, req.body);
  sendSuccess(res, proposal);
}

export async function getStats(_req: Request, res: Response) {
  const stats = await proposalService.getStats();
  sendSuccess(res, stats);
}

export async function syncAgendor(_req: Request, res: Response) {
  const result = await proposalService.syncFromAgendor();
  sendSuccess(res, result);
}

export async function agendorStats(_req: Request, res: Response) {
  const stats = await proposalService.getAgendorStats();
  sendSuccess(res, stats);
}
