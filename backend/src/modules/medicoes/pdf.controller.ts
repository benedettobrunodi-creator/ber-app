import { Request, Response } from 'express';
import * as React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import { MedicaoPDF, type PDFEtapa } from './medicao-pdf';

function labelMedicaoShort(n: number): string {
  return n === 1 ? 'Sinal' : `Med. ${String(n).padStart(2, '0')}`;
}

export async function downloadPdf(req: Request, res: Response) {
  const { id } = req.params;

  const medicaoRaw = await prisma.medicao.findUnique({
    where: { id },
    include: {
      obra: {
        include: {
          medicaoEtapas: {
            orderBy: { ordem: 'asc' },
            include: {
              etapaFornecedores: { include: { fornecedor: true } },
            },
          },
          medicoes: {
            where: { status: { in: ['enviada', 'aprovada', 'nf_emitida', 'paga'] } },
            include: { itens: true },
          },
        },
      },
      itens: true,
      pagamentosDiretos: true,
    },
  });
  if (!medicaoRaw) throw AppError.notFound('Medição');
  const medicao = medicaoRaw as any;

  // Medição anterior pra coluna de referência
  const medicaoAnterior = await prisma.medicao.findFirst({
    where: { obraId: medicao.obraId, numero: { lt: medicao.numero } },
    orderBy: { numero: 'desc' },
    include: { itens: true },
  });
  const percAnteriorPorEfId = new Map(
    (medicaoAnterior?.itens ?? []).map((i) => [i.etapaFornecedorId, Number(i.percentualAcumulado)]),
  );
  const labelAnterior = medicaoAnterior ? labelMedicaoShort(medicaoAnterior.numero) : null;

  // Monta as etapas no formato do PDF
  const etapas: PDFEtapa[] = (medicao.obra.medicaoEtapas as any[]).map((etapa: any) => {
    const itensDaEtapa = (medicao.itens as any[]).filter((item: any) =>
      (etapa.etapaFornecedores as any[]).some((ef: any) => ef.id === item.etapaFornecedorId),
    );
    const valorQuinzenaTotal = itensDaEtapa.reduce((acc: number, item: any) => acc + Number(item.valorQuinzena), 0);
    const percentualAcumulado = itensDaEtapa[0] ? Number(itensDaEtapa[0].percentualAcumulado) : 0;
    const percentualAcumuladoAnterior = etapa.etapaFornecedores[0]
      ? (percAnteriorPorEfId.get(etapa.etapaFornecedores[0].id) ?? 0)
      : 0;

    const fornecedores = (etapa.etapaFornecedores as any[]).map((ef: any) => {
      const item = (medicao.itens as any[]).find((i: any) => i.etapaFornecedorId === ef.id);
      return {
        razaoSocial: ef.fornecedor?.razaoSocial ?? 'BÈR Engenharia',
        tipo: ef.tipo,
        valorContratado: Number(ef.valorContratado),
        valorQuinzena: item ? Number(item.valorQuinzena) : 0,
        percentualAcumuladoAnterior: percAnteriorPorEfId.get(ef.id) ?? 0,
      };
    });

    return {
      ordem: etapa.ordem,
      nome: etapa.nome,
      contratoValor: Number(etapa.contratoValor),
      percentualAcumulado,
      percentualAcumuladoAnterior,
      valorQuinzena: valorQuinzenaTotal,
      fornecedores,
    };
  });

  const valorMedicaoAtual = etapas.reduce((acc, e) => acc + e.valorQuinzena, 0);

  // Soma de medições aprovadas + nf_emitida + paga (exclui atual e enviada)
  const valorJaMedido = (medicao.obra.medicoes as any[])
    .filter((m: any) => m.id !== medicao.id && m.status !== 'enviada')
    .reduce((acc: number, m: any) => acc + (m.itens as any[]).reduce((a: number, item: any) => a + Number(item.valorQuinzena), 0), 0);

  const somaPorStatus = (statuses: string[]) =>
    (medicao.obra.medicoes as any[])
      .filter((m: any) => statuses.includes(m.status))
      .reduce((acc: number, m: any) => acc + (m.itens as any[]).reduce((a: number, item: any) => a + Number(item.valorQuinzena), 0), 0);
  const recebido = somaPorStatus(['paga']);
  const aReceber = somaPorStatus(['enviada', 'aprovada', 'nf_emitida']);

  const pagamentosDiretos = (medicao.pagamentosDiretos as any[]).map((p: any) => ({
    razaoSocial: p.fornecedorRazaoSocial,
    valor: Number(p.valor),
  }));

  const pdfBuffer = await renderToBuffer(
    React.createElement(MedicaoPDF, {
      obraNome:          medicao.obra.name,
      clienteNome:       medicao.obra.client ?? medicao.obra.name,
      numero:            medicao.numero,
      labelAnterior,
      periodoInicio:     medicao.periodoInicio,
      periodoFim:        medicao.periodoFim,
      contratoTotal:     Number(medicao.obra.valorContrato ?? 0),
      valorJaMedido,
      valorMedicaoAtual,
      etapas,
      pagamentosDiretos,
      recebido,
      aReceber,
    }) as any,
  );

  const nomeSlug = medicao.obra.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const medicaoSlug = medicao.numero === 1 ? 'sinal' : `medicao-${String(medicao.numero).padStart(2, '0')}`;
  const filename = `${medicaoSlug}-${nomeSlug}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.send(Buffer.from(pdfBuffer));
}
