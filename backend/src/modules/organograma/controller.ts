import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { sendSuccess } from '../../utils/response';

const INITIAL_DATA = [
  {
    id: 'node-1',
    nome: 'Bruno Di Benedetto',
    cargo: 'Diretoria Executiva',
    colorKey: 'diretoria',
    children: [
      {
        id: 'node-2',
        nome: 'Caroline Souza',
        cargo: 'Financeiro',
        colorKey: 'admin',
        children: [],
      },
      {
        id: 'node-3',
        nome: 'Emerson Machado',
        cargo: 'Compras',
        colorKey: 'admin',
        children: [
          { id: 'node-3a', nome: 'Lucas Rizzi', cargo: 'Compras', colorKey: 'campo', children: [] },
        ],
      },
      {
        id: 'node-4',
        nome: 'Bruna Lima',
        cargo: 'Orçamentos',
        colorKey: 'admin',
        children: [
          { id: 'node-4a', nome: 'Erico Ulisses', cargo: 'Orçamentos', colorKey: 'campo', children: [] },
        ],
      },
      {
        id: 'node-5',
        nome: 'Francisco Gritti',
        cargo: 'Diretor Operacional',
        colorKey: 'operacional',
        children: [
          {
            id: 'node-5a',
            nome: 'Pedro Rubens Dias',
            cargo: 'PMO',
            colorKey: 'coordenacao',
            children: [],
          },
          {
            id: 'node-5b',
            nome: 'Luís Nuin',
            cargo: 'Coordenação',
            colorKey: 'coordenacao',
            children: [
              {
                id: 'node-5b1',
                nome: 'Alisson Luan de Souza',
                cargo: 'Gestor de Obra',
                colorKey: 'gestor',
                children: [
                  {
                    id: 'node-grp1',
                    nome: 'Pool de Mestres',
                    cargo: '',
                    colorKey: 'campo',
                    isGroup: true,
                    children: [
                      { id: 'node-g1a', nome: 'Mestre 1', cargo: 'Mestre de Obras', colorKey: 'campo', children: [] },
                      { id: 'node-g1b', nome: 'Mestre 2', cargo: 'Mestre de Obras', colorKey: 'campo', children: [] },
                      { id: 'node-g1c', nome: 'Mestre 3', cargo: 'Mestre de Obras', colorKey: 'campo', children: [] },
                      { id: 'node-g1d', nome: 'Mestre 4', cargo: 'Mestre de Obras', colorKey: 'campo', children: [] },
                    ],
                  },
                  {
                    id: 'node-grp2',
                    nome: 'Equipe de Campo',
                    cargo: '',
                    colorKey: 'campo',
                    isGroup: true,
                    children: [
                      { id: 'node-g2a', nome: 'Campo 1', cargo: 'Equipe de Campo', colorKey: 'campo', children: [] },
                      { id: 'node-g2b', nome: 'Campo 2', cargo: 'Equipe de Campo', colorKey: 'campo', children: [] },
                      { id: 'node-g2c', nome: 'Campo 3', cargo: 'Equipe de Campo', colorKey: 'campo', children: [] },
                      { id: 'node-g2d', nome: 'Campo 4', cargo: 'Equipe de Campo', colorKey: 'campo', children: [] },
                    ],
                  },
                ],
              },
              {
                id: 'node-5b2',
                nome: 'Nayara Silva',
                cargo: 'Gestora de Obra',
                colorKey: 'gestor',
                children: [],
              },
            ],
          },
          {
            id: 'node-5c',
            nome: 'Christian Palermo',
            cargo: 'Coordenação',
            colorKey: 'coordenacao',
            children: [
              {
                id: 'node-5c1',
                nome: 'Cristiano Curbelo',
                cargo: 'Gestor de Contrato',
                colorKey: 'gestor',
                children: [],
              },
            ],
          },
        ],
      },
    ],
  },
];

export async function getOrgChart(_req: Request, res: Response) {
  let record = await (prisma as any).orgChart.findUnique({ where: { key: 'main' } });
  if (!record) {
    record = await (prisma as any).orgChart.create({
      data: { key: 'main', data: INITIAL_DATA },
    });
  }
  sendSuccess(res, record.data);
}

/** Quantas versões ficam guardadas (cada salvamento gera uma). */
const MAX_VERSOES = 300;

/** Guarda o estado atual como versão e poda o excedente. */
async function snapshotAtual(userId?: string) {
  const atual = await (prisma as any).orgChart.findUnique({ where: { key: 'main' } });
  if (!atual) return;
  await (prisma as any).orgChartVersion.create({
    data: { key: 'main', data: atual.data, savedById: userId ?? null },
  });
  const excedente = await (prisma as any).orgChartVersion.findMany({
    where: { key: 'main' },
    orderBy: { createdAt: 'desc' },
    skip: MAX_VERSOES,
    select: { id: true },
  });
  if (excedente.length) {
    await (prisma as any).orgChartVersion.deleteMany({
      where: { id: { in: excedente.map((v: { id: string }) => v.id) } },
    });
  }
}

export async function putOrgChart(req: Request, res: Response) {
  const { data } = req.body;
  // histórico: o estado que está sendo substituído vira uma versão restaurável
  await snapshotAtual(req.user?.userId);
  const record = await (prisma as any).orgChart.upsert({
    where: { key: 'main' },
    update: { data, updatedById: req.user?.userId },
    create: { key: 'main', data, updatedById: req.user?.userId },
  });
  sendSuccess(res, record.data);
}

/** Conta os cartões de uma árvore salva (pro rótulo do histórico). */
function contarNos(data: unknown): number {
  let n = 0;
  const anda = (node: any) => {
    if (!node) return;
    n += 1;
    for (const c of node.children ?? []) anda(c);
  };
  for (const raiz of Array.isArray(data) ? data : [data]) anda(raiz);
  return n;
}

export async function getVersoes(_req: Request, res: Response) {
  const versoes = await (prisma as any).orgChartVersion.findMany({
    where: { key: 'main' },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  sendSuccess(
    res,
    versoes.map((v: any) => ({ id: v.id, createdAt: v.createdAt, pessoas: contarNos(v.data) })),
  );
}

/** Restaura uma versão do histórico; o estado vigente vira versão (dá pra voltar). */
export async function restaurarVersao(req: Request, res: Response) {
  const versao = await (prisma as any).orgChartVersion.findUnique({ where: { id: req.params.id } });
  if (!versao) {
    res.status(404).json({ success: false, error: 'Versão não encontrada' });
    return;
  }
  await snapshotAtual(req.user?.userId);
  const record = await (prisma as any).orgChart.update({
    where: { key: 'main' },
    data: { data: versao.data, updatedById: req.user?.userId },
  });
  sendSuccess(res, record.data);
}
