// Integração Pipeline (CRM) ↔ Esteira de Orçamentos — fluxo único (Bruno 16/10/26).
//
// Regras de negócio decididas com o Bruno:
// - O orçamento NASCE da oportunidade: ao mover pra Qualificação+ sem orçamento
//   vinculado, cria automático no backlog da esteira, herdando os dados.
// - FICHA DE CADASTRO (padrão Talita) é OBRIGATÓRIA pra sair de Lead: sem os
//   campos essenciais, o movimento é bloqueado.
// - Na entrada em Qualificação, o sistema dispara o e-mail da ficha (1x) pra
//   Bruno + Gritti + Bruna (orçamentos) + Responsável pelo Orçamento.
// - MÃO ÚNICA: o pipeline só se move pela mão do comercial; a etapa do CRM
//   dita o status do orçamento na esteira (nunca o contrário).
// - Donos de campo: valor final e m² = orçamento (espelha pra oportunidade);
//   probabilidade e responsável pelo orçamento = espelham nos dois sentidos
//   conforme quem edita.
// - Exceção: CHANGE ORDER nasce na esteira e vira card no pipeline na coluna
//   "Proposta em produção" (origem change_order).
//
// Anti-loop: todos os espelhos escrevem via prisma DIRETO (nunca pelo service
// do outro módulo), então um espelho não dispara outro.
import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import { categoriaFromStatus } from '../orcamentos/types';

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Etapas em que a oportunidade ganha/possui orçamento na esteira. */
export const ETAPAS_CRIA_ORCAMENTO = ['qualificacao', 'proposta_producao', 'proposta_enviada', 'negociacao'] as const;

/** Etapa do pipeline → status da esteira (mão única CRM→esteira). */
export const ETAPA_PARA_STATUS: Record<string, string> = {
  lead: 'LEAD',
  qualificacao: 'A_INICIAR',
  proposta_producao: 'PRODUZINDO',
  proposta_enviada: 'ENVIADO',
  negociacao: 'AGUARDANDO',
  ganho: 'APROVADO',
  perdido: 'PERDIDO',
  declinado: 'DECLINADO',
  cancelado: 'CANCELADO',
};

const PROB_UP: Record<string, string> = { alta: 'ALTA', media: 'MEDIA', baixa: 'BAIXA' };
const PROB_DOWN: Record<string, string> = { ALTA: 'alta', MEDIA: 'media', BAIXA: 'baixa' };

const FICHA_EMAIL_FIXOS = [
  'bruno@ber-engenharia.com.br',
  'francisco.gritti@ber-engenharia.com.br',
  'bruna.lima@ber-engenharia.com.br',
  'caroline.tenorio@ber-engenharia.com.br', // orçamentos (Bruno 19/10/26)
];

export const ENTREGAVEIS_LABELS: Record<string, string> = {
  planilha_cliente: 'Planilha Orçamentária — modelo cliente',
  planilha_ber: 'Planilha Orçamentária — modelo BÈR',
  cronograma_fisico_financeiro: 'Cronograma Físico-financeiro',
  proposta_tecnica: 'Proposta Técnica',
  proposta_comercial: 'Proposta Comercial',
};

const MODALIDADE_LABELS: Record<string, string> = {
  'D&B': 'D&B',
  'D&B_TECNICO': 'D&B Técnico',
  GC: 'GC',
};

export interface FichaCadastro {
  obra?: string | null;
  enderecoObra?: string | null;
  contatoGerenciadora?: string | null;
  arquitetura?: string | null;
  reservaTecnica?: string | null;
  concorrentes?: string | null;
  modalidade?: string | null; // 'D&B' | 'D&B_TECNICO' | 'GC'
  prazosProcesso?: string | null;
  horarioCondominio?: string | null;
  modalidadeContratacao?: string | null;
  informacoesGerais?: string | null;
  escopo?: string | null;
  seguro?: string | null;
  formaPagamento?: string | null;
  entregaveis?: string[] | null;
  validadeProposta?: string | null;
  arquivosRecebidos?: string | null;
}

