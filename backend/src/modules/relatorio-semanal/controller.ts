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

export async function listRelatorios(req: Request, res: Response) {
  const { id: obraId } = req.params;
  const relatorios = await prisma.relatorioSemanal.findMany({
    where: { obraId },
    include,
    orderBy: { numero: 'desc' },
  });
  return res.json({ data: relatorios });
}

export async function getRelatorio(req: Request, res: Response) {
  const { id: obraId, relatorioId } = req.params;
  const relatorio = await prisma.relatorioSemanal.findFirst({
    where: { id: relatorioId, obraId },
    include,
  });
  if (!relatorio) return res.status(404).json({ error: { message: 'Relatório não encontrado' } });
  return res.json({ data: relatorio });
}

export async function createRelatorio(req: Request, res: Response) {
  const { id: obraId } = req.params;
  const {
    periodoInicio, periodoFim, status, avancoPct, avancoDelta,
    diasTrabalhados, diasUteis, diasImprodutivos, motivoImprodutivo,
    efetivoMedio, efetivoPorDisciplina, destaques, proximosSete,
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
      destaques: destaques ?? null,
      proximosSete: proximosSete ?? null,
      responsavelId: responsavelId ?? null,
      responsavelNome: responsavelNome ?? null,
      dataContrato: dataContrato ? new Date(dataContrato) : null,
      pendencias: { create: pendencias.map((p: any, i: number) => ({ ...p, ordem: i })) },
      marcos: { create: marcos },
    },
    include,
  });

  // Record curva S realizado point
  await prisma.relatorioCurvaS.upsert({
    where: { obraId_semana: { obraId, semana: new Date(periodoFim) } },
    update: { realizadoPct: avancoPct ?? 0 },
    create: { obraId, semana: new Date(periodoFim), realizadoPct: avancoPct ?? 0 },
  });

  return res.status(201).json({ data: relatorio });
}

export async function updateRelatorio(req: Request, res: Response) {
  const { id: obraId, relatorioId } = req.params;
  const existing = await prisma.relatorioSemanal.findFirst({ where: { id: relatorioId, obraId } });
  if (!existing) return res.status(404).json({ error: { message: 'Relatório não encontrado' } });

  const {
    periodoInicio, periodoFim, status, avancoPct, avancoDelta,
    diasTrabalhados, diasUteis, diasImprodutivos, motivoImprodutivo,
    efetivoMedio, efetivoPorDisciplina, destaques, proximosSete,
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
  if (destaques !== undefined) data.destaques = destaques;
  if (proximosSete !== undefined) data.proximosSete = proximosSete;
  if (responsavelId !== undefined) data.responsavelId = responsavelId;
  if (responsavelNome !== undefined) data.responsavelNome = responsavelNome;
  if (dataContrato !== undefined) data.dataContrato = dataContrato ? new Date(dataContrato) : null;

  if (pendencias !== undefined) {
    await prisma.relatorioPendencia.deleteMany({ where: { relatorioId } });
    data.pendencias = { create: pendencias.map((p: any, i: number) => ({ ...p, ordem: i })) };
  }
  if (marcos !== undefined) {
    await prisma.relatorioMarco.deleteMany({ where: { relatorioId } });
    data.marcos = { create: marcos };
  }

  const relatorio = await prisma.relatorioSemanal.update({
    where: { id: relatorioId },
    data,
    include,
  });

  if (avancoPct !== undefined) {
    const semana = relatorio.periodoFim;
    await prisma.relatorioCurvaS.upsert({
      where: { obraId_semana: { obraId, semana } },
      update: { realizadoPct: avancoPct },
      create: { obraId, semana, realizadoPct: avancoPct },
    });
  }

  return res.json({ data: relatorio });
}

export async function deleteRelatorio(req: Request, res: Response) {
  const { id: obraId, relatorioId } = req.params;
  const existing = await prisma.relatorioSemanal.findFirst({ where: { id: relatorioId, obraId } });
  if (!existing) return res.status(404).json({ error: { message: 'Relatório não encontrado' } });
  await prisma.relatorioSemanal.delete({ where: { id: relatorioId } });
  return res.json({ data: { ok: true } });
}

export async function uploadFoto(req: Request, res: Response) {
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
}

export async function deleteFoto(req: Request, res: Response) {
  const { fotoId } = req.params;
  await prisma.relatorioFoto.delete({ where: { id: fotoId } });
  return res.json({ data: { ok: true } });
}

export async function getCurvaS(req: Request, res: Response) {
  const { id: obraId } = req.params;
  const pontos = await prisma.relatorioCurvaS.findMany({
    where: { obraId },
    orderBy: { semana: 'asc' },
  });
  return res.json({ data: pontos });
}

export async function upsertCurvaSPlanejado(req: Request, res: Response) {
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
}

export async function getDadosPeriodo(req: Request, res: Response) {
  const { id: obraId } = req.params;
  const { inicio, fim } = req.query as { inicio: string; fim: string };
  if (!inicio || !fim) return res.status(400).json({ error: { message: 'inicio e fim obrigatórios' } });

  const inicioDate = new Date(inicio);
  const fimDate = new Date(fim);
  const proximoInicio = new Date(fimDate); proximoInicio.setDate(fimDate.getDate() + 1);
  const proximoFim = new Date(fimDate); proximoFim.setDate(fimDate.getDate() + 14);

  // Efetivos por dia do período (a partir dos diários)
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

  // Tarefas do cronograma (de parsedData.tarefas)
  const cron = await prisma.cronograma.findFirst({ where: { obraId }, orderBy: { createdAt: 'desc' } });
  const tarefas: any[] = (cron?.parsedData as any)?.tarefas ?? [];
  const inicioStr = inicio;
  const fimStr = fim;
  const proximoFimStr = proximoFim.toISOString().slice(0, 10);

  const tarefasPeriodo = tarefas.filter(t =>
    !t.ehResumo && t.percentualConcluido < 100 &&
    t.inicio && t.fim &&
    t.inicio <= fimStr && t.fim >= inicioStr,
  );
  const tarefasProximo = tarefas.filter(t =>
    !t.ehResumo && t.percentualConcluido < 100 &&
    t.inicio &&
    t.inicio > fimStr && t.inicio <= proximoFimStr,
  );

  return res.json({ data: { efetivos, tarefasPeriodo, tarefasProximo } });
}
