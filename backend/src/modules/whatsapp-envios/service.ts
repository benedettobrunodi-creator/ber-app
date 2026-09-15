import { prisma } from '../../config/database';
import { nomeObraLimpo, dataArquivo } from '../../services/doc-nome';

// Régua de destinatários do relatório semanal por WhatsApp (Bruno 14/09/26, 23:29):
// stakeholders da obra com "Recebe relatório" marcado E telefone válido
// + SEMPRE Bruno, Chris e Gritti ("Chris e Gritti sempre recebem tb").
const SEMPRE = [
  { nome: 'Bruno Di Benedetto', telefone: '5511999478989' },
  { nome: 'Christian Palermo', telefone: '5511937744490' },
  { nome: 'Francisco Gritti', telefone: '5511981328771' },
];

export function normalizarTelefone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11) return `55${digits}`; // DDD + 9 dígitos
  if (digits.length === 13 && digits.startsWith('55')) return digits;
  if (digits.length === 12 && digits.startsWith('55')) return digits; // fixo com DDI
  if (digits.length === 10) return `55${digits}`; // fixo sem DDI
  return null;
}


/** Enfileira o PDF do relatório pros destinatários; o worker do Mac mini dispara em até 2 min. */
export async function enfileirarRelatorioWhatsapp(obraId: string, relatorioId: string) {
  const relatorio = await prisma.relatorioSemanal.findFirst({ where: { id: relatorioId, obraId } });
  if (!relatorio) throw new Error('Relatório não encontrado');
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { name: true } });
  if (!obra) throw new Error('Obra não encontrada');

  const stakeholders = await prisma.obraStakeholder.findMany({
    where: { obraId, recebeRelatorio: true, telefone: { not: null } },
  });
  const registrados = stakeholders
    .map((s) => ({ nome: s.nome, telefone: normalizarTelefone(s.telefone!) }))
    .filter((s): s is { nome: string; telefone: string } => !!s.telefone);

  const porTelefone = new Map<string, { nome: string; telefone: string }>();
  for (const d of [...SEMPRE, ...registrados]) {
    if (!porTelefone.has(d.telefone)) porTelefone.set(d.telefone, d);
  }
  const destinatarios = [...porTelefone.values()];

  const legenda = `📋 Relatório Semanal nº ${relatorio.numero} — ${obra.name}. Enviado automaticamente pelo BER App.`;
  const arquivoPath = `/v1/obras/${obraId}/relatorios/${relatorioId}/pdf`;
  const arquivoNome = `Relatório Semanal ${String(relatorio.numero).padStart(2, '0')} — ${dataArquivo(relatorio.periodoFim)} — ${nomeObraLimpo(obra.name)}.pdf`;

  // idempotência: não re-enfileira pro mesmo telefone se já há envio pendente/enviado deste relatório
  const existentes = await prisma.whatsappEnvio.findMany({
    where: { relatorioId, telefone: { in: destinatarios.map((d) => d.telefone) }, status: { in: ['pendente', 'enviado'] } },
    select: { telefone: true },
  });
  const jaTem = new Set(existentes.map((e) => e.telefone));
  const novos = destinatarios.filter((d) => !jaTem.has(d.telefone));

  if (novos.length > 0) {
    await prisma.whatsappEnvio.createMany({
      data: novos.map((d) => ({
        obraId, relatorioId, destinatario: d.nome, telefone: d.telefone, legenda, arquivoPath, arquivoNome, status: 'pendente',
      })),
    });
  }
  return { criados: novos.length, jaEnfileirados: jaTem.size, destinatarios: novos.map((d) => d.nome) };
}

/**
 * Diário de obra por WhatsApp (Bruno 14/09 23:35: "Os diários tbm. Sempre enviar").
 * Fixos (Bruno/Chris/Gritti) SEMPRE que o diário fecha; stakeholders com
 * "Recebe diário" + telefone entram só quando o gestor fechou COM envio
 * (o "Fechar sem enviar" continua poupando o lado do cliente).
 */
export async function enfileirarDiarioWhatsapp(obraId: string, diarioId: string, opts: { incluirStakeholders: boolean }) {
  const diario = await prisma.diarioObra.findFirst({ where: { id: diarioId, obraId }, include: { obra: { select: { name: true } } } });
  if (!diario) throw new Error('Diário não encontrado');

  let registrados: { nome: string; telefone: string }[] = [];
  if (opts.incluirStakeholders) {
    const stakeholders = await prisma.obraStakeholder.findMany({
      where: { obraId, recebeDiario: true, telefone: { not: null } },
    });
    registrados = stakeholders
      .map((s) => ({ nome: s.nome, telefone: normalizarTelefone(s.telefone!) }))
      .filter((s): s is { nome: string; telefone: string } => !!s.telefone);
  }

  const porTelefone = new Map<string, { nome: string; telefone: string }>();
  for (const d of [...SEMPRE, ...registrados]) {
    if (!porTelefone.has(d.telefone)) porTelefone.set(d.telefone, d);
  }
  const destinatarios = [...porTelefone.values()];

  const dataFmt = new Date(diario.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  const legenda = `📍 Diário de obra ${dataFmt} — ${diario.obra.name}. Enviado automaticamente pelo BER App.`;
  const arquivoPath = `/v1/diario/${diarioId}/pdf`;
  const arquivoNome = `Diário de Obra ${dataFmt.replace(/\//g, '-')} — ${nomeObraLimpo(diario.obra.name)}.pdf`;

  const existentes = await prisma.whatsappEnvio.findMany({
    where: { diarioId, telefone: { in: destinatarios.map((d) => d.telefone) }, status: { in: ['pendente', 'enviado'] } },
    select: { telefone: true },
  });
  const jaTem = new Set(existentes.map((e) => e.telefone));
  const novos = destinatarios.filter((d) => !jaTem.has(d.telefone));

  if (novos.length > 0) {
    await prisma.whatsappEnvio.createMany({
      data: novos.map((d) => ({
        obraId, diarioId, destinatario: d.nome, telefone: d.telefone, legenda, arquivoPath, arquivoNome, status: 'pendente',
      })),
    });
  }
  return { criados: novos.length, jaEnfileirados: jaTem.size, destinatarios: novos.map((d) => d.nome) };
}
