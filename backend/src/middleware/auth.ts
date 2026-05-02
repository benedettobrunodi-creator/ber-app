import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/errors';
import { validateKey } from '../modules/api-keys/service';
import { prisma } from '../config/database';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (apiKey) {
    validateKey(apiKey).then(key => {
      if (!key) return next(AppError.unauthorized('API Key inválida ou revogada'));
      return prisma.user.findUnique({ where: { id: key.createdById } }).then(user => {
        if (!user) return next(AppError.unauthorized());
        req.user = { userId: user.id, email: user.email, role: user.role };
        next();
      });
    }).catch(next);
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw AppError.unauthorized('Token não fornecido');
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    throw AppError.unauthorized();
  }
}
