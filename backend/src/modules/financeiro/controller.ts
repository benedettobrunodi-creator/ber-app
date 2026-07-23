import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../utils/errors';
import DRE_2026_FORMULAS_RAW from './dre-2026-formulas.json';

// ── Ciclos ──────────────────────────────────────────────────────────────────

export async function listCiclos(_req: Request, res: Response) {
  const ciclos = await prisma.finCiclo.findMany({
    orderBy: [{ ano: 'desc' }, { ordem: 'asc' }],
  });
  sendSuccess(res, ciclos);
}

export async function createCiclo(req: Request, res: Response) {
  const { nome, ano, ordem } = req.body ?? {};
  if (!nome || !ano) throw AppError.badRequest('nome e ano são obrigatórios');
  const ciclo = await prisma.finCiclo.create({
    data: { nome, ano: Number(ano), ordem: ordem != null ? Number(ordem) : 0 },
  });
  sendSuccess(res, ciclo);
}

export async function updateCiclo(req: Request, res: Response) {
  const { id } = req.params;
  const { nome, ano, ordem } = req.body ?? {};
  const data: any = {};
  if (nome !== undefined) data.nome = nome;
  if (ano !== undefined) data.ano = Number(ano);
  if (ordem !== undefined) data.ordem = Number(ordem);
  const ciclo = await prisma.finCiclo.update({ where: { id }, data });
  sendSuccess(res, ciclo);
}

export async function deleteCiclo(req: Request, res: Response) {
  const { id } = req.params;
  await prisma.finCiclo.delete({ where: { id } });
  sendSuccess(res, { deleted: true });
}

/** Duplica ciclo inteiro (linhas + valores) num novo ciclo com o nome informado. */
export async function duplicarCiclo(req: Request, res: Response) {
  const { id } = req.params;
  const { nome, ano } = req.body ?? {};
  if (!nome) throw AppError.badRequest('nome do novo ciclo é obrigatório');
  const origem = await prisma.finCiclo.findUnique({
    where: { id },
    include: { linhas: { include: { valores: true } } },
  });
  if (!origem) throw AppError.notFound('ciclo não encontrado');

  const novo = await prisma.$transaction(async (tx) => {
    const c = await tx.finCiclo.create({
      data: { nome, ano: ano != null ? Number(ano) : origem.ano },
    });
    // Cria linhas em duas fases pra resolver grupoId (auto-referência).
    const idMap = new Map<string, string>();
    for (const l of origem.linhas) {
      const nova = await tx.finLinha.create({
        data: {
          cicloId: c.id,
          ordem: l.ordem,
          rotulo: l.rotulo,
          kpiPct: l.kpiPct,
          orcamentoAnual: l.orcamentoAnual,
          isTotal: l.isTotal,
          isHeader: l.isHeader,
        },
      });
      idMap.set(l.id, nova.id);
    }
    for (const l of origem.linhas) {
      if (!l.grupoId) continue;
      const novoGrupo = idMap.get(l.grupoId);
      if (!novoGrupo) continue;
      await tx.finLinha.update({
        where: { id: idMap.get(l.id)! },
        data: { grupoId: novoGrupo },
      });
    }
    // Copia valores
    for (const l of origem.linhas) {
      const novaLinhaId = idMap.get(l.id)!;
      for (const v of l.valores) {
        await tx.finValor.create({
          data: { linhaId: novaLinhaId, mes: v.mes, valor: v.valor },
        });
      }
    }
    return c;
  });
  sendSuccess(res, novo);
}

// ── Snapshot: ciclo com linhas + valores agrupados por linha ────────────────

