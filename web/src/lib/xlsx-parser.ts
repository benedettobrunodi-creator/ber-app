/**
 * xlsx-parser.ts — Parser de planilhas Excel para importação de orçamento
 * Importado APENAS dinamicamente (await import('./xlsx-parser'))
 * NÃO importar no topo de nenhum componente — mantém xlsx fora do bundle inicial
 */

export interface OrcamentoItem {
  numero: string;
  descricao: string;
  valor_orcado: number;
  tipo: 'grupo' | 'subitem';
}

export async function parseXlsxFile(file: File): Promise<OrcamentoItem[]> {
  // SheetJS — importado dinamicamente apenas quando necessário
  const XLSX = await import('xlsx');

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const dataRows = rows.filter((r: any[]) => r.length >= 3 && r[0] !== '' && r[1] !== '');

  return dataRows.map((r: any[], i: number) => {
    const num = String(r[0]).trim();
    const desc = String(r[1]).trim();
    const val =
      parseFloat(String(r[2]).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    if (!num || !desc) throw new Error(`Linha ${i + 1}: Nº ou Descrição vazio`);
    return {
      numero: num,
      descricao: desc,
      valor_orcado: val,
      tipo: (num.includes('.') ? 'subitem' : 'grupo') as 'grupo' | 'subitem',
    };
  });
}
