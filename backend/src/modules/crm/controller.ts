import { Request, Response, NextFunction } from 'express';
import * as svc from './service';
import * as intSvc from './integration.service';
import {
  createEmpresaSchema, updateEmpresaSchema,
  createContatoSchema, updateContatoSchema,
  createOportunidadeSchema, updateOportunidadeSchema,
  createAtividadeSchema, updateAtividadeSchema,
  upsertMetasAnuaisSchema,
} from './types';

// ── Empresas ──────────────────────────────────────────────────────────────────

export async function listEmpresas(req: Request, res: Response, next: NextFunction) {
  try {
    const nutricao = req.query.nutricao === 'true' ? true : req.query.nutricao === 'false' ? false : undefined;
    const data = await svc.listEmpresas({
      nutricao,
      segmento: req.query.segmento as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json(data);
  } catch (e) { next(e); }
}

export async function getEmpresa(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getEmpresaById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Empresa não encontrada' });
    res.json(data);
  } catch (e) { next(e); }
}

export async function createEmpresa(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createEmpresaSchema.parse(req.body);
    const data = await svc.createEmpresa(body);
    res.status(201).json(data);
  } catch (e) { next(e); }
}

export async function updateEmpresa(req: Request, res: Response, next: NextFunction) {
  try {
    const body = updateEmpresaSchema.parse(req.body);
    const data = await svc.updateEmpresa(req.params.id, body);
    res.json(data);
  } catch (e) { next(e); }
}

export async function deleteEmpresa(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteEmpresa(req.params.id);
    res.status(204).end();
  } catch (e) { next(e); }
}

// ── Contatos ──────────────────────────────────────────────────────────────────

export async function listContatos(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.listContatos({
      empresaId: req.query.empresaId as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json(data);
  } catch (e) { next(e); }
}

export async function createContato(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createContatoSchema.parse(req.body);
    const data = await svc.createContato(body);
    res.status(201).json(data);
  } catch (e) { next(e); }
}

export async function updateContato(req: Request, res: Response, next: NextFunction) {
  try {
    const body = updateContatoSchema.parse(req.body);
    const data = await svc.updateContato(req.params.id, body);
    res.json(data);
  } catch (e) { next(e); }
}

export async function deleteContato(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteContato(req.params.id);
    res.status(204).end();
  } catch (e) { next(e); }
}

// ── Oportunidades ─────────────────────────────────────────────────────────────

export async function listOportunidades(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.listOportunidades({
      etapa: req.query.etapa as string | undefined,
      responsavelId: req.query.responsavelId as string | undefined,
      empresaId: req.query.empresaId as string | undefined,
      origem: req.query.origem as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json(data);
  } catch (e) { next(e); }
}

export async function getOportunidade(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getOportunidadeById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Oportunidade não encontrada' });
    res.json(data);
  } catch (e) { next(e); }
}

export async function createOportunidade(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createOportunidadeSchema.parse(req.body);
    const data = await svc.createOportunidade(body, req.user!.userId, req.user!.email);
    res.status(201).json(data);
  } catch (e) { next(e); }
}

export async function updateOportunidade(req: Request, res: Response, next: NextFunction) {
  try {
    const body = updateOportunidadeSchema.parse(req.body);
    const data = await svc.updateOportunidade(req.params.id, body, req.user!.email);
    res.json(data);
  } catch (e) { next(e); }
}

export async function deleteOportunidade(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteOportunidade(req.params.id);
    res.status(204).end();
  } catch (e) { next(e); }
}

export async function reorderOportunidades(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as { ids?: unknown; etapa?: unknown };
    if (!Array.isArray(body.ids) || body.ids.some(id => typeof id !== 'string')) {
      return res.status(400).json({ error: 'ids must be a string array' });
    }
    await svc.reorderOportunidades({
      ids: body.ids as string[],
      etapa: typeof body.etapa === 'string' ? body.etapa : undefined,
    });
    res.status(204).end();
  } catch (e) { next(e); }
}

// ── Atividades ────────────────────────────────────────────────────────────────

export async function listAtividades(req: Request, res: Response, next: NextFunction) {
  try {
    const concluida = req.query.concluida === 'true' ? true : req.query.concluida === 'false' ? false : undefined;
    const data = await svc.listAtividades({
      oportunidadeId: req.query.oportunidadeId as string | undefined,
      empresaId: req.query.empresaId as string | undefined,
      usuarioId: req.query.usuarioId as string | undefined,
      concluida,
      de: req.query.de as string | undefined,
      ate: req.query.ate as string | undefined,
    });
    res.json(data);
  } catch (e) { next(e); }
}

