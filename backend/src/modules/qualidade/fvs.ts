/**
 * FVS por atividade (03/09/26, GO Bruno "vamos fazer todos").
 *
 * Fluxo: vistoria marca atividade "em execução" → se não há ficha pendente
 * daquela IT na obra, o sistema CRIA uma, com os critérios de qualidade da IT
 * como itens (uma linha por critério) e prazo de 3 dias úteis.
 * O responsável preenche (conforme / não conforme / N/A + foto).
 * Enforcement: item 5.2 da vistoria vira "Não" automático quando há ficha
 * pendente anterior; alertas diários pra fichas vencidas; ranking no resumo
 * semanal. Trava de medição (etapa 4) usa o campo contratacaoId.
 */
import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';

const PRAZO_DIAS_UTEIS = 3;

/** Soma dias úteis (seg–sex) a partir de hoje. */
export function prazoDiasUteis(dias: number, base = new Date()): Date {
  const d = new Date(base);
  let restantes = dias;
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) restantes--;
  }
  return d;
}

/** Critérios da IT viram itens da ficha — uma linha não-vazia por critério. */
function criteriosParaItens(criteriosQualidade: string | null, steps: unknown): string[] {
  const linhas = (criteriosQualidade ?? '')
    .split('\n')
    .map((l) => l.trim().replace(/^[-•*]\s*/, ''))
    .filter((l) => l.length > 2);
  if (linhas.length > 0) return linhas;
  // Fallback raro: IT sem critérios → item único genérico
  return ['Serviço executado conforme a IT (passo a passo e pontos de atenção)'];
}

/**
 * Garante ficha pendente pra cada atividade com IT marcada na vistoria.
 * Retorna as fichas criadas agora. Não duplica: se já existe pendente da
 * mesma IT na obra, reaproveita.
 */
export async function garantirFvsParaAtividades(
  obraId: string,
  atividades: { itCode?: string | null; titulo: string }[],
  vistoriaId: string,
) {
  const criadas: { id: string; itCode: string | null; titulo: string }[] = [];
  for (const a of atividades) {
    if (!a.itCode) continue; // atividade livre não gera ficha automática (sem critérios)
    const existente = await prisma.atividadeFvs.findFirst({
      where: { obraId, itCode: a.itCode, status: 'pendente' },
      select: { id: true },
    });
    if (existente) continue;
    const it = await prisma.instrucaoTecnica.findFirst({
      where: { code: a.itCode },
      select: { criteriosQualidade: true, steps: true, title: true },
    });
    const fvs = await prisma.atividadeFvs.create({
      data: {
        obraId,
        itCode: a.itCode,
        titulo: it?.title ?? a.titulo,
        prazo: prazoDiasUteis(PRAZO_DIAS_UTEIS),
        criadaPorVistoriaId: vistoriaId,
        itens: {
          create: criteriosParaItens(it?.criteriosQualidade ?? null, it?.steps).map((texto, i) => ({
            ordem: i,
            texto,
          })),
        },
      },
      select: { id: true, itCode: true, titulo: true },
    });
    criadas.push(fvs);
  }
  return criadas;
}

/** Fichas pendentes da obra criadas ANTES do início de hoje (pro item 5.2:
 *  ficha recém-aberta pela própria vistoria não penaliza). */
