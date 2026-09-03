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

  // Critério (03/09, Bruno): "Não" e "N/A" exigem justificativa escrita —
  // ninguém reprova ou pula item sem dizer por quê.
  const semJustificativa = respostas.filter(
    (r) => (r.resposta === 'nao' || r.resposta === 'na') && !(r.observacao ?? '').trim(),
  );
  if (semJustificativa.length > 0) {
    throw AppError.badRequest(
      `${semJustificativa.length} item(ns) "Não"/"N/A" sem justificativa — descreva o motivo em cada um`,
    );
  }

  const { resumo, notaFinal, classificacao } = calcularScore(respostas);

  const vistoria = await prisma.qualidadeVistoria.create({
    data: {
      obraId,
      vistoriadorId,
      // Meio-dia UTC pra data não escorregar de dia em BRT
      ...(input.data && { data: new Date(`${input.data}T12:00:00Z`) }),
      notaFinal,
      classificacao: classificacao.key,
      resumo: resumo as object[],
      observacoes: input.observacoes ?? null,
      itens: {
        create: respostas.map((r) => ({
          categoriaKey: r.categoriaKey,
          itemKey: r.itemKey,
          texto: itemTexto.get(`${r.categoriaKey}:${r.itemKey}`)!,
          resposta: r.resposta,
          observacao: r.observacao ?? null,
        })),
      },
    },
    include: { vistoriador: { select: { id: true, name: true } }, itens: true },
  });

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
    include: { vistoria: { select: { id: true, data: true } } },
  });

  return { vistorias, pendencias };
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
