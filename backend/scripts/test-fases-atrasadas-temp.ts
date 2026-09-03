// Dry-run do alerta de fases atrasadas contra o banco apontado por DATABASE_URL.
import { checkFasesAtrasadas } from '../src/modules/fvs/alerts';

async function main() {
  const r = await checkFasesAtrasadas({ dryRun: true });
  console.log(`fases atrasadas: ${r.fasesAtrasadas.length} (dry-run, nada enviado)`);
  for (const f of r.fasesAtrasadas) {
    console.log(`- ${f.obraNome} | ${f.faseCode} ${f.faseNome.slice(0, 40)} | ${f.abertos}/${f.total} abertos | fase atual ${f.faseAtual}`);
  }
}
main().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
