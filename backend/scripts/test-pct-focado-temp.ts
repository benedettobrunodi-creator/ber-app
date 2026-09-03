// Teste da leitura FOCADA: extrai só o % geral do cronograma (linha-resumo).
// Uso: GEMINI_API_KEY=... npx tsx scripts/test-pct-focado-temp.ts /tmp/arquivo.pdf
import { readFileSync } from 'node:fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

const PROMPT = `Este PDF é um cronograma de obra (gantt). Encontre o PERCENTUAL GERAL DE AVANÇO da obra.

Onde procurar, em ordem de prioridade:
1. A linha-resumo chamada "OBRA" (ou similar) — o % concluído dela.
2. A linha-raiz do projeto (id 0 / primeira linha, nome = título do arquivo).
3. Se nenhuma existir, a média ponderada por duração das fases de nível 1.

Retorne APENAS JSON minificado: {"pct":<0-100>,"fonte":"<texto exato da linha usada>","pct_raiz":<0-100 ou null>}
"pct_raiz" = % da linha-raiz do projeto, se diferente da usada.`;

function fase(p: number): string {
  if (p >= 100) return 'PP6 (pós-entrega)';
  if (p >= 75) return 'PP5 (75–100%)';
  if (p >= 50) return 'PP4 (50–75%)';
  if (p >= 25) return 'PP3 (25–50%)';
  return 'PP2 (0–25%)';
}

async function main() {
  const buf = readFileSync(process.argv[2]);
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const t0 = Date.now();
  let out: any = null; let usado = '';
  for (const m of ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-3.6-flash']) {
    try {
      const model = genAI.getGenerativeModel({
        model: m,
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 500 },
      });
      const res = await model.generateContent([
        { inlineData: { mimeType: 'application/pdf', data: buf.toString('base64') } },
        PROMPT,
      ]);
      out = JSON.parse(res.response.text()); usado = m; break;
    } catch (e) {
      console.log(`modelo ${m} falhou: ${(e as Error).message.slice(0, 90)}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  if (!out) throw new Error('todos os modelos falharam');
  console.log(`modelo usado: ${usado}`);
  console.log(`tempo: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`pct lido: ${out.pct}% (fonte: "${out.fonte}") | raiz: ${out.pct_raiz}`);
  console.log(`fase sugerida: ${fase(out.pct)}`);
}
main().then(() => process.exit(0), e => { console.error(e.message); process.exit(1); });
