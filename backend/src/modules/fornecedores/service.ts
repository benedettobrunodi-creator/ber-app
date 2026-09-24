import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';

/**
 * FornecedorCadastro — cadastro ÚNICO e global de fornecedores (Bruno 22/09/26).
 * Usado por Metas de Compra e Cronograma de Contratações (selecionam daqui em
 * vez de digitar nome livre). Anti-duplicata em duas camadas:
 *  - nomeNorm @unique no banco (nome sem acento/minúsculo/espaços colapsados)
 *  - criação SEM `confirmarSimilar` é recusada com a lista de similares quando
 *    há candidato parecido — o front pergunta "é o mesmo que X?" (pedido
 *    explícito do Bruno, msg 13412) e só força com a flag.
 */

export const normalizarNome = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');

/** Similaridade simples e previsível: um contém o outro, ou distância curta. */
function saoSimilares(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true;
  // prefixo comum longo (pega "sinqo" × "sinqo tecnologia" já pelo includes;
  // isto pega typos curtos tipo "greenlog" × "green log" pós-normalização)
  const menor = Math.min(a.length, b.length);
  if (menor >= 5) {
    let iguais = 0;
    for (let i = 0; i < menor; i++) { if (a[i] === b[i]) iguais++; else break; }
    if (iguais / menor >= 0.8) return true;
  }
  return false;
}

export async function listar(q?: string) {
  const where = q?.trim()
    ? { nomeNorm: { contains: normalizarNome(q) } }
    : {};
  return prisma.fornecedorCadastro.findMany({
    where,
    orderBy: { nome: 'asc' },
    take: q?.trim() ? 50 : 500, // sem busca = listagem completa (tela de gestão do hub)
    select: { id: true, nome: true, cnpj: true, contato: true, telefone: true, email: true },
  });
}

export interface CriarInput {
  nome: string;
  cnpj?: string;
  contato?: string;
  telefone?: string;
  email?: string;
  observacoes?: string;
  /** true = usuário já viu os similares e confirmou que é fornecedor NOVO. */
  confirmarSimilar?: boolean;
}

/** Retorna { criado: true, fornecedor } OU { criado: false, similares } —
 *  o front mostra "é o mesmo que X?" e re-envia com confirmarSimilar: true.
 *  Nome EXATAMENTE igual (normalizado) nunca cria: devolve o existente. */
export async function criar(input: CriarInput, userId: string) {
  const nome = input.nome?.trim();
  if (!nome || nome.length < 2) throw AppError.badRequest('Informe o nome do fornecedor');
  const nomeNorm = normalizarNome(nome);

  const exato = await prisma.fornecedorCadastro.findUnique({ where: { nomeNorm } });
  if (exato) {
    return { criado: false as const, jaExistente: exato, similares: [] };
  }

  if (!input.confirmarSimilar) {
    const todos = await prisma.fornecedorCadastro.findMany({ select: { id: true, nome: true, nomeNorm: true } });
    const similares = todos.filter((f) => saoSimilares(f.nomeNorm, nomeNorm)).slice(0, 5);
    if (similares.length > 0) {
      return { criado: false as const, similares: similares.map(({ id, nome: n }) => ({ id, nome: n })) };
    }
  }

  const fornecedor = await prisma.fornecedorCadastro.create({
    data: {
      nome,
      nomeNorm,
      cnpj: input.cnpj?.trim() || null,
      contato: input.contato?.trim() || null,
      telefone: input.telefone?.trim() || null,
      email: input.email?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
      criadoPorId: userId,
    },
  });
  return { criado: true as const, fornecedor };
}

export interface AtualizarInput {
  nome?: string;
  cnpj?: string | null;
  contato?: string | null;
  telefone?: string | null;
  email?: string | null;
  observacoes?: string | null;
}

export async function atualizar(id: string, input: AtualizarInput) {
  const atual = await prisma.fornecedorCadastro.findUnique({ where: { id } });
  if (!atual) throw AppError.notFound('Fornecedor');

  const data: Record<string, unknown> = {};
  if (input.nome !== undefined) {
    const nome = input.nome.trim();
    if (nome.length < 2) throw AppError.badRequest('Nome inválido');
    const nomeNorm = normalizarNome(nome);
    const choque = await prisma.fornecedorCadastro.findUnique({ where: { nomeNorm } });
    if (choque && choque.id !== id) {
      throw AppError.conflict(`Já existe "${choque.nome}" com esse nome`);
    }
    data.nome = nome;
    data.nomeNorm = nomeNorm;
  }
  for (const k of ['cnpj', 'contato', 'telefone', 'email', 'observacoes'] as const) {
    if (input[k] !== undefined) data[k] = input[k]?.trim() || null;
  }
  return prisma.fornecedorCadastro.update({ where: { id }, data });
}
