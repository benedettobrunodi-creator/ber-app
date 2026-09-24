/**
 * Painel de gestão de Compras — indicadores de PROCESSO pra CFO/CEO
 * (Bruno 24/09/26). Complementa o /summary (que já traz meta × comprado ×
 * saving por obra): aqui entram contratações atrasadas, fila da Medição de
 * Fornecedores, ritmo de autorização, lead time e concentração de
 * fornecedores. Tudo calculado de dados existentes — nada é digitado novo.
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';

const OBRA_ATIVA = ['nao_iniciada', 'planejamento', 'em_andamento', 'pos_obra', 'pausada'];

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

    res.json({
      data: {
        contratacoes: { contratados, emCotacao, aContratar, atrasados,
          atrasadosPorObra: Array.from(atrasadosPorObra.entries())
            .map(([obraId, qtd]) => ({ obraId, obraNome: nomeObra.get(obraId) ?? '—', qtd }))
            .sort((a, b) => b.qtd - a.qtd) },
        medicao: { filaValor, filaQtd, autorizadoMes, autorizadoMesQtd, leadTimeMedioDias },
        fornecedores: { top: topFornecedores, total: fornecedores.length, semEmail },
      },
    });
  } catch (err) { next(err); }
}
