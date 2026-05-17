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

const PROMPT = `Analise este cronograma de obra em PDF e extraia todas as tarefas.
Retorne APENAS um JSON válido (sem markdown, sem texto extra) no seguinte formato:
{
  "progresso_geral": <número de 0 a 100>,
  "tarefas": [
    {
      "wbs": "1.1",
      "nome": "Nome da tarefa",
      "inicio": "2025-01-15",
      "fim": "2025-02-10",
      "duracao_dias": 26,
      "percentual_concluido": 75,
      "eh_resumo": false,
      "nivel": 2
    }
  ]
}

Regras:
- "progresso_geral": média ponderada pela duração do percentual_concluido das tarefas não-resumo. Se não houver dado de progresso, calcule pela proporção de tarefas concluídas (fim < hoje).
- "eh_resumo": true para linhas que agrupam outras (fase, etapa, sumário).
- "nivel": 1 = fase principal, 2 = subetapa, 3+ = atividade folha.
- Datas no formato ISO YYYY-MM-DD. Se não encontrar, use null.
- "percentual_concluido": 0 a 100. Se não houver coluna de % no cronograma, estime pela data: se fim < hoje use 100, se inicio > hoje use 0, se em andamento estime proporcionalmente.
- Inclua TODAS as linhas, inclusive resumos.`;

export async function parseCronogramaPDF(
  pdfBuffer: Buffer,
): Promise<CronogramaParseResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });

  const result = await model.generateContent([
    {
      inlineData: {
        data: pdfBuffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    },
    PROMPT,
  ]);

  const text = result.response.text();
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let raw: {
    progresso_geral: number;
    tarefas: {
      wbs: string;
      nome: string;
      inicio: string | null;
      fim: string | null;
      duracao_dias: number | null;
      percentual_concluido: number;
      eh_resumo: boolean;
      nivel: number;
    }[];
  };
  try {
    raw = JSON.parse(clean);
  } catch {
    throw new Error('Gemini não retornou JSON válido: ' + clean.slice(0, 200));
  }

  return {
    progressoGeral: Math.min(100, Math.max(0, Math.round(raw.progresso_geral ?? 0))),
    tarefas: (raw.tarefas ?? []).map((t) => ({
      wbs: t.wbs ?? '',
      nome: t.nome ?? '',
      inicio: t.inicio ?? null,
      fim: t.fim ?? null,
      duracaoDias: t.duracao_dias ?? null,
      percentualConcluido: Math.min(100, Math.max(0, t.percentual_concluido ?? 0)),
      ehResumo: !!t.eh_resumo,
      nivel: t.nivel ?? 1,
    })),
  };
}
