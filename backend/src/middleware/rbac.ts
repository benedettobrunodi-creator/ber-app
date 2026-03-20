import { Request, Response, NextFunction } from 'express';
import { Role, ROLE_HIERARCHY } from '../config/constants';
import { AppError } from '../utils/errors';

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw AppError.unauthorized();
    }

    const userRole = req.user.role as Role;
    const userLevel = ROLE_HIERARCHY[userRole] || 0;

    // User has access if their role is in the allowed list OR their role level is >= the minimum required
    const minRequiredLevel = Math.min(...allowedRoles.map((r) => ROLE_HIERARCHY[r]));
    if (userLevel >= minRequiredLevel) {
      return next();
    }

    throw AppError.forbidden();
  };
}
