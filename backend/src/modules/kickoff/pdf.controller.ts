import { Request, Response } from "express";
import * as React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getByObra } from "./service";
import { KickoffPDF } from "./kickoff-pdf";

export async function downloadKickoffPdf(req: Request, res: Response) {
  const obraId = req.params.obraId || req.params.id;
  const data = await getByObra(obraId);

  const buffer = await renderToBuffer(
    React.createElement(KickoffPDF, {
      obra: data.obra,
      header: data.header as never,
      itens: data.itens as never,
      geradoEm: new Date(),
    }) as never,
  );

  const slug = (data.obra.name || "obra").replace(/[^a-z0-9]/gi, "-").toLowerCase();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="kickoff-${slug}.pdf"`);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.send(buffer);
}
