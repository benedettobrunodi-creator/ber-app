import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';

/**
 * Liberação de fornecedor p/ faturamento (21/09/26, pedido Bruno).
 *
 *   Engenharia SOLICITA (% sobre o valor "comprado" de um item de Metas de
 *   Compra) → Financeiro APROVA (define data de pagamento) → Diretoria
 *   APROVA → E-MAIL AUTOMÁTICO autoriza o fornecedor a emitir a NF.
 *
 * Fonte de valor/fornecedor: ComprasMeta.comprado / .fornecedor (Metas de
 * Compra, JÁ tem valor real populado). Fonte de CONTATO: tenta casar
 * ComprasMeta.fornecedor × ObraContratacaoPlano.empresaContratada por nome
 * dentro da MESMA obra (zero risco de obra errada; se não achar, quem aprova
 * digita o e-mail na hora — nunca trava).
 */

const APROVA_FINANCEIRO_ROLES = ['financeiro', 'diretoria', 'socio'];
const APROVA_DIRETORIA_ROLES = ['diretoria', 'socio'];

const FINANCEIRO_EMAIL = 'caroline.souza@ber-engenharia.com.br';
const DIRETORIA_EMAIL = 'bruno@ber-engenharia.com.br';
const APP_URL = process.env.APP_URL_WEB ?? 'https://ber-app.vercel.app';

const BRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function fmtData(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(`${d}T12:00:00Z`) : d;
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/** Tenta achar o contato (e-mail) do fornecedor no Cronograma de Contratações
 *  da mesma obra, casando pelo nome normalizado. Não lança — retorna null. */
async function tentarAcharEmailFornecedor(obraId: string, fornecedorNome: string | null): Promise<string | null> {
  if (!fornecedorNome?.trim()) return null;
  const alvo = norm(fornecedorNome);
  const planos = await prisma.obraContratacaoPlano.findMany({
    where: { obraId, empresaContratada: { not: null }, email: { not: null } },
    select: { empresaContratada: true, email: true },
  });
  const match = planos.find((p) => p.empresaContratada && norm(p.empresaContratada) === alvo);
  return match?.email ?? null;
}

/** Itens de Metas de Compra elegíveis pra uma NOVA solicitação nesta obra —
 *  já com o saldo ainda disponível (comprado − liberações vivas). */
export async function listarOpcoes(obraId: string) {
  const [itens, liberacoesVivas] = await Promise.all([
    prisma.comprasMeta.findMany({
      where: { obraId, comprado: { gt: 0 } },
      orderBy: [{ pacote: 'asc' }, { categoria: 'asc' }],
    }),
    prisma.liberacaoFornecedor.groupBy({
      by: ['comprasMetaId'],
      where: { comprasMeta: { obraId }, status: { in: ['solicitada', 'aprovada_financeiro', 'autorizada'] } },
      _sum: { valorAutorizado: true },
    }),
  ]);
  const autorizadoPorItem = new Map(liberacoesVivas.map((l) => [l.comprasMetaId, Number(l._sum.valorAutorizado ?? 0)]));

  return itens.map((it) => {
    const jaAutorizado = autorizadoPorItem.get(it.id) ?? 0;
    const saldo = Math.max(0, it.comprado - jaAutorizado);
    return {
      comprasMetaId: it.id,
      pacote: it.pacote,
      categoria: it.categoria,
      descritivo: it.descritivo,
      fornecedor: it.fornecedor,
      comprado: it.comprado,
      jaAutorizado,
      saldo,
    };
  });
}

export interface SolicitarInput {
  comprasMetaId: string;
  percentual: number;
  observacoes?: string;
}

export async function solicitar(obraId: string, input: SolicitarInput, userId: string) {
  const { comprasMetaId, percentual, observacoes } = input;
  if (Number.isNaN(percentual) || percentual <= 0 || percentual > 100) {
    throw AppError.badRequest('Percentual deve estar entre 0 e 100');
  }

  const [item, obra] = await Promise.all([
    prisma.comprasMeta.findFirst({ where: { id: comprasMetaId, obraId } }),
    prisma.obra.findUnique({ where: { id: obraId }, select: { name: true } }),
  ]);
  if (!item) throw AppError.notFound('Item de Metas de Compra');
  if (!obra) throw AppError.notFound('Obra');
  if (item.comprado <= 0) throw AppError.badRequest('Este item não tem valor comprado registrado');

  const valorAutorizado = Math.round((percentual / 100) * item.comprado * 100) / 100;

  // Trava anti-desvio: liberações vivas + esta não pode passar o comprado.
  const agg = await prisma.liberacaoFornecedor.aggregate({
    where: { comprasMetaId, status: { in: ['solicitada', 'aprovada_financeiro', 'autorizada'] } },
    _sum: { valorAutorizado: true },
  });
  const jaComprometido = Number(agg._sum.valorAutorizado ?? 0);
  if (jaComprometido + valorAutorizado > item.comprado + 0.01) {
    throw AppError.badRequest(
      `Liberação passaria o valor comprado do item: já comprometido ${BRL(jaComprometido)} + esta ${BRL(valorAutorizado)} > comprado ${BRL(item.comprado)}.`,
    );
  }

  const lib = await prisma.liberacaoFornecedor.create({
    data: {
      obraId,
      comprasMetaId,
      percentual,
      valorAutorizado,
      observacoes: observacoes?.trim() || null,
      solicitadoPorId: userId,
    },
  });

  const { sendEmailObra } = await import('../../services/email-obras');
  await sendEmailObra({
    to: [FINANCEIRO_EMAIL],
    subject: `Liberação aguardando financeiro — ${obra.name} · ${item.fornecedor ?? item.categoria}`,
    html: `
      <p>A engenharia solicitou liberação de medição de fornecedor:</p>
      <p><strong>${obra.name}</strong> · ${item.categoria}${item.descritivo ? ` — ${item.descritivo}` : ''}<br/>
      Fornecedor: <strong>${item.fornecedor ?? '—'}</strong><br/>
      Percentual: <strong>${percentual.toFixed(1)}%</strong> = <strong>${BRL(valorAutorizado)}</strong>
      ${observacoes?.trim() ? `<br/>Obs.: ${observacoes.trim()}` : ''}</p>
      <p><a href="${APP_URL}/liberacao-fornecedor?id=${lib.id}">Abrir no painel para conferir e definir a data de pagamento</a></p>`,
  }).catch(() => {}); // notificação — não bloqueia a solicitação se o e-mail falhar

  return lib;
}

export async function aprovarFinanceiro(id: string, dataPagamento: string, user: { userId: string; role: string }) {
  if (!APROVA_FINANCEIRO_ROLES.includes(user.role)) {
    throw AppError.forbidden('Aprovação do financeiro é restrita a financeiro/diretoria');
  }
  if (!dataPagamento) throw AppError.badRequest('Informe a data de pagamento');

  const lib = await prisma.liberacaoFornecedor.findUnique({
    where: { id },
    include: { obra: { select: { name: true } }, comprasMeta: true },
  });
  if (!lib) throw AppError.notFound('Liberação');
  if (lib.status !== 'solicitada') {
    throw AppError.badRequest(`Só liberações aguardando financeiro podem ser aprovadas aqui (status atual: ${lib.status})`);
  }

  await prisma.liberacaoFornecedor.update({
    where: { id },
    data: { status: 'aprovada_financeiro', dataPagamento: new Date(`${dataPagamento}T12:00:00Z`), aprovadoFinanceiroId: user.userId },
  });

  const { sendEmailObra } = await import('../../services/email-obras');
  await sendEmailObra({
    to: [DIRETORIA_EMAIL],
    subject: `Liberação aguardando SUA aprovação — ${lib.obra.name} · ${lib.comprasMeta.fornecedor ?? lib.comprasMeta.categoria} · ${BRL(Number(lib.valorAutorizado))}`,
    html: `
      <p>O financeiro aprovou e definiu a data de pagamento. Falta a sua aprovação:</p>
      <p><strong>${lib.obra.name}</strong> · ${lib.comprasMeta.categoria}<br/>
      Fornecedor: <strong>${lib.comprasMeta.fornecedor ?? '—'}</strong><br/>
      Percentual: <strong>${Number(lib.percentual).toFixed(1)}%</strong> = <strong>${BRL(Number(lib.valorAutorizado))}</strong><br/>
      Pagamento em: <strong>${fmtData(dataPagamento)}</strong></p>
      <p><a href="${APP_URL}/liberacao-fornecedor?id=${id}">Abrir para aprovar</a> — ao aprovar, o e-mail de autorização sai automaticamente para o fornecedor.</p>`,
  }).catch(() => {});

  return { ok: true };
}

export async function aprovarDiretoria(id: string, user: { userId: string; role: string }, emailManual?: string) {
  if (!APROVA_DIRETORIA_ROLES.includes(user.role)) {
    throw AppError.forbidden('Aprovação final é restrita à diretoria');
  }
  const lib = await prisma.liberacaoFornecedor.findUnique({
    where: { id },
    include: { obra: { select: { name: true } }, comprasMeta: true },
  });
  if (!lib) throw AppError.notFound('Liberação');
  if (lib.status !== 'aprovada_financeiro') {
    throw AppError.badRequest(`Só liberações já aprovadas pelo financeiro podem ser autorizadas (status atual: ${lib.status})`);
  }

  const nomeForn = lib.comprasMeta.fornecedor ?? 'Fornecedor';
  const emailAutomatico = await tentarAcharEmailFornecedor(lib.obraId, lib.comprasMeta.fornecedor);
  const emailForn = emailAutomatico ?? emailManual?.trim();
  if (!emailForn) {
    throw AppError.badRequest(
      `Não achei e-mail de "${nomeForn}" no Cronograma de Contratações desta obra. Informe o e-mail pra aprovar.`,
    );
  }

  // STRICT: se o e-mail falhar, a aprovação não conclui — autorizar sem
  // avisar o fornecedor recriaria o processo manual por telefone.
  const { sendEmailObra } = await import('../../services/email-obras');
  await sendEmailObra({
    to: [emailForn],
    subject: `BÈR Engenharia — Autorização de faturamento · ${lib.obra.name}`,
    html: `
      <p>Prezados,</p>
      <p>Fica autorizada a emissão da nota fiscal referente à medição do contrato abaixo:</p>
      <p>Obra: <strong>${lib.obra.name}</strong><br/>
      Fornecedor: <strong>${nomeForn}</strong><br/>
      Percentual autorizado nesta medição: <strong>${Number(lib.percentual).toFixed(1)}%</strong><br/>
      Valor autorizado: <strong>${BRL(Number(lib.valorAutorizado))}</strong><br/>
      Data prevista de pagamento: <strong>${fmtData(lib.dataPagamento)}</strong></p>
      <p><strong>O faturamento deve estar rigorosamente de acordo com os dados da Ordem de Compra</strong> (tomador, CNPJ e demais condições) — em alguns contratos a nota é emitida diretamente contra o cliente, conforme indicado na OC.</p>
      <p><strong>É obrigatório que o número da Ordem de Compra (OC) correspondente conste na nota fiscal.</strong> Notas sem esse número não serão aceitas para pagamento.</p>
      <p>A nota fiscal deve ser enviada em resposta a este e-mail. O pagamento fica condicionado ao recebimento e conferência da nota.</p>
      <p>Em caso de dúvida, respondam este e-mail.</p>
      <p>Atenciosamente,<br/>BÈR Engenharia</p>`,
  });

  await prisma.liberacaoFornecedor.update({
    where: { id },
    data: {
      status: 'autorizada',
      aprovadoDiretoriaId: user.userId,
      emailEnviadoEm: new Date(),
      emailDestinatario: emailForn,
    },
  });

  const internos = Array.from(new Set([FINANCEIRO_EMAIL]));
  await sendEmailObra({
    to: internos,
    subject: `Autorização ENVIADA — ${lib.obra.name} · ${nomeForn} · ${BRL(Number(lib.valorAutorizado))}`,
    html: `<p>E-mail de autorização enviado para <strong>${emailForn}</strong>.<br/>
      ${lib.obra.name} · ${nomeForn} · ${Number(lib.percentual).toFixed(1)}% = ${BRL(Number(lib.valorAutorizado))} · pagamento ${fmtData(lib.dataPagamento)}.</p>
      <p><a href="${APP_URL}/liberacao-fornecedor?id=${id}">Ver no painel</a></p>`,
  }).catch(() => {});

  return { ok: true, emailDestinatario: emailForn };
}

export async function recusar(id: string, motivo: string, user: { userId: string; role: string }) {
  if (!APROVA_FINANCEIRO_ROLES.includes(user.role)) {
    throw AppError.forbidden('Recusa restrita a financeiro/diretoria');
  }
  if (!motivo?.trim()) throw AppError.badRequest('Informe o motivo da recusa');
  const lib = await prisma.liberacaoFornecedor.findUnique({ where: { id } });
  if (!lib) throw AppError.notFound('Liberação');
  if (lib.status === 'autorizada') throw AppError.badRequest('Liberação já autorizada não pode ser recusada');

  await prisma.liberacaoFornecedor.update({
    where: { id },
    data: { status: 'recusada', recusadoPorId: user.userId, motivoRecusa: motivo.trim() },
  });
  return { ok: true };
}

/** Resumo por obra — usado na tela pra listar obras sem N+1 chamadas.
 *  Só entram obras com pelo menos 1 item de Metas de Compra com comprado>0. */
export async function getResumoObras() {
  const itens = await prisma.comprasMeta.findMany({
    where: { comprado: { gt: 0 } },
    select: { obraId: true, comprado: true, fornecedor: true },
  });
  if (itens.length === 0) return [];

  const obraIds = Array.from(new Set(itens.map((i) => i.obraId)));
  const obras = await prisma.obra.findMany({
    where: { id: { in: obraIds } },
    select: { id: true, name: true, status: true },
  });
  const nomeMap = new Map(obras.map((o) => [o.id, o.name]));
  const statusMap = new Map(obras.map((o) => [o.id, o.status]));

  type Agg = { qtdItens: number; totalComprado: number; fornecedores: Set<string> };
  const agg = new Map<string, Agg>();
  for (const it of itens) {
    const cur = agg.get(it.obraId) ?? { qtdItens: 0, totalComprado: 0, fornecedores: new Set<string>() };
    cur.qtdItens += 1;
    cur.totalComprado += it.comprado;
    if (it.fornecedor?.trim()) cur.fornecedores.add(it.fornecedor.trim());
    agg.set(it.obraId, cur);
  }

  return obraIds
    .filter((id) => nomeMap.has(id))
    .map((id) => {
      const a = agg.get(id)!;
      return {
        obraId: id,
        obraNome: nomeMap.get(id)!,
        obraStatus: statusMap.get(id)!,
        qtdItens: a.qtdItens,
        qtdFornecedores: a.fornecedores.size,
        totalComprado: a.totalComprado,
      };
    })
    .sort((a, b) => a.obraNome.localeCompare(b.obraNome, 'pt-BR'));
}

/** Painel geral — fila por status, todas as obras juntas. */
export async function getPainelGeral() {
  const itens = await prisma.liberacaoFornecedor.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      obra: { select: { name: true } },
      comprasMeta: { select: { categoria: true, descritivo: true, fornecedor: true, comprado: true } },
    },
  });
  return itens.map((l) => ({
    id: l.id,
    obraId: l.obraId,
    obraNome: l.obra.name,
    comprasMetaId: l.comprasMetaId,
    categoria: l.comprasMeta.categoria,
    descritivo: l.comprasMeta.descritivo,
    fornecedor: l.comprasMeta.fornecedor,
    percentual: Number(l.percentual),
    valorAutorizado: Number(l.valorAutorizado),
    status: l.status,
    dataPagamento: l.dataPagamento ? l.dataPagamento.toISOString().slice(0, 10) : null,
    observacoes: l.observacoes,
    motivoRecusa: l.motivoRecusa,
    emailEnviadoEm: l.emailEnviadoEm ? l.emailEnviadoEm.toISOString() : null,
    emailDestinatario: l.emailDestinatario,
    createdAt: l.createdAt.toISOString(),
  }));
}