// ─── Gate: ficha obrigatória pra sair de Lead ───────────────────────────────

/** Campos essenciais (OK Bruno 16/10): obra, endereço, modalidade, metragem, entregáveis. */
export function validarFichaObrigatoria(opp: { ficha?: unknown; metragemM2?: unknown }): void {
  const f = (opp.ficha ?? {}) as FichaCadastro;
  const faltam: string[] = [];
  if (!f.obra?.trim()) faltam.push('Obra (descrição)');
  if (!f.enderecoObra?.trim()) faltam.push('Endereço da obra');
  if (!f.modalidade) faltam.push('Modalidade (D&B / D&B Técnico / GC)');
  if (opp.metragemM2 == null || Number(opp.metragemM2) <= 0) faltam.push('Metragem (m²)');
  if (!f.entregaveis?.length) faltam.push('Entregáveis');
  if (faltam.length) {
    throw AppError.badRequest(`Ficha de Cadastro incompleta — preencha antes de mover pra Qualificação: ${faltam.join(' · ')}`);
  }
}

/** O gate dispara quando a oportunidade SAI de lead (ou nasce) pra uma etapa de orçamento. */
export function precisaFicha(etapaAnterior: string | null, etapaNova: string): boolean {
  const entrando = (ETAPAS_CRIA_ORCAMENTO as readonly string[]).includes(etapaNova);
  const vinhaDeLead = etapaAnterior === null || etapaAnterior === 'lead';
  return entrando && vinhaDeLead;
}

// ─── Numeração automática do orçamento (padrão NNN.AA) ──────────────────────

