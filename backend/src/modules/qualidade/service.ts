import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import { QUALIDADE_CHECKLIST, classificarNota, NOTA_ALERTA_CRITICO } from './template';
import type { CreateVistoriaInput } from './types';

// ─── Cálculo do score (regras do Checklist MODELO.xlsx) ─────────────────────
// - Conformidade da categoria = Sim / (Sim + Não). N/A fica FORA do denominador.
// - Nota da categoria = 5 × conformidade.
// - Categoria sem itens válidos (tudo N/A ou em branco) fica fora da conta e os
//   pesos das demais são renormalizados — senão a nota cairia injustamente.
// - Nota final = Σ(nota × peso) / Σ(pesos válidos), 2 casas decimais.

export interface ResumoCategoria {
  key: string;
  nome: string;
  peso: number;
  sim: number;
  nao: number;
  na: number;
  /** 0–1; null quando a categoria não tem itens válidos */
  conformidade: number | null;
  /** 0–5; null quando a categoria não tem itens válidos */
  nota: number | null;
}

export function calcularScore(respostas: { categoriaKey: string; resposta: 'sim' | 'nao' | 'na' }[]) {
  const resumo: ResumoCategoria[] = QUALIDADE_CHECKLIST.map((cat) => {
    const rs = respostas.filter((r) => r.categoriaKey === cat.key);
    const sim = rs.filter((r) => r.resposta === 'sim').length;
    const nao = rs.filter((r) => r.resposta === 'nao').length;
    const na = rs.filter((r) => r.resposta === 'na').length;
    const validos = sim + nao;
    const conformidade = validos > 0 ? sim / validos : null;
    return {
      key: cat.key,
      nome: cat.nome,
      peso: cat.peso,
      sim,
      nao,
      na,
      conformidade,
      nota: conformidade !== null ? Math.round(conformidade * 5 * 100) / 100 : null,
    };
  });

  const comNota = resumo.filter((c) => c.nota !== null);
  const somaPesos = comNota.reduce((acc, c) => acc + c.peso, 0);
  const notaFinal = somaPesos > 0
    ? Math.round((comNota.reduce((acc, c) => acc + (c.nota as number) * c.peso, 0) / somaPesos) * 100) / 100
    : 0;

  return { resumo, notaFinal, classificacao: classificarNota(notaFinal) };
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

const itemTexto = new Map(
  QUALIDADE_CHECKLIST.flatMap((c) => c.itens.map((i) => [`${c.key}:${i.key}`, i.texto] as const)),
);

export async function createVistoria(obraId: string, input: CreateVistoriaInput, vistoriadorId: string) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true, name: true } });
  if (!obra) throw AppError.notFound('Obra');

  // Só respostas de itens que existem no template
  const respostas = input.respostas.filter((r) => itemTexto.has(`${r.categoriaKey}:${r.itemKey}`));
  if (respostas.length === 0) throw AppError.badRequest('Nenhum item respondido');

  // ─── Aderência ao Projeto (Bruno 10/09/26) ───
  // Cada atividade em execução pode trazer a conferência contra o projeto
  // técnico: revisão vigente em uso + execução conforme. Itens dinâmicos na
  // categoria 'aderencia_projeto' — entram na nota e, se "não", viram pendência.
  const aderencia: { categoriaKey: string; itemKey: string; resposta: 'sim' | 'nao' | 'na'; observacao: string | null; texto: string }[] = [];
  (input.atividades ?? []).forEach((a, i) => {
    const rot = `«${a.titulo}»${a.projetoDisciplina ? ` (projeto: ${a.projetoDisciplina})` : ''}`;
    const obs = (a.projetoObs ?? '').trim() || null;
    if (a.revisaoOk) {
      aderencia.push({ categoriaKey: 'aderencia_projeto', itemKey: `AP.${i + 1}.rev`, resposta: a.revisaoOk, observacao: obs, texto: `${rot} — canteiro executando com a última revisão vigente do projeto?` });
    }
    if (a.conformeProjeto) {
      aderencia.push({ categoriaKey: 'aderencia_projeto', itemKey: `AP.${i + 1}.exec`, resposta: a.conformeProjeto, observacao: obs, texto: `${rot} — execução conforme o que o projeto especifica?` });
    }
  });

  // Critério (03/09, Bruno): "Não" e "N/A" exigem justificativa escrita —
  // ninguém reprova ou pula item sem dizer por quê.
  const semJustificativa = [...respostas, ...aderencia].filter(
    (r) => (r.resposta === 'nao' || r.resposta === 'na') && !(r.observacao ?? '').trim(),
  );
  if (semJustificativa.length > 0) {
    throw AppError.badRequest(
      `${semJustificativa.length} item(ns) "Não"/"N/A" sem justificativa — descreva o motivo em cada um`,
    );
  }

  // ─── Enforcement FVS (item 5.2 automático) ───
  // Atividade marcada em execução com ficha pendente ABERTA ANTES de hoje →
  // "checklists de execução preenchidos" (5.2) vira Não, sem opinião.
  const { fvsPendentesAnteriores } = await import('./fvs');
  const atividades = input.atividades ?? [];
  const codesMarcados = new Set(atividades.map((a) => a.itCode).filter(Boolean));
  const fvsPendentes = (await fvsPendentesAnteriores(obraId)).filter(
    (f) => f.itCode && codesMarcados.has(f.itCode),
  );
  if (fvsPendentes.length > 0) {
    const obsAuto = `FVS pendente: ${fvsPendentes.map((f) => `${f.itCode} ${f.titulo}`).join('; ')} (automático)`;
    const idx = respostas.findIndex((r) => r.categoriaKey === 'execucao' && r.itemKey === '5.2');
    if (idx >= 0) {
      respostas[idx] = { ...respostas[idx], resposta: 'nao', observacao: obsAuto };
    } else {
      respostas.push({ categoriaKey: 'execucao', itemKey: '5.2', resposta: 'nao', observacao: obsAuto });
    }
  }

  const { resumo, notaFinal, classificacao } = calcularScore([...respostas, ...aderencia]);

  const vistoria = await prisma.qualidadeVistoria.create({
    data: {
      obraId,
      vistoriadorId,
      // Meio-dia UTC pra data não escorregar de dia em BRT
      ...(input.data && { data: new Date(`${input.data}T12:00:00Z`) }),
      notaFinal,
      classificacao: classificacao.key,
      resumo: resumo as object[],
      atividades: (input.atividades ?? []) as object[],
      observacoes: input.observacoes ?? null,
      cienciaNome: input.cienciaNome?.trim() || null,
      itens: {
        create: [
          ...respostas.map((r) => ({
            categoriaKey: r.categoriaKey,
            itemKey: r.itemKey,
            texto: itemTexto.get(`${r.categoriaKey}:${r.itemKey}`)!,
            resposta: r.resposta,
            observacao: r.observacao ?? null,
            fotoUrl: r.fotoUrl ?? null,
          })),
          ...aderencia.map((r) => ({
            categoriaKey: r.categoriaKey,
            itemKey: r.itemKey,
            texto: r.texto,
            resposta: r.resposta,
            observacao: r.observacao,
          })),
        ],
      },
    },
    include: { vistoriador: { select: { id: true, name: true } }, itens: true },
  });

  // Abre FVS pras atividades em execução que ainda não têm ficha pendente
  // (depois do cálculo — ficha recém-criada não penaliza esta vistoria)
  try {
    const { garantirFvsParaAtividades } = await import('./fvs');
    await garantirFvsParaAtividades(obraId, atividades, vistoria.id);
  } catch (err) {
    console.error('[Qualidade] criação automática de FVS falhou:', (err as Error).message);
  }

  // Alerta imediato pra nota crítica — fire-and-forget, nunca trava o submit
  if (notaFinal < NOTA_ALERTA_CRITICO) {
    void import('./alerts')
      .then((a) => a.alertaVistoriaCritica(vistoria, obra.name))
      .catch((err) => console.error('[Qualidade] alerta crítico falhou:', (err as Error).message));
  }

  return vistoria;
}

