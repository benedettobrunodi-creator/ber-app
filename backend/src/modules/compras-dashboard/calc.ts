/**
 * Módulo: Compras Dashboard — cálculo de indicadores por obra
 * Replica fielmente a lógica de /web/src/app/(app)/obras/[id]/compras/page.tsx
 * (linhas 229–294) para garantir consistência entre a view por obra e o painel
 * consolidado.
 */

export interface RawItem {
  id: string;
  tipo: string;
  categoria: string;
  venda: number;
  pctMeta: number;
  comprado: number;
  compradoOk: boolean;
}

export interface ObraIndicadores {
  totalVendaBruta: number;
  totalVenda: number;
  totalMeta: number;
  totalComprado: number;
  totalItens: number;
  itensComprados: number;
  itensPendentes: number;
  itensComCompradoLancado: number;
  okVenda: number;
  okSaving: number;
  okSavingPct: number;
  okSavingMeta: number;
  okSavingMetaPct: number;
  pendVenda: number;
  pendMeta: number;
  potencialSaving: number;
  projecaoSaving: number | null;
  projecaoPct: number | null;
  comissao: number;
  pctComissao: number;
}

function isElegivelComissao(item: RawItem): boolean {
  const cat = item.categoria.toLowerCase();
  return item.tipo === 'item' && !cat.includes('taxa') && !cat.includes('imposto');
}

export function calcObra(items: RawItem[], comissao: number): ObraIndicadores {
  const totalVendaElegivel = items.filter(isElegivelComissao).reduce((s, i) => s + i.venda, 0);
  const pctComissao = totalVendaElegivel > 0 ? comissao / totalVendaElegivel : 0;
  const baseItem = (item: RawItem) =>
    isElegivelComissao(item) ? item.venda * (1 - pctComissao) : item.venda;
  const metaItem = (item: RawItem) => baseItem(item) * (1 - item.pctMeta);

  const onlyItems = items.filter(i => i.tipo !== 'etapa');
  const itemsOk = onlyItems.filter(i => i.compradoOk);
  const itemsPend = onlyItems.filter(i => !i.compradoOk);

  const totalVendaBruta = onlyItems.reduce((s, i) => s + i.venda, 0);
  const totalVenda = onlyItems.reduce((s, i) => s + baseItem(i), 0);
  const totalMeta = onlyItems.reduce((s, i) => s + metaItem(i), 0);
  const totalComprado = onlyItems.reduce((s, i) => s + i.comprado, 0);

  const itemsComComprado = onlyItems.filter(i => i.comprado > 0);
  const okVenda = itemsComComprado.reduce((s, i) => s + baseItem(i), 0);
  const okMeta = itemsComComprado.reduce((s, i) => s + metaItem(i), 0);
  const okComprado = itemsComComprado.reduce((s, i) => s + i.comprado, 0);
  const okSaving = okVenda - okComprado;
  const okSavingPct = okVenda > 0 ? (okSaving / okVenda) * 100 : 0;
  const okSavingMeta = okMeta - okComprado;
  const okSavingMetaPct = okMeta > 0 ? (okSavingMeta / okMeta) * 100 : 0;

  const pendVenda = itemsPend.reduce((s, i) => s + baseItem(i), 0);
  const pendMeta = itemsPend.reduce((s, i) => s + metaItem(i), 0);
  const potencialSaving = pendVenda - pendMeta;

  // Projeção: só quando >=10% dos itens já têm compra lançada.
  // Usa IQR pra filtrar outliers (itens com saving extremo distorcem a média).
  const compradosRatio = onlyItems.length > 0 ? itemsComComprado.length / onlyItems.length : 0;
  let projecaoSaving: number | null = null;
  let projecaoPct: number | null = null;
  if (compradosRatio >= 0.10) {
    const pcts = itemsComComprado
      .map(i => ({ item: i, pct: baseItem(i) > 0 ? (baseItem(i) - i.comprado) / baseItem(i) : 0 }))
      .sort((a, b) => a.pct - b.pct);
    let cleanSavingPct: number;
    if (pcts.length < 4) {
      cleanSavingPct = okSavingPct;
    } else {
      const q = (p: number) => {
        const idx = (pcts.length - 1) * p;
        const lo = Math.floor(idx), hi = Math.ceil(idx);
        return pcts[lo].pct + (pcts[hi].pct - pcts[lo].pct) * (idx - lo);
      };
      const q1 = q(0.25), q3 = q(0.75), iqr = q3 - q1;
      const lower = q1 - 1.5 * iqr, upper = q3 + 1.5 * iqr;
      const clean = pcts.filter(p => p.pct >= lower && p.pct <= upper);
      const cleanVenda = clean.reduce((s, { item }) => s + baseItem(item), 0);
      const cleanSaving = clean.reduce((s, { item }) => s + (baseItem(item) - item.comprado), 0);
      cleanSavingPct = cleanVenda > 0 ? (cleanSaving / cleanVenda) * 100 : 0;
    }
    projecaoSaving = totalVenda * (cleanSavingPct / 100);
    projecaoPct = cleanSavingPct;
  }

  return {
    totalVendaBruta,
    totalVenda,
    totalMeta,
    totalComprado,
    totalItens: onlyItems.length,
    itensComprados: itemsOk.length,
    itensPendentes: itemsPend.length,
    itensComCompradoLancado: itemsComComprado.length,
    okVenda,
    okSaving,
    okSavingPct,
    okSavingMeta,
    okSavingMetaPct,
    pendVenda,
    pendMeta,
    potencialSaving,
    projecaoSaving,
    projecaoPct,
    comissao,
    pctComissao,
  };
}