export async function fvsPendentesAnteriores(obraId: string) {
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  return prisma.atividadeFvs.findMany({
    where: { obraId, status: 'pendente', createdAt: { lt: inicioHoje } },
    select: { id: true, itCode: true, titulo: true, prazo: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function listFvs(obraId: string) {
  return prisma.atividadeFvs.findMany({
    where: { obraId },
    orderBy: [{ status: 'desc' }, { createdAt: 'desc' }], // pendentes primeiro
    include: {
      preenchidoPor: { select: { id: true, name: true } },
      itens: { orderBy: { ordem: 'asc' }, select: { id: true, resposta: true } },
    },
  });
}

export async function getFvs(fvsId: string) {
  const fvs = await prisma.atividadeFvs.findUnique({
    where: { id: fvsId },
    include: {
      preenchidoPor: { select: { id: true, name: true } },
      itens: { orderBy: { ordem: 'asc' } },
      obra: { select: { id: true, name: true } },
    },
  });
  if (!fvs) throw AppError.notFound('Ficha');
  return fvs;
}

export async function responderFvs(
  fvsId: string,
  input: { respostas: { itemId: string; resposta: 'conforme' | 'nao_conforme' | 'na'; observacao?: string | null }[]; trecho?: string | null },
  userId: string,
) {
  const fvs = await prisma.atividadeFvs.findUnique({
    where: { id: fvsId },
    include: { itens: { select: { id: true } } },
  });
  if (!fvs) throw AppError.notFound('Ficha');

  const validIds = new Set(fvs.itens.map((i) => i.id));
  const respostas = input.respostas.filter((r) => validIds.has(r.itemId));

  // Não conforme e N/A exigem justificativa (mesmo critério da vistoria)
  const semJust = respostas.filter(
    (r) => (r.resposta === 'nao_conforme' || r.resposta === 'na') && !(r.observacao ?? '').trim(),
  );
  if (semJust.length > 0) {
    throw AppError.badRequest(`${semJust.length} item(ns) "Não conforme"/"N/A" sem justificativa`);
  }

  for (const r of respostas) {
    await prisma.atividadeFvsItem.update({
      where: { id: r.itemId },
      data: { resposta: r.resposta, observacao: r.observacao ?? null },
    });
  }

  // Todos os itens respondidos → ficha preenchida
  const restantes = await prisma.atividadeFvsItem.count({ where: { fvsId, resposta: null } });
  const preenchida = restantes === 0;
  return prisma.atividadeFvs.update({
    where: { id: fvsId },
    data: {
      ...(input.trecho !== undefined && { trecho: input.trecho }),
      ...(preenchida && { status: 'preenchida', preenchidoPorId: userId, preenchidoEm: new Date() }),
    },
    include: {
      preenchidoPor: { select: { id: true, name: true } },
      itens: { orderBy: { ordem: 'asc' } },
    },
  });
}

export async function uploadFotoFvsItem(
  itemId: string,
  file: { buffer: Buffer; originalname: string; mimetype: string },
) {
  const item = await prisma.atividadeFvsItem.findUnique({ where: { id: itemId } });
  if (!item) throw AppError.notFound('Item');
  const { uploadToR2, isR2Configured } = await import('../../services/storage');
  if (!isR2Configured()) throw AppError.badRequest('Storage de arquivos não configurado no servidor');
  const url = await uploadToR2(
    file.buffer,
    `fvs-atividade/${item.fvsId}-${item.ordem}-${Date.now()}-${file.originalname}`,
    file.mimetype,
  );
  return prisma.atividadeFvsItem.update({ where: { id: itemId }, data: { fotoUrl: url } });
}

export async function removeFvs(fvsId: string) {
  const existing = await prisma.atividadeFvs.findUnique({ where: { id: fvsId } });
  if (!existing) throw AppError.notFound('Ficha');
  await prisma.atividadeFvs.delete({ where: { id: fvsId } });
}

// ─── Alerta diário — fichas vencidas ────────────────────────────────────────
// 1º alerta: e-mail pro vistoriador que originou a ficha (proxy do responsável
// da obra). Reincidência (2º alerta em diante): copia a coordenação.
export async function alertarFvsVencidas({ dryRun = false } = {}) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencidas = await prisma.atividadeFvs.findMany({
    where: { status: 'pendente', prazo: { lt: hoje } },
    include: { obra: { select: { name: true } } },
  });
  if (vencidas.length === 0) return { alertas: 0, vencidas: [] };

  const { FASE_ATRASADA_EMAILS } = await import('../../config/responsavel-areas');
  const { sendEmailObra } = await import('../../services/email-obras');

  let alertas = 0;
  // Agrupa por obra num e-mail só
  const porObra = new Map<string, typeof vencidas>();
  for (const f of vencidas) {
    const lista = porObra.get(f.obra.name) ?? [];
    lista.push(f);
    porObra.set(f.obra.name, lista);
  }

  for (const [obraNome, fichas] of porObra) {
    // Vistoriador que originou a primeira ficha vencida (proxy de responsável)
    const vistoriaIds = fichas.map((f) => f.criadaPorVistoriaId).filter(Boolean) as string[];
    const vistoria = vistoriaIds.length
      ? await prisma.qualidadeVistoria.findFirst({
          where: { id: { in: vistoriaIds } },
          include: { vistoriador: { select: { email: true, name: true } } },
        })
      : null;
    const responsavelEmail = vistoria?.vistoriador?.email ?? null;
    const escalar = fichas.some((f) => f.ultimoAlertaEm !== null); // 2º alerta em diante

    const to = responsavelEmail
      ? escalar ? [responsavelEmail, ...FASE_ATRASADA_EMAILS] : [responsavelEmail]
      : FASE_ATRASADA_EMAILS;

    const linhas = fichas.map((f) =>
      `<li style="color:#2D2D2D;font-size:13px;line-height:1.7;"><strong>${f.itCode ?? ''}</strong> · ${f.titulo}
        <span style="color:#B42318;font-size:11px;font-weight:600;"> — prazo venceu ${f.prazo ? new Date(f.prazo).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : ''}</span></li>`,
    ).join('');

    const html = `
    <div style="font-family:'Montserrat',Arial,sans-serif;max-width:560px;margin:0 auto;background:#F7F7F5;padding:24px;">
      <div style="background:#1E2432;padding:24px 28px;border-radius:12px 12px 0 0;">
        <p style="color:#fff;font-size:16px;font-weight:700;letter-spacing:3px;margin:0;">BÈR ENGENHARIA</p>
        <p style="color:#8A93A3;font-size:10px;letter-spacing:2px;margin:4px 0 0;">CUIDADO EM CADA OBRA</p>
      </div>
      <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;">
        <h2 style="color:#2D2D2D;font-size:17px;margin:0 0 6px;">FVS vencida(s) — ${obraNome}</h2>
        <p style="color:#5A7A7A;font-size:13px;margin:0 0 10px;">Ficha de Verificação de Serviço aberta há mais de ${PRAZO_DIAS_UTEIS} dias úteis sem preenchimento${escalar ? ' — <strong>reincidência, coordenação em cópia</strong>' : ''}:</p>
        <ul style="margin:0;padding-left:18px;">${linhas}</ul>
        <p style="color:#868686;font-size:12px;margin:14px 0 0;">Preencher: BÈR App → obra → Qualidade → Fichas de Verificação.</p>
      </div>
      <p style="color:#868686;font-size:11px;text-align:center;margin-top:16px;">BÈR Engenharia · Alerta automático de FVS pendente</p>
    </div>`;

    if (!dryRun) {
      await sendEmailObra({ to, subject: `FVS vencida — ${obraNome} (${fichas.length})`, html });
      await prisma.atividadeFvs.updateMany({
        where: { id: { in: fichas.map((f) => f.id) } },
        data: { ultimoAlertaEm: new Date(), ...(escalar && { alertaEscalado: true }) },
      });
    }
    alertas++;
  }
  return { alertas, vencidas };
}
