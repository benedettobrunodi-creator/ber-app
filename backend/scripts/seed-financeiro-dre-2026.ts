/**
 * Seeder do módulo Financeiro: cria o ciclo "DRE 2026" com a estrutura
 * extraída do arquivo BER_DRE_2026_v2.xlsx enviado pelo Bruno em 22/07/2026.
 *
 * Uso:
 *   pnpm ts-node scripts/seed-financeiro-dre-2026.ts
 *
 * O seeder só roda se ainda não existir ciclo com nome "DRE 2026".
 * Cria linhas com rótulo/kpiPct/orcamentoAnual. isHeader marcado nas seções
 * numeradas (1., 2., ... 9.); as demais ficam como valores editáveis. Totais
 * automáticos (isTotal + grupoId) o usuário configura pela UI depois.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Row {
  rotulo: string;
  kpiPct?: number | null;
  orcamentoAnual?: number | null;
  isHeader?: boolean;
}

const ROWS: Row[] = [
  { rotulo: 'Valor Referência', orcamentoAnual: 25000000 },
  { rotulo: '1. RECEITA BRUTA', kpiPct: 1.0, orcamentoAnual: 22500000, isHeader: true },
  { rotulo: 'Venda de Corporativo (KPI < 70%)', kpiPct: 0.70, orcamentoAnual: 15750000 },
  { rotulo: 'Venda de Residencial (KPI < 20%)', kpiPct: 0.20, orcamentoAnual: 4500000 },
  { rotulo: 'Venda de Hospedagem (KPI < 10%)',  kpiPct: 0.10, orcamentoAnual: 2250000 },
  { rotulo: 'Gerenciadora', kpiPct: 0.20, orcamentoAnual: 4500000 },
  { rotulo: 'Arquitetura',  kpiPct: 0.30, orcamentoAnual: 6750000 },
  { rotulo: 'Networking',   kpiPct: 0.50, orcamentoAnual: 11250000 },
  { rotulo: '(-) Deduções', isHeader: true },
  { rotulo: 'Deduções de Faturamento Direto (KPI ~70%)', kpiPct: 0.70, orcamentoAnual: 15750000 },
  { rotulo: 'Receita Bruta (após deduções)', kpiPct: 1.0, orcamentoAnual: 6750000 },
  { rotulo: 'Savings',              kpiPct: 0.10, orcamentoAnual: 2250000 },
  { rotulo: 'Imposto sobre savings', kpiPct: 0.20, orcamentoAnual: 337500 },
  { rotulo: '2. RECEITA LÍQUIDA', orcamentoAnual: 8662500, isHeader: true },
  { rotulo: '(-) CUSTO DAS VENDAS (BUDGET)', orcamentoAnual: 8662500, isHeader: true },
  { rotulo: 'Fornecedores',                              kpiPct: 0.85, orcamentoAnual: 7363125 },
  { rotulo: 'Budget de Prêmios (deduzir da comissão)',   kpiPct: 0.05, orcamentoAnual: 1125000 },
  { rotulo: 'Budget de Despesas Discricionárias',        kpiPct: 0.01, orcamentoAnual: 86625 },
  { rotulo: 'Mão de Obra - Direta',                      kpiPct: 0.09, orcamentoAnual: 779625 },
  { rotulo: '3. MARGEM DE CONTRIBUIÇÃO (taxa + savings)', orcamentoAnual: 4037500, isHeader: true },
  { rotulo: 'Taxa Adm',           kpiPct: 0.10, orcamentoAnual: 2500000 },
  { rotulo: 'Imposto sobre ADM',  kpiPct: 0.15, orcamentoAnual: 375000 },
  { rotulo: 'Savings (líquido)',  orcamentoAnual: 1912500 },
  { rotulo: '3.5 DESPESAS FIXAS', kpiPct: 0.2322, orcamentoAnual: 2011800, isHeader: true },
  { rotulo: '4. GERAÇÃO DE CAIXA DA OPERAÇÃO (EBITDA)', kpiPct: 0.3001, orcamentoAnual: 2025700, isHeader: true },
  { rotulo: '% Margem EBITDA' },
  { rotulo: '5. LIABILITIES / SINISTRO', kpiPct: 0.05, orcamentoAnual: 101285, isHeader: true },
  { rotulo: 'Provisão de garantia de obras' },
  { rotulo: '6. INSOLVÊNCIA (dívidas / EBITDA < 50%)', isHeader: true },
  { rotulo: '7. LUCRO', kpiPct: 0.2222, orcamentoAnual: 1924415, isHeader: true },
  { rotulo: 'Adiantamento de dividendos',  kpiPct: 0.55, orcamentoAnual: 1058428.25 },
  { rotulo: 'Reserva de Opex (sinistro de obras)', kpiPct: 0.12, orcamentoAnual: 230929.80 },
  { rotulo: 'Reserva Burn In 3x',          kpiPct: 0.33, orcamentoAnual: 635056.95 },
  { rotulo: 'Saída Eduardo' },
  { rotulo: '8. EXIGÊNCIA DE CAPITAL DE GIRO (caixa vs. competência)', isHeader: true },
  { rotulo: '3x o Burn In',   orcamentoAnual: 6035400 },
  { rotulo: 'Opex',           orcamentoAnual: 50000 },
  { rotulo: '9. ASSETS', isHeader: true },
  { rotulo: 'Conta Corrente / Investimentos' },
  { rotulo: 'Contas a receber' },
];

async function main() {
  const existente = await prisma.finCiclo.findFirst({ where: { nome: 'DRE 2026' } });
  if (existente) {
    console.log(`Ciclo "DRE 2026" já existe (${existente.id}), abortando.`);
    return;
  }

  const ciclo = await prisma.finCiclo.create({
    data: { nome: 'DRE 2026', ano: 2026, ordem: 0 },
  });
  console.log(`Ciclo criado: ${ciclo.id}`);

  let ordem = 0;
  for (const r of ROWS) {
    await prisma.finLinha.create({
      data: {
        cicloId: ciclo.id,
        ordem: ordem++,
        rotulo: r.rotulo,
        kpiPct: r.kpiPct ?? null,
        orcamentoAnual: r.orcamentoAnual ?? null,
        isHeader: !!r.isHeader,
        isTotal: false,
      },
    });
  }
  console.log(`${ROWS.length} linhas criadas.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
