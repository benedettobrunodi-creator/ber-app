/**
 * xlsx-parser.ts — Parser de planilhas Excel para importação de orçamento
 * Importado APENAS dinamicamente (await import('./xlsx-parser'))
 * NÃO importar no topo de nenhum componente — mantém xlsx fora do bundle inicial
 *
 * Formato esperado: Orçamento Analítico BÈR
 *   - Linha 11: cabeçalho
 *   - Col B (idx 2): ÍNDICE — "1","2" para etapas, "1.1","1.2" para subitens
 *   - Col C (idx 3): ETAPA/ITEM — "Etapa" ou "Item"
 *   - Col G (idx 7): DESCRIÇÃO
 *   - Col H (idx 8): UNID.
 *   - Col I (idx 9): QTDE.
 *   - Col S (idx 19): CUSTO TOTAL
 *   - Col AD (idx 30): PREÇO TOTAL (com BDI)
 *
 *   Nota: SheetJS header:1 retorna arrays 1-based (A=1, B=2, ...)
 */

export interface OrcamentoItem {
  numero: string;
  descricao: string;
  valor_orcado: number;
  tipo: 'grupo' | 'subitem';
  unidade: string | null;
  quantidade: number | null;
  custo_total: number;
  preco_total: number;
}

const HEADER_ROW = 11; // 1-based — row index 10 in 0-based array
// SheetJS header:1 → arrays 1-based: A=1, B=2, C=3, ...
const COL_INDICE = 2;      // B
const COL_TIPO = 3;        // C
const COL_DESCRICAO = 7;   // G
const COL_UNIDADE = 8;     // H
const COL_QUANTIDADE = 9;  // I
const COL_CUSTO_TOTAL = 19; // S
const COL_PRECO_TOTAL = 30; // AD

function parseNumber(raw: any): number {
  if (typeof raw === 'number') return raw;
  if (!raw) return 0;
  return parseFloat(String(raw).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
}

export async function parseXlsxFile(file: File): Promise<OrcamentoItem[]> {
  const XLSX = await import('xlsx');

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Skip rows before data (header is at HEADER_ROW, data starts after)
  const dataRows = rows.slice(HEADER_ROW); // 0-based: slice(11) = from row 12

  const items: OrcamentoItem[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || row.length === 0) continue;

    const indice = String(row[COL_INDICE] ?? '').trim();
    const tipoRaw = String(row[COL_TIPO] ?? '').trim().toLowerCase();
    const descricao = String(row[COL_DESCRICAO] ?? '').trim();

    // Skip rows without a valid index or tipo
    if (!indice || !tipoRaw || !descricao) continue;
    if (tipoRaw !== 'etapa' && tipoRaw !== 'item') continue;

    const unidadeRaw = String(row[COL_UNIDADE] ?? '').trim();
    const quantidadeRaw = parseNumber(row[COL_QUANTIDADE]);
    const custoTotal = parseNumber(row[COL_CUSTO_TOTAL]);
    const precoTotal = parseNumber(row[COL_PRECO_TOTAL]);
    const tipo = tipoRaw === 'etapa' ? 'grupo' : 'subitem';

    items.push({
      numero: indice,
      descricao,
      valor_orcado: precoTotal, // preço com BDI é o valor orçado para medição
      tipo,
      unidade: unidadeRaw || null,
      quantidade: quantidadeRaw || null,
      custo_total: custoTotal,
      preco_total: precoTotal,
    });
  }

  if (items.length === 0) {
    throw new Error(
      'Nenhum item encontrado. Verifique se a planilha segue o formato Orçamento Analítico BÈR ' +
      '(cabeçalho na linha 11, colunas B/C/G/S/AD).',
    );
  }

  return items;
}
