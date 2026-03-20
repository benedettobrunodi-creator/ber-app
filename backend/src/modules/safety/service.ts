import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type {
  CreateAPRInput, UpdateAPRInput,
  CreateEPIInput,
  CreateIncidentInput, UpdateIncidentInput,
  CreateTrainingInput,
} from './types';

// ─── APR ────────────────────────────────────────────────────────────────────

export async function listAPRs(obraId: string) {
  return prisma.aPR.findMany({
    where: { obraId },
    include: {
      creator: { select: { id: true, name: true } },
      approver: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createAPR(obraId: string, userId: string, input: CreateAPRInput) {
  return prisma.aPR.create({
    data: {
      obraId,
      activityName: input.activityName,
      date: new Date(input.date),
      responsible: input.responsible,
      risks: input.risks,
      createdBy: userId,
    },
    include: {
      creator: { select: { id: true, name: true } },
    },
  });
}

export async function getAPR(id: string) {
  const apr = await prisma.aPR.findUnique({
    where: { id },
    include: {
      obra: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
      approver: { select: { id: true, name: true } },
    },
  });
  if (!apr) throw AppError.notFound('APR');
  return apr;
}

export async function updateAPR(id: string, input: UpdateAPRInput) {
  const apr = await prisma.aPR.findUnique({ where: { id } });
  if (!apr) throw AppError.notFound('APR');
  const data: any = { ...input };
  if (input.date) data.date = new Date(input.date);
  return prisma.aPR.update({ where: { id }, data });
}

export async function approveAPR(id: string, userId: string, status: string) {
  const apr = await prisma.aPR.findUnique({ where: { id } });
  if (!apr) throw AppError.notFound('APR');
  return prisma.aPR.update({
    where: { id },
    data: { status, approvedBy: userId },
  });
}

export async function deleteAPR(id: string) {
  const apr = await prisma.aPR.findUnique({ where: { id } });
  if (!apr) throw AppError.notFound('APR');
  await prisma.aPR.delete({ where: { id } });
}

// ─── EPI ────────────────────────────────────────────────────────────────────

export async function listEPIs(obraId: string) {
  return prisma.ePIControl.findMany({
    where: { obraId },
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: { deliveredAt: 'desc' },
  });
}

export async function createEPI(obraId: string, input: CreateEPIInput) {
  return prisma.ePIControl.create({
    data: {
      obraId,
      userId: input.userId,
      epiName: input.epiName,
      epiType: input.epiType,
      deliveredAt: new Date(input.deliveredAt),
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      quantity: input.quantity,
      caNumber: input.caNumber,
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });
}

export async function updateEPI(id: string, input: { returnedAt?: string; expiresAt?: string }) {
  const epi = await prisma.ePIControl.findUnique({ where: { id } });
  if (!epi) throw AppError.notFound('Registro de EPI');
  const data: any = {};
  if (input.returnedAt) data.returnedAt = new Date(input.returnedAt);
  if (input.expiresAt) data.expiresAt = new Date(input.expiresAt);
  return prisma.ePIControl.update({ where: { id }, data });
}

export async function getExpiringEPIs() {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return prisma.ePIControl.findMany({
    where: {
      returnedAt: null,
      expiresAt: { lte: thirtyDaysFromNow },
    },
    include: {
      user: { select: { id: true, name: true } },
      obra: { select: { id: true, name: true } },
    },
    orderBy: { expiresAt: 'asc' },
  });
}

export async function deleteEPI(id: string) {
  const epi = await prisma.ePIControl.findUnique({ where: { id } });
  if (!epi) throw AppError.notFound('Registro de EPI');
  await prisma.ePIControl.delete({ where: { id } });
}

// ─── Incidents ──────────────────────────────────────────────────────────────

export async function listIncidents(obraId: string) {
  return prisma.incident.findMany({
    where: { obraId },
    include: {
      reporter: { select: { id: true, name: true } },
      injured: { select: { id: true, name: true } },
    },
    orderBy: { occurredAt: 'desc' },
  });
}

export async function createIncident(obraId: string, userId: string, input: CreateIncidentInput) {
  return prisma.incident.create({
    data: {
      obraId,
      type: input.type,
      severity: input.severity,
      description: input.description,
      immediateAction: input.immediateAction,
      correctiveAction: input.correctiveAction,
      occurredAt: new Date(input.occurredAt),
      reportedBy: userId,
      injuredUserId: input.injuredUserId,
      photoUrls: input.photoUrls,
      status: input.status,
    },
    include: {
      reporter: { select: { id: true, name: true } },
      injured: { select: { id: true, name: true } },
    },
  });
}

export async function getIncident(id: string) {
  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      obra: { select: { id: true, name: true } },
      reporter: { select: { id: true, name: true } },
      injured: { select: { id: true, name: true } },
    },
  });
  if (!incident) throw AppError.notFound('Incidente');
  return incident;
}

export async function updateIncident(id: string, input: UpdateIncidentInput) {
  const incident = await prisma.incident.findUnique({ where: { id } });
  if (!incident) throw AppError.notFound('Incidente');
  const data: any = { ...input };
  if (input.occurredAt) data.occurredAt = new Date(input.occurredAt);
  return prisma.incident.update({
    where: { id },
    data,
    include: {
      reporter: { select: { id: true, name: true } },
      injured: { select: { id: true, name: true } },
    },
  });
}

export async function deleteIncident(id: string) {
  const incident = await prisma.incident.findUnique({ where: { id } });
  if (!incident) throw AppError.notFound('Incidente');
  await prisma.incident.delete({ where: { id } });
}

// ─── Trainings ──────────────────────────────────────────────────────────────

export async function listTrainings(filters?: { userId?: string; obraId?: string; nr?: string }) {
  const where: any = {};
  if (filters?.userId) where.userId = filters.userId;
  if (filters?.obraId) where.obraId = filters.obraId;
  if (filters?.nr) where.nr = filters.nr;
  return prisma.training.findMany({
    where,
    include: {
      user: { select: { id: true, name: true } },
      obra: { select: { id: true, name: true } },
    },
    orderBy: { completedAt: 'desc' },
  });
}

export async function createTraining(input: CreateTrainingInput) {
  return prisma.training.create({
    data: {
      userId: input.userId,
      obraId: input.obraId,
      trainingName: input.trainingName,
      provider: input.provider,
      nr: input.nr,
      completedAt: new Date(input.completedAt),
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      certificateUrl: input.certificateUrl,
    },
    include: {
      user: { select: { id: true, name: true } },
      obra: { select: { id: true, name: true } },
    },
  });
}

export async function getExpiringTrainings() {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return prisma.training.findMany({
    where: {
      expiresAt: { lte: thirtyDaysFromNow },
    },
    include: {
      user: { select: { id: true, name: true } },
      obra: { select: { id: true, name: true } },
    },
    orderBy: { expiresAt: 'asc' },
  });
}

export async function deleteTraining(id: string) {
  const training = await prisma.training.findUnique({ where: { id } });
  if (!training) throw AppError.notFound('Treinamento');
  await prisma.training.delete({ where: { id } });
}