export async function getPainel(obraId: string) {
  const vistorias = await prisma.qualidadeVistoria.findMany({
    where: { obraId },
    orderBy: { data: 'desc' },
    include: { vistoriador: { select: { id: true, name: true } } },
  });

  const pendencias = await prisma.qualidadeVistoriaItem.findMany({
    where: { vistoria: { obraId }, resposta: 'nao', resolvido: false },
    orderBy: { vistoria: { data: 'desc' } },
    include: {
      vistoria: { select: { id: true, data: true } },
      responsavel: { select: { id: true, name: true } },
    },
  });

  const { listFvs } = await import('./fvs');
  const fichas = await listFvs(obraId);

  return { vistorias, pendencias, fichas };
}

export async function getVistoria(vistoriaId: string) {
  const v = await prisma.qualidadeVistoria.findUnique({
    where: { id: vistoriaId },
    include: {
      vistoriador: { select: { id: true, name: true } },
      itens: { include: { resolvidoPor: { select: { id: true, name: true } } } },
    },
  });
  if (!v) throw AppError.notFound('Vistoria');
  return v;
}

/** Pendência com dono e prazo (10/09): atribui responsável e data-limite;
 *  avisa o responsável por e-mail (fire-and-forget). */
export async function atribuirPendencia(
  itemId: string,
  input: { responsavelId?: string | null; prazo?: string | null },
) {
  const item = await prisma.qualidadeVistoriaItem.findUnique({
    where: { id: itemId },
    include: { vistoria: { select: { obraId: true, obra: { select: { name: true } } } } },
  });
  if (!item) throw AppError.notFound('Item');
  if (item.resposta !== 'nao') throw AppError.badRequest('Só itens "Não" são pendências');
  const atualizado = await prisma.qualidadeVistoriaItem.update({
    where: { id: itemId },
    data: {
      ...(input.responsavelId !== undefined && { responsavelId: input.responsavelId }),
      ...(input.prazo !== undefined && { prazo: input.prazo ? new Date(`${input.prazo}T12:00:00Z`) : null }),
    },
    include: { responsavel: { select: { id: true, name: true, email: true } } },
  });
  if (input.responsavelId && atualizado.responsavel?.email) {
    void import('../../services/email-obras').then(({ sendEmailObra }) => sendEmailObra({
      to: [atualizado.responsavel!.email],
      subject: `✅ Pendência de qualidade sob sua responsabilidade — ${item.vistoria.obra.name} · BÈR`,
      html: `<div style="font-family:Montserrat,Arial,sans-serif;max-width:640px;margin:0 auto"><p><b>${item.texto}</b></p><p>${item.observacao ?? ''}</p><p>Obra: <b>${item.vistoria.obra.name}</b>${atualizado.prazo ? ` · prazo <b>${atualizado.prazo.toISOString().slice(0, 10).split('-').reverse().join('/')}</b>` : ''}</p><p style="color:#8B8D82;font-size:12px">Resolva no BER App → Obra → Qualidade → Pendências.</p></div>`,
    })).catch((err) => console.error('[Qualidade] e-mail de atribuição falhou:', (err as Error).message));
  }
  return atualizado;
}

