import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { sendSuccess, sendCreated } from '../../utils/response';
import { AppError } from '../../utils/errors';

const CL_INCLUDE = {
  template: { include: { items: { orderBy: { ordem: 'asc' as const } } } },
  filler: { select: { id: true, name: true } },
  items: {
    include: { templateItem: true, filler: { select: { id: true, name: true } } },
    orderBy: { templateItem: { ordem: 'asc' as const } },
  },
  ambientes: { orderBy: { ordem: 'asc' as const } },
};

// GET /v1/ber-checklist-templates
export async function listTemplates(_req: Request, res: Response) {
  const templates = await prisma.berChecklistTemplate.findMany({
    include: { items: { orderBy: { ordem: 'asc' } } },
    orderBy: { code: 'asc' },
  });
  sendSuccess(res, templates);
}

// GET /v1/obras/:id/ber-checklists
export async function listByObra(req: Request, res: Response) {
  const { id } = req.params;
  const list = await prisma.obraBerChecklist.findMany({
    where: { obraId: id },
    include: CL_INCLUDE,
    orderBy: [{ template: { code: 'asc' } }, { visitaNumero: 'asc' }],
  });
  sendSuccess(res, list);
}

// POST /v1/obras/:id/ber-checklists  { templateId }
export async function createChecklist(req: Request, res: Response) {
  const { id: obraId } = req.params;
  const { templateId } = req.body;
  const userId = (req as any).user?.id;
  if (!templateId) throw AppError.badRequest('templateId obrigatório');

  const template = await prisma.berChecklistTemplate.findUnique({
    where: { id: templateId },
    include: { items: true },
  });
  if (!template) throw AppError.notFound('Template');

  // Unique templates: block duplicate
  if (!template.recorrente) {
    const existing = await prisma.obraBerChecklist.findFirst({
      where: { obraId, templateId },
    });
    if (existing) throw AppError.conflict(`Checklist ${template.code} já existe para esta obra`);
  }

  // visita_numero for recurrent
  let visitaNumero = 1;
  if (template.recorrente) {
    const last = await prisma.obraBerChecklist.findFirst({
      where: { obraId, templateId },
      orderBy: { visitaNumero: 'desc' },
    });
    if (last) visitaNumero = last.visitaNumero + 1;
  }

  const cl = await prisma.obraBerChecklist.create({
    data: {
      obraId, templateId, filledBy: userId, visitaNumero,
      status: 'nao_iniciado',
      items: {
        create: template.items.map(item => ({
          templateItemId: item.id,
          checked: false,
        })),
      },
    },
    include: CL_INCLUDE,
  });
  sendCreated(res, cl);
}

// GET /v1/obra-ber-checklists/:id
export async function getChecklist(req: Request, res: Response) {
  const cl = await prisma.obraBerChecklist.findUnique({
    where: { id: req.params.id },
    include: CL_INCLUDE,
  });
  if (!cl) throw AppError.notFound('Checklist');
  sendSuccess(res, cl);
}

// PATCH /v1/obra-ber-checklists/:id/items/:itemId
export async function patchItem(req: Request, res: Response) {
  const { id: checklistId, itemId } = req.params;
  const { checked, fotoUrl, observacao } = req.body;
  const userId = (req as any).user?.id;

  const cl = await prisma.obraBerChecklist.findUnique({ where: { id: checklistId } });
  if (!cl) throw AppError.notFound('Checklist');
  if (cl.status === 'concluido') throw AppError.badRequest('Checklist já concluído');

  // Auto-set status to em_preenchimento on first interaction
  if (cl.status === 'nao_iniciado') {
    await prisma.obraBerChecklist.update({ where: { id: checklistId }, data: { status: 'em_preenchimento' } });
  }

  const item = await prisma.obraBerChecklistItem.update({
    where: { id: itemId },
    data: {
      ...(checked !== undefined && { checked }),
      ...(fotoUrl !== undefined && { fotoUrl }),
      ...(observacao !== undefined && { observacao }),
      filledAt: new Date(),
      filledBy: userId,
    },
    include: { templateItem: true },
  });
  sendSuccess(res, item);
}

// POST /v1/obra-ber-checklists/:id/submit
export async function submitChecklist(req: Request, res: Response) {
  const { id } = req.params;
  const cl = await prisma.obraBerChecklist.findUnique({
    where: { id },
    include: { items: { include: { templateItem: true } } },
  });
  if (!cl) throw AppError.notFound('Checklist');

  // Validate: all required photo items must have foto_url
  const missingPhotos = cl.items.filter(
    i => i.templateItem?.fotoObrigatoria && i.checked && !i.fotoUrl
  );
  if (missingPhotos.length > 0) {
    throw AppError.badRequest(`${missingPhotos.length} item(s) marcados requerem foto`);
  }

  const updated = await prisma.obraBerChecklist.update({
    where: { id },
    data: { status: 'concluido', submittedAt: new Date() },
    include: CL_INCLUDE,
  });
  sendSuccess(res, updated);
}

// POST /v1/obra-ber-checklists/:id/ambientes  { nome }
export async function addAmbiente(req: Request, res: Response) {
  const { id } = req.params;
  const { nome } = req.body;
  if (!nome?.trim()) throw AppError.badRequest('Nome do ambiente obrigatório');

  const cl = await prisma.obraBerChecklist.findUnique({
    where: { id },
    include: { template: true, items: { include: { templateItem: true } }, ambientes: true },
  });
  if (!cl) throw AppError.notFound('Checklist');

  const lastOrder = cl.ambientes.length;

  // Create ambiente
  const ambiente = await prisma.obraChecklistAmbiente.create({
    data: { checklistId: id, nome: nome.trim(), ordem: lastOrder },
  });

  // Clone template items for this ambiente (CL5 per-ambiente items)
  const templateItems = cl.template ? await prisma.berChecklistTemplateItem.findMany({
    where: { templateId: cl.templateId, secao: 'Vistoria por ambiente' },
    orderBy: { ordem: 'asc' },
  }) : [];

  if (templateItems.length > 0) {
    await prisma.obraBerChecklistItem.createMany({
      data: templateItems.map(item => ({
        checklistId: id,
        templateItemId: item.id,
        ambiente: nome.trim(),
        checked: false,
      })),
    });
  }

  const updated = await prisma.obraBerChecklist.findUnique({ where: { id }, include: CL_INCLUDE });
  sendCreated(res, { ambiente, checklist: updated });
}
