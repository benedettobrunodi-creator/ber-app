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

export async function atualizarParticipantesObra(req: Request, res: Response) {
  const obraId = String(req.body?.obraId ?? '');
  const ids: string[] = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
  sendSuccess(res, await service.atualizarParticipantesObra(req.params.id, obraId, ids));
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

  // agrupar por ENGENHEIRO RESIDENTE (Bruno 14/09: "a reunião é por engenheiro")
  const porEngenheiro = new Map<string, typeof estado.obras>();
  for (const o of estado.obras) {
    const k = o.engenheiroNome ?? 'Sem engenheiro';
    porEngenheiro.set(k, [...(porEngenheiro.get(k) ?? []), o]);
  }
  const grupos = Array.from(porEngenheiro.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([engenheiro, obras]) => ({
      coordenador: engenheiro, // rótulo do grupo na capa (campo mantém o nome por compat)
      obras: obras.map((o) => ({ obraNome: o.obraNome, totalTopicos: (o.topicos as unknown[]).length, obraId: o.obraId, topicos: o.topicos, engenheiroNome: o.coordenadorNome ? `Coord.: ${o.coordenadorNome}` : null })),
    }));

  const capa = await renderToBuffer(
    React.createElement(CapaReuniaoPDF, {
      data: estado.reuniao.data,
      status: estado.reuniao.status,
      participantes: estado.participantes,
      grupos: grupos.map((g) => ({ coordenador: g.coordenador, obras: g.obras.map((o) => ({ obraNome: o.obraNome, totalTopicos: o.totalTopicos, engenheiroNome: o.engenheiroNome })) })),
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
  // e-mail POR ENGENHEIRO: cada um recebe as SUAS obras (+ participantes das
  // obras dele em cópia). Obras sem engenheiro ficam fora e são reportadas.
  const React = await import('react');
  const { renderToBuffer } = await import('@react-pdf/renderer');
  const { PDFDocument } = await import('pdf-lib');
  const { AtaPDF } = await import('../atas/ata-pdf');
  const { getAtaCorrida } = await import('../atas/service');
  const { prisma } = await import('../../config/database');
  const { sendEmailObra } = await import('../../services/email-obras');

  const estado = await service.estadoParaPdf(req.params.id);
  const dia = new Date(estado.reuniao.data).toLocaleDateString('pt-BR');
  const diaIso = new Date(estado.reuniao.data).toISOString().slice(0, 10);

  // participantes por obra (com e-mail) pra colocar em cópia
  const mapaParts = (estado.reuniao.participantesPorObra ?? {}) as Record<string, string[]>;
  const idsParts = Array.from(new Set(Object.values(mapaParts).flat()));
  const usersParts = idsParts.length
    ? await prisma.user.findMany({ where: { id: { in: idsParts } }, select: { id: true, name: true, email: true } })
    : [];
  const userById = new Map(usersParts.map((u) => [u.id, u]));

  const porEng = new Map<string, typeof estado.obras>();
  const semEngenheiro: string[] = [];
  for (const o of estado.obras) {
    if (!o.engenheiroId) { semEngenheiro.push(o.obraNome); continue; }
    porEng.set(o.engenheiroId, [...(porEng.get(o.engenheiroId) ?? []), o]);
  }
  if (porEng.size === 0) {
    res.status(400).json({ error: { message: 'Nenhuma obra com engenheiro residente definido — preenche em Editar informações da obra' } });
    return;
  }
  const engs = await prisma.user.findMany({ where: { id: { in: Array.from(porEng.keys()) } }, select: { id: true, name: true, email: true } });
  const engById = new Map(engs.map((e) => [e.id, e]));

  const enviados: { engenheiro: string; obras: number; destinatarios: string[] }[] = [];
  for (const [engId, obras] of porEng.entries()) {
    const eng = engById.get(engId);
    const doc = await PDFDocument.create();
    for (const o of obras) {
      const data = await getAtaCorrida(o.obraId);
      const buf = await renderToBuffer(
        React.createElement(AtaPDF, {
          obra: data.obra, stakeholders: data.stakeholders,
          topicos: o.topicos as never,
          geradoEm: estado.reuniao.encerradaEm ?? new Date(),
        }) as never,
      );
      const parte = await PDFDocument.load(buf);
      const pages = await doc.copyPages(parte, parte.getPageIndices());
      for (const p of pages) doc.addPage(p);
    }
    const pdf = Buffer.from(await doc.save());

    const destinos = new Map<string, string>();
    if (eng?.email) destinos.set(eng.email, eng.name);
    for (const o of obras) {
      for (const uid of mapaParts[o.obraId] ?? []) {
        const u = userById.get(uid);
        if (u?.email) destinos.set(u.email, u.name);
      }
    }
    if (destinos.size === 0) continue;

    const listaObras = obras.map((o) => `<li style="margin:2px 0">${o.obraNome}</li>`).join('');
    await sendEmailObra({
      to: Array.from(destinos.keys()),
      subject: `📋 Reunião de Engenharia · ${dia} — suas obras · BÈR`,
      html: `<div style="font-family:Montserrat,Arial,sans-serif;max-width:640px;margin:0 auto">
        <div style="background:#5E6B0F;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0">
          <p style="margin:0;font-size:16px;font-weight:700">Reunião de Engenharia — ${dia}</p>
          <p style="margin:2px 0 0;font-size:12px;opacity:.85">${eng?.name ?? 'Engenheiro'} · ${obras.length} obra(s)</p>
        </div>
        <div style="border:1px solid #E4E6DA;border-top:0;padding:16px 18px;border-radius:0 0 8px 8px">
          <p style="font-size:14px;color:#1E1E22">Segue em anexo a ata das suas obras discutidas na reunião:</p>
          <ul style="font-size:13px;color:#1E1E22;padding-left:18px">${listaObras}</ul>
          <p style="color:#8B8D82;font-size:11px;margin:16px 0 0;text-align:center">BÈR Engenharia · enviada automaticamente pelo BER App</p>
        </div>
      </div>`,
      attachments: [{ filename: `reuniao-engenharia-${diaIso}.pdf`, content: pdf.toString('base64') }],
    });
    enviados.push({ engenheiro: eng?.name ?? '?', obras: obras.length, destinatarios: Array.from(destinos.values()) });
  }

  await service.marcarEnviada(req.params.id);
  sendSuccess(res, { enviados, semEngenheiro });
}
