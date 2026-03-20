import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import * as safetyService from './service';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';
import { prisma } from '../../config/database';

// ─── APR ──────────────────────────
export async function listAPRs(req: Request, res: Response) {
  const aprs = await safetyService.listAPRs(req.params.id);
  sendSuccess(res, aprs);
}
export async function createAPR(req: Request, res: Response) {
  const apr = await safetyService.createAPR(req.params.id, req.user!.userId, req.body);
  sendCreated(res, apr);
}
export async function getAPR(req: Request, res: Response) {
  const apr = await safetyService.getAPR(req.params.id);
  sendSuccess(res, apr);
}
export async function updateAPR(req: Request, res: Response) {
  const apr = await safetyService.updateAPR(req.params.id, req.body);
  sendSuccess(res, apr);
}
export async function approveAPR(req: Request, res: Response) {
  const apr = await safetyService.approveAPR(req.params.id, req.user!.userId, req.body.status);
  sendSuccess(res, apr);
}
export async function deleteAPR(req: Request, res: Response) {
  await safetyService.deleteAPR(req.params.id);
  sendNoContent(res);
}

// ─── EPI ──────────────────────────
export async function listEPIs(req: Request, res: Response) {
  const epis = await safetyService.listEPIs(req.params.id);
  sendSuccess(res, epis);
}
export async function createEPI(req: Request, res: Response) {
  const epi = await safetyService.createEPI(req.params.id, req.body);
  sendCreated(res, epi);
}
export async function updateEPI(req: Request, res: Response) {
  const epi = await safetyService.updateEPI(req.params.id, req.body);
  sendSuccess(res, epi);
}
export async function getExpiringEPIs(_req: Request, res: Response) {
  const epis = await safetyService.getExpiringEPIs();
  sendSuccess(res, epis);
}
export async function deleteEPI(req: Request, res: Response) {
  await safetyService.deleteEPI(req.params.id);
  sendNoContent(res);
}

// ─── Incidents ────────────────────
export async function listIncidents(req: Request, res: Response) {
  const incidents = await safetyService.listIncidents(req.params.id);
  sendSuccess(res, incidents);
}
export async function createIncident(req: Request, res: Response) {
  const incident = await safetyService.createIncident(req.params.id, req.user!.userId, req.body);
  sendCreated(res, incident);
}
export async function getIncident(req: Request, res: Response) {
  const incident = await safetyService.getIncident(req.params.id);
  sendSuccess(res, incident);
}
export async function updateIncident(req: Request, res: Response) {
  const incident = await safetyService.updateIncident(req.params.id, req.body);
  sendSuccess(res, incident);
}
export async function deleteIncident(req: Request, res: Response) {
  await safetyService.deleteIncident(req.params.id);
  sendNoContent(res);
}

// ─── Trainings ────────────────────
export async function listTrainings(req: Request, res: Response) {
  const filters = {
    userId: req.query.userId as string | undefined,
    obraId: req.query.obraId as string | undefined,
    nr: req.query.nr as string | undefined,
  };
  const trainings = await safetyService.listTrainings(filters);
  sendSuccess(res, trainings);
}
export async function createTraining(req: Request, res: Response) {
  const training = await safetyService.createTraining(req.body);
  sendCreated(res, training);
}
export async function getExpiringTrainings(_req: Request, res: Response) {
  const trainings = await safetyService.getExpiringTrainings();
  sendSuccess(res, trainings);
}
export async function deleteTraining(req: Request, res: Response) {
  await safetyService.deleteTraining(req.params.id);
  sendNoContent(res);
}

// ─── Export Excel ────────────────────
function fmtDate(d: Date | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-BR');
}

function getEpiStatusLabel(epi: { returnedAt: Date | null; expiresAt: Date | null }): string {
  if (epi.returnedAt) return 'Devolvido';
  if (!epi.expiresAt) return 'Válido';
  const now = new Date();
  const expires = new Date(epi.expiresAt);
  const in30d = new Date();
  in30d.setDate(in30d.getDate() + 30);
  if (expires < now) return 'Vencido';
  if (expires < in30d) return 'Vencendo';
  return 'Válido';
}

function getTrainingStatusLabel(t: { expiresAt: Date | null }): string {
  if (!t.expiresAt) return 'Permanente';
  const now = new Date();
  const expires = new Date(t.expiresAt);
  const in30d = new Date();
  in30d.setDate(in30d.getDate() + 30);
  if (expires < now) return 'Vencido';
  if (expires < in30d) return 'Vencendo';
  return 'Válido';
}