export async function getSnapshot(req: Request, res: Response) {
  const { cicloId } = req.params;
  const ciclo = await prisma.finCiclo.findUnique({
    where: { id: cicloId },
    include: {
      linhas: {
        orderBy: { ordem: 'asc' },
        include: { valores: true },
      },
    },
  });
  if (!ciclo) throw AppError.notFound('ciclo não encontrado');
  // Reformata: cada linha vira { valores: { mes: num|null }, formulas: { mes: refs[] } }
  const linhas = ciclo.linhas.map((l) => {
    const valores: Record<number, number | null> = {};
    const formulas: Record<number, unknown> = {};
    for (const v of l.valores) {
      valores[v.mes] = v.valor != null ? Number(v.valor) : null;
      if (v.formula != null) formulas[v.mes] = v.formula;
    }
    return {
      id: l.id,
      ordem: l.ordem,
      rotulo: l.rotulo,
      kpiPct: l.kpiPct != null ? Number(l.kpiPct) : null,
      orcamentoAnual: l.orcamentoAnual != null ? Number(l.orcamentoAnual) : null,
      isTotal: l.isTotal,
      isHeader: l.isHeader,
      grupoId: l.grupoId,
      valores,
      formulas,
    };
  });
  sendSuccess(res, {
    id: ciclo.id,
    nome: ciclo.nome,
    ano: ciclo.ano,
    linhas,
  });
}

// ── Linhas ──────────────────────────────────────────────────────────────────

export async function createLinha(req: Request, res: Response) {
  const { cicloId } = req.params;
  const { rotulo, ordem, kpiPct, orcamentoAnual, isTotal, isHeader, grupoId } = req.body ?? {};
  if (!rotulo) throw AppError.badRequest('rotulo é obrigatório');
  const linha = await prisma.finLinha.create({
    data: {
      cicloId,
      rotulo,
      ordem: ordem != null ? Number(ordem) : 999,
      kpiPct: kpiPct != null ? Number(kpiPct) : null,
      orcamentoAnual: orcamentoAnual != null ? Number(orcamentoAnual) : null,
      isTotal: !!isTotal,
      isHeader: !!isHeader,
      grupoId: grupoId || null,
    },
  });
  sendSuccess(res, linha);
}

export async function updateLinha(req: Request, res: Response) {
  const { linhaId } = req.params;
  const { rotulo, ordem, kpiPct, orcamentoAnual, isTotal, isHeader, grupoId } = req.body ?? {};
  const data: any = {};
  if (rotulo !== undefined) data.rotulo = rotulo;
  if (ordem !== undefined) data.ordem = Number(ordem);
  if (kpiPct !== undefined) data.kpiPct = kpiPct === null ? null : Number(kpiPct);
  if (orcamentoAnual !== undefined) data.orcamentoAnual = orcamentoAnual === null ? null : Number(orcamentoAnual);
  if (isTotal !== undefined) data.isTotal = !!isTotal;
  if (isHeader !== undefined) data.isHeader = !!isHeader;
  if (grupoId !== undefined) data.grupoId = grupoId || null;
  const linha = await prisma.finLinha.update({ where: { id: linhaId }, data });
  sendSuccess(res, linha);
}

export async function deleteLinha(req: Request, res: Response) {
  const { linhaId } = req.params;
  await prisma.finLinha.delete({ where: { id: linhaId } });
  sendSuccess(res, { deleted: true });
}

/** Atualiza ordem em lote (recebe array de {id, ordem}). */
export async function reorderLinhas(req: Request, res: Response) {
  const items: { id: string; ordem: number }[] = req.body?.items ?? [];
  if (!Array.isArray(items) || items.length === 0) throw AppError.badRequest('items vazio');
  await prisma.$transaction(items.map((it) =>
    prisma.finLinha.update({ where: { id: it.id }, data: { ordem: Number(it.ordem) } }),
  ));
  sendSuccess(res, { updated: items.length });
}

// ── Valores ─────────────────────────────────────────────────────────────────

// ── Seed one-shot ───────────────────────────────────────────────────────────
// Endpoint temporário para popular o ciclo "DRE 2026" a partir da planilha
// enviada pelo Bruno. Idempotente: se já existir, retorna o ciclo existente.

