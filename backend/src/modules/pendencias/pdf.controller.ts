import { Request, Response } from "express";
import * as React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/errors";
import { PendenciasPDF, type PdfPendencia } from "./pendencias-pdf";

export async function downloadPendenciasPdf(req: Request, res: Response) {
  const obraId = req.params.id;
  const somenteAbertas = req.query.abertas === "1";

  const [obra, itens] = await Promise.all([
    prisma.obra.findUnique({ where: { id: obraId }, select: { name: true } }),
    prisma.obraPendencia.findMany({
      where: { obraId, ...(somenteAbertas ? { status: { not: "concluida" } } : {}) },
      orderBy: [{ ambiente: "asc" }, { status: "asc" }, { dataTermino: "asc" }],
    }),
  ]);
  if (!obra) throw AppError.notFound("Obra");

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const pdfItens: PdfPendencia[] = itens.map((i) => ({
    ambiente: i.ambiente,
    atividade: i.atividade,
    disciplina: i.disciplina,
    fornecedor: i.fornecedor,
    tipo: i.tipo,
    criticidade: i.criticidade,
    status: i.status,
    dataTermino: i.dataTermino,
    atrasada: i.status !== "concluida" && !!i.dataTermino && i.dataTermino < hoje,
    fotoAberturaUrl: i.fotoAberturaUrl,
    fotoConclusaoUrl: i.fotoConclusaoUrl,
  }));

  const buffer = await renderToBuffer(
    React.createElement(PendenciasPDF, { obraNome: obra.name, itens: pdfItens, geradoEm: new Date() }) as never,
  );

  const slug = (obra.name || "obra").replace(/[^a-z0-9]/gi, "-").toLowerCase();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="pendencias-${slug}.pdf"`);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.send(buffer);
}
