// Extração de quantitativos a partir de PDFs de projeto (arquitetura, elétrica,
// hidráulica, layout). Segue o padrão de cronograma-parser.ts: PDF direto pro
// Gemini via inlineData, JSON estruturado como resposta, fallback entre modelos.
//
// A IA lê os PDFs enviados e devolve itens alinhados com a estrutura padrão de
// orçamento da BÈR (23 etapas). Itens administrativos (Serviços Preliminares,
// Canteiro, Equipe de Obra, Taxa Adm, Impostos) NÃO devem vir da IA — quem
// preenche esses é o orçamentista.

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface QuantitativoParseItem {
  etapa: string;      // etapa da planilha padrão BÈR (ex: "REVESTIMENTOS E PISOS")
  descricao: string;  // descrição do item (ex: "Piso Vinílico em placa 50x50 LVT")
  unidade: string;    // m2, ml, un, m3, vb
  quantidade: number;
  origem?: string;    // "MIG-03-CON-EX-PLA-03.01: SUÍTE 01, área 25.4 m²"
  confianca?: number; // 0-1: a IA se sente confiante da resposta?
}

export interface QuantitativoParseResult {
  observacoes: string;      // resumo do que a IA extraiu, comentários gerais
  itens: QuantitativoParseItem[];
}

const ETAPAS_PADRAO = [
  'DEMOLIÇÕES E RETIRADAS',
  'REMOÇÕES E DESCARTES',
  'PISO ELEVADO',
  'GESSO E DRYWALL',
  'INSTALAÇÕES ELÉTRICAS E DE ILUMINAÇÃO',
  'INSTALAÇÕES DE DADOS E VOZ',
  'INSTALAÇÕES HIDROSSANITÁRIAS',
  'SPRIKLERS',
  'SISTEMA DE DETECÇÃO E ALARME DE INCÊNDIO',
  'INSTALAÇÕES DE CONDICIONAMENTO DE AR',
  'REVESTIMENTOS E PISOS',
  'VIDROS E ESPELHOS',
  'FORROS',
  'PINTURA',
  'COMUNICAÇÃO VISUAL',
  'PEDRAS E MÁRMORES',
];

const PROMPT = `Você é um orçamentista de obra experiente. Analise os PDFs de projeto anexados (arquitetura, elétrica, hidráulica, layout) e extraia TODOS os itens quantificáveis que precisarão ser cotados no orçamento.

Retorne APENAS JSON minificado (sem markdown, sem texto extra) no formato:
{"obs":"resumo geral","i":[{"e":"ETAPA","d":"Descrição do item","u":"m2","q":10.5,"o":"origem","c":0.9}]}

Chaves: obs=observações gerais, i=itens, e=etapa, d=descrição, u=unidade, q=quantidade, o=origem/localização na prancha, c=confiança (0-1).

REGRAS FORTES:

1. **ETAPA** deve ser EXATAMENTE uma das seguintes (copie literalmente):
${ETAPAS_PADRAO.map(e => '   - ' + e).join('\n')}

2. **UNIDADE** só pode ser: m2, ml, un, m3, vb.

3. **NÃO INCLUA** itens administrativos (ART, Seguro, PCMSO, canteiro, taxa de administração, impostos, equipe de obra, limpeza). Esses são preenchidos manualmente pelo orçamentista.

4. **Escopo por ambiente** (Civil): pra cada ambiente do projeto de arquitetura, extraia os serviços descritos nas notas ("regularizar contrapiso", "instalar novo forro em gesso", "impermeabilização") como itens separados. Use a área do ambiente pra quantificar quando aplicável.

5. **Elétrica**: conte cada tipo de ponto separadamente (tomadas baixas simples, tomadas médias duplas, interruptores, pontos AC, pontos de rede, fitas LED). Some por tipo, não por ambiente. Unidade "un".

6. **Pisos**: se a prancha traz uma tabela de acabamentos (como Huawei EZTower), use a área da tabela como fonte da verdade. Se não, calcule pela geometria dos ambientes.

7. **Drywall e Gesso**: separe paredes/septos a construir vs a demolir. Meça em m². Reforços em ml.

8. **Confiança (c)**: 0.9+ quando o dado veio de tabela pronta ou anotação explícita; 0.7-0.9 quando você mediu na planta com escala; abaixo de 0.7 quando extrapolou/estimou. Nunca omita o campo c.

9. **Origem (o)**: sempre indique de qual prancha e ambiente veio o dado (ex: "MIG-03-CON-EX-PLA-03.01: SUÍTE 01"). Isso ajuda a Bruna a revisar.

10. **Não invente**. Se não conseguir extrair uma quantidade específica, não inclua o item. Melhor ter 30 itens confiáveis do que 100 duvidosos.

Priorize QUALIDADE de dados sobre quantidade. Bruna vai revisar tudo depois.`;

