// Teste: parseia um cronograma PDF local e mapeia o % pra fase do Sequenciamento.
// Uso: GEMINI_API_KEY=... npx tsx scripts/test-parse-cronograma-temp.ts /tmp/arquivo.pdf
import { readFileSync } from 'node:fs';
import { parseCronogramaPDF } from '../src/services/cronograma-parser';

function fase(p: number): string {
  if (p >= 100) return 'PP6 (pós-entrega)';
  if (p >= 75) return 'PP5 (75–100%)';
  if (p >= 50) return 'PP4 (50–75%)';
  if (p >= 25) return 'PP3 (25–50%)';
  return 'PP2 (0–25%)';
}

async function main() {
  const buf = readFileSync(process.argv[2]);
  const t0 = Date.now();
  const parsed = await parseCronogramaPDF(buf);
  const leaf = parsed.tarefas.filter(t => !t.ehResumo);
  const totalDias = leaf.reduce((s, t) => s + (t.duracaoDias ?? 0), 0);
  const pctPonderado = totalDias > 0
    ? Math.round(leaf.reduce((s, t) => s + (t.duracaoDias ?? 0) * t.percentualConcluido / 100, 0) / totalDias * 100)
    : parsed.progressoGeral;
  console.log(`tarefas: ${parsed.tarefas.length} (${leaf.length} folha) | ${((Date.now()-t0)/1000).toFixed(1)}s`);
  console.log(`progresso_geral (IA): ${parsed.progressoGeral}%`);
  console.log(`progresso ponderado por duração (recalculado): ${pctPonderado}%`);
  console.log(`fase sugerida: ${fase(pctPonderado)}`);
  // amostra das fases de nível 1 pra conferência
  for (const t of parsed.tarefas.filter(t => t.nivel === 1).slice(0, 12)) {
    console.log(`  [${t.wbs}] ${t.nome.slice(0, 50)} — ${t.percentualConcluido}%`);
  }
}
main().then(() => process.exit(0), e => { console.error(e.message); process.exit(1); });
