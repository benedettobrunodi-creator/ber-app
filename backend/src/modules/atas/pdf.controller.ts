import { Request, Response } from "express";
import * as React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAtaCorrida } from "./service";
import { AtaPDF } from "./ata-pdf";

export async function downloadAtaPdf(req: Request, res: Response) {
  const obraId = req.params.obraId || req.params.id;
  const data = await getAtaCorrida(obraId);

  const buffer = await renderToBuffer(
    React.createElement(AtaPDF, {
      obra: data.obra,
      stakeholders: data.stakeholders,
      topicos: data.topicos as never,
      geradoEm: new Date(),
    }) as any,
  );

  const slug = (data.obra.name || "obra").replace(/[^a-z0-9]/gi, "-").toLowerCase();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="ata-${slug}.pdf"`);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.send(buffer);
}
