/**
 * Ficha de Pendências — PDF no padrão visual BÈR (mesma família de ata-pdf).
 * Agrupada por ambiente, abertas primeiro, com resumo no topo.
 */
import * as React from "react";
import { Document, Page, Text, View, StyleSheet, Image, Svg, Circle } from "@react-pdf/renderer";

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
  fotoAberturaUrl: string | null;
  fotoConclusaoUrl: string | null;
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

  // gráficos
  chartCard: { border: `0.5pt solid ${BER.border}`, borderRadius: 3, padding: 8, marginBottom: 8 },
  chartTitle: { fontSize: 7, fontFamily: "Helvetica-Bold", color: BER.teal, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 },
  chartLegend: { fontSize: 6.5, color: BER.gray },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  barLabel: { width: "34%", fontSize: 7, textAlign: "right", paddingRight: 4, color: BER.carbon },
  barTrack: { flex: 1, flexDirection: "row", alignItems: "center" },
  barVal: { fontSize: 6.5, color: BER.gray, paddingLeft: 3 },
  legSq: { width: 6, height: 6, borderRadius: 1, marginRight: 2 },
  legRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" },
  legItem: { flexDirection: "row", alignItems: "center" },

  // registro fotográfico
  fotoBloco: { marginBottom: 12, border: `0.5pt solid ${BER.border}`, borderRadius: 3, padding: 8 },
  fotoTitulo: { fontSize: 8, fontFamily: "Helvetica-Bold", marginBottom: 1 },
  fotoMeta: { fontSize: 7, color: BER.gray, marginBottom: 5 },
  fotoRow: { flexDirection: "row", gap: 8 },
  fotoCol: { flex: 1 },
  fotoLabel: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: BER.teal, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  fotoImg: { width: "100%", height: 150, objectFit: "cover", borderRadius: 3 },
  fotoVazia: { width: "100%", height: 150, backgroundColor: BER.surface, borderRadius: 3, alignItems: "center", justifyContent: "center" },
  fotoVaziaTxt: { fontSize: 7, color: BER.gray },
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

        {/* KPIs no modelo da planilha (04/09): escopo separado dos itens novos */}
        {(() => {
          const pend = itens.filter((i) => i.tipo === "pendencia");
          const pendConcl = pend.filter((i) => i.status === "concluida").length;
          const solic = itens.filter((i) => i.tipo === "solicitacao").length;
          const cards: [string, string, string?][] = [
            [String(itens.length), "Total de solicitações"],
            [String(pend.length), "Pendências de obra"],
            [String(pendConcl), "Concluídas", BER.green],
            [String(pend.length - pendConcl), "Pendentes"],
            [String(solic), "Itens novos", "#7A3FB8"],
            [String(atrasadas.length), "Atrasadas", atrasadas.length ? BER.red : undefined],
          ];
          return (
            <View style={styles.resumoRow}>
              {cards.map(([num, label, cor], i) => (
                <View key={i} style={styles.resumoBox}>
                  <Text style={[styles.resumoNum, cor ? { color: cor } : {}]}>{num}</Text>
                  <Text style={styles.resumoLabel}>{label}</Text>
                </View>
              ))}
            </View>
          );
        })()}

        {/* Roscas no modelo da planilha (04/09, Bruno: "rosca é mais clean").
            Detalhe por ambiente já está nas seções abaixo — sem barras aqui. */}
        {(() => {
          if (!itens.length) return null;
          const GREEN = BER.green, GRAY = "#C9C9C9", ROXO = "#7A3FB8";
          const pend = itens.filter((i) => i.tipo === "pendencia");
          const pendConcl = pend.filter((i) => i.status === "concluida").length;
          const pendPend = pend.length - pendConcl;
          const solic = itens.filter((i) => i.tipo === "solicitacao").length;
          const pct = pend.length ? Math.round((pendConcl / pend.length) * 100) : 0;

          const DonutPdf = ({ titulo, fatias, centro, sub }: {
            titulo: string;
            fatias: { valor: number; cor: string; label: string }[];
            centro: string;
            sub: string;
          }) => {
            const R = 24;
            const C = 2 * Math.PI * R;
            const total = Math.max(1, fatias.reduce((s, f) => s + f.valor, 0));
            let acc = 0;
            return (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <View style={{ width: 64, height: 64, position: "relative" }}>
                  <Svg width={64} height={64} viewBox="0 0 64 64">
                    <Circle cx={32} cy={32} r={R} fill="none" stroke="#F1F1EC" strokeWidth={9} />
                    {fatias.filter((f) => f.valor > 0).map((f, i) => {
                      const frac = f.valor / total;
                      // Sem strokeDashoffset no react-pdf: vão inicial no
                      // dasharray posiciona a fatia. PDFKit exige comprimentos > 0.
                      const arco = Math.max(0.1, frac * C - 1.5);
                      const dash = acc <= 0
                        ? `${arco} ${C}`
                        : `0.01 ${acc * C} ${arco} ${C}`;
                      const el = (
                        <Circle key={i} cx={32} cy={32} r={R} fill="none" stroke={f.cor} strokeWidth={9}
                          strokeDasharray={dash} />
                      );
                      acc += frac;
                      return el;
                    })}
                  </Svg>
                  <View style={{ position: "absolute", top: 0, left: 0, width: 64, height: 64, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: BER.carbon }}>{centro}</Text>
                    <Text style={{ fontSize: 5, color: BER.gray, textTransform: "uppercase", letterSpacing: 0.5 }}>{sub}</Text>
                  </View>
                </View>
                <View>
                  <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: BER.teal, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 }}>{titulo}</Text>
                  {fatias.map((f, i) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 1.5 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 1, backgroundColor: f.cor }} />
                      <Text style={{ fontSize: 7, color: BER.gray }}>{f.label} <Text style={{ fontFamily: "Helvetica-Bold", color: BER.carbon }}>{f.valor}</Text></Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          };

          return (
            <View style={[styles.chartCard, { flexDirection: "row", gap: 16 }]}>
              <DonutPdf titulo="Pendências de obra"
                fatias={[
                  { valor: pendConcl, cor: GREEN, label: "Concluídas" },
                  { valor: pendPend, cor: GRAY, label: "Pendentes" },
                ]}
                centro={`${pct}%`} sub="do escopo" />
              <DonutPdf titulo="Visão geral"
                fatias={[
                  { valor: pendConcl, cor: GREEN, label: "Concluídas" },
                  { valor: pendPend, cor: GRAY, label: "Pendentes" },
                  { valor: solic, cor: ROXO, label: "Itens novos" },
                ]}
                centro={String(itens.length)} sub="itens" />
            </View>
          );
        })()}

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

            {/* Registro fotográfico DENTRO da seção do ambiente (04/09, Bruno).
                Só slots preenchidos — sem caixa vazia de "antes" (fotos são do resolvido). */}
            {arr.some((i) => i.fotoAberturaUrl || i.fotoConclusaoUrl) && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6, marginBottom: 4 }}>
                {arr.filter((i) => i.fotoAberturaUrl || i.fotoConclusaoUrl).flatMap((i, idx) =>
                  [
                    ...(i.fotoAberturaUrl ? [{ url: i.fotoAberturaUrl, rotulo: "antes" }] : []),
                    ...(i.fotoConclusaoUrl ? [{ url: i.fotoConclusaoUrl, rotulo: i.fotoAberturaUrl ? "depois" : null }] : []),
                  ].map((f, j) => (
                    <View key={`${idx}-${j}`} style={{ width: "48.5%" }} wrap={false}>
                      <Image style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 3 }} src={f.url} />
                      <Text style={{ fontSize: 6.5, color: BER.gray, marginTop: 2, lineHeight: 1.3 }}>
                        {i.atividade.length > 90 ? i.atividade.slice(0, 90) + "…" : i.atividade}
                        {f.rotulo ? `  ·  ${f.rotulo}` : ""}  ·  {STATUS_LABEL[i.status] ?? i.status}
                      </Text>
                    </View>
                  )),
                )}
              </View>
            )}
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
