// Teste standalone: renderiza a AtaPDF com dados reais e grava /tmp/ata.pdf.
// Uso: DATABASE_URL=<public> npx tsx scripts/test-ata-pdf.tsx <obraId>
import * as React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { writeFileSync } from "node:fs";
import { getAtaCorrida } from "../src/modules/atas/service";
import { AtaPDF } from "../src/modules/atas/ata-pdf";

async function main() {
  const obraId = process.argv[2];
  const data = await getAtaCorrida(obraId);
  const buf = await renderToBuffer(
    React.createElement(AtaPDF, {
      obra: data.obra,
      stakeholders: data.stakeholders,
      topicos: data.topicos as never,
      geradoEm: new Date(),
    }) as never,
  );
  writeFileSync("/tmp/ata.pdf", buf);
  console.log(`OK ata.pdf ${buf.length} bytes | ${data.stakeholders.length} stakeholders | ${data.topicos.length} topicos`);
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
