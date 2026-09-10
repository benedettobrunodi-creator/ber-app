import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';

/**
 * Liberação de Medição (Bruno 10/09/26).
 *
 * A medição financeira acontece no app de medição; aqui mora o SEMÁFORO que
 * autoriza: por pacote contratado (Cronograma de Contratações), o sistema diz
 * 🟢 liberado ou 🔴 bloqueado com base na qualidade:
 *   - FVS vinculada pendente de preencher (pior ainda se vencida) → bloqueia
 *   - Última FVS preenchida com item não conforme → bloqueia
 * Override (liberar exceção / bloquear na mão) só diretoria ou coordenação,
 * com justificativa; vale 31 dias — um ciclo de medição.
 */

const OVERRIDE_DIAS = 31;

export type StatusLiberacao = 'liberado' | 'bloqueado' | 'liberado_excecao' | 'bloqueado_manual';

export async function getPainel(obraId: string) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true, name: true } });
  if (!obra) throw AppError.notFound('Obra');

  const planos = await prisma.obraContratacaoPlano.findMany({
    where: { obraId, OR: [{ status: 'contratado' }, { empresaContratada: { not: null } }] },
    orderBy: [{ ordem: 'asc' }, { pacote: 'asc' }],
  });

  const fichas = await prisma.atividadeFvs.findMany({
    where: { obraId },
    include: { itens: { select: { resposta: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const desde = new Date(Date.now() - OVERRIDE_DIAS * 24 * 3600 * 1000);
  const overrides = await prisma.liberacaoMedicaoOverride.findMany({
    where: { obraId, createdAt: { gte: desde } },
    orderBy: { createdAt: 'desc' },
    include: { criadoPor: { select: { id: true, name: true } } },
  });

  const hoje = new Date();
  const linhas = planos.map((p) => {
    const fichasDoPlano = fichas.filter((f) => f.contratacaoId === p.id);
    const motivos: string[] = [];

    for (const f of fichasDoPlano.filter((x) => x.status === 'pendente')) {
      const vencida = f.prazo && f.prazo < hoje;
      motivos.push(`FVS "${f.titulo}"${f.trecho ? ` (${f.trecho})` : ''} pendente de preencher${vencida ? ` — VENCIDA desde ${f.prazo!.toISOString().slice(0, 10)}` : ''}`);
    }
    // NC aberta = ficha preenchida com não-conforme SEM ficha posterior da mesma IT limpa
    const preenchidas = fichasDoPlano.filter((x) => x.status === 'preenchida');
    const vistasLimpa = new Set(
      preenchidas.filter((x) => !x.itens.some((i) => i.resposta === 'nao_conforme')).map((x) => x.itCode ?? x.titulo),
    );
    for (const f of preenchidas) {
      const temNc = f.itens.some((i) => i.resposta === 'nao_conforme');
      const chave = f.itCode ?? f.titulo;
      const reinspecionadaLimpa = vistasLimpa.has(chave) &&
        preenchidas.some((x) => (x.itCode ?? x.titulo) === chave && x.preenchidoEm && f.preenchidoEm && x.preenchidoEm > f.preenchidoEm && !x.itens.some((i) => i.resposta === 'nao_conforme'));
      if (temNc && !reinspecionadaLimpa) {
        motivos.push(`Não conformidade aberta na FVS "${f.titulo}"${f.trecho ? ` (${f.trecho})` : ''} — reinspecionar`);
      }
    }

    const override = overrides.find((o) => o.planoId === p.id) ?? null;
    let status: StatusLiberacao;
    if (override) {
      status = override.liberado ? 'liberado_excecao' : 'bloqueado_manual';
    } else {
      status = motivos.length > 0 ? 'bloqueado' : 'liberado';
    }

    return {
      planoId: p.id,
      pacote: p.pacote,
      fornecedor: p.empresaContratada,
      responsavel: p.responsavel,
      status,
      motivos,
      fichas: fichasDoPlano.map((f) => ({ id: f.id, titulo: f.titulo, trecho: f.trecho, status: f.status, prazo: f.prazo })),
      override: override && {
        liberado: override.liberado,
        justificativa: override.justificativa,
        por: override.criadoPor?.name ?? null,
        em: override.createdAt,
      },
    };
  });

  // fichas da obra ainda sem vínculo com fornecedor — a UI oferece o vínculo
  const semVinculo = fichas
    .filter((f) => !f.contratacaoId)
    .map((f) => ({ id: f.id, titulo: f.titulo, trecho: f.trecho, status: f.status }));

  return { obra: { id: obra.id, nome: obra.name }, linhas, fichasSemVinculo: semVinculo };
}

export async function criarOverride(
  obraId: string,
  planoId: string,
  input: { liberado: boolean; justificativa: string },
  user: { userId: string; role: string },
) {
  if (!['diretoria', 'socio', 'coordenacao'].includes(user.role)) {
    throw AppError.forbidden('Liberação excepcional é restrita à diretoria/coordenação');
  }
  const plano = await prisma.obraContratacaoPlano.findFirst({ where: { id: planoId, obraId } });
  if (!plano) throw AppError.notFound('Pacote de contratação');
  if (!input.justificativa?.trim()) throw AppError.badRequest('Justificativa é obrigatória');
  return prisma.liberacaoMedicaoOverride.create({
    data: { obraId, planoId, liberado: input.liberado, justificativa: input.justificativa.trim(), criadoPorId: user.userId },
    include: { criadoPor: { select: { id: true, name: true } } },
  });
}

export async function removerOverride(obraId: string, planoId: string, user: { role: string }) {
  if (!['diretoria', 'socio', 'coordenacao'].includes(user.role)) {
    throw AppError.forbidden('Restrito à diretoria/coordenação');
  }
  await prisma.liberacaoMedicaoOverride.deleteMany({ where: { obraId, planoId } });
}

export async function vincularFicha(obraId: string, fvsId: string, planoId: string | null) {
  const ficha = await prisma.atividadeFvs.findFirst({ where: { id: fvsId, obraId } });
  if (!ficha) throw AppError.notFound('Ficha');
  if (planoId) {
    const plano = await prisma.obraContratacaoPlano.findFirst({ where: { id: planoId, obraId } });
    if (!plano) throw AppError.notFound('Pacote de contratação');
  }
  return prisma.atividadeFvs.update({ where: { id: fvsId }, data: { contratacaoId: planoId } });
}
