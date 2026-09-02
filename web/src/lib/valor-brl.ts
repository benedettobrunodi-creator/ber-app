/**
 * Parser de valores monetários/numéricos em formato brasileiro (02/09/26).
 * Aceita: "15.000,00" · "15000,00" · "15000.00" · "15000" · "R$ 15.000,00" · "9.000".
 * Nasceu de dois bugs reais no mesmo dia: NF do Josué (9.000,00 → NaN) e
 * Change Order do Bruno (form acusava campo vazio com tudo preenchido).
 * O padrão ingênuo `replace(',', '.')` quebra com ponto de milhar — não usar.
 */
export function parseValorBRL(raw: unknown): number {
  let s = String(raw ?? '').trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (s === '') return NaN;
  if (s.includes('.') && s.includes(',')) {
    // "9.000,00" — ponto = milhar, vírgula = decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    // "9000,00" — vírgula decimal
    s = s.replace(',', '.');
  } else if (/\.\d{3}$/.test(s)) {
    // "9.000" — ponto de milhar sem casas decimais
    s = s.replace(/\./g, '');
  }
  return Number(s);
}
