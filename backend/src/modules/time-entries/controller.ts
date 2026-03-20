import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import * as timeEntryService from './service';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated, parsePagination, buildPagination } from '../../utils/response';

export async function checkin(req: Request, res: Response) {
  const entry = await timeEntryService.checkin(req.user!.userId, req.body);
  sendCreated(res, entry);
}

export async function checkout(req: Request, res: Response) {
  const entry = await timeEntryService.checkout(req.user!.userId, req.body);
  sendCreated(res, entry);
}

export async function getMyEntries(req: Request, res: Response) {
  const { page, limit } = parsePagination(req.query as any);
  const month = req.query.month as string | undefined;
  const { entries, total } = await timeEntryService.getMyEntries(req.user!.userId, page, limit, month);
  sendPaginated(res, entries, buildPagination(page, limit, total));
}

export async function getMyStatus(req: Request, res: Response) {
  const status = await timeEntryService.getMyStatus(req.user!.userId);
  sendSuccess(res, status);
}

export async function getAllEntries(req: Request, res: Response) {
  const { page, limit } = parsePagination(req.query as any);
  const filters = {
    userId: req.query.userId as string | undefined,
    obraId: req.query.obraId as string | undefined,
    month: req.query.month as string | undefined,
  };
  const { entries, total } = await timeEntryService.getAllEntries(page, limit, filters);
  sendPaginated(res, entries, buildPagination(page, limit, total));
}

export async function getActiveWorkers(_req: Request, res: Response) {
  const workers = await timeEntryService.getActiveWorkers();
  sendSuccess(res, workers);
}

export async function getReport(req: Request, res: Response) {
  const month = req.query.month as string;
  if (!month) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Parâmetro month é obrigatório (YYYY-MM)' } });
  }
  const userId = req.query.userId as string | undefined;
  const obraId = req.query.obraId as string | undefined;
  const report = await timeEntryService.getMonthlyReport(month, userId, obraId);
  sendSuccess(res, report);
}

export async function exportToExcel(req: Request, res: Response) {
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Parâmetros startDate e endDate são obrigatórios (YYYY-MM-DD)' } });
  }

  const userIdsParam = req.query.userIds as string | undefined;
  const userIds = userIdsParam ? userIdsParam.split(',').map((id) => id.trim()) : undefined;

  const grouped = await timeEntryService.exportTimeEntries({ userIds, startDate, endDate });

  const workbook = new ExcelJS.Workbook();

  for (const [, userData] of Object.entries(grouped)) {
    const sheetName = userData.userName.substring(0, 31); // Excel sheet name limit
    const sheet = workbook.addWorksheet(sheetName);

    sheet.columns = [
      { header: 'Data', key: 'data', width: 15 },
      { header: 'Entrada', key: 'entrada', width: 12 },
      { header: 'Saída', key: 'saida', width: 12 },
      { header: 'Total Horas', key: 'totalHoras', width: 15 },
      { header: 'Obra', key: 'obra', width: 25 },
      { header: 'Endereço', key: 'endereco', width: 40 },
    ];

    // Style header row
    sheet.getRow(1).font = { bold: true };

    for (const pair of userData.pairs) {
      sheet.addRow(pair);
    }
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=relatorio-ponto-${startDate}-${endDate}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
}

export async function deleteEntry(req: Request, res: Response) {
  await timeEntryService.deleteEntry(req.params.id);
  sendNoContent(res);
}
