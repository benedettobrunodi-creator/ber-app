import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import * as React from 'react';

function labelMedicao(numero: number): string {
  return numero === 1 ? 'Sinal' : `Medição ${String(numero).padStart(2, '0')}`;
}

function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",

  });
}

function formatData(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

const tipoLabel: Record<string, string> = {
  terceiro_ber_paga: "BER",
  terceiro_fatura_direto: "Direto",
  miscelaneos_ber: "BER",
};

export interface PDFFornecedor {
  razaoSocial: string;
  tipo: string;
  valorContratado: number;
  valorQuinzena: number;
  percentualAcumuladoAnterior: number;
}

export interface PDFEtapa {
  ordem: number;
  nome: string;
  contratoValor: number;
  percentualAcumulado: number;
  percentualAcumuladoAnterior: number;
  valorQuinzena: number;
  fornecedores: PDFFornecedor[];
}

export interface MedicaoPDFProps {
  obraNome: string;
  clienteNome: string;
  numero: number;
  labelAnterior: string | null;
  periodoInicio: Date;
  periodoFim: Date;
  contratoTotal: number;
  valorJaMedido: number;
  valorMedicaoAtual: number;
  etapas: PDFEtapa[];
  // Pagamentos do cliente direto pro fornecedor entre medições — abatem do Resumo.
  pagamentosDiretos?: { razaoSocial: string; valor: number }[];
  // Pipeline financeiro pra barra colorida (recebido / a receber / não medido)
  recebido?: number;
  aReceber?: number;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#171717",
  },
  // Header
  header: {
    marginBottom: 16,
    borderBottom: "1pt solid #e5e5e5",
    paddingBottom: 12,
  },
  brand: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#111",
    marginBottom: 2,
  },
  brandSub: {
    fontSize: 8,
    color: "#737373",
    letterSpacing: 1,
  },
  medicaoTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginTop: 10,
  },
  medicaoMeta: {
    fontSize: 9,
    color: "#525252",
    marginTop: 2,
  },
  // KPIs
  kpiGrid: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
    marginBottom: 16,
  },
  kpi: {
    flex: 1,
    padding: 8,
    border: "1pt solid #e5e5e5",
    borderRadius: 3,
  },
  kpiLabel: {
    fontSize: 7,
    color: "#737373",
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  kpiValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  kpiSub: {
    fontSize: 7,
    color: "#737373",
    marginTop: 2,
  },
  // Section title
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    marginTop: 4,
  },
  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderBottom: "1pt solid #d4d4d4",
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: "#525252",
  },
  colOrdem: { width: 18 },
  colEtapa: { flex: 3 },
  colContrato: { width: 62, textAlign: "right", paddingRight: 10 },
  colFat: { width: 40, textAlign: "left", paddingLeft: 2 },
  colPercAnt: { width: 38, textAlign: "right", paddingRight: 4 },
  colPerc: { width: 38, textAlign: "right", paddingRight: 4 },
  colValor: { width: 62, textAlign: "right" },

  rowEtapa: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottom: "0.5pt solid #f0f0f0",
  },
  rowEtapaBold: { fontFamily: "Helvetica-Bold" },
  rowFornec: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: "#fafafa",
    fontSize: 8,
    color: "#525252",
  },
  etapaNome: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  forNome: { fontSize: 8 },
  fatBER: { color: "#92400e" },
  fatDireto: { color: "#1d4ed8" },

  // Footer
  totalRow: {
    flexDirection: "row",
    borderTop: "1pt solid #171717",
    marginTop: 4,
    paddingTop: 6,
    paddingHorizontal: 6,
    fontFamily: "Helvetica-Bold",
  },

  // Resumo de faturamento
  resumoSection: {
    marginTop: 14,
    border: "1pt solid #e5e5e5",
    borderRadius: 3,
  },
  resumoTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottom: "0.5pt solid #e5e5e5",
    backgroundColor: "#f5f5f5",
  },
  resumoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottom: "0.5pt solid #f0f0f0",
    fontSize: 9,
  },
  resumoRowLabel: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  resumoTag: {
    fontSize: 7,
    color: "#1d4ed8",
  },
  resumoRowSub: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 3,
    paddingBottom: 5,
    borderBottom: "0.5pt solid #f0f0f0",
    fontSize: 8,
    color: "#047857",
    fontStyle: "italic",
  },
  resumoValores: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  barraSection: {
    marginTop: 8,
    marginBottom: 12,
    padding: 10,
    border: "0.5pt solid #e5e5e5",
    borderRadius: 4,
    backgroundColor: "#fafafa",
  },
  barraHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  barraTitulo: {
    fontSize: 9,
    color: "#404040",
  },
  barraResumo: {
    fontSize: 8,
    color: "#737373",
  },
  barraTrack: {
    flexDirection: "row",
    height: 8,
    backgroundColor: "#e5e5e5",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  barraLegenda: {
    flexDirection: "row",
    gap: 14,
    fontSize: 7,
    color: "#525252",
  },
  barraLegendaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  resumoBrutoRiscado: {
    fontSize: 8,
    color: "#a3a3a3",
    textDecoration: "line-through",
  },
  resumoSubtotalVerde: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "#ecfdf5",
    borderTop: "0.5pt solid #d1fae5",
    borderBottom: "0.5pt solid #d1fae5",
    fontSize: 8,
    color: "#047857",
  },
  resumoRowTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#f9f9f9",
  },

  // Assinaturas
  assinaturas: {
    flexDirection: "row",
    gap: 20,
    marginTop: 36,
  },
  assinaturaBloco: {
    flex: 1,
    alignItems: "center",
  },
  linhaAssinatura: {
    width: "100%",
    borderTop: "0.5pt solid #525252",
    paddingTop: 4,
    alignItems: "center",
  },
  assinaturaLabel: {
    fontSize: 8,
    color: "#525252",
  },

  // Emissão
  emissao: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 7,
    color: "#a3a3a3",
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "0.5pt solid #e5e5e5",
    paddingTop: 6,
  },
});