export async function exportExcel(req: Request, res: Response) {
  const tipo = req.query.tipo as string;
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BER Engenharia';
  workbook.created = new Date();

  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3436' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  };

  if (tipo === 'apr') {
    const where: any = {};
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }
    const aprs = await prisma.aPR.findMany({
      where,
      include: { obra: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });

    const sheet = workbook.addWorksheet('APRs');
    sheet.columns = [
      { header: 'Obra', key: 'obra', width: 30 },
      { header: 'Atividade', key: 'atividade', width: 35 },
      { header: 'Data', key: 'data', width: 14 },
      { header: 'Responsável', key: 'responsavel', width: 25 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Riscos', key: 'riscos', width: 60 },
    ];
    sheet.getRow(1).eachCell((cell) => { cell.style = headerStyle; });

    for (const apr of aprs) {
      const risks = (apr.risks as any[]) || [];
      const riskText = risks.map((r: any) => `${r.description} (${r.severity}) — ${r.control}`).join('; ');
      sheet.addRow({
        obra: apr.obra?.name ?? '',
        atividade: apr.activityName,
        data: fmtDate(apr.date),
        responsavel: apr.responsible,
        status: apr.status,
        riscos: riskText,
      });
    }
  } else if (tipo === 'epi') {
    const where: any = {};
    if (startDate || endDate) {
      where.deliveredAt = {};
      if (startDate) where.deliveredAt.gte = startDate;
      if (endDate) where.deliveredAt.lte = endDate;
    }
    const epis = await prisma.ePIControl.findMany({
      where,
      include: {
        user: { select: { name: true } },
        obra: { select: { name: true } },
      },
      orderBy: { deliveredAt: 'desc' },
    });

    const sheet = workbook.addWorksheet('EPIs');
    sheet.columns = [
      { header: 'Colaborador', key: 'colaborador', width: 25 },
      { header: 'EPI', key: 'epi', width: 35 },
      { header: 'CA', key: 'ca', width: 14 },
      { header: 'Data Entrega', key: 'entrega', width: 14 },
      { header: 'Validade', key: 'validade', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
    ];
    sheet.getRow(1).eachCell((cell) => { cell.style = headerStyle; });

    for (const epi of epis) {
      sheet.addRow({
        colaborador: epi.user?.name ?? '',
        epi: epi.epiName,
        ca: epi.caNumber ?? '',
        entrega: fmtDate(epi.deliveredAt),
        validade: fmtDate(epi.expiresAt),
        status: getEpiStatusLabel(epi),
      });
    }
  } else if (tipo === 'incidentes') {
    const where: any = {};
    if (startDate || endDate) {
      where.occurredAt = {};
      if (startDate) where.occurredAt.gte = startDate;
      if (endDate) where.occurredAt.lte = endDate;
    }
    const incidents = await prisma.incident.findMany({
      where,
      include: { obra: { select: { name: true } } },
      orderBy: { occurredAt: 'desc' },
    });

    const sheet = workbook.addWorksheet('Incidentes');
    sheet.columns = [
      { header: 'Obra', key: 'obra', width: 30 },
      { header: 'Tipo', key: 'tipo', width: 20 },
      { header: 'Severidade', key: 'severidade', width: 14 },
      { header: 'Data', key: 'data', width: 14 },
      { header: 'Descrição', key: 'descricao', width: 50 },
      { header: 'Ação Imediata', key: 'acaoImediata', width: 40 },
      { header: 'Ação Corretiva', key: 'acaoCorretiva', width: 40 },
      { header: 'Status', key: 'status', width: 14 },
    ];
    sheet.getRow(1).eachCell((cell) => { cell.style = headerStyle; });

    for (const inc of incidents) {
      sheet.addRow({
        obra: inc.obra?.name ?? '',
        tipo: inc.type,
        severidade: inc.severity,
        data: fmtDate(inc.occurredAt),
        descricao: inc.description,
        acaoImediata: inc.immediateAction ?? '',
        acaoCorretiva: inc.correctiveAction ?? '',
        status: inc.status,
      });
    }
  } else if (tipo === 'treinamentos') {
    const where: any = {};
    if (startDate || endDate) {
      where.completedAt = {};
      if (startDate) where.completedAt.gte = startDate;
      if (endDate) where.completedAt.lte = endDate;
    }
    const trainings = await prisma.training.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { completedAt: 'desc' },
    });

    const sheet = workbook.addWorksheet('Treinamentos');
    sheet.columns = [
      { header: 'Colaborador', key: 'colaborador', width: 25 },
      { header: 'Treinamento', key: 'treinamento', width: 40 },
      { header: 'NR', key: 'nr', width: 10 },
      { header: 'Fornecedor', key: 'fornecedor', width: 25 },
      { header: 'Data Conclusão', key: 'conclusao', width: 16 },
      { header: 'Validade', key: 'validade', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
    ];
    sheet.getRow(1).eachCell((cell) => { cell.style = headerStyle; });

    for (const t of trainings) {
      sheet.addRow({
        colaborador: t.user?.name ?? '',
        treinamento: t.trainingName,
        nr: t.nr,
        fornecedor: t.provider ?? '',
        conclusao: fmtDate(t.completedAt),
        validade: fmtDate(t.expiresAt),
        status: getTrainingStatusLabel(t),
      });
    }
  } else {
    res.status(400).json({ error: { code: 'INVALID_TYPE', message: 'Tipo inválido. Use: apr, epi, incidentes, treinamentos' } });
    return;
  }

  const filename = `seguranca_${tipo}_${new Date().toISOString().split('T')[0]}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}