/** Ranking de qualidade entre obras ativas (10/09): última nota + tendência. */
export async function rankingObras() {
  const obras = await prisma.obra.findMany({
    where: { status: { in: ['em_andamento', 'planejamento'] } },
    select: { id: true, name: true, status: true },
    orderBy: { name: 'asc' },
  });
  const linhas = [] as { obraId: string; nome: string; nota: number | null; classificacao: string | null; data: Date | null; tendencia: 'subiu' | 'caiu' | 'estavel' | null; pendencias: number }[];
  for (const o of obras) {
    const ultimas = await prisma.qualidadeVistoria.findMany({
      where: { obraId: o.id },
      orderBy: { data: 'desc' },
      take: 2,
      select: { notaFinal: true, classificacao: true, data: true },
    });
    const pend = await prisma.qualidadeVistoriaItem.count({
      where: { vistoria: { obraId: o.id }, resposta: 'nao', resolvido: false },
    });
    const atual = ultimas[0] ?? null;
    const anterior = ultimas[1] ?? null;
    let tendencia: 'subiu' | 'caiu' | 'estavel' | null = null;
    if (atual && anterior) {
      const d = Number(atual.notaFinal) - Number(anterior.notaFinal);
      tendencia = d > 0.05 ? 'subiu' : d < -0.05 ? 'caiu' : 'estavel';
    }
    linhas.push({
      obraId: o.id, nome: o.name,
      nota: atual ? Number(atual.notaFinal) : null,
      classificacao: atual?.classificacao ?? null,
      data: atual?.data ?? null,
      tendencia,
      pendencias: pend,
    });
  }
  return linhas.sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1));
}

