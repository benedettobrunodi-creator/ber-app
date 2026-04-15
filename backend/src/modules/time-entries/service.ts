import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CheckinInput, CheckoutInput } from './types';

export async function checkin(userId: string, input: CheckinInput) {
  // Check if user is already checked in
  const lastEntry = await prisma.timeEntry.findFirst({
    where: { userId },
    orderBy: { timestamp: 'desc' },
  });

  if (lastEntry && lastEntry.type === 'checkin') {
    throw AppError.badRequest('Você já está com check-in ativo. Faça checkout primeiro.');
  }

  return prisma.timeEntry.create({
    data: {
      userId,
      obraId: input.obraId,
      type: 'checkin',
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address,
      notes: input.notes,
    },
    include: {
      obra: { select: { id: true, name: true } },
    },
  });
}

export async function checkout(userId: string, input: CheckoutInput) {
  const lastEntry = await prisma.timeEntry.findFirst({
    where: { userId },
    orderBy: { timestamp: 'desc' },
  });

  if (!lastEntry || lastEntry.type !== 'checkin') {
    throw AppError.badRequest('Nenhum check-in ativo encontrado.');
  }

  return prisma.timeEntry.create({
    data: {
      userId,
      obraId: lastEntry.obraId,
      type: 'checkout',
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address,
      notes: input.notes,
    },
    include: {
      obra: { select: { id: true, name: true } },
    },
  });
}

export async function getMyEntries(userId: string, page: number, limit: number, month?: string) {
  const skip = (page - 1) * limit;
  const where: any = { userId };

  if (month) {
    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(year, m - 1, 1);
    const endDate = new Date(year, m, 1);
    where.timestamp = { gte: startDate, lt: endDate };
  }

  const [entries, total] = await Promise.all([
    prisma.timeEntry.findMany({
      where,
      include: { obra: { select: { id: true, name: true } } },
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    }),
    prisma.timeEntry.count({ where }),
  ]);
  return { entries, total };
}

export async function getMyStatus(userId: string) {
  const lastEntry = await prisma.timeEntry.findFirst({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    include: { obra: { select: { id: true, name: true } } },
  });

  const isCheckedIn = lastEntry?.type === 'checkin';
  return {
    isCheckedIn,
    lastEntry: lastEntry || null,
    checkedInSince: isCheckedIn ? lastEntry.timestamp : null,
  };
}

export async function getAllEntries(page: number, limit: number, filters: { userId?: string; obraId?: string; month?: string }) {
  const skip = (page - 1) * limit;
  const where: any = {};

  if (filters.userId) where.userId = filters.userId;
  if (filters.obraId) where.obraId = filters.obraId;
  if (filters.month) {
    const [year, m] = filters.month.split('-').map(Number);
    const startDate = new Date(year, m - 1, 1);
    const endDate = new Date(year, m, 1);
    where.timestamp = { gte: startDate, lt: endDate };
  }

  const [entries, total] = await Promise.all([
    prisma.timeEntry.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        obra: { select: { id: true, name: true } },
      },
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    }),
    prisma.timeEntry.count({ where }),
  ]);
  return { entries, total };
}

export async function getActiveWorkers() {
  // Find users whose last entry is a checkin
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      timeEntries: {
        orderBy: { timestamp: 'desc' },
        take: 1,
        include: { obra: { select: { id: true, name: true } } },
      },
    },
  });

  return users
    .filter((u) => u.timeEntries[0]?.type === 'checkin')
    .map((u) => ({
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      checkedInAt: u.timeEntries[0].timestamp,
      obra: u.timeEntries[0].obra,
    }));
}

