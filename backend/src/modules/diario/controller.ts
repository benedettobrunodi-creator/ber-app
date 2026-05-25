import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';
import { uploadToR2, deleteFromR2, isR2Configured } from '../../services/storage';
import * as fs from 'fs';
import * as path from 'path';
import { env } from '../../config/env';
import type {
  CreateDiarioInput, UpdateDiarioInput,
  CreateEfetivoInput, CreateAtividadeInput, CreateOcorrenciaInput,
  CreateVisitaInput, CreateMaterialInput, CreateEquipamentoInput,
} from './types';

const diarioInclude = {
  criadoPor: { select: { id: true, name: true } },
  fechadoPor: { select: { id: true, name: true } },
  efetivos: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  atividades: { orderBy: { createdAt: 'asc' as const } },
  fotos: {
    include: { ambiente: { select: { id: true, nome: true } } },
    orderBy: { ordem: 'asc' as const },
  },
  ocorrencias: { orderBy: { createdAt: 'asc' as const } },
  visitas: { orderBy: { createdAt: 'asc' as const } },
  materiais: { orderBy: { createdAt: 'asc' as const } },
  equipamentos: { orderBy: { createdAt: 'asc' as const } },
};

export async function listByObra(req: Request, res: Response) {
  const diarios = await prisma.diarioObra.findMany({
    where: { obraId: req.params.id },
    include: {
      criadoPor: { select: { id: true, name: true } },
      _count: { select: { efetivos: true, atividades: true, fotos: true } },
    },
    orderBy: { data: 'desc' },
  });
  sendSuccess(res, diarios);
}

export async function create(req: Request, res: Response) {
  const input = req.body as CreateDiarioInput;
  const obra = await prisma.obra.findUnique({ where: { id: req.params.id } });
  if (!obra) throw AppError.notFound('Obra');

  const existing = await prisma.diarioObra.findFirst({
    where: { obraId: req.params.id, data: new Date(input.data) },
  });
  if (existing) throw AppError.conflict('Já existe um diário para esta data');

  const diario = await prisma.diarioObra.create({
    data: {
      obraId: req.params.id,
      data: new Date(input.data),
      clima: input.clima,
      condicaoTrabalho: input.condicaoTrabalho,
      observacoesInternas: input.observacoesInternas,
      observacoesCliente: input.observacoesCliente,
      criadoPorId: req.user!.userId,
    },
    include: diarioInclude,
  });
  sendCreated(res, diario);
}

export async function getById(req: Request, res: Response) {
  const diario = await prisma.diarioObra.findUnique({
    where: { id: req.params.diarioId },
    include: diarioInclude,
  });
  if (!diario) throw AppError.notFound('Diário');
  sendSuccess(res, diario);
}

export async function update(req: Request, res: Response) {
  const input = req.body as UpdateDiarioInput;
  const diario = await prisma.diarioObra.findUnique({ where: { id: req.params.diarioId } });
  if (!diario) throw AppError.notFound('Diário');
  if (diario.status === 'fechado') throw AppError.forbidden('Diário fechado não pode ser editado');

  const updated = await prisma.diarioObra.update({
    where: { id: req.params.diarioId },
    data: {
      clima: input.clima,
      condicaoTrabalho: input.condicaoTrabalho,
      observacoesInternas: input.observacoesInternas,
      observacoesCliente: input.observacoesCliente,
      ...(input.avancoDia !== undefined && { avancoDia: input.avancoDia }),
    },
    include: diarioInclude,
  });
  sendSuccess(res, updated);
}

