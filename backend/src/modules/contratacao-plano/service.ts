import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreatePlanoInput, UpdatePlanoInput } from './types';
import { CONTRATACAO_TEMPLATE } from './template';

const parseDate = (d: string | null | undefined) => (d ? new Date(d) : null);

/** Semeia os pacotes do template padrão (coluna A) numa obra sem planos. */
async function seedTemplate(obraId: string) {
  await prisma.obraContratacaoPlano.createMany({
    data: CONTRATACAO_TEMPLATE.map((pacote, i) => ({ obraId, pacote, ordem: i })),
  });
}

/** Calcula status real considerando atraso vs status armazenado */
function effectiveStatus(p: { status: string; dataLimite: Date | null; contratacaoId: string | null }) {
  if (p.contratacaoId) return 'contratado';
  // status "contratado" pode ser marcado manualmente (sem vínculo a uma contratação)
  if (p.dataLimite && p.dataLimite.getTime() < Date.now() && p.status !== 'contratado') return 'atrasado';
  return p.status;
}

export async function listByObra(obraId: string) {
  const total = await prisma.obraContratacaoPlano.count({ where: { obraId } });
  if (total === 0) await seedTemplate(obraId);

  const rows = await prisma.obraContratacaoPlano.findMany({
    where: { obraId },
    include: { contratacao: { select: { id: true, fornecedor: true, valor: true, status: true } } },
    orderBy: [{ dataIdeal: 'asc' }, { dataLimite: 'asc' }, { ordem: 'asc' }, { pacote: 'asc' }],
  });

  // Nº das OCs (24/09/26, Bruno): compras preenche numeroOc no item de Metas;
  // aqui mostramos SÓ os números (nunca valor — regra: Cronograma não exibe
  // dinheiro). Ligação: mesmo fornecedor do cadastro único, na mesma obra.
  const metasComOc = await prisma.comprasMeta.findMany({
    where: { obraId, numeroOc: { not: null }, fornecedorId: { not: null } },
    select: { fornecedorId: true, numeroOc: true },
  });
  const ocsPorFornecedor = new Map<string, string[]>();
  for (const m of metasComOc) {
    const lista = ocsPorFornecedor.get(m.fornecedorId!) ?? [];
    if (m.numeroOc && !lista.includes(m.numeroOc)) lista.push(m.numeroOc);
    ocsPorFornecedor.set(m.fornecedorId!, lista);
  }

  return rows.map(r => ({
    ...r,
    statusEfetivo: effectiveStatus(r),
    numerosOc: r.fornecedorId ? (ocsPorFornecedor.get(r.fornecedorId) ?? []) : [],
  }));
}

/** Visão GLOBAL do Cronograma de Contratações (hub de Compras, 24/09/26):
 *  todas as obras numa tabela só, sem entrar obra por obra. Mesma fonte de
 *  dados das telas por obra — editar aqui É editar lá. Sem valores (regra:
 *  Cronograma nunca mostra dinheiro). */
export async function listGlobal() {
  const rows = await prisma.obraContratacaoPlano.findMany({
    include: {
      obra: { select: { id: true, name: true, status: true } },
      contratacao: { select: { id: true, fornecedor: true, valor: true, status: true } },
    },
    orderBy: [{ dataIdeal: 'asc' }, { dataLimite: 'asc' }, { ordem: 'asc' }, { pacote: 'asc' }],
  });

  const metasComOc = await prisma.comprasMeta.findMany({
    where: { numeroOc: { not: null }, fornecedorId: { not: null } },
    select: { obraId: true, fornecedorId: true, numeroOc: true },
  });
  const ocsPorChave = new Map<string, string[]>();
  for (const m of metasComOc) {
    const chave = `${m.obraId}:${m.fornecedorId}`;
    const lista = ocsPorChave.get(chave) ?? [];
    if (m.numeroOc && !lista.includes(m.numeroOc)) lista.push(m.numeroOc);
    ocsPorChave.set(chave, lista);
  }

  return rows.map(r => ({
    ...r,
    obraNome: r.obra.name,
    obraStatus: r.obra.status,
    statusEfetivo: effectiveStatus(r),
    numerosOc: r.fornecedorId ? (ocsPorChave.get(`${r.obraId}:${r.fornecedorId}`) ?? []) : [],
  }));
}

export async function create(obraId: string, input: CreatePlanoInput) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!obra) throw AppError.notFound('Obra');
  const max = await prisma.obraContratacaoPlano.aggregate({ where: { obraId }, _max: { ordem: true } });
  return prisma.obraContratacaoPlano.create({
    data: {
      obraId,
      pacote:     input.pacote,
      ordem:      (max._max.ordem ?? -1) + 1,
      dataIdeal:  parseDate(input.dataIdeal),
      dataLimite: parseDate(input.dataLimite),
      contato:    input.contato ?? null,
      telefone:   input.telefone ?? null,
      email:      input.email ?? null,
      responsavel:       input.responsavel ?? null,
      empresaContratada: input.empresaContratada ?? null,
      fornecedorId:      input.fornecedorId ?? null,
      tempoEntrega:      parseDate(input.tempoEntrega),
      dataEmissaoPedido: parseDate(input.dataEmissaoPedido),
      inicioMobilizacao: parseDate(input.inicioMobilizacao),
      observacoes: input.observacoes ?? null,
    },
  });
}

export async function update(id: string, input: UpdatePlanoInput) {
  const existing = await prisma.obraContratacaoPlano.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Plano de contratação');

  // Se vinculou a uma contratação, valida que ela existe e é da mesma obra
  if (input.contratacaoId) {
    const c = await prisma.obraContratacao.findUnique({
      where: { id: input.contratacaoId },
      select: { obraId: true },
    });
    if (!c) throw AppError.notFound('Contratação');
    if (c.obraId !== existing.obraId) {
      throw AppError.badRequest('Contratação não pertence a esta obra');
    }
  }

  return prisma.obraContratacaoPlano.update({
    where: { id },
    data: {
      pacote:        input.pacote,
      dataIdeal:     'dataIdeal'  in input ? parseDate(input.dataIdeal)  : undefined,
      dataLimite:    'dataLimite' in input ? parseDate(input.dataLimite) : undefined,
      contato:       'contato'  in input ? (input.contato  ?? null) : undefined,
      telefone:      'telefone' in input ? (input.telefone ?? null) : undefined,
      email:         'email'    in input ? (input.email    ?? null) : undefined,
      responsavel:       'responsavel'       in input ? (input.responsavel       ?? null) : undefined,
      empresaContratada: 'empresaContratada' in input ? (input.empresaContratada ?? null) : undefined,
      // Cadastro único de fornecedores (22/09/26)
      fornecedorId:      'fornecedorId'      in input ? (input.fornecedorId      ?? null) : undefined,
      tempoEntrega:      'tempoEntrega'      in input ? parseDate(input.tempoEntrega)      : undefined,
      dataEmissaoPedido: 'dataEmissaoPedido' in input ? parseDate(input.dataEmissaoPedido) : undefined,
      inicioMobilizacao: 'inicioMobilizacao' in input ? parseDate(input.inicioMobilizacao) : undefined,
      observacoes:   input.observacoes,
      status:        input.contratacaoId ? 'contratado' : input.status,
      contratacaoId: input.contratacaoId,
    },
  });
}

export async function remove(id: string) {
  const existing = await prisma.obraContratacaoPlano.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Plano de contratação');
  await prisma.obraContratacaoPlano.delete({ where: { id } });
}