export async function createAtividade(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createAtividadeSchema.parse(req.body);
    const data = await svc.createAtividade(body, req.user!.userId);
    res.status(201).json(data);
  } catch (e) { next(e); }
}

export async function updateAtividade(req: Request, res: Response, next: NextFunction) {
  try {
    const body = updateAtividadeSchema.parse(req.body);
    const data = await svc.updateAtividade(req.params.id, body);
    res.json(data);
  } catch (e) { next(e); }
}

export async function deleteAtividade(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteAtividade(req.params.id);
    res.status(204).end();
  } catch (e) { next(e); }
}

// ── Metas ─────────────────────────────────────────────────────────────────────

export async function getMetasAno(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getMetasAno(Number(req.params.ano));
    res.json(data);
  } catch (e) { next(e); }
}

export async function upsertMetasAnuais(req: Request, res: Response, next: NextFunction) {
  try {
    const body = upsertMetasAnuaisSchema.parse(req.body);
    const data = await svc.upsertMetasAnuais(body);
    res.json(data);
  } catch (e) { next(e); }
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getPipelineStats(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.getPipelineStats()); } catch (e) { next(e); }
}

export async function getFunilMacro(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.getFunilMacro()); } catch (e) { next(e); }
}

export async function getForecast(req: Request, res: Response, next: NextFunction) {
  try {
    const ano = Number(req.params.ano) || new Date().getFullYear();
    res.json(await svc.getForecast(ano));
  } catch (e) { next(e); }
}

export async function getVendasVsMeta(req: Request, res: Response, next: NextFunction) {
  try {
    const ano = Number(req.params.ano) || new Date().getFullYear();
    res.json(await svc.getVendasVsMeta(ano));
  } catch (e) { next(e); }
}

export async function getPipelineMesAMes(req: Request, res: Response, next: NextFunction) {
  try {
    const ano = Number(req.params.ano) || new Date().getFullYear();
    res.json(await svc.getPipelineMesAMes(ano));
  } catch (e) { next(e); }
}

export async function getTicketMedio(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.getTicketMedio({
      ano: req.query.ano ? Number(req.query.ano) : undefined,
      origem: req.query.origem as string | undefined,
    }));
  } catch (e) { next(e); }
}

export async function getWinRate(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.getWinRate({
      ano: req.query.ano ? Number(req.query.ano) : undefined,
      responsavelId: req.query.responsavelId as string | undefined,
    }));
  } catch (e) { next(e); }
}

export async function getNutricao(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.getNutricao()); } catch (e) { next(e); }
}

export async function getPipelineAtivoAcumulado(req: Request, res: Response, next: NextFunction) {
  try {
    const ano = req.query.ano ? Number(req.query.ano) : new Date().getFullYear();
    res.json(await svc.getPipelineAtivoAcumulado(ano));
  } catch (e) { next(e); }
}

export async function getFunilConversao(req: Request, res: Response, next: NextFunction) {
  try {
    const ano = req.query.ano ? Number(req.query.ano) : undefined;
    res.json(await svc.getFunilConversao(ano));
  } catch (e) { next(e); }
}

export async function getMotivosPerda(req: Request, res: Response, next: NextFunction) {
  try {
    const ano = req.query.ano ? Number(req.query.ano) : undefined;
    res.json(await svc.getMotivosPerda(ano));
  } catch (e) { next(e); }
}

export async function getPerformanceResponsavel(req: Request, res: Response, next: NextFunction) {
  try {
    const ano = req.query.ano ? Number(req.query.ano) : undefined;
    res.json(await svc.getPerformanceResponsavel(ano));
  } catch (e) { next(e); }
}

export async function getForecastHorizonte(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.getForecastHorizonte()); } catch (e) { next(e); }
}

export async function getCicloVendas(req: Request, res: Response, next: NextFunction) {
  try {
    const ano = req.query.ano ? Number(req.query.ano) : undefined;
    res.json(await svc.getCicloVendas(ano));
  } catch (e) { next(e); }
}

export async function getWinRateSegmento(req: Request, res: Response, next: NextFunction) {
  try {
    const ano = req.query.ano ? Number(req.query.ano) : undefined;
    res.json(await svc.getWinRateSegmento(ano));
  } catch (e) { next(e); }
}

export async function getPipelineAging(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.getPipelineAging()); } catch (e) { next(e); }
}

export async function getRecorrenciaClientes(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.getRecorrenciaClientes()); } catch (e) { next(e); }
}

