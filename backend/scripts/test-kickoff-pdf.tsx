import * as React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { writeFileSync } from "node:fs";
import { KickoffPDF } from "../src/modules/kickoff/kickoff-pdf";
import { KICKOFF_TEMPLATE } from "../src/modules/kickoff/template";
async function main() {
  let ordem = 0;
  const itens = KICKOFF_TEMPLATE.flatMap(s => s.itens.map((item, i) => ({
    secao: s.secao, item, ordem: ordem++,
    responsavel: i % 3 === 0 ? "Francisco Gritti" : null,
    naRede: i % 2 === 0 ? "sim" : "na",
    dataAlvo: i % 4 === 0 ? new Date("2026-08-05") : null,
    status: ["concluido","em_andamento","atrasado","na"][i % 4],
    observacoes: i % 5 === 0 ? "Observação de exemplo pra conferir o layout." : null,
  })));
  const buf = await renderToBuffer(React.createElement(KickoffPDF, {
    obra: { name: "573.26 Leila e Orlando NJ Arquitetos" },
    header: { coordenador: "Christian Palermo", engenheiro: "José Ricardo", supervisor: "—",
      inicioObra: new Date("2026-07-01"), terminoObra: new Date("2026-12-20"), dataKickoff: new Date("2026-07-10"),
      participantesDeptos: { comercial: "Fulano", pmo: "Gritti", financeiro: "Carol" } },
    itens: itens as never, geradoEm: new Date(),
  }) as never);
  writeFileSync("/tmp/kickoff.pdf", buf);
  console.log("OK kickoff.pdf", buf.length, "bytes,", itens.length, "itens");
}
main().then(()=>process.exit(0),(e)=>{console.error(e);process.exit(1);});
