/**
 * Painel de gestão de Compras — indicadores de PROCESSO pra CFO/CEO
 * (Bruno 24/09/26). Complementa o /summary (que já traz meta × comprado ×
 * saving por obra): aqui entram contratações atrasadas, fila da Medição de
 * Fornecedores, ritmo de autorização, lead time e concentração de
 * fornecedores. Tudo calculado de dados existentes — nada é digitado novo.
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { montarItensPorObra } from './controller';
import { pctComissaoDe, financeiroDoItem, isElegivelComissao } from './calc';

const OBRA_ATIVA = ['nao_iniciada', 'planejamento', 'em_andamento', 'pos_obra', 'pausada'];

/** Disciplina = prefixo da categoria antes do "|" (padrão do orçamento BÈR:
 *  "Ar Condicionado | Equipamento Split…"). Sem "|", a categoria inteira. */
function disciplinaDe(categoria: string): string {
  const i = categoria.indexOf('|');
  return (i > 0 ? categoria.slice(0, i) : categoria).trim();
}

export async function getGestao(_req: Request, res: Response, next: NextFunction) {
  try {
    const obrasAtivas = await prisma.obra.findMany({
      where: { status: { in: OBRA_ATIVA } },
      select: { id: true, name: true },
    });
    const obraIds = obrasAtivas.map(o => o.id);
    const nomeObra = new Map(obrasAtivas.map(o => [o.id, o.name]));

    const [planos, liberacoes, fornecedores, metasComForn] = await Promise.all([
      prisma.obraContratacaoPlano.findMany({
        where: { obraId: { in: obraIds } },
        select: { obraId: true, status: true, dataLimite: true, contratacaoId: true },
      }),
      prisma.liberacaoFornecedor.findMany({
        select: {
          status: true, valorAutorizado: true, createdAt: true,
          emailEnviadoEm: true, obraId: true,
        },
      }),
      prisma.fornecedorCadastro.findMany({ select: { id: true, nome: true, email: true } }),
      prisma.comprasMeta.findMany({
        where: { obraId: { in: obraIds }, comprado: { gt: 0 } },
        select: { fornecedorId: true, fornecedor: true, comprado: true },
      }),
    ]);

    // ── Contratações (mesma regra de "atrasado" do módulo contratacao-plano)
    const agora = Date.now();
    let contratados = 0, emCotacao = 0, aContratar = 0, atrasados = 0;
    const atrasadosPorObra = new Map<string, number>();
    for (const p of planos) {
      const efetivo = p.contratacaoId
        ? 'contratado'
        : (p.dataLimite && p.dataLimite.getTime() < agora && p.status !== 'contratado')
          ? 'atrasado'
          : p.status;
      if (efetivo === 'contratado') contratados++;
      else if (efetivo === 'em_cotacao') emCotacao++;
      else if (efetivo === 'atrasado') {
        atrasados++;
        atrasadosPorObra.set(p.obraId, (atrasadosPorObra.get(p.obraId) ?? 0) + 1);
      } else aContratar++;
    }

    // ── Medição de Fornecedores
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    let filaValor = 0, filaQtd = 0, autorizadoMes = 0, autorizadoMesQtd = 0;
    const leadTimesDias: number[] = [];
    for (const l of liberacoes) {
      const v = Number(l.valorAutorizado);
      if (l.status === 'solicitada' || l.status === 'aprovada_financeiro') {
        filaValor += v; filaQtd++;
      }
      if (l.status === 'autorizada' && l.emailEnviadoEm) {
        if (l.emailEnviadoEm >= inicioMes) { autorizadoMes += v; autorizadoMesQtd++; }
        leadTimesDias.push((l.emailEnviadoEm.getTime() - l.createdAt.getTime()) / 86400000);
      }
    }
    const leadTimeMedioDias = leadTimesDias.length
      ? leadTimesDias.reduce((a, b) => a + b, 0) / leadTimesDias.length
      : null;

    // ── Concentração de fornecedores (top 10 por R$ comprado, obras ativas)
    const nomeFornecedor = new Map(fornecedores.map(f => [f.id, f.nome]));
    const porFornecedor = new Map<string, number>();
    for (const m of metasComForn) {
      const chave = m.fornecedorId
        ? (nomeFornecedor.get(m.fornecedorId) ?? m.fornecedor ?? '—')
        : (m.fornecedor?.trim() || '—');
      porFornecedor.set(chave, (porFornecedor.get(chave) ?? 0) + m.comprado);
    }
    const totalComprado = Array.from(porFornecedor.values()).reduce((a, b) => a + b, 0);
    const topFornecedores = Array.from(porFornecedor.entries())
      .filter(([nome]) => nome !== '—' && !/^b[eè]r/i.test(nome)) // exclui equipe própria
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([nome, valor]) => ({ nome, valor, pct: totalComprado > 0 ? valor / totalComprado : 0 }));

    const semEmail = fornecedores.filter(f => !f.email).length;

    // ── ANÁLISE por item/disciplina (25/09/26, Bruno) — MESMAS regras da tela
    // de Metas (montarItensPorObra + helpers do calc: splits, CO, comissão).
    const { itemsByObra, comissaoByObra } = await montarItensPorObra(obraIds);

    type Estouro = { obraId: string; obraNome: string; categoria: string; descritivo: string | null;
      meta: number; venda: number; comprado: number; estouro: number; acimaVenda: boolean };
    const estouros: Estouro[] = [];
    const porDisciplina = new Map<string, { venda: number; meta: number; comprado: number; itens: number }>();

    for (const [obraId, itens] of itemsByObra.entries()) {
      const pctComissao = pctComissaoDe(itens, comissaoByObra.get(obraId) ?? 0);
      for (const it of itens) {
        if (it.tipo === 'etapa') continue;
        const { base, meta } = financeiroDoItem(it, pctComissao);
        // Estouros: comprado acima da meta do item (pior ainda: acima da venda)
        if (it.comprado > 0 && it.comprado > meta + 0.01) {
          estouros.push({
            obraId, obraNome: nomeObra.get(obraId) ?? '—',
            categoria: it.categoria, descritivo: it.descritivo,
            meta, venda: base, comprado: it.comprado,
            estouro: it.comprado - meta, acimaVenda: it.comprado > base + 0.01,
          });
        }
        // Disciplinas: só itens já comprados (saving REALIZADO), excluindo taxa/imposto
        if (it.comprado > 0 && isElegivelComissao(it)) {
          const d = disciplinaDe(it.categoria);
          const cur = porDisciplina.get(d) ?? { venda: 0, meta: 0, comprado: 0, itens: 0 };
          cur.venda += base; cur.meta += meta; cur.comprado += it.comprado; cur.itens += 1;
          porDisciplina.set(d, cur);
        }
      }
    }

    estouros.sort((a, b) => b.estouro - a.estouro);
    const disciplinas = Array.from(porDisciplina.entries())
      .filter(([, v]) => v.itens >= 2 && v.meta > 1000) // amostra mínima pra não ranquear ruído
      .map(([nome, v]) => ({
        nome, venda: v.venda, meta: v.meta, comprado: v.comprado, itens: v.itens,
        saving: v.meta - v.comprado,
        savingPct: v.meta > 0 ? ((v.meta - v.comprado) / v.meta) * 100 : 0,
        savingVenda: v.venda - v.comprado,
        savingVendaPct: v.venda > 0 ? ((v.venda - v.comprado) / v.venda) * 100 : 0,
      }))
      .sort((a, b) => b.savingPct - a.savingPct);

    // Aging da fila: dias do pedido mais antigo ainda parado
    let agingDias: number | null = null;
    for (const l of liberacoes) {
      if (l.status === 'solicitada' || l.status === 'aprovada_financeiro') {
        const dias = (Date.now() - l.createdAt.getTime()) / 86400000;
        if (agingDias === null || dias > agingDias) agingDias = dias;
      }
    }

    // % do comprado sem fornecedor do cadastro
    const compradoSemCadastro = metasComForn.filter(m => !m.fornecedorId).reduce((s, m) => s + m.comprado, 0);
    const pctForaCadastro = totalComprado > 0 ? compradoSemCadastro / totalComprado : 0;

    res.json({
      data: {
        contratacoes: { contratados, emCotacao, aContratar, atrasados,
          atrasadosPorObra: Array.from(atrasadosPorObra.entries())
            .map(([obraId, qtd]) => ({ obraId, obraNome: nomeObra.get(obraId) ?? '—', qtd }))
            .sort((a, b) => b.qtd - a.qtd) },
        medicao: { filaValor, filaQtd, autorizadoMes, autorizadoMesQtd, leadTimeMedioDias, agingDias },
        fornecedores: { top: topFornecedores, total: fornecedores.length, semEmail, pctForaCadastro },
        analise: {
          estouros: estouros.slice(0, 10),
          totalEstouros: estouros.length,
          valorTotalEstouros: estouros.reduce((s, e) => s + e.estouro, 0),
          disciplinas,
        },
      },
    });
  } catch (err) { next(err); }
}
