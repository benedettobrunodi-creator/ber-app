import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { sendSuccess, sendCreated } from '../../utils/response';
import { AppError } from '../../utils/errors';

const MODULES = [
  'dashboard', 'obras', 'kanban', 'sequenciamento', 'checklists',
  'recebimentos', 'seguranca', 'normas', 'instrucoes',
  'ponto', 'configuracoes',
] as const;

// GET /v1/roles
export async function listRoles(_req: Request, res: Response) {
  const roles = await prisma.customRole.findMany({
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { users: true } } },
  });
  sendSuccess(res, roles);
}

// GET /v1/roles/:id
export async function getRole(req: Request, res: Response) {
  const role = await prisma.customRole.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { users: true } } },
  });
  if (!role) throw AppError.notFound('Role');
  sendSuccess(res, role);
}

// POST /v1/roles
export async function createRole(req: Request, res: Response) {
  const { name, description, permissions } = req.body;
  if (!name?.trim()) throw AppError.badRequest('nome obrigatorio');

  const existing = await prisma.customRole.findUnique({ where: { name: name.trim() } });
  if (existing) throw AppError.conflict('Role com esse nome ja existe');

  const sanitized = sanitizePermissions(permissions);
  const role = await prisma.customRole.create({
    data: { name: name.trim(), description: description?.trim() || null, permissions: sanitized },
  });
  sendCreated(res, role);
}

// PUT /v1/roles/:id
export async function updateRole(req: Request, res: Response) {
  const { name, description, permissions } = req.body;

  const role = await prisma.customRole.findUnique({ where: { id: req.params.id } });
  if (!role) throw AppError.notFound('Role');

  // System roles: allow editing permissions but not name
  const data: any = {};
  if (name !== undefined && !role.isSystem) data.name = name.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if (permissions !== undefined) data.permissions = sanitizePermissions(permissions);

  const updated = await prisma.customRole.update({
    where: { id: req.params.id },
    data,
    include: { _count: { select: { users: true } } },
  });
  sendSuccess(res, updated);
}

// DELETE /v1/roles/:id
export async function deleteRole(req: Request, res: Response) {
  const role = await prisma.customRole.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { users: true } } },
  });
  if (!role) throw AppError.notFound('Role');
  if (role.isSystem) throw AppError.badRequest('Nao e possivel excluir role do sistema');
  if (role._count.users > 0) throw AppError.badRequest('Role possui usuarios vinculados');

  await prisma.customRole.delete({ where: { id: req.params.id } });
  sendSuccess(res, { deleted: true });
}

// GET /v1/roles/modules — list available modules
export async function listModules(_req: Request, res: Response) {
  sendSuccess(res, MODULES);
}

function sanitizePermissions(perms: any): Record<string, boolean> {
  if (!perms || typeof perms !== 'object') return {};
  const result: Record<string, boolean> = {};
  for (const mod of MODULES) {
    result[mod] = !!perms[mod];
  }
  return result;
}
