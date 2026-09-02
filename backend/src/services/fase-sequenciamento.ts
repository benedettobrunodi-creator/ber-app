/**
 * Fase do Sequenciamento (PP1..PP6) — leitura focada do cronograma + fase efetiva.
 * (02/09/26, pedido do Bruno; testes validados em 573.26 Leila e Higienópolis)
 *
 * Leitura focada: em vez de extrair o gantt inteiro (impreciso), a IA lê SÓ o
 * % geral de avanço (linha "OBRA" → linha-raiz → média das fases nível 1).
 * Precedência da fase efetiva: manual > cronograma > relatório semanal.
 * Falha de IA nunca quebra nada — cai pro relatório (comportamento antigo).
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../config/database';
import { downloadFile } from './storage';

const PROMPT = `Este PDF é um cronograma de obra (gantt). Encontre o PERCENTUAL GERAL DE AVANÇO da obra.

Onde procurar, em ordem de prioridade:
1. A linha-resumo chamada "OBRA" (ou similar) — o % concluído dela.
2. A linha-raiz do projeto (id 0 / primeira linha, nome = título do arquivo).
3. Se nenhuma existir, a média ponderada por duração das fases de nível 1.

Retorne APENAS JSON minificado: {"pct":<0-100>,"fonte":"<texto exato da linha usada>"}`;

// 02/09/26: 1.5-* e 2.0-flash descontinuados pela Google; 3.6-flash é o atual.
const MODELS = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-3-flash-preview'];

export const FASES_SEQ = ['PP1', 'PP2', 'PP3', 'PP4', 'PP5', 'PP6'] as const;

export function faseFromPct(pct: number): string {
  if (pct >= 100) return 'PP6';
  if (pct >= 75) return 'PP5';
  if (pct >= 50) return 'PP4';
  if (pct >= 25) return 'PP3';
  return 'PP2';
}

export function faseFromStatusEPct(status: string, pct: number | null): string | null {
  if (status === 'nao_iniciada' || status === 'planejamento') return 'PP1';
  if (status === 'pos_obra' || status === 'concluida') return 'PP6';
  if (pct == null) return null;
  return faseFromPct(pct);
}

/** Lê o % geral de um cronograma PDF (leitura focada). Lança em falha total. */
export async function lerPctCronograma(pdfBuffer: Buffer): Promise<{ pct: number; fonte: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');
  const genAI = new GoogleGenerativeAI(apiKey);

  let lastErr: Error | null = null;
  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 500 },
      });
      const res = await model.generateContent([
        { inlineData: { mimeType: 'application/pdf', data: pdfBuffer.toString('base64') } },
        PROMPT,
      ]);
      const out = JSON.parse(res.response.text()) as { pct: number; fonte?: string };
      if (typeof out.pct !== 'number' || out.pct < 0 || out.pct > 100) {
        throw new Error(`pct inválido: ${out.pct}`);
      }
      return { pct: Math.round(out.pct), fonte: String(out.fonte ?? '').slice(0, 120) };
    } catch (e) {
      lastErr = e as Error;
      console.warn(`[FASE-SEQ] modelo ${modelName} falhou: ${(e as Error).message.slice(0, 140)}`);
    }
  }
  throw lastErr ?? new Error('leitura focada falhou');
}

/**
 * Roda a leitura focada no cronograma mais recente da obra e grava o resultado.
 * Fire-and-forget nos gatilhos (upload de cronograma / envio de relatório):
 * falha só loga, nunca propaga.
 */
export async function atualizarLeituraCronograma(obraId: string): Promise<void> {
  const cron = await prisma.cronograma.findFirst({
    where: { obraId },
    orderBy: { updatedAt: 'desc' },
  });
  if (!cron) return;
  const buffer = await downloadFile(cron.fileUrl);
  const { pct, fonte } = await lerPctCronograma(buffer);
  await prisma.cronograma.update({
    where: { id: cron.id },
    data: { pctFocado: pct, pctFocadoEm: new Date(), pctFocadoFonte: fonte },
  });
  console.log(`[FASE-SEQ] obra=${obraId} pct=${pct}% (fonte: ${fonte})`);
}

export interface FaseObra {
  faseEfetiva: string | null;
  origem: 'manual' | 'cronograma' | 'relatorio' | null;
  faseManual: string | null;
  pctCronograma: number | null;
  pctCronogramaEm: Date | null;
  pctCronogramaFonte: string | null;
  pctRelatorio: number | null;
  faseCronograma: string | null;
  faseRelatorio: string | null;
  divergente: boolean;
}

/** Fase efetiva da obra + os dois lados da reconciliação. */
export async function getFaseObra(obraId: string): Promise<FaseObra> {
  const [obra, cron, relatorio] = await Promise.all([
    prisma.obra.findUniqueOrThrow({ where: { id: obraId }, select: { status: true, faseSeqManual: true } }),
    prisma.cronograma.findFirst({
      where: { obraId, pctFocado: { not: null } },
      orderBy: { updatedAt: 'desc' },
      select: { pctFocado: true, pctFocadoEm: true, pctFocadoFonte: true },
    }),
    prisma.relatorioSemanal.findFirst({
      where: { obraId },
      orderBy: { numero: 'desc' },
      select: { avancoPct: true },
    }),
  ]);

  const pctCronograma = cron?.pctFocado ?? null;
  const pctRelatorio = relatorio ? Number(relatorio.avancoPct) : null;
  const faseCronograma = pctCronograma != null ? faseFromStatusEPct(obra.status, pctCronograma) : null;
  const faseRelatorio = faseFromStatusEPct(obra.status, pctRelatorio);

  let faseEfetiva: string | null;
  let origem: FaseObra['origem'];
  if (obra.faseSeqManual) {
    faseEfetiva = obra.faseSeqManual; origem = 'manual';
  } else if (faseCronograma) {
    faseEfetiva = faseCronograma; origem = 'cronograma';
  } else if (faseRelatorio) {
    faseEfetiva = faseRelatorio; origem = 'relatorio';
  } else {
    faseEfetiva = null; origem = null;
  }

  return {
    faseEfetiva,
    origem,
    faseManual: obra.faseSeqManual,
    pctCronograma,
    pctCronogramaEm: cron?.pctFocadoEm ?? null,
    pctCronogramaFonte: cron?.pctFocadoFonte ?? null,
    pctRelatorio,
    faseCronograma,
    faseRelatorio,
    divergente: !!(faseCronograma && faseRelatorio && faseCronograma !== faseRelatorio),
  };
}