export function MedicaoPDF(props: MedicaoPDFProps) {
  const {
    obraNome,
    clienteNome,
    numero,
    labelAnterior,
    periodoInicio,
    periodoFim,
    contratoTotal,
    valorJaMedido,
    valorMedicaoAtual,
    etapas,
    pagamentosDiretos = [],
    recebido = 0,
    aReceber = 0,
  } = props;

  // Percentuais pra barra de progresso financeiro
  const pctRecebido = contratoTotal > 0 ? Math.min(100, (recebido / contratoTotal) * 100) : 0;
  const pctAReceber = contratoTotal > 0 ? Math.min(100 - pctRecebido, (aReceber / contratoTotal) * 100) : 0;
  const pctMedido = contratoTotal > 0 ? Math.min(100, ((recebido + aReceber) / contratoTotal) * 100) : 0;

  const saldoAMedir = contratoTotal - valorJaMedido - valorMedicaoAtual;
  const dataEmissao = new Date();

  // Resumo de faturamento — só o que cliente vai pagar nesta medição (líquido).
  // Pagamentos diretos abatem da linha de cada fornecedor; lines zeradas somem.
  const pagoDiretoMap = new Map<string, number>();
  for (const p of pagamentosDiretos) {
    pagoDiretoMap.set(p.razaoSocial, (pagoDiretoMap.get(p.razaoSocial) ?? 0) + p.valor);
  }
  const allFornPDF = etapas.flatMap((e) => e.fornecedores);
  const berFaturamentoPDF = allFornPDF
    .filter((f) => f.tipo === "terceiro_ber_paga" || f.tipo === "miscelaneos_ber")
    .reduce((acc, f) => acc + f.valorQuinzena, 0);
  const terceirosPDFMap = new Map<string, number>();
  for (const f of allFornPDF.filter((f) => f.tipo === "terceiro_fatura_direto")) {
    terceirosPDFMap.set(f.razaoSocial, (terceirosPDFMap.get(f.razaoSocial) ?? 0) + f.valorQuinzena);
  }
  const terceirosPDF = Array.from(terceirosPDFMap.entries())
    .map(([razaoSocial, valorBruto]) => {
      const pagoDireto = pagoDiretoMap.get(razaoSocial) ?? 0;
      return {
        razaoSocial,
        valor: Math.max(0, valorBruto - pagoDireto), // líquido a pagar
        pagoDireto,
      };
    })
    // só remove se valor bruto era 0 (sem quinzena nem pagamento direto)
    .filter((t) => t.valor > 0 || t.pagoDireto > 0);
  const totalPagoDiretoPDF = pagamentosDiretos.reduce((acc, p) => acc + p.valor, 0);
  const valorMedicaoAtualLiquido = Math.max(0, valorMedicaoAtual - totalPagoDiretoPDF);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <Text style={styles.brand}>BER Engenharia</Text>
          <Text style={styles.brandSub}>CONSTRUÇÃO E INTERIORES CORPORATIVOS</Text>

          <Text style={styles.medicaoTitle}>
            {labelMedicao(numero)} — {obraNome}
          </Text>
          <Text style={styles.medicaoMeta}>
            Cliente: {clienteNome} · Período: {formatData(periodoInicio)} a {formatData(periodoFim)}
          </Text>
        </View>

        {/* KPIs */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>VALOR DO CONTRATO</Text>
            <Text style={styles.kpiValue}>{formatBRL(contratoTotal)}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>JÁ MEDIDO</Text>
            <Text style={styles.kpiValue}>{formatBRL(valorJaMedido)}</Text>
            <Text style={styles.kpiSub}>medições aprovadas</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>MEDIÇÃO ATUAL</Text>
            <Text style={styles.kpiValue}>{formatBRL(valorMedicaoAtual)}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>SALDO A MEDIR</Text>
            <Text style={styles.kpiValue}>{formatBRL(saldoAMedir)}</Text>
          </View>
        </View>

        {/* Barra de progresso financeiro */}
        {contratoTotal > 0 && (recebido > 0 || aReceber > 0) && (
          <View style={styles.barraSection}>
            <View style={styles.barraHeaderRow}>
              <Text style={styles.barraTitulo}>Progresso financeiro</Text>
              <Text style={styles.barraResumo}>
                {formatBRL(recebido + aReceber)} de {formatBRL(contratoTotal)} medidos ({pctMedido.toFixed(1)}%)
              </Text>
            </View>
            <View style={styles.barraTrack}>
              {pctRecebido > 0 && (
                <View style={{ width: `${pctRecebido}%`, backgroundColor: "#10b981" }} />
              )}
              {pctAReceber > 0 && (
                <View style={{ width: `${pctAReceber}%`, backgroundColor: "#3b82f6" }} />
              )}
            </View>
            <View style={styles.barraLegenda}>
              <View style={styles.barraLegendaItem}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#10b981" }} />
                <Text>Recebido {formatBRL(recebido)}</Text>
              </View>
              <View style={styles.barraLegendaItem}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#3b82f6" }} />
                <Text>A receber {formatBRL(aReceber)}</Text>
              </View>
              <View style={styles.barraLegendaItem}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#d4d4d4" }} />
                <Text>Não medido {formatBRL(Math.max(0, contratoTotal - recebido - aReceber))}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Etapas */}
        <Text style={styles.sectionTitle}>Detalhamento por etapa</Text>

        <View>
          {/* Cabeçalho da tabela */}
          <View style={styles.tableHeader}>
            <Text style={styles.colOrdem}>#</Text>
            <Text style={styles.colEtapa}>ETAPA / FORNECEDOR</Text>
            <Text style={styles.colContrato}>CONTRATO</Text>
            <Text style={styles.colFat}>NF</Text>
            <Text style={styles.colPercAnt}>{labelAnterior ? labelAnterior.toUpperCase() : "ANTERIOR"}</Text>
            <Text style={styles.colPerc}>% EXEC.</Text>
            <Text style={styles.colValor}>MEDIÇÃO</Text>
          </View>

          {etapas.map((etapa) => (
            <View key={etapa.ordem} wrap={false}>
              {/* Linha da etapa */}
              <View style={[styles.rowEtapa, styles.rowEtapaBold]}>
                <Text style={styles.colOrdem}>{etapa.ordem}</Text>
                <Text style={[styles.colEtapa, styles.etapaNome]}>{etapa.nome}</Text>
                <Text style={styles.colContrato}>{formatBRL(etapa.contratoValor)}</Text>
                <Text style={styles.colFat}> </Text>
                <Text style={styles.colPercAnt}>
                  {etapa.percentualAcumuladoAnterior.toFixed(0)}%
                </Text>
                <Text style={styles.colPerc}>
                  {etapa.percentualAcumulado.toFixed(0)}%
                </Text>
                <Text style={styles.colValor}>{formatBRL(etapa.valorQuinzena)}</Text>
              </View>

              {/* Sublinhas: fornecedores */}
              {etapa.fornecedores.map((f, idx) => {
                const isDireto = f.tipo === "terceiro_fatura_direto";
                return (
                  <View
                    key={idx}
                    style={styles.rowFornec}
                  >
                    <Text style={styles.colOrdem}> </Text>
                    <Text style={[styles.colEtapa, styles.forNome]}>
                      {"   └ "}{f.razaoSocial}
                    </Text>
                    <Text style={styles.colContrato}>
                      {formatBRL(f.valorContratado)}
                    </Text>
                    <Text
                      style={[
                        styles.colFat,
                        isDireto ? styles.fatDireto : styles.fatBER,
                      ]}
                    >
                      {tipoLabel[f.tipo] ?? f.tipo}
                    </Text>
                    <Text style={styles.colPercAnt}>
                      {f.percentualAcumuladoAnterior.toFixed(0)}%
                    </Text>
                    <Text style={styles.colPerc}> </Text>
                    <Text style={styles.colValor}>
                      {formatBRL(f.valorQuinzena)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}

          {/* Total da medição */}
          <View style={styles.totalRow}>
            <Text style={styles.colOrdem}> </Text>
            <Text style={styles.colEtapa}>TOTAL DA MEDIÇÃO</Text>
            <Text style={styles.colContrato}> </Text>
            <Text style={styles.colFat}> </Text>
            <Text style={styles.colPercAnt}> </Text>
            <Text style={styles.colPerc}> </Text>
            <Text style={styles.colValor}>{formatBRL(valorMedicaoAtual)}</Text>
          </View>
        </View>

        {/* Resumo de faturamento */}
        <View style={styles.resumoSection}>
          <Text style={styles.resumoTitle}>RESUMO DE FATURAMENTO</Text>
          {berFaturamentoPDF > 0 && (
            <View style={styles.resumoRow}>
              <Text>BER Engenharia</Text>
              <Text>{formatBRL(berFaturamentoPDF)}</Text>
            </View>
          )}
          {terceirosPDF.map((t) => {
            const bruto = t.valor + t.pagoDireto;
            return (
              <View key={t.razaoSocial}>
                <View style={styles.resumoRow}>
                  <View style={styles.resumoRowLabel}>
                    <Text>{t.razaoSocial}</Text>
                    <Text style={styles.resumoTag}>fatura direto</Text>
                  </View>
                  <View style={styles.resumoValores}>
                    {t.pagoDireto > 0 && (
                      <Text style={styles.resumoBrutoRiscado}>{formatBRL(bruto)}</Text>
                    )}
                    <Text>{formatBRL(t.valor)}</Text>
                  </View>
                </View>
                {t.pagoDireto > 0 && (
                  <View style={styles.resumoRowSub}>
                    <Text>     já pago direto pelo cliente</Text>
                    <Text>−{formatBRL(t.pagoDireto)}</Text>
                  </View>
                )}
              </View>
            );
          })}
          {totalPagoDiretoPDF > 0 && (
            <View style={styles.resumoSubtotalVerde}>
              <Text>Subtotal pago direto pelo cliente</Text>
              <Text>−{formatBRL(totalPagoDiretoPDF)}</Text>
            </View>
          )}
          <View style={styles.resumoRowTotal}>
            <Text>{totalPagoDiretoPDF > 0 ? "TOTAL DA MEDIÇÃO (líquido)" : "TOTAL DA MEDIÇÃO"}</Text>
            <Text>{formatBRL(valorMedicaoAtualLiquido)}</Text>
          </View>
        </View>

        {/* Assinaturas */}
        <View style={styles.assinaturas}>
          <View style={styles.assinaturaBloco}>
            <View style={styles.linhaAssinatura}>
              <Text style={styles.assinaturaLabel}>BER Engenharia</Text>
            </View>
          </View>
          <View style={styles.assinaturaBloco}>
            <View style={styles.linhaAssinatura}>
              <Text style={styles.assinaturaLabel}>{clienteNome}</Text>
            </View>
          </View>
        </View>

        {/* Rodapé */}
        <View style={styles.emissao} fixed>
          <Text>Emitido em {formatData(dataEmissao)}</Text>
          <Text>BER Engenharia · {labelMedicao(numero)}</Text>
        </View>
      </Page>
    </Document>
  );
}
