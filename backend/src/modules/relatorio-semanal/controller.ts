import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { uploadToR2, isR2Configured } from '../../services/storage';
import path from 'path';
import fs from 'fs';
import { env } from '../../config/env';

const include = {
  responsavel: { select: { id: true, name: true, email: true } },
  pendencias: { orderBy: { ordem: 'asc' as const } },
  marcos: { orderBy: { data: 'asc' as const } },
  fotos: {
    orderBy: { ordem: 'asc' as const },
    include: { angulo: { select: { id: true, nome: true } } },
  },
};

const err500 = (res: Response, e: any) => {
  const full: string = e?.message ?? String(e);
  console.error('[relatorio-semanal] ERROR:', full);
  // Prisma validation errors embed the full data dump; extract just the description at the end
  const parts = full.split(/\n}\n|\n\}\n/);
  const short = parts[parts.length - 1]?.trim() || full;
  return res.status(500).json({ error: { message: short || full } });
};

export async function listRelatorios(req: Request, res: Response) {
  try {
    const { id: obraId } = req.params;
    const relatorios = await prisma.relatorioSemanal.findMany({
      where: { obraId },
      include,
      orderBy: { numero: 'desc' },
    });
    return res.json({ data: relatorios });
  } catch (e: any) { return err500(res, e); }
}

export async function getRelatorio(req: Request, res: Response) {
  try {
    const { id: obraId, relatorioId } = req.params;
    const relatorio = await prisma.relatorioSemanal.findFirst({
      where: { id: relatorioId, obraId },
      include,
    });
    if (!relatorio) return res.status(404).json({ error: { message: 'Relatório não encontrado' } });
    return res.json({ data: relatorio });
  } catch (e: any) { return err500(res, e); }
}

