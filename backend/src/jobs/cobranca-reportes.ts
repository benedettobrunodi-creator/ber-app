// Cobrança automática de Diário de Obra e Relatório Semanal (Bruno 16/10/26):
// pra cada obra EM ANDAMENTO, se o diário do dia útil anterior não estiver
// FECHADO, ou se a semana anterior não tiver relatório semanal ENVIADO ao
// cliente, dispara e-mail de cobrança pra Bruno + Gritti + Chris + o gestor
// (coordenador) da obra. Sem gestor definido, vai só pro trio fixo.
import { prisma } from '../config/database';

const DESTINATARIOS_FIXOS = [
  'bruno@ber-engenharia.com.br',
  'francisco.gritti@ber-engenharia.com.br',
  'christian.palermo@ber-engenharia.com.br',
];

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000; // America/Sao_Paulo = UTC-3, sem horário de verão

/** Hoje (data-calendário em BRT) como Date UTC à meia-noite — compatível com colunas @db.Date. */
function hojeBrtDateOnly(): Date {
  const agora = new Date(Date.now() - BRT_OFFSET_MS);
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
}

function addDias(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

const fmtBr = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function ehFeriado(data: Date): Promise<boolean> {
  const f = await prisma.feriado.findFirst({ where: { data, ativo: true } });
  return !!f;
}

async function obrasAtivas() {
  return prisma.obra.findMany({
    where: { status: 'em_andamento' },
    select: {
      id: true,
      name: true,
      createdAt: true,
      coordinator: { select: { name: true, email: true } },
    },
    orderBy: { name: 'asc' },
  });
}

function destinatarios(coordEmail?: string | null): string[] {
  const set = new Set(DESTINATARIOS_FIXOS);
  if (coordEmail) set.add(coordEmail.toLowerCase());
  return [...set];
}

async function enviarCobranca(to: string[], subject: string, titulo: string, corpo: string): Promise<void> {
  const { htmlAvisoInterno } = await import('../services/email-equipe');
  const { sendEmailObra } = await import('../services/email-obras');
  await sendEmailObra({
    to,
    subject,
    html: htmlAvisoInterno(titulo, corpo, 'Cobrança automática do BER App — Excelência Operacional'),
  });
}

/** Diário de obra: cobra o dia útil ANTERIOR (seg-sex, pulando feriado) sem
 *  diário FECHADO/APROVADO. Rodar ter-sáb de manhã. */
export async function cobrarDiariosFaltantes(): Promise<{ verificadas: number; faltantes: number; dia: string | null }> {
  const alvo = addDias(hojeBrtDateOnly(), -1);
  const dow = alvo.getUTCDay();
  if (dow === 0 || dow === 6) return { verificadas: 0, faltantes: 0, dia: null }; // fim de semana não cobra
  if (await ehFeriado(alvo)) return { verificadas: 0, faltantes: 0, dia: null };

  const appUrl = process.env.APP_PUBLIC_URL ?? 'https://ber-app.vercel.app';
  const obras = await obrasAtivas();
  let faltantes = 0;

  for (const obra of obras) {
    if (obra.createdAt > addDias(alvo, 1)) continue; // obra nem existia no dia cobrado
    const diario = await prisma.diarioObra.findFirst({
      where: { obraId: obra.id, data: alvo, status: { in: ['fechado', 'aprovado'] } },
      select: { id: true },
    });
    if (diario) continue;

    faltantes++;
    const corpo = `
      <p style="font-size:14px;color:#2D2D2D;margin:0 0 10px;">
        A obra <strong>${esc(obra.name)}</strong> está sem o <strong>diário de obra de ${fmtBr(alvo)}</strong> fechado no BER App.
      </p>
      <p style="font-size:13px;color:#5C5E54;margin:0 0 14px;">
        ${obra.coordinator?.name ? `Gestor da obra: <strong>${esc(obra.coordinator.name)}</strong>.` : 'Obra sem gestor definido no app.'}
        O diário precisa ser preenchido e <strong>fechado</strong> todo dia útil.
      </p>
      <p style="margin:0;"><a href="${appUrl}/diario/${obra.id}" style="color:#5E6B0F;font-weight:600;font-size:13px;">Preencher o diário →</a></p>`;
    await enviarCobranca(
      destinatarios(obra.coordinator?.email),
      `⚠️ Diário de obra não preenchido — ${obra.name} (${fmtBr(alvo)})`,
      '⚠️ Diário de obra em falta',
      corpo,
    ).catch((e) => console.error('[cobranca] e-mail diário falhou:', obra.name, (e as Error).message));
  }
  return { verificadas: obras.length, faltantes, dia: fmtBr(alvo) };
}

/** Relatório semanal: na segunda, cobra a SEMANA ANTERIOR (seg-dom) sem
 *  relatório criado OU criado mas sem envio ao cliente (enviadoEm). */
export async function cobrarRelatoriosSemanaisFaltantes(): Promise<{ verificadas: number; faltantes: number; semana: string }> {
  const hoje = hojeBrtDateOnly(); // segunda
  const fimSemana = addDias(hoje, -1); // domingo
  const iniSemana = addDias(hoje, -7); // segunda anterior
  const appUrl = process.env.APP_PUBLIC_URL ?? 'https://ber-app.vercel.app';
  const obras = await obrasAtivas();
  let faltantes = 0;

  for (const obra of obras) {
    if (obra.createdAt > fimSemana) continue;
    const rel = await prisma.relatorioSemanal.findFirst({
      where: { obraId: obra.id, periodoFim: { gte: iniSemana, lte: fimSemana } },
      select: { id: true, numero: true, enviadoEm: true },
      orderBy: { periodoFim: 'desc' },
    });
    if (rel?.enviadoEm) continue;

    faltantes++;
    const motivo = rel
      ? `O relatório nº ${rel.numero} foi <strong>criado mas não consta envio ao cliente</strong>.`
      : 'Nenhum relatório semanal foi criado pra essa semana.';
    const corpo = `
      <p style="font-size:14px;color:#2D2D2D;margin:0 0 10px;">
        A obra <strong>${esc(obra.name)}</strong> está sem o <strong>relatório semanal de ${fmtBr(iniSemana)} a ${fmtBr(fimSemana)}</strong> no BER App.
      </p>
      <p style="font-size:13px;color:#5C5E54;margin:0 0 14px;">
        ${motivo}
        ${obra.coordinator?.name ? ` Gestor da obra: <strong>${esc(obra.coordinator.name)}</strong>.` : ' Obra sem gestor definido no app.'}
      </p>
      <p style="margin:0;"><a href="${appUrl}/obras/${obra.id}/relatorios" style="color:#5E6B0F;font-weight:600;font-size:13px;">Abrir os relatórios da obra →</a></p>`;
    await enviarCobranca(
      destinatarios(obra.coordinator?.email),
      `⚠️ Relatório semanal pendente — ${obra.name} (${fmtBr(iniSemana)}–${fmtBr(fimSemana)})`,
      '⚠️ Relatório semanal em falta',
      corpo,
    ).catch((e) => console.error('[cobranca] e-mail relatório falhou:', obra.name, (e as Error).message));
  }
  return { verificadas: obras.length, faltantes, semana: `${fmtBr(iniSemana)} a ${fmtBr(fimSemana)}` };
}