export async function fechar(req: Request, res: Response) {
  const diario = await prisma.diarioObra.findUnique({
    where: { id: req.params.diarioId },
    include: { obra: { select: { name: true, whatsappCliente: true } } },
  });
  if (!diario) throw AppError.notFound('Diário');
  if (diario.status === 'fechado') throw AppError.badRequest('Diário já está fechado');

  const tokenPublico = randomUUID();
  const enviarWhatsapp = req.body?.enviarWhatsapp !== false;

  const updated = await prisma.diarioObra.update({
    where: { id: req.params.diarioId },
    data: { status: 'fechado', fechadoEm: new Date(), fechadoPorId: req.user!.userId, tokenPublico },
    include: diarioInclude,
  });

  // Enviar WhatsApp se obra tiver contato e gestor não tiver desativado
  if (enviarWhatsapp && diario.obra.whatsappCliente) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://ber-app.vercel.app';
    const link = `${appUrl}/atualizacao/${tokenPublico}`;
    const dataFmt = new Date(diario.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    const msg = `📍 ${diario.obra.name} — ${dataFmt}\nVeja a atualização do dia:\n${link}`;
    spawn('python3', [
      '/Users/assistentebruno/.claude/agents/clara/scripts/send_whatsapp.py',
      '--to', diario.obra.whatsappCliente,
      '--message', msg,
    ], { detached: true, stdio: 'ignore' }).unref();
  }

  sendSuccess(res, { ...updated, tokenPublico });
}

export async function reabrir(req: Request, res: Response) {
  const diario = await prisma.diarioObra.findUnique({ where: { id: req.params.diarioId } });
  if (!diario) throw AppError.notFound('Diário');
  if (diario.status !== 'fechado') throw AppError.badRequest('Diário não está fechado');

  const updated = await prisma.diarioObra.update({
    where: { id: req.params.diarioId },
    data: { status: 'rascunho', fechadoEm: null, fechadoPorId: null },
    include: diarioInclude,
  });
  sendSuccess(res, updated);
}

export async function aprovar(req: Request, res: Response) {
  const diario = await prisma.diarioObra.findUnique({ where: { id: req.params.diarioId } });
  if (!diario) throw AppError.notFound('Diário');
  if (!['fechado', 'recusado'].includes(diario.status)) throw AppError.badRequest('Diário precisa estar fechado para aprovar');

  const updated = await prisma.diarioObra.update({
    where: { id: req.params.diarioId },
    data: { status: 'aprovado' },
    include: diarioInclude,
  });
  sendSuccess(res, updated);
}

export async function recusar(req: Request, res: Response) {
  const diario = await prisma.diarioObra.findUnique({ where: { id: req.params.diarioId } });
  if (!diario) throw AppError.notFound('Diário');
  if (!['fechado', 'aprovado'].includes(diario.status)) throw AppError.badRequest('Diário precisa estar fechado para recusar');

  const updated = await prisma.diarioObra.update({
    where: { id: req.params.diarioId },
    data: { status: 'recusado' },
    include: diarioInclude,
  });
  sendSuccess(res, updated);
}

export async function deleteDiario(req: Request, res: Response) {
  const diario = await prisma.diarioObra.findUnique({ where: { id: req.params.diarioId } });
  if (!diario) throw AppError.notFound('Diário');
  await prisma.diarioObra.delete({ where: { id: req.params.diarioId } });
  sendNoContent(res);
}

export async function addEfetivo(req: Request, res: Response) {
  const input = req.body as CreateEfetivoInput;
  await assertDiarioOpen(req.params.diarioId);
  const ef = await prisma.diarioEfetivo.create({
    data: {
      diarioId: req.params.diarioId,
      userId: input.userId,
      nomeExterno: input.nomeExterno,
      funcao: input.funcao,
      categoria: input.categoria,
      quantidade: input.quantidade ?? 1,
      presente: input.presente ?? true,
      observacao: input.observacao,
      origem: 'manual',
    },
    include: { user: { select: { id: true, name: true } } },
  });
  sendCreated(res, ef);
}

export async function removeEfetivo(req: Request, res: Response) {
  await assertDiarioOpen(req.params.diarioId);
  const ef = await prisma.diarioEfetivo.findFirst({
    where: { id: req.params.efId, diarioId: req.params.diarioId },
  });
  if (!ef) throw AppError.notFound('Efetivo');
  await prisma.diarioEfetivo.delete({ where: { id: req.params.efId } });
  sendNoContent(res);
}

