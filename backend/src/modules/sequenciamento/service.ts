import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type {
  CreateSequenciamentoInput,
  StartEtapaInput,
  SubmitEtapaInput,
  ApproveEtapaInput,
  RejectEtapaInput,
  UpdateEtapaInput,
  ReorderEtapasInput,
  AddEtapaInput,
} from './types';

const etapaInclude = {
  submitter: { select: { id: true, name: true } },
  approver: { select: { id: true, name: true } },
  rejecter: { select: { id: true, name: true } },
};

const seqInclude = {
  template: { select: { id: true, name: true, segment: true } },
  creator: { select: { id: true, name: true } },
  etapas: {
    orderBy: { order: 'asc' as const },
    include: etapaInclude,
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

async function getSeqOrThrow(obraId: string) {
  const seq = await prisma.obraSequenciamento.findUnique({
    where: { obraId },
  });
  if (!seq) throw AppError.notFound('Sequenciamento');
  return seq;
}

function assertNotFrozen(seq: { frozenAt: Date | null }) {
  if (seq.frozenAt) {
    throw AppError.badRequest(
      'Sequenciamento já foi congelado e não pode ser editado',
      'SEQ_FROZEN',
    );
  }
}

// ─── Templates ─────────────────────────────────────────────────────────────

export async function listTemplates() {
  return prisma.sequenciamentoTemplate.findMany({
    include: {
      etapas: { orderBy: { order: 'asc' } },
    },
    orderBy: { name: 'asc' },
  });
}

// ─── Sequenciamento ────────────────────────────────────────────────────────

export async function createSequenciamento(
  obraId: string,
  userId: string,
  input: CreateSequenciamentoInput,
) {
  const existing = await prisma.obraSequenciamento.findUnique({
    where: { obraId },
  });
  if (existing) {
    throw AppError.conflict('Esta obra já possui um sequenciamento');
  }

  const template = await prisma.sequenciamentoTemplate.findUnique({
    where: { id: input.templateId },
    include: { etapas: { orderBy: { order: 'asc' } } },
  });
  if (!template) {
    throw AppError.notFound('Template de sequenciamento');
  }

  const sequenciamento = await prisma.obraSequenciamento.create({
    data: {
      obraId,
      templateId: input.templateId,
      createdBy: userId,
      etapas: {
        create: template.etapas.map((etapa) => ({
          obraId,
          templateEtapaId: etapa.id,
          name: etapa.name,
          discipline: etapa.discipline,
          order: etapa.order,
          estimatedDays: etapa.estimatedDays,
          dependsOn: etapa.dependsOn,
          status: 'nao_iniciada',
        })),
      },
    },
    include: seqInclude,
  });

  return sequenciamento;
}

export async function getSequenciamento(obraId: string) {
  return prisma.obraSequenciamento.findUnique({
    where: { obraId },
    include: seqInclude,
  });
}

// ─── Edit mode (pre-freeze) ───────────────────────────────────────────────

export async function updateEtapa(
  obraId: string,
  etapaId: string,
  input: UpdateEtapaInput,
) {
  const seq = await getSeqOrThrow(obraId);
  assertNotFrozen(seq);

  const etapa = await prisma.obraEtapa.findFirst({
    where: { id: etapaId, obraId },
  });
  if (!etapa) throw AppError.notFound('Etapa');

  return prisma.obraEtapa.update({
    where: { id: etapaId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.estimatedDays !== undefined && { estimatedDays: input.estimatedDays }),
    },
    include: etapaInclude,
  });
}

export async function reorderEtapas(
  obraId: string,
  input: ReorderEtapasInput,
) {
  const seq = await getSeqOrThrow(obraId);
  assertNotFrozen(seq);

  // Update order for each etapa based on array position
  await prisma.$transaction(
    input.etapaIds.map((id, idx) =>
      prisma.obraEtapa.updateMany({
        where: { id, obraId },
        data: { order: idx + 1 },
      }),
    ),
  );

  return getSequenciamento(obraId);
}

export async function addEtapa(
  obraId: string,
  input: AddEtapaInput,
) {
  const seq = await getSeqOrThrow(obraId);
  assertNotFrozen(seq);

  // Shift existing etapas at or after the target position
  await prisma.obraEtapa.updateMany({
    where: {
      sequenciamentoId: seq.id,
      order: { gte: input.order },
    },
    data: { order: { increment: 1 } },
  });

  await prisma.obraEtapa.create({
    data: {
      sequenciamentoId: seq.id,
      obraId,
      name: input.name,
      discipline: input.discipline,
      estimatedDays: input.estimatedDays,
      order: input.order,
      status: 'nao_iniciada',
    },
  });

  return getSequenciamento(obraId);
}

export async function removeEtapa(
  obraId: string,
  etapaId: string,
) {
  const seq = await getSeqOrThrow(obraId);
  assertNotFrozen(seq);

  const etapa = await prisma.obraEtapa.findFirst({
    where: { id: etapaId, obraId },
  });
  if (!etapa) throw AppError.notFound('Etapa');

  await prisma.obraEtapa.delete({ where: { id: etapaId } });

  // Re-compact order numbers
  const remaining = await prisma.obraEtapa.findMany({
    where: { sequenciamentoId: seq.id },
    orderBy: { order: 'asc' },
  });
  await prisma.$transaction(
    remaining.map((e, idx) =>
      prisma.obraEtapa.update({
        where: { id: e.id },
        data: { order: idx + 1 },
      }),
    ),
  );

  return getSequenciamento(obraId);
}

export async function freezeSequenciamento(obraId: string) {
  const seq = await getSeqOrThrow(obraId);
  assertNotFrozen(seq);

  // Ensure no etapa has been started yet
  const started = await prisma.obraEtapa.findFirst({
    where: {
      sequenciamentoId: seq.id,
      status: { not: 'nao_iniciada' },
    },
  });
  if (started) {
    throw AppError.badRequest(
      'Não é possível congelar — existem etapas já iniciadas',
      'ETAPAS_STARTED',
    );
  }

  return prisma.obraSequenciamento.update({
    where: { id: seq.id },
    data: { frozenAt: new Date() },
    include: seqInclude,
  });
}

// ─── Etapa actions (post-freeze) ──────────────────────────────────────────

async function getEtapaOrThrow(obraId: string, etapaId: string) {
  const etapa = await prisma.obraEtapa.findFirst({
    where: { id: etapaId, obraId },
    include: etapaInclude,
  });
  if (!etapa) throw AppError.notFound('Etapa');
  return etapa;
}

async function checkDependencies(etapa: { sequenciamentoId: string; dependsOn: string[] }) {
  if (etapa.dependsOn.length === 0) return;

  const dependencies = await prisma.obraEtapa.findMany({
    where: {
      sequenciamentoId: etapa.sequenciamentoId,
      templateEtapaId: { in: etapa.dependsOn },
    },
  });

  const notApproved = dependencies.filter((d) => d.status !== 'aprovada');
  if (notApproved.length > 0) {
    const names = notApproved.map((d) => d.name).join(', ');
    throw AppError.badRequest(
      `Etapas dependentes não aprovadas: ${names}`,
      'DEPENDENCIES_NOT_MET',
    );
  }
}

export async function startEtapa(
  obraId: string,
  etapaId: string,
  _userId: string,
  input: StartEtapaInput,
) {
  const etapa = await getEtapaOrThrow(obraId, etapaId);

  if (etapa.status !== 'nao_iniciada') {
    throw AppError.badRequest('Etapa já foi iniciada');
  }

  await checkDependencies(etapa);

  const now = new Date();
  const estimatedEnd = new Date(now);
  estimatedEnd.setDate(estimatedEnd.getDate() + etapa.estimatedDays);

  return prisma.obraEtapa.update({
    where: { id: etapaId },
    data: {
      status: 'em_andamento',
      startDate: now,
      estimatedEndDate: estimatedEnd,
      gestorNotes: input.gestorNotes,
    },
    include: etapaInclude,
  });
}

export async function submitEtapa(
  obraId: string,
  etapaId: string,
  userId: string,
  input: SubmitEtapaInput,
) {
  const etapa = await getEtapaOrThrow(obraId, etapaId);

  if (etapa.status !== 'em_andamento') {
    throw AppError.badRequest('Etapa precisa estar em andamento para enviar para aprovação');
  }

  const now = new Date();

  return prisma.obraEtapa.update({
    where: { id: etapaId },
    data: {
      status: 'aguardando_aprovacao',
      gestorNotes: input.gestorNotes,
      evidenciaDescricao: input.evidenciaDescricao ?? null,
      evidenciaFotos: input.evidenciaFotos ?? [],
      evidenciaRegistradaEm: input.evidenciaDescricao || (input.evidenciaFotos && input.evidenciaFotos.length > 0) ? now : null,
      submittedBy: userId,
      submittedAt: now,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
    },
    include: etapaInclude,
  });
}

export async function approveEtapa(
  obraId: string,
  etapaId: string,
  userId: string,
  input: ApproveEtapaInput,
) {
  const etapa = await getEtapaOrThrow(obraId, etapaId);

  if (etapa.status !== 'aguardando_aprovacao') {
    throw AppError.badRequest('Etapa precisa estar aguardando aprovação');
  }

  return prisma.obraEtapa.update({
    where: { id: etapaId },
    data: {
      status: 'aprovada',
      endDate: new Date(),
      coordenadorNotes: input.coordenadorNotes,
      approvedBy: userId,
      approvedAt: new Date(),
    },
    include: etapaInclude,
  });
}

export async function rejectEtapa(
  obraId: string,
  etapaId: string,
  userId: string,
  input: RejectEtapaInput,
) {
  const etapa = await getEtapaOrThrow(obraId, etapaId);

  if (etapa.status !== 'aguardando_aprovacao') {
    throw AppError.badRequest('Etapa precisa estar aguardando aprovação');
  }

  return prisma.obraEtapa.update({
    where: { id: etapaId },
    data: {
      status: 'em_andamento',
      coordenadorNotes: input.coordenadorNotes,
      rejectedBy: userId,
      rejectedAt: new Date(),
      rejectionReason: input.rejectionReason,
      approvedBy: null,
      approvedAt: null,
      endDate: null,
    },
    include: etapaInclude,
  });
}
