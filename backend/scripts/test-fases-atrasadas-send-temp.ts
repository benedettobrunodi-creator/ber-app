// Disparo real do primeiro digest de fases atrasadas (pedido do Bruno 02/09).
import { checkFasesAtrasadas } from '../src/modules/fvs/alerts';
async function main() {
  const r = await checkFasesAtrasadas();
  console.log(`enviados: ${r.alertasEnviados} | fases: ${r.fasesAtrasadas.length}`);
}
main().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
