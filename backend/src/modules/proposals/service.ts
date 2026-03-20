import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import { fetchAllDeals, mapAgendorStatus, type AgendorDeal } from '../../services/agendor';
import type { CreateProposalInput, UpdateProposalInput } from './types';

export async function listProposals(page: number, limit: number, status?: string) {
  const skip = (page - 1) * limit;
  const where: any = {};
  if (status) where.status = status;

  const [proposals, total] = await Promise.all([
    prisma.proposal.findMany({
      where,
      include: { creator: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.proposal.count({ where }),
  ]);
  return { proposals, total };
}

export async function getProposalById(id: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true } },
      meetings: true,
    },
  });
  if (!proposal) throw AppError.notFound('Proposta');
  return proposal;
}

export async function createProposal(createdBy: string, input: CreateProposalInput) {
  return prisma.proposal.create({
    data: {
      clientName: input.clientName,
      title: input.title,
      value: input.value,
      status: input.status,
      sentDate: input.sentDate ? new Date(input.sentDate) : undefined,
      notes: input.notes,
      createdBy,
    },
    include: { creator: { select: { id: true, name: true } } },
  });
}

export async function updateProposal(id: string, input: UpdateProposalInput) {
  const existing = await prisma.proposal.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Proposta');

  const data: any = { ...input };
  if (input.sentDate !== undefined) data.sentDate = input.sentDate ? new Date(input.sentDate) : null;
  if (input.closedDate !== undefined) data.closedDate = input.closedDate ? new Date(input.closedDate) : null;

  return prisma.proposal.update({
    where: { id },
    data,
    include: { creator: { select: { id: true, name: true } } },
  });
}

export async function getStats() {
  const [statusCounts, totalValue, wonValue, monthlyData] = await Promise.all([
    prisma.proposal.groupBy({
      by: ['status'],
      _count: true,
    }),
    prisma.proposal.aggregate({
      _sum: { value: true },
    }),
    prisma.proposal.aggregate({
      where: { status: 'ganha' },
      _sum: { value: true },
    }),
    prisma.proposal.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
      _count: true,
    }),
  ]);

  const pipeline: Record<string, number> = {};
  for (const sc of statusCounts) {
    pipeline[sc.status] = sc._count;
  }

  const total = statusCounts.reduce((acc, sc) => acc + sc._count, 0);
  const won = pipeline['ganha'] || 0;

  return {
    pipeline,
    total,
    totalValue: totalValue._sum.value,
    wonValue: wonValue._sum.value,
    conversionRate: total > 0 ? ((won / total) * 100).toFixed(1) : '0',
    thisMonth: monthlyData.reduce((acc, m) => acc + m._count, 0),
  };
}

// ─── Agendor Sync ────────────────────────────────────────────────────────────

function buildProposalData(deal: AgendorDeal) {
  const status = mapAgendorStatus(deal);
  const closedDate = deal.wonAt || deal.lostAt;
  const isSent = ['enviada_alta', 'enviada_media', 'enviada_baixa', 'ganha', 'perdida'].includes(status);

  return {
    agendorDealId: String(deal.id),
    clientName: deal.organization?.name || 'Cliente não informado',
    title: deal.title,
    value: deal.value ?? undefined,
    status,
    sentDate: isSent && deal.startTime ? new Date(deal.startTime) : undefined,
    closedDate: closedDate ? new Date(closedDate) : undefined,
    agendorStageName: deal.dealStage.name,
    agendorFunnelName: deal.dealStage.funnel?.name || null,
    agendorWebUrl: deal._webUrl,
    agendorUpdatedAt: new Date(deal.updatedAt),
  };
}

export async function syncFromAgendor() {
  console.log('[Agendor Sync] Iniciando sincronização...');
  const startTime = Date.now();

  let deals: AgendorDeal[];
  try {
    deals = await fetchAllDeals();
  } catch (err) {
    console.error('[Agendor Sync] Erro ao buscar deals:', (err as Error).message);
    throw AppError.internal(`Falha ao conectar com Agendor: ${(err as Error).message}`);
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const deal of deals) {
    try {
      const data = buildProposalData(deal);
      const dealId = String(deal.id);

      const existing = await prisma.proposal.findUnique({
        where: { agendorDealId: dealId },
      });

      if (existing) {
        await prisma.proposal.update({
          where: { agendorDealId: dealId },
          data,
        });
        updated++;
      } else {
        await prisma.proposal.create({ data });
        created++;
      }
    } catch (err) {
      const msg = `Deal ${deal.id} (${deal.title}): ${(err as Error).message}`;
      console.error(`[Agendor Sync] Erro: ${msg}`);
      errors.push(msg);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Agendor Sync] Concluído em ${elapsed}s — ${created} criados, ${updated} atualizados, ${errors.length} erros`);

  return {
    synced: created + updated,
    created,
    updated,
    errors: errors.length > 0 ? errors : undefined,
    totalDeals: deals.length,
    elapsed: `${elapsed}s`,
  };
}

// ─── Agendor Stats ───────────────────────────────────────────────────────────

export async function getAgendorStats() {
  const proposals = await prisma.proposal.findMany({
    where: { agendorDealId: { not: null } },
    select: {
      status: true,
      value: true,
      agendorStageName: true,
      agendorFunnelName: true,
    },
  });

  const byStage: Record<string, { count: number; value: number }> = {};
  const byStatus: Record<string, { count: number; value: number }> = {};

  for (const p of proposals) {
    const stage = p.agendorStageName || 'Sem stage';
    if (!byStage[stage]) byStage[stage] = { count: 0, value: 0 };
    byStage[stage].count++;
    byStage[stage].value += Number(p.value || 0);

    if (!byStatus[p.status]) byStatus[p.status] = { count: 0, value: 0 };
    byStatus[p.status].count++;
    byStatus[p.status].value += Number(p.value || 0);
  }

  return {
    total: proposals.length,
    byStage,
    byStatus,
  };
}