export async function proximoNumeroOrcamento(): Promise<string> {
  const ano2 = String(new Date().getFullYear()).slice(2);
  const doAno = await prisma.orcamento.findMany({
    where: { numero: { endsWith: `.${ano2}` } },
    select: { numero: true },
  });
  let max = 0;
  for (const o of doAno) {
    const m = /^(\d+)\.\d{2}$/.exec(o.numero);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  let seq = max + 1;
  let numero = `${seq}.${ano2}`;
  // corrida rara: garante unicidade
  while (await prisma.orcamento.findUnique({ where: { numero }, select: { id: true } })) {
    seq += 1;
    numero = `${seq}.${ano2}`;
  }
  return numero;
}

// ─── CRM → Esteira: cria/atualiza o orçamento quando a etapa muda ────────────

/**
 * Chamar APÓS a etapa da oportunidade mudar (create/update/drag).
 * - veioDeLead=true (cruzou Lead→Qualificação+, ou nasceu direto lá): cria o
 *   orçamento no backlog se não existe e dispara o e-mail da ficha (1x).
 *   Oportunidades ANTIGAS (já além de Lead, sem vínculo) NÃO ganham orçamento
 *   automático ao trocar de etapa — a esteira já tem os orçamentos delas
 *   criados à mão no fluxo antigo; auto-criar duplicaria. Essas são vinculadas
 *   manualmente (ação "criar orçamento" existente) e daí passam a sincronizar.
 * - Pra quem JÁ tem orçamento vinculado: sincroniza o status em toda mudança.
 */
export async function sincronizarEsteiraAposEtapa(oportunidadeId: string, userId: string, veioDeLead: boolean): Promise<void> {
  const opp = await prisma.crmOportunidade.findUnique({
    where: { id: oportunidadeId },
    include: {
      empresa: { select: { razaoSocial: true, segmento: true } },
      responsavelOrcamento: { select: { id: true, name: true, email: true } },
      responsavel: { select: { name: true } },
    },
  });
  if (!opp) return;
  const statusAlvo = ETAPA_PARA_STATUS[opp.etapa];
  if (!statusAlvo) return;

  const criaNessaEtapa = veioDeLead && (ETAPAS_CRIA_ORCAMENTO as readonly string[]).includes(opp.etapa);

  if (!opp.orcamentoId && criaNessaEtapa) {
    const numero = await proximoNumeroOrcamento();
    const orc = await prisma.orcamento.create({
      data: {
        numero,
        cliente: opp.empresa?.razaoSocial ?? opp.titulo,
        descricaoCurta: opp.titulo.slice(0, 500),
        m2: opp.metragemM2 != null ? Number(opp.metragemM2) : null,
        valorVenda: opp.valor,
        segmento: opp.empresa?.segmento?.slice(0, 50) ?? null,
        probabilidade: opp.probabilidade ? (PROB_UP[opp.probabilidade] ?? null) : null,
        status: statusAlvo,
        categoria: categoriaFromStatus(statusAlvo),
        tipo: 'NOVO',
        responsavelId: opp.responsavelOrcamentoId,
        createdById: userId,
        observacoes: 'Criado automaticamente a partir da oportunidade do CRM (fluxo único).',
      },
      select: { id: true, numero: true },
    });
    await prisma.crmOportunidade.update({ where: { id: opp.id }, data: { orcamentoId: orc.id } });
    await prisma.crmOportunidadeHistorico.create({
      data: {
        oportunidadeId: opp.id,
        campo: 'orcamento',
        valorNovo: `Orçamento ${orc.numero} criado na esteira (automático)`,
        alteradoPor: 'Sistema — fluxo único',
      },
    }).catch(() => {});
  } else if (opp.orcamentoId) {
    await prisma.orcamento.update({
      where: { id: opp.orcamentoId },
      data: { status: statusAlvo, categoria: categoriaFromStatus(statusAlvo) },
    }).catch(() => {});
  }

  // E-mail da ficha — 1x, sempre que a oportunidade está em etapa de orçamento
  // com ficha preenchida e o e-mail ainda não saiu (não exige mais "vindo de
  // lead": cobre ficha preenchida depois e negócios anteriores ao fluxo único).
  await enviarFichaSePendente(opp.id);
}

/** Dispara o e-mail da ficha se ainda não foi enviado, a oportunidade está em
 *  etapa de orçamento e a ficha existe. Caso real (Camila 22/10): a ficha era
 *  preenchida DEPOIS do negócio já estar em qualificação — sem mudança de
 *  etapa, o e-mail nunca saía. Agora salvar a ficha também dispara. */
export async function enviarFichaSePendente(oportunidadeId: string): Promise<void> {
  try {
    const opp = await prisma.crmOportunidade.findUnique({
      where: { id: oportunidadeId },
      select: { id: true, etapa: true, ficha: true, fichaEnviadaEm: true },
    });
    if (!opp || opp.fichaEnviadaEm) return;
    if (!(ETAPAS_CRIA_ORCAMENTO as readonly string[]).includes(opp.etapa)) return;
    if (opp.ficha == null) return; // sem ficha não há o que enviar
    await enviarFichaEmail(opp.id);
    await prisma.crmOportunidade.update({ where: { id: opp.id }, data: { fichaEnviadaEm: new Date() } });
  } catch (e) {
    console.error('[integracao-esteira] e-mail da ficha falhou:', (e as Error).message);
  }
}

/** Espelha campos do COMERCIAL pro orçamento vinculado (probabilidade, responsável pelo orçamento). */
export async function espelharOportunidadeNoOrcamento(oportunidadeId: string): Promise<void> {
  const opp = await prisma.crmOportunidade.findUnique({
    where: { id: oportunidadeId },
    select: { orcamentoId: true, probabilidade: true, responsavelOrcamentoId: true },
  });
  if (!opp?.orcamentoId) return;
  await prisma.orcamento.update({
    where: { id: opp.orcamentoId },
    data: {
      probabilidade: opp.probabilidade ? (PROB_UP[opp.probabilidade] ?? null) : null,
      responsavelId: opp.responsavelOrcamentoId,
    },
  }).catch(() => {});
}

// ─── Esteira → CRM ───────────────────────────────────────────────────────────

/** Espelha pro CRM apenas os campos do orçamento que MUDARAM neste update
 *  (seletivo de propósito: espelhar tudo sempre poderia sobrescrever um valor
 *  mais novo que o comercial acabou de editar do lado dele). */
export async function espelharOrcamentoNaOportunidade(
  orcamentoId: string,
  mudou: { valorVenda?: boolean; m2?: boolean; probabilidade?: boolean; responsavelId?: boolean },
): Promise<void> {
  if (!mudou.valorVenda && !mudou.m2 && !mudou.probabilidade && !mudou.responsavelId) return;
  const orc = await prisma.orcamento.findUnique({
    where: { id: orcamentoId },
    select: { valorVenda: true, m2: true, probabilidade: true, responsavelId: true },
  });
  if (!orc) return;
  const opp = await prisma.crmOportunidade.findFirst({ where: { orcamentoId }, select: { id: true } });
  if (!opp) return;
  const data: Record<string, unknown> = {};
  if (mudou.valorVenda) data.valor = orc.valorVenda;
  if (mudou.m2) data.metragemM2 = orc.m2 != null ? orc.m2 : null;
  if (mudou.probabilidade) data.probabilidade = orc.probabilidade ? (PROB_DOWN[orc.probabilidade] ?? null) : null;
  if (mudou.responsavelId) data.responsavelOrcamentoId = orc.responsavelId;
  await prisma.crmOportunidade.update({ where: { id: opp.id }, data: data as never }).catch(() => {});
}

/** Change Order criada na esteira → card no pipeline em "Proposta em produção". */
export async function criarCardPipelineParaCO(orcamentoId: string, userId: string): Promise<void> {
  const orc = await prisma.orcamento.findUnique({
    where: { id: orcamentoId },
    select: { id: true, numero: true, cliente: true, descricaoCurta: true, valorVenda: true, m2: true, probabilidade: true, responsavelId: true, tipo: true },
  });
  if (!orc || orc.tipo !== 'CHANGE_ORDER') return;
  const jaTem = await prisma.crmOportunidade.findFirst({ where: { orcamentoId }, select: { id: true } });
  if (jaTem) return;

  const titulo = `Change Order ${orc.numero} — ${orc.cliente}`.slice(0, 500);
  const opp = await prisma.crmOportunidade.create({
    data: {
      titulo,
      etapa: 'proposta_producao',
      origem: 'change_order',
      valor: orc.valorVenda,
      metragemM2: orc.m2 != null ? orc.m2 : null,
      probabilidade: orc.probabilidade ? (PROB_DOWN[orc.probabilidade] ?? null) : null,
      responsavelOrcamentoId: orc.responsavelId,
      createdById: userId,
      dataEntradaPipeline: new Date(),
      orcamentoId: orc.id,
    },
    select: { id: true },
  });
  await prisma.crmOportunidadeHistorico.create({
    data: {
      oportunidadeId: opp.id,
      campo: 'criacao',
      valorNovo: 'proposta_producao (Change Order vindo da esteira)',
      alteradoPor: 'Sistema — fluxo único',
    },
  }).catch(() => {});
}

// ─── E-mail da Ficha de Cadastro (padrão Talita) ─────────────────────────────

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function linhaFicha(rotulo: string, valor?: string | null): string {
  const v = valor?.trim();
  return `
    <tr>
      <td style="padding:7px 10px;font-size:11px;color:#5C5E54;text-transform:uppercase;letter-spacing:.06em;vertical-align:top;width:190px;border-bottom:1px solid #E4E6DA;">${rotulo}</td>
      <td style="padding:7px 10px;font-size:13px;color:#1E1E22;border-bottom:1px solid #E4E6DA;white-space:pre-wrap;">${v ? esc(v) : '<span style="color:#B42318;">— não informado —</span>'}</td>
    </tr>`;
}

export async function enviarFichaEmail(oportunidadeId: string): Promise<void> {
  const opp = await prisma.crmOportunidade.findUnique({
    where: { id: oportunidadeId },
    include: {
      empresa: { select: { razaoSocial: true } },
      responsavel: { select: { name: true } },
      responsavelOrcamento: { select: { name: true, email: true } },
    },
  });
  if (!opp) return;
  const f = (opp.ficha ?? {}) as FichaCadastro;
  const appUrl = process.env.APP_PUBLIC_URL ?? 'https://ber-app.vercel.app';
  const fmtVal = opp.valor != null
    ? Number(opp.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : null;
  const entregaveis = (f.entregaveis ?? []).map((e) => ENTREGAVEIS_LABELS[e] ?? e).join('\n');
  const modalidade = f.modalidade ? (MODALIDADE_LABELS[f.modalidade] ?? f.modalidade) : null;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#1E1E22">
    <div style="background:#1E1E22;color:#F7F7F5;padding:20px 26px;border-radius:12px 12px 0 0">
      <div style="font-size:11px;color:#B5B820;letter-spacing:.14em;text-transform:uppercase;margin-bottom:4px">Nova oportunidade — Ficha de Cadastro</div>
      <div style="font-size:19px;font-weight:700">${esc(opp.titulo)}</div>
    </div>
    <div style="border:1px solid #E4E6DA;border-top:none;border-radius:0 0 12px 12px;padding:20px 22px">
      <table style="width:100%;border-collapse:collapse;">
        ${linhaFicha('Cliente', opp.empresa?.razaoSocial ?? opp.titulo)}
        ${linhaFicha('Obra', f.obra)}
        ${linhaFicha('Endereço da obra', f.enderecoObra)}
        ${linhaFicha('Contato ou gerenciadora', f.contatoGerenciadora)}
        ${linhaFicha('Arquitetura', f.arquitetura)}
        ${linhaFicha('Reserva técnica', f.reservaTecnica)}
        ${linhaFicha('Concorrentes', f.concorrentes)}
        ${linhaFicha('Metragem', opp.metragemM2 != null ? `${Number(opp.metragemM2).toLocaleString('pt-BR')} m²` : null)}
        ${linhaFicha('Modalidade', modalidade)}
        ${linhaFicha('Valor estimado', fmtVal)}
        ${linhaFicha('Prazos do processo', f.prazosProcesso)}
        ${linhaFicha('Horário liberado pelo condomínio', f.horarioCondominio)}
        ${linhaFicha('Modalidade de contratação', f.modalidadeContratacao)}
        ${linhaFicha('Informações gerais', f.informacoesGerais)}
        ${linhaFicha('Escopo', f.escopo)}
        ${linhaFicha('Seguro', f.seguro)}
        ${linhaFicha('Forma de pagamento', f.formaPagamento)}
        ${linhaFicha('Entregáveis', entregaveis)}
        ${linhaFicha('Validade da proposta', f.validadeProposta)}
        ${linhaFicha('Arquivos recebidos', f.arquivosRecebidos)}
        ${linhaFicha('Responsável pela conta', opp.responsavel?.name)}
        ${linhaFicha('Executivo comercial', opp.executivoComercial)}
        ${linhaFicha('Responsável pelo orçamento', opp.responsavelOrcamento?.name)}
      </table>
      <p style="margin:16px 0 0;"><a href="${appUrl}/crm" style="color:#5E6B0F;font-weight:600;font-size:13px;">Abrir a oportunidade no CRM →</a></p>
      <p style="font-size:11px;color:#8B8D82;margin:14px 0 0;">Enviado automaticamente pelo BER App quando a oportunidade entrou em Qualificação. O orçamento correspondente já foi criado no backlog da esteira.</p>
    </div>
  </div>`;

  const to = new Set(FICHA_EMAIL_FIXOS);
  if (opp.responsavelOrcamento?.email) to.add(opp.responsavelOrcamento.email.toLowerCase());

  const { sendEmailObra } = await import('../../services/email-obras');
  await sendEmailObra({
    to: [...to],
    subject: `📋 Ficha de Cadastro — ${opp.titulo.slice(0, 120)}`,
    html,
  });
}
