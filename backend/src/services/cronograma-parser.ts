import Anthropic from '@anthropic-ai/sdk';

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
Retorne APENAS JSON minificado (sem espaços, sem markdown, sem texto extra):
{"progresso_geral":<0-100>,"tarefas":[{"w":"1.1","n":"Nome","i":"2025-01-15","f":"2025-02-10","d":26,"p":75,"r":false,"v":2}]}

Chaves: w=wbs, n=nome, i=inicio, f=fim, d=duracao_dias, p=percentual_concluido, r=eh_resumo, v=nivel.
Regras:
- progresso_geral: média ponderada por duração do p das tarefas não-resumo.
- r=true para linhas que agrupam outras (fase, etapa, sumário).
- v: 1=fase principal, 2=subetapa, 3+=atividade folha.
- Datas ISO YYYY-MM-DD ou null se ausente.
- p: 0-100. Sem coluna de %: fim<hoje→100, inicio>hoje→0, em andamento→proporcional.
- Inclua TODAS as linhas, inclusive resumos.`;

export async function parseCronogramaPDF(
  pdfBuffer: Buffer,
): Promise<CronogramaParseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada');

  const client = new Anthropic({ apiKey });

  const message = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 32000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBuffer.toString('base64'),
            },
          },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  }).finalMessage();

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  console.log('[CRONOGRAMA PARSE] resposta bruta:', text.slice(0, 500));

  // Strip markdown fences if present
  const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  const clean = start !== -1 && end !== -1 ? stripped.slice(start, end + 1) : stripped;

  type RawTask = {
    // compact keys (new prompt)
    w?: string; n?: string; i?: string | null; f?: string | null; d?: number | null; p?: number; r?: boolean; v?: number;
    // verbose keys (backward compat)
    wbs?: string; nome?: string; inicio?: string | null; fim?: string | null;
    duracao_dias?: number | null; percentual_concluido?: number; eh_resumo?: boolean; nivel?: number;
  };
  let raw: { progresso_geral?: number; tarefas?: RawTask[] } = {};
  try {
    raw = JSON.parse(clean);
  } catch {
    // Try to salvage truncated JSON: extract complete task objects before truncation
    console.warn('[CRONOGRAMA PARSE] JSON truncado, tentando recuperação parcial...');
    const pgMatch = clean.match(/"progresso_geral"\s*:\s*(\d+)/);
    const progressoGeral = pgMatch ? parseInt(pgMatch[1]) : 0;
    const taskMatches = [...clean.matchAll(/\{[^{}]*"(?:n|nome)"\s*:\s*"[^"]*"[^{}]*\}/g)];
    if (taskMatches.length === 0) {
      console.error('[CRONOGRAMA PARSE] JSON inválido e sem recuperação:', clean.slice(0, 500));
      throw new Error('Claude não retornou JSON válido. O cronograma pode ser muito extenso — tente um PDF com menos páginas ou exporte apenas as tarefas principais.');
    }
    console.log(`[CRONOGRAMA PARSE] Recuperados ${taskMatches.length} itens de JSON truncado`);
    raw = { progresso_geral: progressoGeral, tarefas: taskMatches.map(m => { try { return JSON.parse(m[0]); } catch { return null; } }).filter(Boolean) as RawTask[] };
  }

  const mapTask = (t: RawTask): CronogramaTask => ({
    wbs: t.w ?? t.wbs ?? '',
    nome: t.n ?? t.nome ?? '',
    inicio: t.i ?? t.inicio ?? null,
    fim: t.f ?? t.fim ?? null,
    duracaoDias: t.d ?? t.duracao_dias ?? null,
    percentualConcluido: Math.min(100, Math.max(0, t.p ?? t.percentual_concluido ?? 0)),
    ehResumo: !!(t.r ?? t.eh_resumo),
    nivel: t.v ?? t.nivel ?? 1,
  });

  return {
    progressoGeral: Math.min(100, Math.max(0, Math.round(raw.progresso_geral ?? 0))),
    tarefas: (raw.tarefas ?? []).map(mapTask),
  };
}
