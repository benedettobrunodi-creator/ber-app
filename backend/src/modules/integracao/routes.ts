// Integração BÈR OS → BÈR App (04/10/26): busca read-only pro campo único
// do BÈR OS. Chamada servidor-a-servidor com API Key de nível diretoria;
// o e-mail identifica QUEM busca e o escopo segue as regras do app:
// coordenação pra cima vê tudo, o resto só as obras onde é membro.
import { Router } from 'express';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { ROLE_HIERARCHY } from '../../config/constants';
import type { Role } from '../../config/constants';

const router = Router();

router.get('/busca', authenticate, requireRole('diretoria'), async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 100);
  const email = String(req.query.email ?? '').trim().toLowerCase();
  if (q.length < 2 || !email) return res.json({ obras: [], documentos: [] });

  const usuario = await prisma.user.findUnique({ where: { email } });
  if (!usuario || !usuario.isActive) return res.json({ obras: [], documentos: [], semVinculo: true });

  // Escopo de obras: nível >= coordenação vê tudo; demais, só onde é membro
  const nivel = ROLE_HIERARCHY[usuario.role as Role] ?? 0;
  let obraIds: string[] | null = null; // null = sem restrição
  if (nivel < 3) {
    const membros = await prisma.obraMember.findMany({ where: { userId: usuario.id }, select: { obraId: true } });
    obraIds = membros.map(m => m.obraId);
    if (obraIds.length === 0) return res.json({ obras: [], documentos: [] });
  }
  const filtroObra = obraIds ? { id: { in: obraIds } } : {};
  const filtroObraId = obraIds ? { obraId: { in: obraIds } } : {};

  const [obras, projetoDocs, obraDocs] = await Promise.all([
    prisma.obra.findMany({
      where: {
        ...filtroObra,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { client: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: { id: true, name: true, client: true, status: true },
    }),
    prisma.projetoDocumento.findMany({
      where: {
        ...filtroObraId,
        obsoleto: false,
        OR: [
          { codigo: { contains: q, mode: 'insensitive' } },
          { titulo: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 8,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, codigo: true, titulo: true, disciplina: true, obraId: true, obra: { select: { name: true } } },
    }),
    prisma.obraDocumento.findMany({
      where: { ...filtroObraId, nome: { contains: q, mode: 'insensitive' } },
      take: 8,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, nome: true, tipo: true, obraId: true, obra: { select: { name: true } } },
    }),
  ]);

  res.json({
    obras: obras.map(o => ({ id: o.id, nome: o.name, cliente: o.client, status: o.status })),
    documentos: [
      ...projetoDocs.map(d => ({
        id: d.id, nome: d.titulo ? `${d.codigo} — ${d.titulo}` : d.codigo,
        detalhe: d.disciplina, obraId: d.obraId, obraNome: d.obra.name, origem: 'projeto' as const,
      })),
      ...obraDocs.map(d => ({
        id: d.id, nome: d.nome, detalhe: d.tipo, obraId: d.obraId, obraNome: d.obra.name, origem: 'gestao' as const,
      })),
    ].slice(0, 10),
  });
});

export default router;
