import { Request, Response } from "express";
import * as React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/errors";
import { PendenciasPDF, type PdfPendencia } from "./pendencias-pdf";

export async function downloadPendenciasPdf(req: Request, res: Response) {
  const obraId = req.params.id;
  // Escopo escolhido pelo usuário antes de gerar (27/08):
  //   filtro = todas | abertas | atrasadas | solicitacoes | alta | concluidas
  //   ambiente = nome exato (opcional) · fotos = 0 desliga o registro fotográfico
  const filtro = String(req.query.filtro ?? (req.query.abertas === "1" ? "abertas" : "todas"));
  const ambiente = req.query.ambiente ? String(req.query.ambiente) : null;
  const incluirFotos = req.query.fotos !== "0";

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const [obra, todos] = await Promise.all([
    prisma.obra.findUnique({ where: { id: obraId }, select: { name: true } }),
    prisma.obraPendencia.findMany({
      where: { obraId, ...(ambiente ? { ambiente } : {}) },
      orderBy: [{ ambiente: "asc" }, { status: "asc" }, { dataTermino: "asc" }],
    }),
  ]);
  if (!obra) throw AppError.notFound("Obra");

  const late = (i: { status: string; dataTermino: Date | null }) =>
    i.status !== "concluida" && !!i.dataTermino && i.dataTermino < hoje;
  const itens = todos.filter((i) => {
    if (filtro === "abertas") return i.status !== "concluida";
    if (filtro === "atrasadas") return late(i);
    if (filtro === "solicitacoes") return i.tipo === "solicitacao";
    if (filtro === "alta") return i.criticidade === "alta" && i.status !== "concluida";
    if (filtro === "concluidas") return i.status === "concluida";
    return true;
  });
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
    fotoAberturaUrl: incluirFotos ? i.fotoAberturaUrl : null,
    fotoConclusaoUrl: incluirFotos ? i.fotoConclusaoUrl : null,
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