interface ParserOptions {
  fileName?: string; // pra log
}

/**
 * Parseia N PDFs em uma única chamada Gemini — o modelo cruza as pranchas
 * (arquitetura ↔ elétrica ↔ hidráulica) e devolve itens consolidados.
 */
export async function parseQuantitativoPDFs(
  pdfBuffers: Array<{ buffer: Buffer; fileName: string }>,
  _opts: ParserOptions = {},
): Promise<QuantitativoParseResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');
  if (pdfBuffers.length === 0) throw new Error('Nenhum PDF fornecido');

  const genAI = new GoogleGenerativeAI(apiKey);

  // Prioridade: Gemini 2.5 Pro (mais preciso pra plantas) → Flash como fallback.
  const MODELS = [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-2.0-flash',
  ];

  const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];
  for (const p of pdfBuffers) {
    parts.push({
      inlineData: { mimeType: 'application/pdf', data: p.buffer.toString('base64') },
    });
    parts.push({ text: `Arquivo anexado: ${p.fileName}` });
  }
  parts.push({ text: PROMPT });

  let text = '';
  let modelUsado = '';
  let lastErr: Error | null = null;
  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 65536 },
      });
      const result = await model.generateContent(parts);
      text = result.response.text();
      modelUsado = modelName;
      console.log(`[QUANT PARSE] modelo ${modelName} OK — ${text.length} chars`);
      break;
    } catch (err) {
      lastErr = err as Error;
      console.warn(`[QUANT PARSE] modelo ${modelName} falhou: ${lastErr.message.slice(0, 200)}`);
    }
  }
  if (!text) throw lastErr ?? new Error('Todos os modelos Gemini falharam');
  console.log('[QUANT PARSE] resposta (primeiros 300):', text.slice(0, 300));

  const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  const clean = start !== -1 && end !== -1 ? stripped.slice(start, end + 1) : stripped;

  type RawItem = {
    e?: string; d?: string; u?: string; q?: number; o?: string; c?: number;
    etapa?: string; descricao?: string; unidade?: string; quantidade?: number; origem?: string; confianca?: number;
  };
  let raw: { obs?: string; observacoes?: string; i?: RawItem[]; itens?: RawItem[] };
  try {
    raw = JSON.parse(clean);
  } catch {
    console.warn('[QUANT PARSE] JSON inválido — tentando recuperação parcial');
    const obsMatch = clean.match(/"(?:obs|observacoes)"\s*:\s*"([^"]*)"/);
    const observacoes = obsMatch ? obsMatch[1] : '';
    const itemMatches = [...clean.matchAll(/\{[^{}]*"(?:d|descricao)"\s*:\s*"[^"]*"[^{}]*\}/g)];
    if (itemMatches.length === 0) {
      console.error('[QUANT PARSE] sem itens recuperáveis:', clean.slice(0, 500));
      throw new Error('IA retornou JSON inválido e sem itens recuperáveis');
    }
    const recovered = itemMatches
      .map(m => { try { return JSON.parse(m[0]) as RawItem; } catch { return null; } })
      .filter((t): t is RawItem => t !== null);
    console.log(`[QUANT PARSE] recuperados ${recovered.length}/${itemMatches.length} itens do JSON truncado`);
    raw = { obs: observacoes, i: recovered };
  }

  const mapItem = (it: RawItem): QuantitativoParseItem => ({
    etapa:     (it.e ?? it.etapa ?? '').trim(),
    descricao: (it.d ?? it.descricao ?? '').trim(),
    unidade:   (it.u ?? it.unidade ?? '').toLowerCase().trim(),
    quantidade: Number(it.q ?? it.quantidade ?? 0),
    origem:    it.o ?? it.origem ?? undefined,
    confianca: typeof (it.c ?? it.confianca) === 'number' ? (it.c ?? it.confianca) : undefined,
  });

  const itens = (raw.i ?? raw.itens ?? [])
    .map(mapItem)
    // Sanidade: quantidade > 0, etapa e descricao preenchidos, unidade válida
    .filter(i =>
      i.quantidade > 0 &&
      i.etapa.length > 0 &&
      i.descricao.length > 0 &&
      ['m2', 'ml', 'un', 'm3', 'vb'].includes(i.unidade),
    );

  return {
    observacoes: (raw.obs ?? raw.observacoes ?? '').trim() + (modelUsado ? ` [modelo: ${modelUsado}]` : ''),
    itens,
  };
}