// Valores mensais extraídos do BER_DRE_2026_v2.xlsx (Bruno, 22/07/2026).
// Chaves: número do mês (3=Mar, 4=Abr, 5=Mai, ..., 12=Dez).
const DRE_2026_ROWS: {
  rotulo: string;
  kpiPct?: number | null;
  orcamentoAnual?: number | null;
  isHeader?: boolean;
  valores?: Record<number, number>;
}[] = [
  { rotulo: 'Valor Referência', orcamentoAnual: 25000000, valores: { 3: 1096000, 4: 1009000, 5: 5687756, 6: 363393, 7: 2754000, 8: 2754000, 9: 2754000, 10: 2754000, 11: 2754000, 12: 2754000 } },
  { rotulo: '1. RECEITA BRUTA', kpiPct: 1.0, orcamentoAnual: 22500000, isHeader: true, valores: { 3: 986400, 4: 908100, 5: 5119180.4, 6: 327053.7, 7: 327053.7, 8: 327053.7, 9: 327053.7, 10: 327053.7, 11: 327053.7, 12: 327053.7 } },
  { rotulo: 'Venda de Corporativo (KPI < 70%)', kpiPct: 0.70, orcamentoAnual: 15750000 },
  { rotulo: 'Venda de Residencial (KPI < 20%)', kpiPct: 0.20, orcamentoAnual: 4500000 },
  { rotulo: 'Venda de Hospedagem (KPI < 10%)',  kpiPct: 0.10, orcamentoAnual: 2250000 },
  { rotulo: 'Gerenciadora', kpiPct: 0.20, orcamentoAnual: 4500000 },
  { rotulo: 'Arquitetura',  kpiPct: 0.30, orcamentoAnual: 6750000 },
  { rotulo: 'Networking',   kpiPct: 0.50, orcamentoAnual: 11250000 },
  { rotulo: '(-) Deduções', isHeader: true },
  { rotulo: 'Deduções de Faturamento Direto (KPI ~70%)', kpiPct: 0.70, orcamentoAnual: 15750000, valores: { 3: 690480, 4: 635670, 5: 3583426.28, 6: 228937.59, 7: 228937.59, 8: 228937.59, 9: 228937.59, 10: 228937.59, 11: 228937.59, 12: 228937.59 } },
  { rotulo: 'Receita Bruta (após deduções)', kpiPct: 1.0, orcamentoAnual: 6750000, valores: { 3: 295920, 4: 272430, 5: 1535754.12, 6: 98116.11, 7: 98116.11, 8: 98116.11, 9: 98116.11, 10: 98116.11, 11: 98116.11, 12: 98116.11 } },
  { rotulo: 'Savings',              kpiPct: 0.10, orcamentoAnual: 2250000, valores: { 3: 98640, 4: 90810, 5: 511918.04, 6: 32705.37, 7: 32705.37, 8: 32705.37, 9: 32705.37, 10: 32705.37, 11: 32705.37, 12: 32705.37 } },
  { rotulo: 'Imposto sobre savings', kpiPct: 0.20, orcamentoAnual: 337500, valores: { 3: 19728, 4: 18162, 5: 102383.61, 6: 6541.07, 7: 6541.07, 8: 6541.07, 9: 6541.07, 10: 6541.07, 11: 6541.07, 12: 6541.07 } },
  { rotulo: '2. RECEITA LÍQUIDA', orcamentoAnual: 8662500, isHeader: true, valores: { 3: 374832, 4: 345078, 5: 1945288.55, 6: 124280.41, 7: 124280.41, 8: 124280.41, 9: 124280.41, 10: 124280.41, 11: 124280.41, 12: 124280.41 } },
  { rotulo: '(-) CUSTO DAS VENDAS (BUDGET)', orcamentoAnual: 8662500, isHeader: true, valores: { 3: 374832, 4: 345078, 5: 1945288.55, 6: 124280.41, 7: 124280.41, 8: 124280.41, 9: 124280.41, 10: 124280.41, 11: 124280.41, 12: 124280.41 } },
  { rotulo: 'Fornecedores',                              kpiPct: 0.85, orcamentoAnual: 7363125, valores: { 3: 318607.2, 4: 293316.3, 5: 1653495.27, 6: 105638.35, 7: 105638.35, 8: -52011.93, 9: -52011.93, 10: -52011.93, 11: -52011.93, 12: -52011.93 } },
  { rotulo: 'Budget de Prêmios (deduzir da comissão)',   kpiPct: 0.05, orcamentoAnual: 1125000, valores: { 3: 18741.6, 4: 17253.9, 5: 97264.43, 6: 6214.02, 7: 6214.02, 8: 137700, 9: 137700, 10: 137700, 11: 137700, 12: 137700 } },
  { rotulo: 'Budget de Despesas Discricionárias',        kpiPct: 0.01, orcamentoAnual: 86625, valores: { 3: 3748.32, 4: 3450.78, 5: 19452.89, 6: 1242.8, 7: 1242.8, 8: 1242.8, 9: 1242.8, 10: 1242.8, 11: 1242.8, 12: 1242.8 } },
  { rotulo: 'Mão de Obra - Direta',                      kpiPct: 0.09, orcamentoAnual: 779625, valores: { 3: 33734.88, 4: 31057.02, 5: 175075.97, 6: 11185.24, 7: 11185.24, 8: 11185.24, 9: 11185.24, 10: 11185.24, 11: 11185.24, 12: 11185.24 } },
  { rotulo: '3. MARGEM DE CONTRIBUIÇÃO (taxa + savings)', orcamentoAnual: 4037500, isHeader: true, valores: { 3: 172072, 4: 158413, 5: 621447.71, 6: 238069.3, 7: 342874.3, 8: 342874.3, 9: 342874.3, 10: 342874.3, 11: 342874.3, 12: 342874.3 } },
  { rotulo: 'Taxa Adm',           kpiPct: 0.10, orcamentoAnual: 2500000, valores: { 3: 109600, 4: 100900, 5: 249309.74, 6: 249300, 7: 275400, 8: 275400, 9: 275400, 10: 275400, 11: 275400, 12: 275400 } },
  { rotulo: 'Imposto sobre ADM',  kpiPct: 0.15, orcamentoAnual: 375000, valores: { 3: 16440, 4: 15135, 5: 37396.46, 6: 37395, 7: 41310, 8: 41310, 9: 41310, 10: 41310, 11: 41310, 12: 41310 } },
  { rotulo: 'Savings (líquido)',  orcamentoAnual: 1912500, valores: { 3: 78912, 4: 72648, 5: 409534.43, 6: 26164.3, 7: 26164.3, 8: 26164.3, 9: 26164.3, 10: 26164.3, 11: 26164.3, 12: 26164.3 } },
  { rotulo: '3.5 DESPESAS FIXAS', kpiPct: 0.2322, orcamentoAnual: 2011800, isHeader: true, valores: { 3: 122000, 4: 128000, 5: 212917.24, 6: 212917.24, 7: 212917.24, 8: 212917.24, 9: 212917.24, 10: 212917.24, 11: 212917.24, 12: 212917.24 } },
  { rotulo: '4. GERAÇÃO DE CAIXA DA OPERAÇÃO (EBITDA)', kpiPct: 0.3001, orcamentoAnual: 2025700, isHeader: true, valores: { 3: 50072, 4: 30413, 5: 408530.47, 6: 25152.06, 7: 129957.06, 8: 129957.06, 9: 129957.06, 10: 129957.06, 11: 129957.06, 12: 129957.06 } },
  { rotulo: '% Margem EBITDA', valores: { 3: 0.17, 4: 0.11, 5: 0.27, 6: 0.26, 7: 1.32, 8: 1.32, 9: 1.32, 10: 1.32, 11: 1.32, 12: 1.32 } },
  { rotulo: '5. LIABILITIES / SINISTRO', kpiPct: 0.05, orcamentoAnual: 101285, isHeader: true, valores: { 3: 2503.6, 4: 1520.65, 5: 20426.52, 6: 1257.6, 7: 6497.85, 8: 6497.85, 9: 6497.85, 10: 6497.85, 11: 6497.85, 12: 6497.85 } },
  { rotulo: 'Provisão de garantia de obras' },
  { rotulo: '6. INSOLVÊNCIA (dívidas / EBITDA < 50%)', isHeader: true },
  { rotulo: '7. LUCRO', kpiPct: 0.2222, orcamentoAnual: 1924415, isHeader: true, valores: { 3: 47568.4, 4: 28892.35, 5: 288103.95, 6: 3894.45, 7: 103459.2, 8: 103459.2, 9: 103459.2, 10: 103459.2, 11: 103459.2, 12: 103459.2 } },
  { rotulo: 'Adiantamento de dividendos',  kpiPct: 0.55, orcamentoAnual: 1058428.25, valores: { 3: 26162.62, 4: 15890.79, 5: 158457.17, 6: 2141.95, 7: 56902.56, 8: 56902.56, 9: 56902.56, 10: 56902.56, 11: 56902.56, 12: 56902.56 } },
  { rotulo: 'Reserva de Opex (sinistro de obras)', kpiPct: 0.12, orcamentoAnual: 230929.80, valores: { 3: 5708.21, 4: 3467.08, 5: 34572.47, 6: 467.33, 7: 12415.1, 8: 12415.1, 9: 12415.1, 10: 12415.1, 11: 12415.1, 12: 12415.1 } },
  { rotulo: 'Reserva Burn In 3x',          kpiPct: 0.33, orcamentoAnual: 635056.95, valores: { 3: 15697.57, 4: 9534.48, 5: 95074.3, 6: 1285.17, 7: 34141.54, 8: 34141.54, 9: 34141.54, 10: 34141.54, 11: 34141.54, 12: 34141.54 } },
  { rotulo: 'Saída Eduardo', valores: { 5: 100000, 6: 20000, 7: 20000, 8: 20000, 9: 20000, 10: 20000, 11: 20000, 12: 20000 } },
  { rotulo: '8. EXIGÊNCIA DE CAPITAL DE GIRO (caixa vs. competência)', isHeader: true },
  { rotulo: '3x o Burn In',   orcamentoAnual: 6035400 },
  { rotulo: 'Opex',           orcamentoAnual: 50000 },
  { rotulo: '9. ASSETS', isHeader: true },
  { rotulo: 'Conta Corrente / Investimentos' },
  { rotulo: 'Contas a receber' },
];

