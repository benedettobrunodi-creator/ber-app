import { Request, Response } from 'express';
import * as service from './service';

export async function list(req: Request, res: Response) {
  const data = await service.listByObra(req.params.obraId);
  res.json({ data });
}
/** Usuários ativos da plataforma — pro modal "Novo contato" puxar nome/e-mail
 *  quando a empresa selecionada é a BÈR (pedido Bruno 03/09). */
export async function usuariosBer(_req: Request, res: Response) {
  const { prisma } = await import('../../config/database');
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  });
  res.json({ data: users });
}

export async function create(req: Request, res: Response) {
  const data = await service.create(req.params.obraId, req.body);
  res.status(201).json({ data });
}
export async function update(req: Request, res: Response) {
  const data = await service.update(req.params.id, req.body);
  res.json({ data });
}
export async function remove(req: Request, res: Response) {
  await service.remove(req.params.id);
  res.status(204).end();
}
