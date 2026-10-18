/**
 * Disciplinas de mão de obra — lista ÚNICA usada no Diário de Obra (lançamento
 * de efetivos) e no Histograma do Relatório Semanal (Francisco/Dany 09/10/26:
 * "mesma base, não digitar duas vezes").
 */
export const MDO_DISCIPLINAS = [
  'BER', 'Civil', 'Pintura', 'Elétrica', 'Hidráulica', 'Drywall',
  'Ar Condicionado', 'Marcenaria', 'Pedras', 'Serralheria', 'Impermeabilização',
  'Gesso', 'Piso', 'Vidro', 'Paisagismo', 'Outros',
] as const;

/** Sugestão de disciplina a partir da categoria (função) do efetivo do diário. */
export const CATEGORIA_TO_DISCIPLINA: Record<string, string> = {
  pedreiro: 'Civil', servente: 'Civil', encarregado: 'Civil', armador: 'Civil',
  eletricista: 'Elétrica', pintor: 'Pintura', gesseiro: 'Gesso', carpinteiro: 'Marcenaria',
};