export async function getCohort(req: Request, res: Response, next: NextFunction) {
  try {
    const ano = Number(req.query.ano) || new Date().getFullYear();
    res.json(await svc.getCohort(ano));
  } catch (e) { next(e); }
}

// ── Integração ────────────────────────────────────────────────────────────────

export async function criarOrcamentoDeOportunidade(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await intSvc.criarOrcamentoDeOportunidade(
      req.params.id,
      req.user!.userId,
      req.body,
    );
    res.status(201).json(data);
  } catch (e) { next(e); }
}

export async function vincularOrcamento(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await intSvc.vincularOrcamento(req.params.id, req.body.orcamentoId);
    res.json(data);
  } catch (e) { next(e); }
}

export async function criarObraDeOrcamento(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await intSvc.criarObraDeOrcamento(req.params.id, req.user!.userId, req.body);
    res.status(201).json(data);
  } catch (e) { next(e); }
}

export async function getContextoOrcamento(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await intSvc.getContextoOrcamento(req.params.id);
    res.json(data);
  } catch (e) { next(e); }
}

// ── Nutrição ──────────────────────────────────────────────────────────────────

export async function listNutricao(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.listNutricao()); } catch (e) { next(e); }
}

export async function getContatoHistorico(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.getContatoHistorico(req.params.id)); } catch (e) { next(e); }
}

export async function getNutricaoAgenda(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.getNutricaoAgenda()); } catch (e) { next(e); }
}

export async function contatarAgora(req: Request, res: Response, next: NextFunction) {
  try {
    const { tipo, notas } = req.body;
    const data = await svc.contatarAgora(req.params.id, req.user!.userId, tipo ?? 'outro', notas);
    res.json(data);
  } catch (e) { next(e); }
}

export async function registrarInteracao(req: Request, res: Response, next: NextFunction) {
  try {
    const { tipo, notas, resultado, proximoContato, notasRelacionamento, tags } = req.body;
    if (!tipo) return res.status(400).json({ error: 'tipo é obrigatório' });
    const data = await svc.registrarInteracao(req.params.id, req.user!.userId, {
      tipo, notas, resultado, proximoContato, notasRelacionamento, tags,
    });
    res.json(data);
  } catch (e) { next(e); }
}

// ── Campanhas ─────────────────────────────────────────────────────────────────

export async function listCampanhas(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.listCampanhas()); } catch (e) { next(e); }
}

export async function getCampanha(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.getCampanha(req.params.id)); } catch (e) { next(e); }
}

export async function createCampanha(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createCampanha(req.body)); } catch (e) { next(e); }
}

export async function updateCampanha(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.updateCampanha(req.params.id, req.body)); } catch (e) { next(e); }
}

export async function deleteCampanha(req: Request, res: Response, next: NextFunction) {
  try { await svc.deleteCampanha(req.params.id); res.status(204).end(); } catch (e) { next(e); }
}

export async function addContatosCampanha(req: Request, res: Response, next: NextFunction) {
  try {
    const ids = req.body.contatoIds ?? req.body.contatos ?? req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'contatoIds deve ser um array não-vazio de UUIDs' });
    }
    res.json(await svc.addContatosCampanha(req.params.id, ids));
  } catch (e: any) {
    if (e?.code === 'P2003') return res.status(400).json({ error: 'Um ou mais contatos não foram encontrados no sistema' });
    if (e?.code === 'P2025') return res.status(404).json({ error: 'Campanha não encontrada' });
    next(e);
  }
}

export async function updateCampanhaContato(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.updateCampanhaContato(req.params.id, req.params.contatoId, req.body);
    res.json(data);
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ error: 'Contato não encontrado na campanha' });
    next(e);
  }
}

export async function bulkUpdateCampanhaStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { contatoIds, status } = req.body;
    if (!status || typeof status !== 'string') return res.status(400).json({ error: 'status é obrigatório' });
    const contatoIdList: string[] = Array.isArray(contatoIds) && contatoIds.length > 0
      ? contatoIds
      : (await svc.getCampanha(req.params.id))?.contatos.map((cc: any) => cc.contato.id) ?? [];
    const result = await svc.bulkUpdateCampanhaStatus(req.params.id, contatoIdList, status);
    res.json(result);
  } catch (e) { next(e); }
}

export async function removeContatoCampanha(req: Request, res: Response, next: NextFunction) {
  try { await svc.removeContatoCampanha(req.params.id, req.params.contatoId); res.status(204).end(); } catch (e) { next(e); }
}
