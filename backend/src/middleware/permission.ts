import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/errors';

const ALL_OFF: Record<string, boolean> = {
  dashboard: false, obras: false, kanban: false, checklists: false, diario: false,
  recebimentos: false, seguranca: false, normas: false, instrucoes: false, ponto: false,
  orcamentos: false, organograma: false, configuracoes: false, admin: false,
  comprasDashboard: false, aditivos: false, contratacoes: false, atas: false,
  documentos: false, stakeholders: false, kickoff: false, raci: false,
  contratacaoPlano: false, histograma: false, gestao360: false,
};

const ALL_ON: Record<string, boolean> = Object.fromEntries(
  Object.keys(ALL_OFF).map(k => [k, true]),
);

/** Pacote de permissões "obra" — quem opera obras precisa de tudo isso pra
 *  preencher RDO, atas, checklists, contratos, etc. */
const OBRA_OPS: Record<string, boolean> = {
  ...ALL_OFF,
  dashboard: true, obras: true, kanban: true, checklists: true, diario: true,
  recebimentos: true, seguranca: true, normas: true, instrucoes: true, ponto: true,
  comprasDashboard: true, aditivos: true, contratacoes: true, atas: true,
  documentos: true, stakeholders: true, kickoff: true, raci: true,
  contratacaoPlano: true, histograma: true, gestao360: true,
};

/** Itens sensíveis exclusivos do sócio: salários (organograma), config de
 *  sistema, e gestão de usuários (admin). */
const SOCIO_ONLY: Record<string, boolean> = {
  organograma: false, configuracoes: false, admin: false,
};

const DEFAULT_PERMS: Record<string, Record<string, boolean>> = {
  socio:       { ...ALL_ON },
  diretoria:   { ...ALL_ON, ...SOCIO_ONLY },
  coordenacao: { ...ALL_ON, ...SOCIO_ONLY },
  pmo:         { ...OBRA_OPS, organograma: true },
  engenharia:  { ...OBRA_OPS },
  gestor:      { ...OBRA_OPS },
  financeiro:  { ...ALL_OFF, dashboard: true, obras: true, recebimentos: true, ponto: true, diario: true,
                 comprasDashboard: true, aditivos: true, contratacoes: true, documentos: true, gestao360: true },
  compras:     { ...ALL_OFF, dashboard: true, obras: true, recebimentos: true, ponto: true, diario: true,
                 comprasDashboard: true, contratacoes: true, contratacaoPlano: true, documentos: true },
  orcamentos:  { ...ALL_OFF, dashboard: true, orcamentos: true, ponto: true, diario: true },
  campo:       { ...ALL_OFF, dashboard: true, obras: true, ponto: true, diario: true, checklists: true,
                 atas: true, stakeholders: true, gestao360: true, seguranca: true },
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
      const baseDefaults = DEFAULT_PERMS[user.role] ?? ALL_OFF;
      const perms = customPerms && Object.keys(customPerms).length > 0
        ? { ...baseDefaults, ...customPerms }
        : baseDefaults;

      if (perms[moduleKey] === true) return next();

      // Log diagnóstico — quando algo dá 403, queremos saber o porquê
      console.warn(`[PERM 403] user=${req.user.userId} role=${user.role} module=${moduleKey} value=${perms[moduleKey]} hasCustom=${!!customPerms && Object.keys(customPerms ?? {}).length > 0}`);
      return next(AppError.forbidden('Sem permissão para acessar este módulo'));
    } catch (err) {
      next(err);
    }
  };
}
