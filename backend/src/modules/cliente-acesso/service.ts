import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import { randomUUID } from 'node:crypto';
import type { IssueAcessoInput, AprovarInput, ContestarInput } from './types';

export async function issueAcesso(obraId: string, input: IssueAcessoInput) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!obra) throw AppError.notFound('Obra');
  const token = randomUUID();
  return prisma.clienteAcesso.create({
    data: {
      obraId,
      email: input.email,
      nome:  input.nome,
      token,
      expiraEm: input.expiraEm ? new Date(input.expiraEm) : null,
    },
  });
}

export async function listAcessosByObra(obraId: string) {
  return prisma.clienteAcesso.findMany({
    where: { obraId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function revogarAcesso(id: string) {
  const a = await prisma.clienteAcesso.findUnique({ where: { id } });
  if (!a) throw AppError.notFound('Acesso');
  await prisma.clienteAcesso.delete({ where: { id } });
}

/**
 * Cliente abre /v1/cliente/medicao/:token — busca a medição vinculada
 * (qualquer medição enviada da obra cujo tokenPublico bata).
 * Sem auth — só validação de token.
 */
export async function getMedicaoPorToken(token: string) {
  const m = await prisma.medicao.findUnique({
    where: { tokenPublico: token },
    include: {
      obra: { select: { id: true, name: true, client: true, valorContrato: true, prazoPagamentoDias: true } },
      itens: {
        include: {
          etapaFornecedor: {
            include: {
              etapa: true,
              fornecedor: true,
            },
          },
        },
      },
      pagamentosDiretos: true,
      transicoes: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!m) throw AppError.notFound('Medição');
  // só expõe medições enviadas em diante (não rascunho)
  if (m.status === 'rascunho') throw AppError.notFound('Medição');
  return m;
}

/**
 * Cliente abre /v1/cliente/medicao/:token/consolidado — retorna o panorama
 * financeiro do contrato inteiro (todas medições já enviadas): contrato e
 * pago por empresa (BÈR + terceiros), com breakdown por medição.
 */
export async function getConsolidadoPorToken(token: string) {
  const m = await prisma.medicao.findUnique({
    where: { tokenPublico: token },
    select: { obraId: true },
  });
  if (!m) throw AppError.notFound('Medição');

  const [obra, etapaFornecedores, medicoes] = await Promise.all([
    prisma.obra.findUnique({
      where: { id: m.obraId },
      select: {
        id: true, name: true, client: true,
        valorContrato: true, prazoPagamentoDias: true,
        dataInicioObra: true, dataFimObra: true,
      },
    }),
    prisma.etapaFornecedor.findMany({
      where: { etapa: { obraId: m.obraId } },
      include: {
        etapa: { select: { id: true, ordem: true, nome: true } },
        fornecedor: { select: { id: true, razaoSocial: true } },
      },
    }),
    prisma.medicao.findMany({
      where: { obraId: m.obraId, NOT: { status: 'rascunho' } },
      orderBy: { numero: 'asc' },
      include: {
        itens: { select: { etapaFornecedorId: true, valorQuinzena: true } },
        pagamentosDiretos: { select: { fornecedorRazaoSocial: true, valor: true } },
      },
    }),
  ]);
  if (!obra) throw AppError.notFound('Obra');

  // Chave por empresa: o nome da empresa. BÈR aparece como "BÈR Engenharia"
  // quando o item é miscelaneos_ber OU sem fornecedor cadastrado.
  type EmpresaKey = string;
  interface EmpresaAgg {
    nome: string;
    tipo: 'principal' | 'terceiro_ber_paga' | 'terceiro_fatura_direto';
    contrato: number;
    porMedicao: Record<string, number>; // medicaoId → valor
  }
  const empresas = new Map<EmpresaKey, EmpresaAgg>();
  const BER_NOME = 'BÈR Engenharia';

  // Helper: identifica a empresa daquele etapaFornecedor
  const empresaDoEF = (ef: typeof etapaFornecedores[number]): { nome: string; tipo: EmpresaAgg['tipo'] } => {
    if (ef.tipo === 'miscelaneos_ber' || !ef.fornecedor) {
      return { nome: BER_NOME, tipo: 'principal' };
    }
    return {
      nome: ef.fornecedor.razaoSocial,
      tipo: ef.tipo === 'terceiro_fatura_direto' ? 'terceiro_fatura_direto' : 'terceiro_ber_paga',
    };
  };
  const getOrInit = (nome: string, tipo: EmpresaAgg['tipo']): EmpresaAgg => {
    let agg = empresas.get(nome);
    if (!agg) { agg = { nome, tipo, contrato: 0, porMedicao: {} }; empresas.set(nome, agg); }
    return agg;
  };

  // 1) Contrato: soma de valorContratado dos etapaFornecedores agrupado por empresa
  for (const ef of etapaFornecedores) {
    const { nome, tipo } = empresaDoEF(ef);
    const agg = getOrInit(nome, tipo);
    agg.contrato += Number(ef.valorContratado);
  }

  // Mapa rápido: etapaFornecedorId → empresa
  const efToEmpresa = new Map<string, string>();
  for (const ef of etapaFornecedores) {
    efToEmpresa.set(ef.id, empresaDoEF(ef).nome);
  }

  // 2) Pago por empresa por medição
  const medicaoMeta = medicoes.map(med => ({
    id: med.id,
    numero: med.numero,
    periodoInicio: med.periodoInicio,
    periodoFim: med.periodoFim,
    status: med.status,
    dataPagamentoRealizado: med.dataPagamentoRealizado,
  }));
  for (const med of medicoes) {
    for (const it of med.itens) {
      const nome = efToEmpresa.get(it.etapaFornecedorId);
      if (!nome) continue;
      const agg = empresas.get(nome);
      if (!agg) continue;
      agg.porMedicao[med.id] = (agg.porMedicao[med.id] ?? 0) + Number(it.valorQuinzena);
    }
    // Pagamentos diretos do cliente: vai pra empresa cujo nome bate (terceiro_fatura_direto)
    for (const pd of med.pagamentosDiretos) {
      const nome = pd.fornecedorRazaoSocial;
      const existente = empresas.get(nome);
      if (existente) {
        existente.porMedicao[med.id] = (existente.porMedicao[med.id] ?? 0) + Number(pd.valor);
      }
    }
  }

  // Ordena: BÈR principal primeiro, terceiros depois alfabeticamente
  const empresasArr = [...empresas.values()].sort((a, b) => {
    if (a.tipo === 'principal') return -1;
    if (b.tipo === 'principal') return 1;
    return a.nome.localeCompare(b.nome);
  });

  // Totais por empresa
  const empresasOut = empresasArr.map(e => {
    const pagoTotal = Object.values(e.porMedicao).reduce((s, v) => s + v, 0);
    return {
      nome: e.nome,
      tipo: e.tipo,
      contrato: e.contrato,
      pagoTotal,
      saldo: e.contrato - pagoTotal,
      porMedicao: e.porMedicao,
    };
  });

  const totalContrato = empresasOut.reduce((s, e) => s + e.contrato, 0);
  const totalPago     = empresasOut.reduce((s, e) => s + e.pagoTotal, 0);

  return {
    obra,
    medicoes: medicaoMeta,
    empresas: empresasOut,
    totais: {
      contrato: totalContrato,
      pago:     totalPago,
      saldo:    totalContrato - totalPago,
      pctPago:  totalContrato > 0 ? (totalPago / totalContrato) * 100 : 0,
    },
  };
}

export async function clienteAprovar(token: string, _input: AprovarInput) {
  const m = await prisma.medicao.findUnique({ where: { tokenPublico: token } });
  if (!m) throw AppError.notFound('Medição');
  if (m.status !== 'enviada') {
    throw AppError.badRequest(`Medição não está em estado enviada (atual: ${m.status})`);
  }
  return prisma.$transaction(async (tx) => {
    const upd = await tx.medicao.update({
      where: { id: m.id },
      data: { status: 'aprovada' },
    });
    await tx.medicaoTransicao.create({
      data: {
        medicaoId: m.id,
        userId: null,
        deStatus: 'enviada',
        paraStatus: 'aprovada',
        comentario: 'Aprovada pelo cliente via portal',
      },
    });
    return upd;
  });
}

export async function clienteContestar(token: string, input: ContestarInput) {
  const m = await prisma.medicao.findUnique({ where: { tokenPublico: token } });
  if (!m) throw AppError.notFound('Medição');
  if (m.status !== 'enviada') {
    throw AppError.badRequest(`Medição não está em estado enviada (atual: ${m.status})`);
  }
  return prisma.$transaction(async (tx) => {
    const upd = await tx.medicao.update({
      where: { id: m.id },
      data: { status: 'contestada' },
    });
    await tx.medicaoTransicao.create({
      data: {
        medicaoId: m.id,
        userId: null,
        deStatus: 'enviada',
        paraStatus: 'contestada',
        comentario: `Contestada pelo cliente: ${input.comentario}`,
      },
    });
    return upd;
  });
}
