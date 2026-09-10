import { Request, Response } from 'express';
import * as service from './service';
import * as fvsService from './fvs';
import { QUALIDADE_CHECKLIST } from './template';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';

export async function template(_req: Request, res: Response) {
  sendSuccess(res, QUALIDADE_CHECKLIST);
}

export async function painel(req: Request, res: Response) {
  sendSuccess(res, await service.getPainel(req.params.id));
}

export async function atividadesCatalogo(_req: Request, res: Response) {
  sendSuccess(res, await service.listAtividadesCatalogo());
}

export async function create(req: Request, res: Response) {
  sendCreated(res, await service.createVistoria(req.params.id, req.body, req.user!.userId));
}

export async function getOne(req: Request, res: Response) {
  sendSuccess(res, await service.getVistoria(req.params.vistoriaId));
}

export async function vistoriaPdf(req: Request, res: Response) {
  const { renderToBuffer } = await import('@react-pdf/renderer');
  const { VistoriaPdf } = await import('./vistoria-pdf');
  const React = await import('react');
  const v = await service.getVistoria(req.params.vistoriaId);
  const obra = await (await import('../../config/database')).prisma.obra.findUnique({
    where: { id: v.obraId }, select: { name: true },
  });
  const data = {
    obraNome: obra?.name ?? 'Obra',
    data: v.data,
    vistoriador: v.vistoriador?.name ?? null,
    cienciaNome: (v as { cienciaNome?: string | null }).cienciaNome ?? null,
    notaFinal: v.notaFinal,
    classificacao: v.classificacao,
    resumo: v.resumo as never,
    atividades: (v.atividades ?? []) as never,
    observacoes: v.observacoes,
    pendencias: v.itens.filter((i) => i.resposta === 'nao').map((i) => ({
      itemKey: i.itemKey, texto: i.texto, observacao: i.observacao, fotoUrl: i.fotoUrl, resolvido: i.resolvido,
    })),
  };
  const buffer = await renderToBuffer(React.createElement(VistoriaPdf, { d: data }) as never);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="vistoria-qualidade-${req.params.vistoriaId.slice(0, 8)}.pdf"`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.end(buffer);
}

export async function atribuirPendencia(req: Request, res: Response) {
  sendSuccess(res, await service.atribuirPendencia(req.params.itemId, req.body));
}

export async function ranking(_req: Request, res: Response) {
  sendSuccess(res, await service.rankingObras());
}

export async function resolverPendencia(req: Request, res: Response) {
  sendSuccess(res, await service.resolverPendencia(req.params.itemId, req.user!.userId, req.body.resolvido));
}

export async function uploadFotoTemp(req: Request, res: Response) {
  sendSuccess(res, await service.uploadFotoTemp(req.file!));
}

export async function uploadFoto(req: Request, res: Response) {
  if (!req.file) {
    res.status(400).json({ error: { message: 'Envie a foto no campo "file"' } });
    return;
  }
  sendSuccess(res, await service.uploadFotoItem(req.params.itemId, req.file));
}

export async function remove(req: Request, res: Response) {
  await service.removeVistoria(req.params.vistoriaId);
  sendNoContent(res);
}

// ─── FVS por atividade ───

export async function getFvs(req: Request, res: Response) {
  sendSuccess(res, await fvsService.getFvs(req.params.fvsId));
}

export async function responderFvs(req: Request, res: Response) {
  sendSuccess(res, await fvsService.responderFvs(req.params.fvsId, req.body, req.user!.userId));
}

export async function uploadFotoFvs(req: Request, res: Response) {
  if (!req.file) {
    res.status(400).json({ error: { message: 'Envie a foto no campo "file"' } });
    return;
  }
  sendSuccess(res, await fvsService.uploadFotoFvsItem(req.params.itemId, req.file));
}

export async function removeFvs(req: Request, res: Response) {
  await fvsService.removeFvs(req.params.fvsId);
  sendNoContent(res);
}
