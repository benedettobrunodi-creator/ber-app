/**
 * E-mails por área responsável — usado no gatilho de item do Sequenciamento
 * (FVS) em aberto e vencido. Definido com o Bruno em 01/09/26.
 * Pra trocar/adicionar gente, é só editar essas listas.
 */
export const RESPONSAVEL_AREA_EMAILS: Record<string, string[]> = {
  PMO: ['francisco.gritti@ber-engenharia.com.br', 'leandro.colman@ber-engenharia.com.br'],
  Engenharia: ['christian.palermo@ber-engenharia.com.br'],
  Compras: ['emerson.machado@ber-engenharia.com.br'],
  Financeiro: ['caroline.souza@ber-engenharia.com.br'],
  Comercial: ['camila.santos@ber-engenharia.com.br'],
};

export const BRUNO_EMAIL = 'bruno@ber-engenharia.com.br';

/** Destinatários de um alerta de item da área X: a própria área + PMO +
 *  Engenharia + Bruno sempre, sem duplicar. */
export function destinatariosAlerta(area: string): string[] {
  const set = new Set<string>([
    ...(RESPONSAVEL_AREA_EMAILS[area] ?? []),
    ...RESPONSAVEL_AREA_EMAILS.PMO,
    ...RESPONSAVEL_AREA_EMAILS.Engenharia,
    BRUNO_EMAIL,
  ]);
  return Array.from(set);
}
