import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../utils/errors';

export async function getAll(_req: Request, res: Response, next: NextFunction) {
  try {
    const values = await prisma.dreValue.findMany({
      orderBy: [{ rowKey: 'asc' }, { colKey: 'asc' }],
    });
    sendSuccess(res, values);
  } catch (err) {
    next(err);
  }
}

export async function bulkUpsert(req: Request, res: Response, next: NextFunction) {
  try {
    const items = req.body as Array<{ rowKey: string; colKey: string; value: number; kpi?: number | null }>;

    if (!Array.isArray(items) || items.length === 0) {
      throw AppError.badRequest('Body deve ser um array não-vazio de {rowKey, colKey, value, kpi?}');
    }

    const userId = (req as any).user?.userId;

    const ops = items.map((item) =>
      prisma.dreValue.upsert({
        where: { rowKey_colKey: { rowKey: item.rowKey, colKey: item.colKey } },
        update: { value: item.value, kpi: item.kpi ?? undefined, updatedBy: userId },
        create: { rowKey: item.rowKey, colKey: item.colKey, value: item.value, kpi: item.kpi ?? undefined, updatedBy: userId },
      })
    );

    const results = await prisma.$transaction(ops);
    sendSuccess(res, results);
  } catch (err) {
    next(err);
  }
}