export async function resolverPendencia(itemId: string, userId: string, resolvido: boolean) {
  const item = await prisma.qualidadeVistoriaItem.findUnique({ where: { id: itemId } });
  if (!item) throw AppError.notFound('Item');
  if (item.resposta !== 'nao') throw AppError.badRequest('Só itens "Não" são pendências');
  return prisma.qualidadeVistoriaItem.update({
    where: { id: itemId },
    data: resolvido
      ? { resolvido: true, resolvidoEm: new Date(), resolvidoPorId: userId }
      : { resolvido: false, resolvidoEm: null, resolvidoPorId: null },
  });
}

/** Catálogo de atividades = ITs publicadas (exposto via módulo qualidade
 *  pra não depender do perm('instrucoes'), que o campo pode não ter). */
export async function listAtividadesCatalogo() {
  return prisma.instrucaoTecnica.findMany({
    where: { status: 'publicada' },
    select: { code: true, title: true, discipline: true },
    orderBy: { code: 'asc' },
  });
}

/** Upload em segundo plano: guarda no R2 antes da vistoria existir e devolve a
 *  URL — o submit referencia via resposta.fotoUrl (Onda 1 UX, 10/09). */
export async function uploadFotoTemp(file: { buffer: Buffer; originalname: string; mimetype: string }) {
  const { uploadToR2, isR2Configured } = await import('../../services/storage');
  if (!isR2Configured()) throw AppError.badRequest('Storage de arquivos não configurado no servidor');
  const url = await uploadToR2(
    file.buffer,
    `qualidade/temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname}`,
    file.mimetype,
  );
  return { url };
}

export async function uploadFotoItem(
  itemId: string,
  file: { buffer: Buffer; originalname: string; mimetype: string },
) {
  const item = await prisma.qualidadeVistoriaItem.findUnique({ where: { id: itemId } });
  if (!item) throw AppError.notFound('Item');
  const { uploadToR2, isR2Configured } = await import('../../services/storage');
  if (!isR2Configured()) throw AppError.badRequest('Storage de arquivos não configurado no servidor');
  const url = await uploadToR2(
    file.buffer,
    `qualidade/${item.vistoriaId}-${item.categoriaKey}-${item.itemKey}-${Date.now()}-${file.originalname}`,
    file.mimetype,
  );
  return prisma.qualidadeVistoriaItem.update({ where: { id: itemId }, data: { fotoUrl: url } });
}

export async function removeVistoria(vistoriaId: string) {
  const existing = await prisma.qualidadeVistoria.findUnique({ where: { id: vistoriaId } });
  if (!existing) throw AppError.notFound('Vistoria');
  await prisma.qualidadeVistoria.delete({ where: { id: vistoriaId } });
}