export async function addAtividade(req: Request, res: Response) {
  const input = req.body as CreateAtividadeInput;
  await assertDiarioOpen(req.params.diarioId);
  const at = await prisma.diarioAtividade.create({
    data: {
      diarioId: req.params.diarioId,
      descricao: input.descricao,
      status: input.status,
      obraEtapaId: input.obraEtapaId,
      origem: 'manual',
    },
  });
  sendCreated(res, at);
}

export async function removeAtividade(req: Request, res: Response) {
  await assertDiarioOpen(req.params.diarioId);
  const at = await prisma.diarioAtividade.findFirst({
    where: { id: req.params.atId, diarioId: req.params.diarioId },
  });
  if (!at) throw AppError.notFound('Atividade');
  await prisma.diarioAtividade.delete({ where: { id: req.params.atId } });
  sendNoContent(res);
}

export async function addOcorrencia(req: Request, res: Response) {
  const input = req.body as CreateOcorrenciaInput;
  await assertDiarioOpen(req.params.diarioId);
  const oc = await prisma.diarioOcorrencia.create({
    data: {
      diarioId: req.params.diarioId,
      tipo: input.tipo,
      descricao: input.descricao,
      visivelCliente: input.visivelCliente ?? false,
    },
  });
  sendCreated(res, oc);
}

export async function removeOcorrencia(req: Request, res: Response) {
  await assertDiarioOpen(req.params.diarioId);
  const oc = await prisma.diarioOcorrencia.findFirst({
    where: { id: req.params.ocId, diarioId: req.params.diarioId },
  });
  if (!oc) throw AppError.notFound('Ocorrência');
  await prisma.diarioOcorrencia.delete({ where: { id: req.params.ocId } });
  sendNoContent(res);
}

export async function addVisita(req: Request, res: Response) {
  const input = req.body as CreateVisitaInput;
  await assertDiarioOpen(req.params.diarioId);
  const vi = await prisma.diarioVisita.create({
    data: {
      diarioId: req.params.diarioId,
      tipo: input.tipo,
      nome: input.nome,
      observacao: input.observacao,
      visivelCliente: input.visivelCliente ?? true,
    },
  });
  sendCreated(res, vi);
}

export async function removeVisita(req: Request, res: Response) {
  await assertDiarioOpen(req.params.diarioId);
  const vi = await prisma.diarioVisita.findFirst({
    where: { id: req.params.viId, diarioId: req.params.diarioId },
  });
  if (!vi) throw AppError.notFound('Visita');
  await prisma.diarioVisita.delete({ where: { id: req.params.viId } });
  sendNoContent(res);
}

export async function addMaterial(req: Request, res: Response) {
  const input = req.body as CreateMaterialInput;
  await assertDiarioOpen(req.params.diarioId);
  const mat = await prisma.diarioMaterial.create({
    data: {
      diarioId: req.params.diarioId,
      descricao: input.descricao,
      recebimentoMaterialId: input.recebimentoMaterialId,
      quantidade: input.quantidade ?? null,
      unidade: input.unidade ?? null,
      origem: 'manual',
    },
  });
  sendCreated(res, mat);
}

export async function addFoto(req: Request, res: Response) {
  await assertDiarioOpen(req.params.diarioId);
  if (!req.file) throw AppError.badRequest('Nenhum arquivo enviado');

  let fileUrl: string;
  if (isR2Configured()) {
    fileUrl = await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype);
  } else {
    const uploadsDir = path.resolve(env.uploadDir);
    const ext = path.extname(req.file.originalname);
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);
    fileUrl = `/uploads/${filename}`;
  }

  const foto = await prisma.diarioFoto.create({
    data: {
      diarioId: req.params.diarioId,
      fileUrl,
      legenda: req.body.legenda ?? null,
      ambienteId: req.body.ambienteId ?? null,
      ordem: req.body.ordem ? Number(req.body.ordem) : 0,
      uploadedById: req.user!.userId,
    },
    include: { ambiente: { select: { id: true, nome: true } } },
  });
  sendCreated(res, foto);
}

