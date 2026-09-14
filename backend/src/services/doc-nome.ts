/**
 * Nomenclatura padrão dos documentos gerados pelo sistema (Bruno 14/09/26:
 * "Sempre que gerar documento ter nomenclatura coerente" — WhatsApp E e-mail).
 * Padrão: "<Tipo> <ref> — <Obra>.pdf", sem uuid, sem prefixo "BER — Obra |",
 * sem caracteres proibidos em nome de arquivo.
 */
export function nomeObraLimpo(name: string): string {
  return name
    .replace(/^BER\s*[—–-]\s*Obra\s*\|?\s*/i, '')
    .replace(/[/\\:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nomeDocumento(tipo: string, ref: string, obraName?: string | null): string {
  const partes = [tipo, ref].filter(Boolean).join(' ');
  const obra = obraName ? ` — ${nomeObraLimpo(obraName)}` : '';
  return `${partes}${obra}.pdf`.replace(/\s+/g, ' ');
}

/** dd-mm-aaaa a partir de Date/ISO (UTC, mesmo critério dos PDFs). */
export function dataArquivo(d: Date | string): string {
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }).replace(/\//g, '-');
}
