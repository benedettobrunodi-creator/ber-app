// Cronograma PDF parser — Gemini 2.0 Flash (já configurado em GEMINI_API_KEY).
// Reativado em 2026-06-25 pra desbloquear "Reprocessar cronograma".

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface CronogramaTask {
  wbs: string;
  nome: string;
  inicio: string | null;
  fim: string | null;
  duracaoDias: number | null;
  percentualConcluido: number;
  ehResumo: boolean;
  nivel: number;
}

export interface CronogramaParseResult {
  progressoGeral: number;
  tarefas: CronogramaTask[];
}

const PROMPT = `Analise este cronograma de obra em PDF e extraia TODAS as linhas/tarefas.

Retorne APENAS JSON minificado (sem markdown, sem texto extra) no formato:
{"progresso_geral":<0-100>,"tarefas":[{"w":"1.1","n":"Nome","i":"2025-01-15","f":"2025-02-10","d":26,"p":75,"r":false,"v":2}]}

Chaves: w=wbs, n=nome, i=inicio, f=fim, d=duracao_dias, p=percentual_concluido, r=eh_resumo, v=nivel.

Regras:
- "progresso_geral": média ponderada por duração do "p" das tarefas não-resumo.
- "r"=true para linhas que agrupam outras (fase, etapa, sumário, MS Project parent).
- "v": 1=fase principal, 2=subetapa, 3+=atividade folha.
- Datas no formato ISO YYYY-MM-DD. Se não encontrar, use null.
- "p": 0-100. Se a planilha tem coluna "% concluído" ou "% complete", use ela. Senão estime pela data: fim<hoje→100, inicio>hoje→0, em andamento→proporcional.
- INCLUA TODAS AS LINHAS, inclusive a tarefa-raiz do projeto e todos os resumos. Não trunque.`;

export async function parseCronogramaPDF(
  pdfBuffer: Buffer,
): Promise<CronogramaParseResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 32000 },
  });

  const result = await model.generateContent([
    { inlineData: { mimeType: 'application/pdf', data: pdfBuffer.toString('base64') } },
    { text: PROMPT },
  ]);

  const text = result.response.text();
  console.log('[CRONOGRAMA PARSE] resposta (primeiros 300):', text.slice(0, 300));

  // Gemini com responseMimeType=application/json devolve JSON puro, mas tolera
  // markdown fences caso o modelo escape.
  const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  const clean = start !== -1 && end !== -1 ? stripped.slice(start, end + 1) : stripped;

  type RawTask = {
    w?: string; n?: string; i?: string | null; f?: string | null; d?: number | null; p?: number; r?: boolean; v?: number;
    wbs?: string; nome?: string; inicio?: string | null; fim?: string | null;
    duracao_dias?: number | null; percentual_concluido?: number; eh_resumo?: boolean; nivel?: number;
  };
  let raw: { progresso_geral?: number; tarefas?: RawTask[] };
  try {
    raw = JSON.parse(clean);
  } catch {
    console.error('[CRONOGRAMA PARSE] JSON inválido:', clean.slice(0, 500));
    throw new Error('Gemini não retornou JSON válido — tente subir o PDF novamente ou simplifique o cronograma.');
  }

  const mapTask = (t: RawTask): CronogramaTask => ({
    wbs:                 t.w ?? t.wbs ?? '',
    nome:                t.n ?? t.nome ?? '',
    inicio:              t.i ?? t.inicio ?? null,
    fim:                 t.f ?? t.fim ?? null,
    duracaoDias:         t.d ?? t.duracao_dias ?? null,
    percentualConcluido: Math.min(100, Math.max(0, t.p ?? t.percentual_concluido ?? 0)),
    ehResumo:            !!(t.r ?? t.eh_resumo),
    nivel:               t.v ?? t.nivel ?? 1,
  });

  return {
    progressoGeral: Math.min(100, Math.max(0, Math.round(raw.progresso_geral ?? 0))),
    tarefas:        (raw.tarefas ?? []).map(mapTask),
  };
}
