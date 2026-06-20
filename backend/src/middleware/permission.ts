import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/errors';

const ALL_OFF: Record<string, boolean> = {
  dashboard: false, obras: false, kanban: false, checklists: false, diario: false,
  recebimentos: false, seguranca: false, normas: false, instrucoes: false, ponto: false,
  orcamentos: false, organograma: false, configuracoes: false, admin: false,
  comprasDashboard: false, aditivos: false,
};

const DEFAULT_PERMS: Record<string, Record<string, boolean>> = {
  socio:       { ...ALL_OFF, admin: true, comprasDashboard: true, aditivos: true },
  diretoria:   { ...ALL_OFF },
  coordenacao: { ...ALL_OFF },
  pmo:         { ...ALL_OFF },
  engenharia:  { ...ALL_OFF },
  financeiro:  { ...ALL_OFF },
  gestor:      { ...ALL_OFF },
  compras:     { ...ALL_OFF },
  orcamentos:  { ...ALL_OFF },
  campo:       { ...ALL_OFF },
};

/** Middleware that checks whether the authenticated user has permission for a given module.
 *  Must run after `authenticate` (requires req.user to be set).
 *  socio role always bypasses — they are the system owner. */
export function requirePermission(moduleKey: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(AppError.unauthorized());

      // Owner always has access
      if (req.user.role === 'socio') return next();

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { permissions: true, role: true },
      });

      if (!user) return next(AppError.unauthorized());

      const customPerms = user.permissions as Record<string, boolean> | null;
      const perms = customPerms && Object.keys(customPerms).length > 0
        ? customPerms
        : DEFAULT_PERMS[user.role] ?? ALL_OFF;

      if (perms[moduleKey] === true) return next();

      return next(AppError.forbidden('Sem permissão para acessar este módulo'));
    } catch (err) {
      next(err);
    }
  };
}
