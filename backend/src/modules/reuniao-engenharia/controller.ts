import { Request, Response } from 'express';
import * as service from './service';
import { sendSuccess, sendCreated } from '../../utils/response';

export async function listar(_req: Request, res: Response) {
  sendSuccess(res, await service.listar());
}

export async function criar(req: Request, res: Response) {
  sendCreated(res, await service.criar(req.user?.userId ?? null));
}

export async function detalhe(req: Request, res: Response) {
  sendSuccess(res, await service.detalhe(req.params.id));
}

export async function atualizarParticipantes(req: Request, res: Response) {
  const ids: string[] = Array.isArray(req.body?.participantesIds) ? req.body.participantesIds : [];
  sendSuccess(res, await service.atualizarParticipantes(req.params.id, ids));
}

export async function encerrar(req: Request, res: Response) {
  sendSuccess(res, await service.encerrar(req.params.id));
}

/** Monta o PDF consolidado: capa (grupos por responsável) + AtaPDF de cada obra, mesclados. */
async function montarPdfConsolidado(id: string): Promise<{ buffer: Buffer; reuniao: Awaited<ReturnType<typeof service.estadoParaPdf>> }> {
  const React = await import('react');
  const { renderToBuffer } = await import('@react-pdf/renderer');
  const { PDFDocument } = await import('pdf-lib');
  const { CapaReuniaoPDF } = await import('./reuniao-pdf');
  const { AtaPDF } = await import('../atas/ata-pdf');
  const { getAtaCorrida } = await import('../atas/service');

  const estado = await service.estadoParaPdf(id);

  // agrupar por responsável da obra (pedido do Bruno 14/09)
  const porCoordenador = new Map<string, typeof estado.obras>();
  for (const o of estado.obras) {
    const k = o.coordenadorNome ?? 'Sem coordenador';
    porCoordenador.set(k, [...(porCoordenador.get(k) ?? []), o]);
  }
  const grupos = Array.from(porCoordenador.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([coordenador, obras]) => ({
      coordenador,
      obras: obras.map((o) => ({ obraNome: o.obraNome, totalTopicos: (o.topicos as unknown[]).length, obraId: o.obraId, topicos: o.topicos })),
    }));

  const capa = await renderToBuffer(
    React.createElement(CapaReuniaoPDF, {
      data: estado.reuniao.data,
      status: estado.reuniao.status,
      participantes: estado.participantes,
      grupos: grupos.map((g) => ({ coordenador: g.coordenador, obras: g.obras.map((o) => ({ obraNome: o.obraNome, totalTopicos: o.totalTopicos })) })),
    }) as never,
  );

  const finalDoc = await PDFDocument.create();
  const anexar = async (buf: Buffer | Uint8Array) => {
    const doc = await PDFDocument.load(buf);
    const pages = await finalDoc.copyPages(doc, doc.getPageIndices());
    for (const p of pages) finalDoc.addPage(p);
  };
  await anexar(capa);

  for (const g of grupos) {
    for (const o of g.obras) {
      // obra e stakeholders vêm vivos (metadados estáveis); tópicos = estado da
      // reunião (snapshot se encerrada, vivo se aberta)
      const data = await getAtaCorrida(o.obraId);
      const buf = await renderToBuffer(
        React.createElement(AtaPDF, {
          obra: data.obra,
          stakeholders: data.stakeholders,
          topicos: o.topicos as never,
          geradoEm: estado.reuniao.encerradaEm ?? new Date(),
        }) as never,
      );
      await anexar(buf);
    }
  }

  return { buffer: Buffer.from(await finalDoc.save()), reuniao: estado };
}

export async function pdf(req: Request, res: Response) {
  const { buffer, reuniao } = await montarPdfConsolidado(req.params.id);
  const dia = new Date(reuniao.reuniao.data).toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="reuniao-engenharia-${dia}.pdf"`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.send(buffer);
}

export async function enviar(req: Request, res: Response) {
  const { buffer, reuniao } = await montarPdfConsolidado(req.params.id);
  const destinatarios = reuniao.participantes.filter((p) => p.email);
  if (destinatarios.length === 0) {
    res.status(400).json({ error: { message: 'Nenhum participante com e-mail — seleciona a equipe primeiro' } });
    return;
  }
  const dia = new Date(reuniao.reuniao.data).toLocaleDateString('pt-BR');
  const { sendEmailObra } = await import('../../services/email-obras');
  await sendEmailObra({
    to: destinatarios.map((d) => d.email as string),
    subject: `📋 Ata da Reunião de Engenharia · ${dia} · BÈR`,
    html: `<div style="font-family:Montserrat,Arial,sans-serif;max-width:640px;margin:0 auto">
      <div style="background:#5E6B0F;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0">
        <p style="margin:0;font-size:16px;font-weight:700">Reunião de Engenharia — ${dia}</p>
        <p style="margin:2px 0 0;font-size:12px;opacity:.85">Ata consolidada · obras agrupadas por responsável</p>
      </div>
      <div style="border:1px solid #E4E6DA;border-top:0;padding:16px 18px;border-radius:0 0 8px 8px">
        <p style="font-size:14px;color:#1E1E22">Segue em anexo a ata consolidada da reunião, com a situação de cada obra em andamento — tópicos, responsáveis, prazos e pendências.</p>
        <p style="color:#8B8D82;font-size:11px;margin:16px 0 0;text-align:center">BÈR Engenharia · enviada automaticamente pelo BER App</p>
      </div>
    </div>`,
    attachments: [{ filename: `reuniao-engenharia-${new Date(reuniao.reuniao.data).toISOString().slice(0, 10)}.pdf`, content: buffer.toString('base64') }],
  });
  await service.marcarEnviada(req.params.id);
  sendSuccess(res, { enviados: destinatarios.map((d) => ({ name: d.name, email: d.email })) });
}
