import { Request, Response } from 'express';
import * as service from './service';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';
import { uploadToR2, isR2Configured } from '../../services/storage';

export async function list(req: Request, res: Response) {
  const data = await service.listByObra(req.params.id);
  sendSuccess(res, data);
}

export async function create(req: Request, res: Response) {
  const data = await service.create(req.params.id, req.body, req.user!.userId);
  sendCreated(res, data);
}

export async function update(req: Request, res: Response) {
  const data = await service.update(req.params.amostraId, req.body);
  sendSuccess(res, data);
}

export async function remove(req: Request, res: Response) {
  await service.remove(req.params.amostraId);
  sendNoContent(res);
}

export async function uploadFoto(req: Request, res: Response) {
  const file = req.file;
  if (!file) throw AppError.badRequest('Envie o arquivo da foto (campo "file")');
  if (!isR2Configured()) throw AppError.badRequest('Storage de fotos não configurado no servidor');
  const url = await uploadToR2(file.buffer, `amostras/${req.params.amostraId}-${file.originalname}`, file.mimetype);
  sendSuccess(res, await service.addFoto(req.params.amostraId, url));
}

export async function removeFoto(req: Request, res: Response) {
  const { url } = req.body as { url?: string };
  if (!url) throw AppError.badRequest('Informe a url da foto a remover');
  sendSuccess(res, await service.removeFoto(req.params.amostraId, url));
}

export async function enviarEmail(req: Request, res: Response) {
  const { id: obraId, amostraId } = req.params;
  const { todosEmailsDaObra, sendEmailObra, amostraAprovacaoHtml } = await import('../../services/email-obras');

  const amostra = await prisma.amostraAprovacao.findFirst({
    where: { id: amostraId, obraId },
    include: { responsavelStakeholder: { select: { nome: true, empresa: true } } },
  });
  if (!amostra) throw AppError.notFound('Amostra');

  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { name: true } });
  if (!obra) throw AppError.notFound('Obra');

  const emails = await todosEmailsDaObra(obraId);
  if (emails.length === 0) {
    throw AppError.badRequest('Nenhum stakeholder com e-mail cadastrado nesta obra');
  }

  const fmt = amostra.dataAprovacao
    ? new Date(amostra.dataAprovacao).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    : null;
  const responsavelNome = amostra.responsavelStakeholder
    ? `${amostra.responsavelStakeholder.nome} (${amostra.responsavelStakeholder.empresa})`
    : null;

  const statusLabel = amostra.status === 'aprovado' ? 'aprovada' : amostra.status === 'reprovado' ? 'reprovada' : 'pendente';

  await sendEmailObra({
    to: emails,
    subject: `Amostra ${statusLabel} — ${amostra.item} · ${obra.name} · BÈR Engenharia`,
    html: amostraAprovacaoHtml({
      obraNome: obra.name,
      item: amostra.item,
      marca: amostra.marca,
      especificacao: amostra.especificacao,
      ambiente: amostra.ambiente,
      status: amostra.status,
      dataFmt: fmt,
      responsavelNome,
      observacoes: amostra.observacoes,
      fotos: amostra.fotos,
    }),
  });

  const updated = await service.marcarEmailEnviado(amostraId);
  sendSuccess(res, { ok: true, enviadoPara: emails, emailEnviadoEm: updated.emailEnviadoEm });
}
