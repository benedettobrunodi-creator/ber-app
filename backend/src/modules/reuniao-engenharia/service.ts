/**
 * Reunião de Engenharia semanal (14/09/26) — menu Atas do painel geral.
 *
 * Modelo: a reunião agrupa as obras EM ANDAMENTO e aponta pra ATA VIVA de
 * cada uma (ObraAtaTopico — a mesma de obras/[id]/atas; editar aqui = editar
 * lá). Histórico: no encerramento grava-se um snapshot imutável do estado de
 * todos os tópicos ("fotografia"); reunião encerrada exibe o snapshot.
 * Na reunião aberta, cada tópico ganha um selo de diff vs o snapshot da
 * última reunião encerrada: novo | alterado | concluido.
 */
import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';

const topicoSelect = {
  id: true,
  ordem: true,
  status: true,
  impacto: true,
  changeOrder: true,
  disciplina: true,
  tema: true,
  observacoes: true,
  responsavelStakeholderId: true,
  acao: true,
  confirmado: true,
  dataInfo: true,
  dataAlvo: true,
  dataFinal: true,
  updatedAt: true,
  responsavelStakeholder: { select: { id: true, nome: true, empresa: true, funcao: true } },
  atualizacoes: { orderBy: { data: 'desc' as const }, select: { id: true, data: true, texto: true } },
};

type SnapshotObra = {
  obraId: string;
  obraNome: string;
  coordenadorId: string | null;
  coordenadorNome: string | null;
  engenheiroId?: string | null;
  engenheiroNome?: string | null;
  participantes?: { id: string; name: string }[];
  topicos: unknown[];
};

async function resolverParticipantesPorObra(participantesPorObra: unknown): Promise<Map<string, { id: string; name: string; email: string | null }[]>> {
  const mapa = (participantesPorObra ?? {}) as Record<string, string[]>;
  const todos = Array.from(new Set(Object.values(mapa).flat()));
  const users = todos.length
    ? await prisma.user.findMany({ where: { id: { in: todos } }, select: { id: true, name: true, email: true } })
    : [];
  const porId = new Map(users.map((u) => [u.id, u]));
  const out = new Map<string, { id: string; name: string; email: string | null }[]>();
  for (const [obraId, ids] of Object.entries(mapa)) {
    out.set(obraId, (ids ?? []).map((id) => porId.get(id)).filter((u): u is NonNullable<typeof u> => Boolean(u)));
  }
  return out;
}

