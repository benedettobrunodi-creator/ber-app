import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/errors';

/** Edit guard for per-obra modules under Gestão 360.
 *  Allows the request when the authenticated user is the obra's coordinator,
 *  a member, or has the `socio`/`admin` role.
 *  Must run after `authenticate` (req.user) and after the route has :obraId.
 *  Read endpoints should not use this — they keep the global module permission. */
export async function obraMemberOnly(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(AppError.unauthorized());

    const obraId = req.params.obraId || req.params.id;
    if (!obraId) return next(AppError.badRequest('obraId ausente na rota'));

    if (req.user.role === 'socio') return next();

    const fresh = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { role: true, permissions: true },
    });
    if (!fresh) return next(AppError.unauthorized());

    // Bypass para roles de gestão da empresa (visão global, não precisam
    // estar listados como membro/coordenador de cada obra individual).
    if (fresh.role === 'diretoria' || fresh.role === 'coordenacao') return next();

    const perms = (fresh.permissions as Record<string, boolean> | null) ?? {};
    if (perms.admin === true) return next();

    const [coord, member] = await Promise.all([
      prisma.obra.findFirst({ where: { id: obraId, coordinatorId: req.user.userId }, select: { id: true } }),
      prisma.obraMember.findUnique({
        where: { obraId_userId: { obraId, userId: req.user.userId } },
        select: { id: true },
      }),
    ]);

    if (coord || member) return next();

    return next(AppError.forbidden('Você precisa ser coordenador ou membro desta obra para editar'));
  } catch (err) {
    next(err);
  }
}
