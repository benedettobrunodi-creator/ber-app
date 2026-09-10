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


/**
 * Envia a ata corrida por e-mail a todos os stakeholders com e-mail (Bruno 10/09).
 * PDF anexado na identidade BÈR; responde com a lista de quem recebeu.
 */
export async function enviarAtaStakeholders(req: Request, res: Response) {
  const obraId = req.params.obraId || req.params.id;
  const data = await getAtaCorrida(obraId);

  const destinatarios = (data.stakeholders as { nome: string; email?: string | null }[])
    .filter((s) => s.email && /@/.test(s.email))
    .map((s) => ({ nome: s.nome, email: s.email as string }));
  if (destinatarios.length === 0) {
    res.status(400).json({ error: { message: 'Nenhum stakeholder com e-mail cadastrado nesta obra' } });
    return;
  }

  const buffer = await renderToBuffer(
    React.createElement(AtaPDF, {
      obra: data.obra,
      stakeholders: data.stakeholders,
      topicos: data.topicos as never,
      geradoEm: new Date(),
    }) as any,
  );
  const slug = (data.obra.name || 'obra').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const hoje = new Date().toLocaleDateString('pt-BR');

  const { sendEmailObra } = await import('../../services/email-obras');
  await sendEmailObra({
    to: destinatarios.map((d) => d.email),
    subject: `📋 Ata de reunião atualizada — ${data.obra.name} · ${hoje} · BÈR`,
    html: `<div style="font-family:Montserrat,Arial,sans-serif;max-width:640px;margin:0 auto">
      <div style="background:#5E6B0F;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0">
        <p style="margin:0;font-size:16px;font-weight:700">${data.obra.name}</p>
        <p style="margin:2px 0 0;font-size:12px;opacity:.85">Ata de reunião · atualizada em ${hoje}</p>
      </div>
      <div style="border:1px solid #E4E6DA;border-top:0;padding:16px 18px;border-radius:0 0 8px 8px">
        <p style="font-size:14px;color:#1E1E22">Segue em anexo a ata atualizada da obra, com os tópicos, responsáveis e status de cada item.</p>
        <p style="color:#8B8D82;font-size:11px;margin:16px 0 0;text-align:center">BÈR Engenharia · enviada automaticamente pelo BER App</p>
      </div>
    </div>`,
    attachments: [{ filename: `ata-${slug}.pdf`, content: buffer.toString('base64') }],
  });

  res.json({ data: { enviados: destinatarios } });
}
