/**
 * Ficha de Pendências — PDF no padrão visual BÈR (mesma família de ata-pdf).
 * Agrupada por ambiente, abertas primeiro, com resumo no topo.
 */
import * as React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const BER = {
  carbon: "#2D2D2D",
  teal: "#5A7A7A",
  olive: "#B5B820",
  gray: "#868686",
  surface: "#F7F7F5",
  border: "#E8E8E4",
  red: "#E05555",
  green: "#3D9E5F",
  amber: "#E6A23C",
};

export interface PdfPendencia {
  ambiente: string;
  atividade: string;
  disciplina: string | null;
  fornecedor: string | null;
  tipo: string;
  criticidade: string;
  status: string;
  dataTermino: Date | null;
  atrasada: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  bloqueada: "Bloqueada",
};
const STATUS_COLOR: Record<string, string> = {
  aberta: BER.gray,
  em_andamento: "#2563EB",
  concluida: BER.green,
  bloqueada: BER.red,
};
const CRIT_COLOR: Record<string, string> = { baixa: BER.gray, media: BER.amber, alta: BER.red };

const styles = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 40, paddingHorizontal: 32, fontFamily: "Helvetica", fontSize: 9, color: BER.carbon },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 5, backgroundColor: BER.teal },
  topBarOlive: { position: "absolute", top: 5, left: 0, right: 0, height: 2, backgroundColor: BER.olive },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottom: `1pt solid ${BER.border}`, paddingBottom: 10, marginBottom: 10 },
  brand: { fontSize: 17, fontFamily: "Helvetica-Bold", color: BER.carbon, letterSpacing: 0.3 },
  brandSub: { fontSize: 6.5, color: BER.teal, marginTop: 2, letterSpacing: 1 },
  docTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: BER.carbon, textAlign: "right" },
  docMeta: { fontSize: 8, color: BER.gray, textAlign: "right", marginTop: 2 },

  resumoRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  resumoBox: { flex: 1, border: `1pt solid ${BER.border}`, borderRadius: 3, padding: 6 },
  resumoNum: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  resumoLabel: { fontSize: 6.5, color: BER.gray, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 1 },

  ambTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: BER.teal, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 12, marginBottom: 4, borderLeft: `2pt solid ${BER.olive}`, paddingLeft: 5 },
  tableHeader: { flexDirection: "row", backgroundColor: BER.surface, borderTop: `1.5pt solid ${BER.teal}`, borderBottom: `0.5pt solid ${BER.border}`, paddingVertical: 4, paddingHorizontal: 4 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 7, color: BER.carbon },
  row: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 4, borderBottom: `0.5pt solid ${BER.border}` },
  cAtiv: { width: "46%", paddingRight: 6 },
  cForn: { width: "16%", paddingRight: 6 },
  cDisc: { width: "12%", paddingRight: 6 },
  cPrazo: { width: "11%", paddingRight: 6 },
  cStatus: { width: "15%" },
  cell: { fontSize: 8 },
  solTag: { fontSize: 6, color: "#7A3FB8", fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 18, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: BER.gray, borderTop: `0.5pt solid ${BER.border}`, paddingTop: 5 },
});

function fmtBR(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function PendenciasPDF({ obraNome, itens, geradoEm }: {
  obraNome: string;
  itens: PdfPendencia[];
  geradoEm: Date;
}) {
  const abertas = itens.filter((i) => i.status !== "concluida");
  const atrasadas = itens.filter((i) => i.atrasada);
  const grupos = new Map<string, PdfPendencia[]>();
  for (const i of itens) {
    const arr = grupos.get(i.ambiente) ?? [];
    arr.push(i);
    grupos.set(i.ambiente, arr);
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar} fixed />
        <View style={styles.topBarOlive} fixed />
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>BÈR ENGENHARIA</Text>
            <Text style={styles.brandSub}>CUIDADO EM CADA OBRA</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>Ficha de Pendências</Text>
            <Text style={styles.docMeta}>{obraNome} · gerada em {fmtBR(geradoEm)}</Text>
          </View>
        </View>

        <View style={styles.resumoRow}>
          <View style={styles.resumoBox}>
            <Text style={styles.resumoNum}>{itens.length}</Text>
            <Text style={styles.resumoLabel}>Total</Text>
          </View>
          <View style={styles.resumoBox}>
            <Text style={styles.resumoNum}>{abertas.length}</Text>
            <Text style={styles.resumoLabel}>Em aberto</Text>
          </View>
          <View style={styles.resumoBox}>
            <Text style={[styles.resumoNum, { color: atrasadas.length ? BER.red : BER.carbon }]}>{atrasadas.length}</Text>
            <Text style={styles.resumoLabel}>Atrasadas</Text>
          </View>
          <View style={styles.resumoBox}>
            <Text style={[styles.resumoNum, { color: BER.green }]}>{itens.length - abertas.length}</Text>
            <Text style={styles.resumoLabel}>Concluídas</Text>
          </View>
        </View>

        {[...grupos.entries()].map(([amb, arr]) => (
          <View key={amb} wrap>
            <Text style={styles.ambTitle}>{amb} — {arr.filter((i) => i.status !== "concluida").length} em aberto</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.cAtiv]}>ATIVIDADE</Text>
              <Text style={[styles.th, styles.cForn]}>FORNECEDOR</Text>
              <Text style={[styles.th, styles.cDisc]}>DISCIPLINA</Text>
              <Text style={[styles.th, styles.cPrazo]}>PRAZO</Text>
              <Text style={[styles.th, styles.cStatus]}>STATUS</Text>
            </View>
            {arr.map((i, idx) => (
              <View key={idx} style={styles.row} wrap={false}>
                <View style={styles.cAtiv}>
                  <Text style={styles.cell}>
                    {i.atividade}
                    {i.tipo === "solicitacao" ? "  " : ""}
                    {i.tipo === "solicitacao" && <Text style={styles.solTag}>[SOLICITAÇÃO CLIENTE]</Text>}
                  </Text>
                </View>
                <Text style={[styles.cell, styles.cForn]}>{i.fornecedor ?? "—"}</Text>
                <Text style={[styles.cell, styles.cDisc]}>{i.disciplina ?? "—"}</Text>
                <Text style={[styles.cell, styles.cPrazo, i.atrasada ? { color: BER.red, fontFamily: "Helvetica-Bold" } : {}]}>
                  {fmtBR(i.dataTermino)}{i.atrasada ? " !" : ""}
                </Text>
                <Text style={[styles.cell, styles.cStatus, { color: STATUS_COLOR[i.status] ?? BER.gray }, i.criticidade === "alta" && i.status !== "concluida" ? { fontFamily: "Helvetica-Bold" } : {}]}>
                  {STATUS_LABEL[i.status] ?? i.status}
                  {i.criticidade === "alta" && i.status !== "concluida" ? " · ALTA" : ""}
                </Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>BÈR Engenharia · Ficha de Pendências · {obraNome}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