// Fórmulas do DRE 2026 (parseadas do BER_DRE_2026_v2.xlsx). Chave "rowIdx:mes".
// Refs usam rowIdx (offset no DRE_2026_ROWS) — resolvido em runtime pelo seeder.
const DRE_2026_FORMULAS: Record<string, any[]> = DRE_2026_FORMULAS_RAW as any;

export async function seedDre2026(req: Request, res: Response) {
  const replace = req.query.replace === 'true';
  const existente = await prisma.finCiclo.findFirst({ where: { nome: 'DRE 2026' } });
  if (existente && !replace) {
    sendSuccess(res, { criado: false, cicloId: existente.id, motivo: 'ciclo "DRE 2026" já existe. Use ?replace=true pra recriar.' });
    return;
  }
  if (existente && replace) {
    await prisma.finCiclo.delete({ where: { id: existente.id } });
  }
  const ciclo = await prisma.finCiclo.create({
    data: { nome: 'DRE 2026', ano: 2026, ordem: 0 },
  });
  // Cria linhas e guarda rowIdx → linhaId
  const rowIdxToLinhaId = new Map<number, string>();
  for (let idx = 0; idx < DRE_2026_ROWS.length; idx++) {
    const r = DRE_2026_ROWS[idx];
    const linha = await prisma.finLinha.create({
      data: {
        cicloId: ciclo.id,
        ordem: idx,
        rotulo: r.rotulo,
        kpiPct: r.kpiPct ?? null,
        orcamentoAnual: r.orcamentoAnual ?? null,
        isHeader: !!r.isHeader,
        isTotal: false,
      },
    });
    rowIdxToLinhaId.set(idx, linha.id);
  }
  // Popula valores mensais das células que NÃO tem fórmula
  let valoresCriados = 0;
  for (let idx = 0; idx < DRE_2026_ROWS.length; idx++) {
    const r = DRE_2026_ROWS[idx];
    if (!r.valores) continue;
    const linhaId = rowIdxToLinhaId.get(idx)!;
    for (const [mesStr, valor] of Object.entries(r.valores)) {
      const mes = Number(mesStr);
      const key = `${idx}:${mes}`;
      if (DRE_2026_FORMULAS[key]) continue; // fórmula toma precedência
      await prisma.finValor.create({
        data: { linhaId, mes, valor },
      });
      valoresCriados++;
    }
  }
  // Popula fórmulas (converte rowIdx → linhaId nas refs)
  let formulasCriadas = 0;
  for (const [key, tokens] of Object.entries(DRE_2026_FORMULAS)) {
    const [rowIdxStr, mesStr] = key.split(':');
    const rowIdx = Number(rowIdxStr);
    const mes = Number(mesStr);
    const linhaId = rowIdxToLinhaId.get(rowIdx);
    if (!linhaId) continue;
    // Converte refs
    const resolvedTokens = tokens.map((t: any) => {
      if (t.type === 'ref') {
        const refLinhaId = rowIdxToLinhaId.get(t.rowIdx);
        if (!refLinhaId) return null;
        return { type: 'ref', linhaId: refLinhaId, mes: t.mes };
      }
      return t;
    }).filter((t: any) => t != null);
    if (resolvedTokens.length === 0) continue;
    await prisma.finValor.upsert({
      where: { linhaId_mes: { linhaId, mes } },
      update: { valor: null, formula: { tokens: resolvedTokens } as any },
      create: { linhaId, mes, valor: null, formula: { tokens: resolvedTokens } as any },
    });
    formulasCriadas++;
  }
  sendSuccess(res, {
    criado: true,
    cicloId: ciclo.id,
    linhas: DRE_2026_ROWS.length,
    valores: valoresCriados,
    formulas: formulasCriadas,
  });
}

