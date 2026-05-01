import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateAlocacaoInput, UpdateAlocacaoInput } from './types';

const include = {
  user: { select: { id: true, name: true, role: true, avatarUrl: true } },
  recursoExterno: { select: { id: true, nome: true, funcao: true } },
  obra: {
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      expectedEndDate: true,
      dataInicioProjeto: true,
      dataFimProjeto: true,
      dataInicioObra: true,
      dataFimObra: true,
    },
  },
} as const;

export async function listAlocacoes() {
  return prisma.alocacao.findMany({ include, orderBy: { createdAt: 'desc' } });
}

export async function createAlocacao(data: CreateAlocacaoInput) {
  return prisma.alocacao.create({
    data: {
      userId: data.userId ?? null,
      recursoExternoId: data.recursoExternoId ?? null,
      obraId: data.obraId,
      cargoNaAlocacao: data.cargoNaAlocacao ?? 'gestor',
      fase: data.fase ?? 'ambas',
      dedicacaoPct: data.dedicacaoPct,
      dataInicio: data.dataInicio ? new Date(data.dataInicio) : null,
      dataFim: data.dataFim ? new Date(data.dataFim) : null,
    },
    include,
  });
}

export async function updateAlocacao(id: string, data: UpdateAlocacaoInput) {
  const existing = await prisma.alocacao.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Alocação');

  return prisma.alocacao.update({
    where: { id },
    data: {
      ...(data.userId !== undefined && { userId: data.userId }),
      ...(data.recursoExternoId !== undefined && { recursoExternoId: data.recursoExternoId }),
      ...(data.obraId !== undefined && { obraId: data.obraId }),
      ...(data.cargoNaAlocacao !== undefined && { cargoNaAlocacao: data.cargoNaAlocacao }),
      ...(data.fase !== undefined && { fase: data.fase }),
      ...(data.dedicacaoPct !== undefined && { dedicacaoPct: data.dedicacaoPct }),
      ...(data.dataInicio !== undefined && { dataInicio: data.dataInicio ? new Date(data.dataInicio) : null }),
      ...(data.dataFim !== undefined && { dataFim: data.dataFim ? new Date(data.dataFim) : null }),
    },
    include,
  });
}

export async function deleteAlocacao(id: string) {
  const existing = await prisma.alocacao.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Alocação');
  await prisma.alocacao.delete({ where: { id } });
}

export async function listConflitos() {
  const alocs = await prisma.alocacao.findMany({ include, orderBy: { createdAt: 'desc' } });

  type AlT = (typeof alocs)[number];

  function rStart(a: AlT): Date | null {
    if (a.dataInicio) return a.dataInicio;
    if (a.fase === 'projeto') return a.obra.dataInicioProjeto ?? null;
    if (a.fase === 'obra') return a.obra.dataInicioObra ?? a.obra.startDate ?? null;
    return a.obra.dataInicioProjeto ?? a.obra.dataInicioObra ?? a.obra.startDate ?? null;
  }

  function rEnd(a: AlT): Date | null {
    if (a.dataFim) return a.dataFim;
    if (a.fase === 'projeto') return a.obra.dataFimProjeto ?? null;
    if (a.fase === 'obra') return a.obra.dataFimObra ?? a.obra.expectedEndDate ?? null;
    return a.obra.dataFimObra ?? a.obra.expectedEndDate ?? null;
  }

  const byRecurso = new Map<string, AlT[]>();
  for (const a of alocs) {
    const key = a.userId ?? a.recursoExternoId ?? a.id;
    const list = byRecurso.get(key) ?? [];
    list.push(a);
    byRecurso.set(key, list);
  }

  const conflicts: {
    recursoKey: string;
    recursoName: string;
    totalPct: number;
    overlapStart: Date;
    overlapEnd: Date;
    alocacoes: AlT[];
  }[] = [];

  for (const [, as] of byRecurso.entries()) {
    if (as.length < 2) continue;
    for (let i = 0; i < as.length; i++) {
      for (let j = i + 1; j < as.length; j++) {
        const a = as[i];
        const b = as[j];
        const phasesOverlap =
          a.fase === 'ambas' || b.fase === 'ambas' || a.fase === b.fase;
        if (!phasesOverlap) continue;
        const aS = rStart(a);
        const aE = rEnd(a);
        const bS = rStart(b);
        const bE = rEnd(b);
        if (!aS || !aE || !bS || !bE) continue;
        if (aS <= bE && bS <= aE) {
          const totalPct = a.dedicacaoPct + b.dedicacaoPct;
          if (totalPct > 100) {
            conflicts.push({
              recursoKey: a.userId ?? a.recursoExternoId ?? a.id,
              recursoName: a.user?.name ?? a.recursoExterno?.nome ?? '—',
              totalPct,
              overlapStart: new Date(Math.max(aS.getTime(), bS.getTime())),
              overlapEnd: new Date(Math.min(aE.getTime(), bE.getTime())),
              alocacoes: [a, b],
            });
          }
        }
      }
    }
  }

  return conflicts;
}