export async function getMonthlyReport(month: string, userId?: string, obraId?: string) {
  const [year, m] = month.split('-').map(Number);
  const startDate = new Date(year, m - 1, 1);
  const endDate = new Date(year, m, 1);

  const where: any = {
    timestamp: { gte: startDate, lt: endDate },
  };
  if (userId) where.userId = userId;
  if (obraId) where.obraId = obraId;

  const entries = await prisma.timeEntry.findMany({
    where,
    include: {
      user: { select: { id: true, name: true } },
      obra: { select: { id: true, name: true } },
    },
    orderBy: [{ userId: 'asc' }, { timestamp: 'asc' }],
  });

  // Group by user and calculate hours
  const report: Record<string, { user: any; totalHours: number; days: number; entries: any[] }> = {};

  for (const entry of entries) {
    const key = entry.userId;
    if (!report[key]) {
      report[key] = { user: entry.user, totalHours: 0, days: 0, entries: [] };
    }
    report[key].entries.push(entry);
  }

  // Calculate hours from checkin/checkout pairs
  for (const data of Object.values(report)) {
    const checkins = data.entries.filter((e: any) => e.type === 'checkin');
    const checkouts = data.entries.filter((e: any) => e.type === 'checkout');
    const workDays = new Set<string>();

    for (const ci of checkins) {
      const co = checkouts.find(
        (c: any) => c.timestamp > ci.timestamp && c.userId === ci.userId,
      );
      if (co) {
        const hours = (new Date(co.timestamp).getTime() - new Date(ci.timestamp).getTime()) / (1000 * 60 * 60);
        data.totalHours += hours;
      }
      workDays.add(new Date(ci.timestamp).toISOString().split('T')[0]);
    }
    data.days = workDays.size;
    data.totalHours = Math.round(data.totalHours * 100) / 100;
    delete (data as any).entries;
  }

  return Object.values(report);
}

export async function exportTimeEntries(params: { userIds?: string[]; startDate: string; endDate: string }) {
  const where: any = {
    timestamp: {
      gte: new Date(params.startDate),
      lte: new Date(params.endDate + 'T23:59:59.999Z'),
    },
  };

  if (params.userIds && params.userIds.length > 0) {
    where.userId = { in: params.userIds };
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    include: {
      user: { select: { id: true, name: true } },
      obra: { select: { id: true, name: true } },
    },
    orderBy: [{ userId: 'asc' }, { timestamp: 'asc' }],
  });

  // Group by user
  const grouped: Record<string, { userName: string; pairs: any[] }> = {};

  for (const entry of entries) {
    if (!grouped[entry.userId]) {
      grouped[entry.userId] = { userName: (entry as any).user?.name || entry.userId, pairs: [] };
    }
  }

  // Build checkin/checkout pairs per user
  for (const userId of Object.keys(grouped)) {
    const userEntries = entries.filter((e) => e.userId === userId);
    const checkins = userEntries.filter((e) => e.type === 'checkin');

    for (const ci of checkins) {
      const co = userEntries.find(
        (e) => e.type === 'checkout' && e.timestamp > ci.timestamp,
      );

      const checkinTime = new Date(ci.timestamp);
      const checkoutTime = co ? new Date(co.timestamp) : null;
      let totalHours = '';
      if (checkoutTime) {
        const diffMs = checkoutTime.getTime() - checkinTime.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        totalHours = `${hours}h${minutes.toString().padStart(2, '0')}min`;
      }

      grouped[userId].pairs.push({
        data: checkinTime.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        entrada: checkinTime.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }),
        saida: checkoutTime
          ? checkoutTime.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
          : '',
        totalHoras: totalHours,
        obra: (ci as any).obra?.name || 'Escritório',
        endereco: ci.address || '',
        latEntrada: ci.latitude != null ? String(ci.latitude) : '',
        lngEntrada: ci.longitude != null ? String(ci.longitude) : '',
        enderecoSaida: co?.address || '',
        latSaida: co?.latitude != null ? String(co.latitude) : '',
        lngSaida: co?.longitude != null ? String(co.longitude) : '',
      });
    }
  }

  return grouped;
}

export async function deleteEntry(id: string) {
  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry) throw AppError.notFound('Registro de ponto');
  await prisma.timeEntry.delete({ where: { id } });
}