/** Upsert de um valor OU fórmula (linha × mês).
 *  formula pode ser:
 *   - array de refs {linhaId, mes} → soma pura (retrocompat)
 *   - { tokens: [...] } → expressão com precedência (+,-,*,/, refs, literais, parens)
 *  valor null/0 sem formula → remove célula.
 *  valor número (sem formula) → salva manual, limpa formula.
 */
export async function setValor(req: Request, res: Response) {
  const { linhaId } = req.params;
  const { mes, valor, formula } = req.body ?? {};
  const m = Number(mes);
  if (!(m >= 1 && m <= 12)) throw AppError.badRequest('mes inválido (1..12)');

  // Fórmula formato novo (tokens) ou antigo (array de refs)
  if (formula && (Array.isArray(formula) || (typeof formula === 'object' && Array.isArray(formula.tokens)))) {
    let stored: any;
    if (Array.isArray(formula)) {
      const refs = formula
        .filter((r: any) => r && typeof r.linhaId === 'string' && Number.isInteger(r.mes) && r.mes >= 1 && r.mes <= 12)
        .map((r: any) => ({ linhaId: r.linhaId as string, mes: r.mes as number }));
      if (refs.length === 0) throw AppError.badRequest('formula sem refs válidas');
      stored = refs;
    } else {
      const tokens = (formula.tokens as any[]).filter(t => t && typeof t.type === 'string');
      if (tokens.length === 0) throw AppError.badRequest('formula sem tokens');
      stored = { tokens };
    }
    const up = await prisma.finValor.upsert({
      where: { linhaId_mes: { linhaId, mes: m } },
      update: { valor: null, formula: stored },
      create: { linhaId, mes: m, valor: null, formula: stored },
    });
    sendSuccess(res, up);
    return;
  }

  const v = valor === null || valor === undefined || valor === '' ? null : Number(valor);
  if (v === null || v === 0) {
    await prisma.finValor.deleteMany({ where: { linhaId, mes: m } });
    sendSuccess(res, { removed: true });
    return;
  }
  const up = await prisma.finValor.upsert({
    where: { linhaId_mes: { linhaId, mes: m } },
    update: { valor: v, formula: null as any },
    create: { linhaId, mes: m, valor: v },
  });
  sendSuccess(res, up);
}