export async function createRelatorio(req: Request, res: Response) {
  try {
    const { id: obraId } = req.params;
    const {
      periodoInicio, periodoFim, status, avancoPct, avancoDelta,
      diasTrabalhados, diasUteis, diasImprodutivos, motivoImprodutivo,
      efetivoMedio, efetivoPorDisciplina, atividadesSemana, destaques, proximosSete,
      responsavelId, responsavelNome, dataContrato,
      pendencias = [], marcos = [],
    } = req.body;

    const last = await prisma.relatorioSemanal.findFirst({
      where: { obraId },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    const numero = (last?.numero ?? 0) + 1;

    const relatorio = await prisma.relatorioSemanal.create({
      data: {
        obraId, numero,
        periodoInicio: new Date(periodoInicio),
        periodoFim: new Date(periodoFim),
        status: status ?? 'no_prazo',
        avancoPct: avancoPct ?? 0,
        avancoDelta: avancoDelta ?? null,
        diasTrabalhados: diasTrabalhados ?? null,
        diasUteis: diasUteis ?? null,
        diasImprodutivos: diasImprodutivos ?? null,
        motivoImprodutivo: motivoImprodutivo ?? null,
        efetivoMedio: efetivoMedio ?? null,
        efetivoPorDisciplina: efetivoPorDisciplina ?? null,
        atividadesSemana: atividadesSemana ?? null,
        destaques: destaques ?? null,
        proximosSete: proximosSete ?? null,
        responsavelId: responsavelId ?? null,
        responsavelNome: responsavelNome ?? null,
        dataContrato: dataContrato ? new Date(dataContrato) : null,
        pendencias: { create: pendencias.map((p: any, i: number) => ({ ...p, prazo: p.prazo || null, ordem: i })) },
        marcos: { create: marcos.filter((m: any) => m.data) },
      },
      include,
    });

    return res.status(201).json({ data: relatorio });
  } catch (e: any) { return err500(res, e); }
}

export async function updateRelatorio(req: Request, res: Response) {
  try {
    const { id: obraId, relatorioId } = req.params;
    const existing = await prisma.relatorioSemanal.findFirst({ where: { id: relatorioId, obraId } });
    if (!existing) return res.status(404).json({ error: { message: 'Relatório não encontrado' } });

    const {
      periodoInicio, periodoFim, status, avancoPct, avancoDelta,
      diasTrabalhados, diasUteis, diasImprodutivos, motivoImprodutivo,
      efetivoMedio, efetivoPorDisciplina, atividadesSemana, destaques, proximosSete,
      responsavelId, responsavelNome, dataContrato,
      pendencias, marcos,
    } = req.body;

    const data: any = {};
    if (periodoInicio !== undefined) data.periodoInicio = new Date(periodoInicio);
    if (periodoFim !== undefined) data.periodoFim = new Date(periodoFim);
    if (status !== undefined) data.status = status;
    if (avancoPct !== undefined) data.avancoPct = avancoPct;
    if (avancoDelta !== undefined) data.avancoDelta = avancoDelta;
    if (diasTrabalhados !== undefined) data.diasTrabalhados = diasTrabalhados;
    if (diasUteis !== undefined) data.diasUteis = diasUteis;
    if (diasImprodutivos !== undefined) data.diasImprodutivos = diasImprodutivos;
    if (motivoImprodutivo !== undefined) data.motivoImprodutivo = motivoImprodutivo;
    if (efetivoMedio !== undefined) data.efetivoMedio = efetivoMedio;
    if (efetivoPorDisciplina !== undefined) data.efetivoPorDisciplina = efetivoPorDisciplina;
    if (atividadesSemana !== undefined) data.atividadesSemana = atividadesSemana;
    if (destaques !== undefined) data.destaques = destaques;
    if (proximosSete !== undefined) data.proximosSete = proximosSete;
    if (responsavelId !== undefined) data.responsavelId = responsavelId;
    if (responsavelNome !== undefined) data.responsavelNome = responsavelNome;
    if (dataContrato !== undefined) data.dataContrato = dataContrato ? new Date(dataContrato) : null;

    if (pendencias !== undefined) {
      await prisma.relatorioPendencia.deleteMany({ where: { relatorioId } });
      data.pendencias = { create: pendencias.map((p: any, i: number) => ({ ...p, prazo: p.prazo || null, ordem: i })) };
    }
    if (marcos !== undefined) {
      await prisma.relatorioMarco.deleteMany({ where: { relatorioId } });
      data.marcos = { create: marcos.filter((m: any) => m.data) };
    }

    const relatorio = await prisma.relatorioSemanal.update({
      where: { id: relatorioId },
      data,
      include,
    });

    return res.json({ data: relatorio });
  } catch (e: any) { return err500(res, e); }
}

export async function deleteRelatorio(req: Request, res: Response) {
  try {
    const { id: obraId, relatorioId } = req.params;
    const existing = await prisma.relatorioSemanal.findFirst({ where: { id: relatorioId, obraId } });
    if (!existing) return res.status(404).json({ error: { message: 'Relatório não encontrado' } });
    await prisma.relatorioSemanal.delete({ where: { id: relatorioId } });
    return res.json({ data: { ok: true } });
  } catch (e: any) { return err500(res, e); }
}

export async function uploadFoto(req: Request, res: Response) {
  try {
    const { id: obraId, relatorioId } = req.params;
    const existing = await prisma.relatorioSemanal.findFirst({ where: { id: relatorioId, obraId } });
    if (!existing) return res.status(404).json({ error: { message: 'Relatório não encontrado' } });
    if (!req.file) return res.status(400).json({ error: { message: 'Arquivo obrigatório' } });

    let url: string;
    if (isR2Configured()) {
      url = await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype);
    } else {
      const dir = path.resolve(env.uploadDir);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const fname = `${Date.now()}-${req.file.originalname}`;
      fs.writeFileSync(path.join(dir, fname), req.file.buffer);
      url = `/uploads/${fname}`;
    }

    const count = await prisma.relatorioFoto.count({ where: { relatorioId } });
    const anguloId = req.body.anguloId ?? null;
    const foto = await prisma.relatorioFoto.create({
      data: { relatorioId, url, legenda: req.body.legenda ?? null, ordem: count, anguloId },
      include: { angulo: { select: { id: true, nome: true } } },
    });
    return res.status(201).json({ data: foto });
  } catch (e: any) { return err500(res, e); }
}

export async function deleteFoto(req: Request, res: Response) {
  try {
    const { fotoId } = req.params;
    await prisma.relatorioFoto.delete({ where: { id: fotoId } });
    return res.json({ data: { ok: true } });
  } catch (e: any) { return err500(res, e); }
}

export async function getCurvaS(req: Request, res: Response) {
  try {
    const { id: obraId } = req.params;
    const pontos = await prisma.relatorioCurvaS.findMany({
      where: { obraId },
      orderBy: { semana: 'asc' },
    });
    return res.json({ data: pontos });
  } catch (e: any) { return err500(res, e); }
}

export async function replaceCurvaS(req: Request, res: Response) {
  try {
    const { id: obraId } = req.params;
    const { pontos } = req.body as { pontos: { semana: string; planejadoPct?: number | null; realizadoPct?: number | null }[] };
    if (!Array.isArray(pontos)) return res.status(400).json({ error: { message: 'pontos deve ser um array' } });
    await prisma.relatorioCurvaS.deleteMany({ where: { obraId } });
    if (pontos.length > 0) {
      await prisma.relatorioCurvaS.createMany({
        data: pontos.map(p => ({
          obraId,
          semana: new Date(p.semana),
          planejadoPct: p.planejadoPct ?? null,
          realizadoPct: p.realizadoPct ?? null,
        })),
      });
    }
    const result = await prisma.relatorioCurvaS.findMany({ where: { obraId }, orderBy: { semana: 'asc' } });
    return res.json({ data: result });
  } catch (e: any) { return err500(res, e); }
}

export async function upsertCurvaSPlanejado(req: Request, res: Response) {
  try {
    const { id: obraId } = req.params;
    const { semana, planejadoPct, realizadoPct } = req.body;
    const update: any = {};
    if (planejadoPct !== undefined) update.planejadoPct = planejadoPct;
    if (realizadoPct !== undefined) update.realizadoPct = realizadoPct;
    const ponto = await prisma.relatorioCurvaS.upsert({
      where: { obraId_semana: { obraId, semana: new Date(semana) } },
      update,
      create: { obraId, semana: new Date(semana), planejadoPct: planejadoPct ?? null, realizadoPct: realizadoPct ?? null },
    });
    return res.json({ data: ponto });
  } catch (e: any) { return err500(res, e); }
}

export async function getAllTarefas(req: Request, res: Response) {
  try {
    const { id: obraId } = req.params;
    const cron = await prisma.cronograma.findFirst({ where: { obraId }, orderBy: { createdAt: 'desc' } });
    const tarefas: any[] = (cron?.parsedData as any)?.tarefas ?? [];
    const result = tarefas
      .filter(t => !t.ehResumo)
      .map(t => ({
        wbs: t.wbs ?? '',
        nome: t.nome ?? '',
        inicio: t.inicio ?? null,
        fim: t.fim ?? null,
        percentualConcluido: t.percentualConcluido ?? 0,
      }));
    return res.json({ data: result });
  } catch (e: any) { return err500(res, e); }
}

export async function getDadosPeriodo(req: Request, res: Response) {
  try {
    const { id: obraId } = req.params;
    const { inicio, fim } = req.query as { inicio: string; fim: string };
    if (!inicio || !fim) return res.status(400).json({ error: { message: 'inicio e fim obrigatórios' } });

    const inicioDate = new Date(inicio);
    const fimDate = new Date(fim);
    const proximoFim = new Date(fimDate); proximoFim.setDate(fimDate.getDate() + 14);

    const diarios = await prisma.diarioObra.findMany({
      where: { obraId, data: { gte: inicioDate, lte: fimDate } },
      select: {
        data: true,
        efetivos: { select: { quantidade: true, presente: true } },
      },
      orderBy: { data: 'asc' },
    });
    const efetivos = diarios.map(d => ({
      data: d.data,
      total: d.efetivos.filter(e => e.presente).reduce((s, e) => s + e.quantidade, 0),
    }));

    const cron = await prisma.cronograma.findFirst({ where: { obraId }, orderBy: { createdAt: 'desc' } });
    const tarefas: any[] = (cron?.parsedData as any)?.tarefas ?? [];
    const fimStr = fim;
    const proximoFimStr = proximoFim.toISOString().slice(0, 10);

    const tarefasPeriodo = tarefas.filter(t =>
      !t.ehResumo && t.percentualConcluido < 100 &&
      t.inicio && t.fim &&
      t.inicio <= fimStr && t.fim >= inicio,
    );
    const tarefasProximo = tarefas.filter(t =>
      !t.ehResumo && t.percentualConcluido < 100 &&
      t.inicio &&
      t.inicio > fimStr && t.inicio <= proximoFimStr,
    );

    return res.json({ data: { efetivos, tarefasPeriodo, tarefasProximo } });
  } catch (e: any) { return err500(res, e); }
}
