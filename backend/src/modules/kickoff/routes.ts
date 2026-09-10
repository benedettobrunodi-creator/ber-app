import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { obraMemberOnly } from '../../middleware/obraMemberOnly';
import { upsertKickoffSchema, updateKickoffItemSchema } from './types';
import * as service from './service';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const obraKickoffRouter = Router({ mergeParams: true });

obraKickoffRouter.get('/', w(async (req: Request, res: Response) => {
  const data = await service.getByObra(req.params.obraId);
  res.json({ data });
}));

// PDF do kickoff
obraKickoffRouter.get('/pdf', w(async (req: Request, res: Response) => {
  const { downloadKickoffPdf } = await import('./pdf.controller');
  return downloadKickoffPdf(req, res);
}));

obraKickoffRouter.put('/', obraMemberOnly, validate(upsertKickoffSchema), w(async (req: Request, res: Response) => {
  const data = await service.upsert(req.params.obraId, req.body);
  res.json({ data });
}));

// Atualiza um item do checklist (responsável, na rede, data alvo, status, obs)
obraKickoffRouter.patch('/itens/:itemId', obraMemberOnly, validate(updateKickoffItemSchema), w(async (req: Request, res: Response) => {
  const data = await service.updateItem(req.params.itemId, req.body);
  res.json({ data });
}));

// ─── Kickoff EXTERNO (reunião com o cliente — Bruno 10/09/26) ─────────────
obraKickoffRouter.get('/externo', w(async (req: Request, res: Response) => {
  const { getExterno } = await import('./externo.service');
  res.json({ data: await getExterno(req.params.obraId) });
}));

obraKickoffRouter.put('/externo', obraMemberOnly, w(async (req: Request, res: Response) => {
  const { upsertExterno } = await import('./externo.service');
  res.json({ data: await upsertExterno(req.params.obraId, req.body?.conteudo) });
}));

obraKickoffRouter.get('/externo/pdf', w(async (req: Request, res: Response) => {
  const [{ getExterno }, { KickoffExternoPDF }, React, { renderToBuffer }] = await Promise.all([
    import('./externo.service'), import('./externo-pdf'), import('react'), import('@react-pdf/renderer'),
  ]);
  const { obra, conteudo } = await getExterno(req.params.obraId);
  const buffer = await renderToBuffer(
    React.createElement(KickoffExternoPDF, { obra: { name: obra.name, address: obra.address }, c: conteudo, geradoEm: new Date() }) as never,
  );
  const slug = (conteudo.nomeCliente || obra.name || 'obra').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="kickoff-externo-${slug}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
}));

obraKickoffRouter.get('/externo/pptx', w(async (req: Request, res: Response) => {
  const [{ getExterno }, { gerarKickoffExternoPptx }] = await Promise.all([
    import('./externo.service'), import('./externo-pptx'),
  ]);
  const { obra, conteudo } = await getExterno(req.params.obraId);
  const buffer = await gerarKickoffExternoPptx({ name: obra.name, address: obra.address }, conteudo);
  const slug = (conteudo.nomeCliente || obra.name || 'obra').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  res.setHeader('Content-Disposition', `attachment; filename="kickoff-externo-${slug}.pptx"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
}));
