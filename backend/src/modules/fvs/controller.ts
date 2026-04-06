import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { sendSuccess, sendCreated } from '../../utils/response';
import { AppError } from '../../utils/errors';

const FVS_INCLUDE = {
  template: { include: { items: { orderBy: { ordem: 'asc' as const } } } },
  etapa: { select: { id: true, name: true, discipline: true } },
  filler: { select: { id: true, name: true } },
  gestorApprover: { select: { id: true, name: true } },
  coordApprover: { select: { id: true, name: true } },
  rejector: { select: { id: true, name: true } },
  items: {
    include: { templateItem: true, filler: { select: { id: true, name: true } } },
    orderBy: { templateItem: { ordem: 'asc' as const } },
  },
};

// GET /obras/:id/fvs
export async function listFvsByObra(req: Request, res: Response) {
  const { id } = req.params;
  const fvsList = await prisma.obraFvs.findMany({
    where: { obraId: id },
    include: FVS_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  sendSuccess(res, fvsList);
}

// GET /obras/:id/etapas/:etapaId/fvs
export async function getFvsByEtapa(req: Request, res: Response) {
  const { etapaId } = req.params;
  const fvs = await prisma.obraFvs.findFirst({
    where: { etapaId },
    include: FVS_INCLUDE,
  });
  sendSuccess(res, fvs ?? null);
}

// GET /v1/fvs-templates
export async function listTemplates(_req: Request, res: Response) {
  const templates = await prisma.fvsTemplate.findMany({
    include: { items: { orderBy: { ordem: 'asc' } } },
    orderBy: { code: 'asc' },
  });
  sendSuccess(res, templates);
}

// POST /obras/:id/etapas/:etapaId/fvs
export async function createFvs(req: Request, res: Response) {
  const { id: obraId, etapaId } = req.params;
  const { templateId } = req.body;
  const userId = (req as any).user?.id;

  // Check not already created
  const existing = await prisma.obraFvs.findFirst({ where: { etapaId } });
  if (existing) throw AppError.conflict('FVS já existe para esta etapa');

  let resolvedTemplateId = templateId;
  if (!resolvedTemplateId) {
    const etapa = await prisma.obraEtapa.findUnique({ where: { id: etapaId } });
    if (etapa?.discipline) {
      const tmpl = await prisma.fvsTemplate.findFirst({
        where: { disciplina: { contains: etapa.discipline.toLowerCase() } },
      });
      resolvedTemplateId = tmpl?.id;
    }
  }
  if (!resolvedTemplateId) throw AppError.notFound('Template FVS não encontrado');

  const template = await prisma.fvsTemplate.findUnique({
    where: { id: resolvedTemplateId },
    include: { items: true },
  });
  if (!template) throw AppError.notFound('Template não encontrado');

  const fvs = await prisma.obraFvs.create({
    data: {
      obraId,
      etapaId,
      templateId: resolvedTemplateId,
      filledBy: userId,
      status: 'pendente',
      items: {
        create: template.items.map(item => ({
          templateItemId: item.id,
          momento: item.momento,
          checked: false,
        })),
      },
    },
    include: FVS_INCLUDE,
  });
  sendCreated(res, fvs);
}

// PATCH /obra-fvs/:fvsId/items/:itemId
export async function checkItem(req: Request, res: Response) {
  const { fvsId, itemId } = req.params;
  const { checked, observacao, fotoUrl } = req.body;
  const userId = (req as any).user?.id;

  const fvs = await prisma.obraFvs.findUnique({ where: { id: fvsId } });
  if (!fvs) throw AppError.notFound('FVS não encontrada');
  if (['aprovada', 'rejeitada'].includes(fvs.status)) throw AppError.badRequest('FVS encerrada');

  const { na } = req.body;
  // Toggling na clears checked; toggling checked clears na
  const updateData: any = { filledAt: new Date(), filledBy: userId };
  if (na !== undefined) {
    updateData.na = na;
    if (na) updateData.checked = false; // na = true → uncheck
  } else {
    updateData.checked = checked ?? true;
    if (checked) updateData.na = false; // checking → clear na
  }
  if (observacao !== undefined) updateData.observacao = observacao;
  if (fotoUrl !== undefined) updateData.fotoUrl = fotoUrl;

  const item = await prisma.obraFvsItem.update({
    where: { id: itemId },
    data: updateData,
    include: { templateItem: true },
  });
  sendSuccess(res, item);
}

// POST /obra-fvs/:fvsId/submit-inicio
export async function submitInicio(req: Request, res: Response) {
  const { fvsId } = req.params;
  const fvs = await prisma.obraFvs.findUnique({
    where: { id: fvsId },
    include: { items: { include: { templateItem: true } } },
  });
  if (!fvs) throw AppError.notFound('FVS não encontrada');

  // Item is "done" if checked=true OR na=true (not applicable)
  const unchecked = fvs.items.filter(i => i.momento === 'inicio' && i.templateItem?.obrigatorio && !i.checked && !(i as any).na);
  if (unchecked.length > 0) {
    throw AppError.badRequest(`${unchecked.length} item(s) obrigatório(s) de pré-execução não marcados`);
  }

  const updated = await prisma.obraFvs.update({
    where: { id: fvsId },
    data: { status: 'inicio_preenchido' },
    include: FVS_INCLUDE,
  });
  sendSuccess(res, updated);
}

// POST /obra-fvs/:fvsId/submit-conclusao
export async function submitConclusao(req: Request, res: Response) {
  const { fvsId } = req.params;
  const fvs = await prisma.obraFvs.findUnique({
    where: { id: fvsId },
    include: { items: { include: { templateItem: true } } },
  });
  if (!fvs) throw AppError.notFound('FVS não encontrada');
  if (!['inicio_aprovado', 'pendente', 'inicio_preenchido'].includes(fvs.status)) {
    throw AppError.badRequest('A pré-execução precisa ser aprovada pelo gestor e coordenador antes de enviar a conclusão');
  }

  const unchecked = fvs.items.filter(i => i.momento === 'conclusao' && i.templateItem?.obrigatorio && !i.checked && !(i as any).na);
  if (unchecked.length > 0) {
    throw AppError.badRequest(`${unchecked.length} item(s) obrigatório(s) de conclusão não marcados`);
  }

  const updated = await prisma.obraFvs.update({
    where: { id: fvsId },
    data: { status: 'aguardando_gestor' },
    include: FVS_INCLUDE,
  });
  sendSuccess(res, updated);
}

// POST /obra-fvs/:fvsId/approve-gestor-inicio
export async function approveGestorInicio(req: Request, res: Response) {
  const { fvsId } = req.params;
  const userId = (req as any).user?.id;
  const role = (req as any).user?.role;
  if (!['gestor', 'coordenacao', 'diretoria'].includes(role)) throw AppError.forbidden('Sem permissão');

  const fvs = await prisma.obraFvs.findUnique({ where: { id: fvsId } });
  if (!fvs) throw AppError.notFound('FVS não encontrada');
  if (fvs.status !== 'inicio_preenchido') throw AppError.badRequest('FVS não está aguardando aprovação do início');

  const updated = await prisma.obraFvs.update({
    where: { id: fvsId },
    data: { status: 'inicio_aprovado_gestor', gestorApprovedBy: userId, gestorApprovedAt: new Date() },
    include: FVS_INCLUDE,
  });
  sendSuccess(res, updated);
}

// POST /obra-fvs/:fvsId/approve-coord-inicio
export async function approveCoordInicio(req: Request, res: Response) {
  const { fvsId } = req.params;
  const userId = (req as any).user?.id;
  const role = (req as any).user?.role;
  if (!['coordenacao', 'diretoria'].includes(role)) throw AppError.forbidden('Sem permissão');

  const fvs = await prisma.obraFvs.findUnique({ where: { id: fvsId } });
  if (!fvs) throw AppError.notFound('FVS não encontrada');
  if (fvs.status !== 'inicio_aprovado_gestor') throw AppError.badRequest('FVS não está aguardando aprovação do coordenador para o início');

  const updated = await prisma.obraFvs.update({
    where: { id: fvsId },
    data: { status: 'inicio_aprovado', coordApprovedBy: userId, coordApprovedAt: new Date() },
    include: FVS_INCLUDE,
  });
  sendSuccess(res, updated);
}

// POST /obra-fvs/:fvsId/approve-gestor
export async function approveGestor(req: Request, res: Response) {
  const { fvsId } = req.params;
  const userId = (req as any).user?.id;
  const role = (req as any).user?.role;
  if (!['gestor', 'coordenacao', 'diretoria'].includes(role)) throw AppError.forbidden('Sem permissão');

  const updated = await prisma.obraFvs.update({
    where: { id: fvsId },
    data: { status: 'aguardando_coord', gestorApprovedBy: userId, gestorApprovedAt: new Date() },
    include: FVS_INCLUDE,
  });
  sendSuccess(res, updated);
}

// POST /obra-fvs/:fvsId/approve-coord
export async function approveCoord(req: Request, res: Response) {
  const { fvsId } = req.params;
  const userId = (req as any).user?.id;
  const role = (req as any).user?.role;
  if (!['coordenacao', 'diretoria'].includes(role)) throw AppError.forbidden('Sem permissão');

  const updated = await prisma.obraFvs.update({
    where: { id: fvsId },
    data: { status: 'aprovada', coordApprovedBy: userId, coordApprovedAt: new Date() },
    include: FVS_INCLUDE,
  });
  sendSuccess(res, updated);
}

// POST /obras/:id/fvs/auto-provision
export async function autoProvision(req: Request, res: Response) {
  const { id: obraId } = req.params;
  const { autoProvisionFvs } = await import('./auto-provision');
  const result = await autoProvisionFvs(obraId);
  sendSuccess(res, result);
}

// POST /obra-fvs/:fvsId/items  — add custom item
export async function addCustomItem(req: Request, res: Response) {
  const { fvsId } = req.params;
  const { descricao, momento } = req.body;
  const userId = (req as any).user?.id;

  if (!descricao?.trim()) throw AppError.badRequest('Descrição obrigatória');
  if (!['inicio', 'conclusao'].includes(momento)) throw AppError.badRequest('Momento deve ser "inicio" ou "conclusao"');

  const fvs = await prisma.obraFvs.findUnique({ where: { id: fvsId } });
  if (!fvs) throw AppError.notFound('FVS não encontrada');
  if (['aprovada', 'rejeitada'].includes(fvs.status)) throw AppError.badRequest('FVS encerrada');

  const item = await prisma.obraFvsItem.create({
    data: {
      fvsId,
      momento,
      descricao: descricao.trim(),
      checked: false,
      na: false,
      filledBy: userId,
    },
    include: { templateItem: true, filler: { select: { id: true, name: true } } },
  });
  sendCreated(res, item);
}

// POST /obra-fvs/:fvsId/reject
export async function rejectFvs(req: Request, res: Response) {
  const { fvsId } = req.params;
  const { reason } = req.body;
  const userId = (req as any).user?.id;
  if (!reason?.trim()) throw AppError.badRequest('Motivo da rejeição obrigatório');

  const updated = await prisma.obraFvs.update({
    where: { id: fvsId },
    data: { status: 'rejeitada', rejectedBy: userId, rejectionReason: reason },
    include: FVS_INCLUDE,
  });
  sendSuccess(res, updated);
}