/** Histórico completo de liberações de UMA obra (qualquer status) — "quanto o
 *  fornecedor já mediu", com quem solicitou/aprovou em cada etapa e quando. */
export async function getHistoricoObra(obraId: string) {
  const itens = await prisma.liberacaoFornecedor.findMany({
    where: { obraId },
    orderBy: { createdAt: 'desc' },
    include: {
      comprasMeta: { select: { categoria: true, descritivo: true, fornecedor: true, comprado: true } },
      solicitadoPor: { select: { name: true } },
      aprovadoFinanceiro: { select: { name: true } },
      aprovadoDiretoria: { select: { name: true } },
      recusadoPor: { select: { name: true } },
    },
  });
  return itens.map((l) => ({
    id: l.id,
    comprasMetaId: l.comprasMetaId,
    categoria: l.comprasMeta.categoria,
    descritivo: l.comprasMeta.descritivo,
    fornecedor: l.comprasMeta.fornecedor,
    comprado: l.comprasMeta.comprado,
    percentual: Number(l.percentual),
    valorAutorizado: Number(l.valorAutorizado),
    status: l.status,
    dataPagamento: l.dataPagamento ? l.dataPagamento.toISOString().slice(0, 10) : null,
    observacoes: l.observacoes,
    motivoRecusa: l.motivoRecusa,
    emailEnviadoEm: l.emailEnviadoEm ? l.emailEnviadoEm.toISOString() : null,
    emailDestinatario: l.emailDestinatario,
    solicitadoPorNome: l.solicitadoPor?.name ?? null,
    aprovadoFinanceiroNome: l.aprovadoFinanceiro?.name ?? null,
    aprovadoDiretoriaNome: l.aprovadoDiretoria?.name ?? null,
    recusadoPorNome: l.recusadoPor?.name ?? null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }));
}