export async function removeFoto(req: Request, res: Response) {
  const foto = await prisma.diarioFoto.findFirst({
    where: { id: req.params.fotoId, diarioId: req.params.diarioId },
  });
  if (!foto) throw AppError.notFound('Foto');
  if (foto.fileUrl.startsWith('http')) {
    await deleteFromR2(foto.fileUrl).catch(() => {});
  }
  await prisma.diarioFoto.delete({ where: { id: foto.id } });
  sendNoContent(res);
}

export async function getPublico(req: Request, res: Response) {
  const diario = await prisma.diarioObra.findUnique({
    where: { tokenPublico: req.params.token },
    include: {
      obra: { select: { name: true, client: true } },
      efetivos: { select: { categoria: true, quantidade: true } },
      atividades: {
        where: { status: { not: 'nao_realizada' } },
        select: { descricao: true, status: true },
        orderBy: { createdAt: 'asc' },
      },
      fotos: {
        select: { id: true, fileUrl: true, legenda: true, ordem: true },
        orderBy: { ordem: 'asc' },
      },
      ocorrencias: {
        where: { visivelCliente: true },
        select: { tipo: true, descricao: true },
      },
      visitas: {
        where: { visivelCliente: true },
        select: { tipo: true, nome: true, observacao: true },
      },
    },
  });
  if (!diario) throw AppError.notFound('Diário');
  if (diario.status !== 'fechado') throw AppError.badRequest('Diário ainda não fechado');

  const totalEfetivos = diario.efetivos.reduce((acc, e) => acc + (e.quantidade ?? 1), 0);

  sendSuccess(res, {
    obraNome: diario.obra.name,
    clienteNome: diario.obra.client,
    data: diario.data,
    clima: diario.clima,
    condicaoTrabalho: diario.condicaoTrabalho,
    avancoDia: diario.avancoDia ? Number(diario.avancoDia) : null,
    observacoesCliente: diario.observacoesCliente,
    totalEfetivos,
    fotos: diario.fotos,
    atividades: diario.atividades,
    ocorrencias: diario.ocorrencias,
    visitas: diario.visitas,
  });
}

export async function removeMaterial(req: Request, res: Response) {
  await assertDiarioOpen(req.params.diarioId);
  const mat = await prisma.diarioMaterial.findFirst({
    where: { id: req.params.matId, diarioId: req.params.diarioId },
  });
  if (!mat) throw AppError.notFound('Material');
  await prisma.diarioMaterial.delete({ where: { id: req.params.matId } });
  sendNoContent(res);
}

export async function addEquipamento(req: Request, res: Response) {
  const input = req.body as CreateEquipamentoInput;
  await assertDiarioOpen(req.params.diarioId);
  const eq = await prisma.diarioEquipamento.create({
    data: {
      diarioId: req.params.diarioId,
      nome: input.nome,
    },
  });
  sendCreated(res, eq);
}

export async function removeEquipamento(req: Request, res: Response) {
  await assertDiarioOpen(req.params.diarioId);
  const eq = await prisma.diarioEquipamento.findFirst({
    where: { id: req.params.eqId, diarioId: req.params.diarioId },
  });
  if (!eq) throw AppError.notFound('Equipamento');
  await prisma.diarioEquipamento.delete({ where: { id: req.params.eqId } });
  sendNoContent(res);
}

async function assertDiarioOpen(diarioId: string) {
  const diario = await prisma.diarioObra.findUnique({
    where: { id: diarioId },
    select: { status: true },
  });
  if (!diario) throw AppError.notFound('Diário');
  if (diario.status === 'fechado') throw AppError.forbidden('Diário fechado não pode ser editado');
}