async function coletarEstadoObras(obrasIds: string[], participantesPorObra?: unknown): Promise<SnapshotObra[]> {
  const obras = await prisma.obra.findMany({
    where: { id: { in: obrasIds } },
    select: {
      id: true, name: true, coordinatorId: true,
      coordinator: { select: { id: true, name: true } },
      residentEngineer: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
  });
  const topicos = await prisma.obraAtaTopico.findMany({
    where: { obraId: { in: obrasIds } },
    orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
    select: { ...topicoSelect, obraId: true },
  });
  const parts = await resolverParticipantesPorObra(participantesPorObra);
  return obras.map((o) => ({
    obraId: o.id,
    obraNome: o.name,
    coordenadorId: o.coordinatorId,
    coordenadorNome: o.coordinator?.name ?? null,
    engenheiroId: o.residentEngineer?.id ?? null,
    engenheiroNome: o.residentEngineer?.name ?? null,
    participantes: (parts.get(o.id) ?? []).map((u) => ({ id: u.id, name: u.name })),
    topicos: topicos.filter((t) => t.obraId === o.id),
  }));
}

export async function listar() {
  const reunioes = await prisma.reuniaoEngenharia.findMany({
    orderBy: { data: 'desc' },
    select: {
      id: true, data: true, status: true, participantesIds: true, obrasIds: true,
      encerradaEm: true, enviadaEm: true, createdAt: true,
    },
  });
  const idsUsers = Array.from(new Set(reunioes.flatMap((r) => r.participantesIds)));
  const users = idsUsers.length
    ? await prisma.user.findMany({ where: { id: { in: idsUsers } }, select: { id: true, name: true } })
    : [];
  const nome = new Map(users.map((u) => [u.id, u.name]));
  return reunioes.map((r) => ({
    ...r,
    participantes: r.participantesIds.map((id) => ({ id, name: nome.get(id) ?? '?' })),
    totalObras: r.obrasIds.length,
  }));
}

export async function criar(userId: string | null) {
  // encerra (com fotografia) qualquer reunião ainda aberta — o histórico nunca fica órfão
  const abertas = await prisma.reuniaoEngenharia.findMany({ where: { status: 'aberta' }, select: { id: true } });
  for (const a of abertas) await encerrar(a.id).catch(() => {});

  // em andamento + pós-obra (Bruno 14/09: pós-obra também se discute na reunião)
  const obras = await prisma.obra.findMany({
    where: { status: { in: ['em_andamento', 'pos_obra'] } },
    select: { id: true },
    orderBy: { name: 'asc' },
  });
  if (obras.length === 0) throw AppError.badRequest('Nenhuma obra em andamento/pós-obra pra montar a reunião');

  // participantes default: os da reunião anterior (o time semanal muda pouco)
  const anterior = await prisma.reuniaoEngenharia.findFirst({ orderBy: { data: 'desc' }, select: { participantesIds: true, participantesPorObra: true } });

  return prisma.reuniaoEngenharia.create({
    data: {
      criadaPor: userId,
      obrasIds: obras.map((o) => o.id),
      participantesIds: anterior?.participantesIds ?? [],
      participantesPorObra: anterior?.participantesPorObra ?? {},
    },
  });
}

export async function detalhe(id: string) {
  const reuniao = await prisma.reuniaoEngenharia.findUnique({ where: { id } });
  if (!reuniao) throw AppError.notFound('Reunião');

  const participantes = reuniao.participantesIds.length
    ? await prisma.user.findMany({
        where: { id: { in: reuniao.participantesIds } },
        select: { id: true, name: true, email: true },
      })
    : [];

  if (reuniao.status === 'encerrada') {
    return { reuniao, participantes, obras: (reuniao.snapshot ?? []) as SnapshotObra[], diffBase: null };
  }

  const obras = await coletarEstadoObras(reuniao.obrasIds, reuniao.participantesPorObra);

  // diff vs o snapshot da última reunião ENCERRADA anterior a esta
  const base = await prisma.reuniaoEngenharia.findFirst({
    where: { status: 'encerrada', data: { lt: reuniao.data } },
    orderBy: { data: 'desc' },
    select: { id: true, data: true, encerradaEm: true, snapshot: true },
  });
  let diff: Record<string, 'novo' | 'alterado' | 'concluido'> = {};
  if (base?.snapshot) {
    const antigos = new Map<string, { status: string; updatedAt: string }>();
    for (const o of base.snapshot as SnapshotObra[]) {
      for (const t of o.topicos as { id: string; status: string; updatedAt: string }[]) {
        antigos.set(t.id, { status: t.status, updatedAt: String(t.updatedAt) });
      }
    }
    for (const o of obras) {
      for (const t of o.topicos as { id: string; status: string; updatedAt: Date }[]) {
        const antigo = antigos.get(t.id);
        if (!antigo) diff[t.id] = 'novo';
        else if (t.status === 'concluido' && antigo.status !== 'concluido') diff[t.id] = 'concluido';
        else if (new Date(t.updatedAt).getTime() > new Date(antigo.updatedAt).getTime()) diff[t.id] = 'alterado';
      }
    }
  } else {
    // sem base: nada é marcado (primeira reunião não pinta tudo de "novo")
    diff = {};
  }

  return {
    reuniao,
    participantes,
    obras,
    diff,
    diffBase: base ? { id: base.id, data: base.data } : null,
  };
}

export async function atualizarParticipantesObra(id: string, obraId: string, userIds: string[]) {
  const reuniao = await prisma.reuniaoEngenharia.findUnique({ where: { id }, select: { status: true, participantesPorObra: true, obrasIds: true } });
  if (!reuniao) throw AppError.notFound('Reunião');
  if (reuniao.status !== 'aberta') throw AppError.badRequest('Reunião encerrada não muda mais');
  if (!reuniao.obrasIds.includes(obraId)) throw AppError.badRequest('Obra não faz parte desta reunião');
  const mapa = ((reuniao.participantesPorObra ?? {}) as Record<string, string[]>);
  mapa[obraId] = userIds;
  return prisma.reuniaoEngenharia.update({ where: { id }, data: { participantesPorObra: mapa as never } });
}

export async function atualizarParticipantes(id: string, participantesIds: string[]) {
  const reuniao = await prisma.reuniaoEngenharia.findUnique({ where: { id }, select: { status: true } });
  if (!reuniao) throw AppError.notFound('Reunião');
  if (reuniao.status !== 'aberta') throw AppError.badRequest('Reunião encerrada não muda mais');
  return prisma.reuniaoEngenharia.update({ where: { id }, data: { participantesIds } });
}

export async function encerrar(id: string) {
  const reuniao = await prisma.reuniaoEngenharia.findUnique({ where: { id } });
  if (!reuniao) throw AppError.notFound('Reunião');
  if (reuniao.status === 'encerrada') return reuniao; // idempotente
  const snapshot = await coletarEstadoObras(reuniao.obrasIds, reuniao.participantesPorObra);
  return prisma.reuniaoEngenharia.update({
    where: { id },
    data: { status: 'encerrada', encerradaEm: new Date(), snapshot: snapshot as never },
  });
}

/** Estado das obras pro PDF/e-mail: snapshot se encerrada, vivo se aberta. */
export async function estadoParaPdf(id: string) {
  const reuniao = await prisma.reuniaoEngenharia.findUnique({ where: { id } });
  if (!reuniao) throw AppError.notFound('Reunião');
  const obras = reuniao.status === 'encerrada' && reuniao.snapshot
    ? ((reuniao.snapshot as unknown) as SnapshotObra[])
    : await coletarEstadoObras(reuniao.obrasIds, reuniao.participantesPorObra);
  const participantes = reuniao.participantesIds.length
    ? await prisma.user.findMany({
        where: { id: { in: reuniao.participantesIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  return { reuniao, obras, participantes };
}

export async function marcarEnviada(id: string) {
  return prisma.reuniaoEngenharia.update({ where: { id }, data: { enviadaEm: new Date() } });
}
