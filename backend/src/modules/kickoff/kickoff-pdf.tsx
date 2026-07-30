import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import * as React from "react";

const BER = {
  carbon: "#2D2D2D", teal: "#5A7A7A", olive: "#B5B820", gray: "#868686",
  offwhite: "#D8DDD8", surface: "#F7F7F5", border: "#E8E8E4",
  red: "#B23B3B", green: "#3D9E5F", blue: "#1d4ed8",
};

interface Header {
  coordenador: string | null; engenheiro: string | null; supervisor: string | null;
  mestreEncarregado: string | null;
  inicioObra: Date | string | null; terminoObra: Date | string | null; dataKickoff: Date | string | null;
  participantesDeptos: Record<string, string> | null;
}
interface Item {
  secao: string; item: string; ordem: number;
  responsavel: string | null; naRede: string | null; dataAlvo: Date | string | null;
  status: string | null; observacoes: string | null;
}
export interface KickoffPDFProps {
  obra: { name: string };
  header: Header | null;
  itens: Item[];
  geradoEm: Date;
}

const fmtDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

const DEPTOS: { key: string; label: string }[] = [
  { key: "comercial", label: "Comercial" }, { key: "pmo", label: "PMO" },
  { key: "suprimentos", label: "Suprimentos" }, { key: "orcamentos", label: "Orçamentos" },
  { key: "financeiro", label: "Financeiro" }, { key: "coordenador", label: "Coordenador" },
  { key: "engenheiro", label: "Engenheiro" },
];
const NAREDE: Record<string, string> = { sim: "Sim", nao: "Não", na: "N/A" };
const STATUS: Record<string, { label: string; cor: string; bg: string }> = {
  concluido:    { label: "Concluído",    cor: BER.green, bg: "#E7F3EC" },
  em_andamento: { label: "Em andamento", cor: BER.blue,  bg: "#E7EDFB" },
  atrasado:     { label: "Atrasado",     cor: BER.red,   bg: "#FBE9E9" },
  na:           { label: "N/A",          cor: BER.gray,  bg: BER.surface },
};

const styles = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 40, paddingHorizontal: 32, fontFamily: "Helvetica", fontSize: 9, color: BER.carbon },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 5, backgroundColor: BER.teal },
  topBarOlive: { position: "absolute", top: 5, left: 0, right: 0, height: 2, backgroundColor: BER.olive },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottom: `1pt solid ${BER.border}`, paddingBottom: 10, marginBottom: 12 },
  brand: { fontSize: 17, fontFamily: "Helvetica-Bold", color: BER.carbon, letterSpacing: 0.3 },
  brandSub: { fontSize: 6.5, color: BER.teal, marginTop: 2, letterSpacing: 1 },
  docTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: BER.carbon, textAlign: "right" },
  docMeta: { fontSize: 8, color: BER.gray, textAlign: "right", marginTop: 2 },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: BER.teal, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 14, marginBottom: 5, borderLeft: `2pt solid ${BER.olive}`, paddingLeft: 5 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "33.33%", flexDirection: "row", paddingVertical: 2, paddingRight: 8 },
  cellLabel: { width: 70, fontSize: 8, color: BER.gray },
  cellVal: { flex: 1, fontSize: 9 },
  secHead: { backgroundColor: BER.surface, borderTop: `1.5pt solid ${BER.teal}`, borderBottom: `0.5pt solid ${BER.border}`, paddingVertical: 3, paddingHorizontal: 4, marginTop: 10 },
  secHeadTxt: { fontSize: 8, fontFamily: "Helvetica-Bold", color: BER.carbon, textTransform: "uppercase", letterSpacing: 0.4 },
  th: { flexDirection: "row", borderBottom: `0.5pt solid ${BER.border}`, paddingVertical: 3, paddingHorizontal: 4 },
  thTxt: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: BER.gray },
  row: { flexDirection: "row", borderBottom: `0.5pt solid ${BER.border}`, paddingVertical: 4, paddingHorizontal: 4 },
  rowAlt: { backgroundColor: "#FAFAF8" },
  td: { fontSize: 7.5, paddingRight: 4 },
  cItem: { width: "34%" }, cResp: { width: "16%" }, cRede: { width: "9%" }, cData: { width: "11%" }, cStatus: { width: "14%" }, cObs: { width: "16%" },
  badge: { fontSize: 6.5, fontFamily: "Helvetica-Bold", paddingVertical: 1, paddingHorizontal: 3, borderRadius: 2, alignSelf: "flex-start" },
  emissao: { position: "absolute", bottom: 18, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: BER.gray, borderTop: `0.5pt solid ${BER.border}`, paddingTop: 5 },
  empty: { fontSize: 9, color: BER.gray, fontStyle: "italic", paddingVertical: 8 },
});

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellVal}>{value || "—"}</Text>
    </View>
  );
}

export function KickoffPDF({ obra, header, itens, geradoEm }: KickoffPDFProps) {
  const deptos = header?.participantesDeptos ?? {};
  // Agrupa por seção preservando ordem
  const secoes: { secao: string; itens: Item[] }[] = [];
  for (const it of [...itens].sort((a, b) => a.ordem - b.ordem)) {
    let g = secoes.find((s) => s.secao === it.secao);
    if (!g) { g = { secao: it.secao, itens: [] }; secoes.push(g); }
    g.itens.push(it);
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar} fixed />
        <View style={styles.topBarOlive} fixed />

        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>BÈR Engenharia</Text>
            <Text style={styles.brandSub}>CONSTRUÇÃO E INTERIORES CORPORATIVOS E RESIDENCIAIS</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>Kickoff de Obra</Text>
            <Text style={styles.docMeta}>{obra.name}</Text>
          </View>
        </View>

        {/* Dados do kickoff */}
        <Text style={styles.sectionTitle}>Dados do Kickoff</Text>
        <View style={styles.grid}>
          <Info label="Obra" value={obra.name} />
          <Info label="Coordenador" value={header?.coordenador} />
          <Info label="Engenheiro" value={header?.engenheiro} />
          <Info label="Supervisor" value={header?.supervisor} />
          <Info label="Mestre / Enc." value={header?.mestreEncarregado} />
          <Info label="Início" value={fmtDate(header?.inicioObra ?? null)} />
          <Info label="Término" value={fmtDate(header?.terminoObra ?? null)} />
          <Info label="Data Kick Off" value={fmtDate(header?.dataKickoff ?? null)} />
        </View>

        {/* Comercial x Engenharia */}
        <Text style={styles.sectionTitle}>Comercial × Engenharia</Text>
        <View style={styles.grid}>
          {DEPTOS.map((d) => <Info key={d.key} label={d.label} value={deptos[d.key]} />)}
        </View>

        {/* Checklist */}
        <Text style={styles.sectionTitle}>Checklist</Text>
        {secoes.length === 0 ? (
          <Text style={styles.empty}>Nenhum item.</Text>
        ) : (
          secoes.map((s) => (
            <View key={s.secao} wrap={false}>
              <View style={styles.secHead}><Text style={styles.secHeadTxt}>{s.secao}</Text></View>
              <View style={styles.th}>
                <Text style={[styles.thTxt, styles.cItem]}>DOCUMENTO / AÇÃO</Text>
                <Text style={[styles.thTxt, styles.cResp]}>RESPONSÁVEL</Text>
                <Text style={[styles.thTxt, styles.cRede]}>NA REDE</Text>
                <Text style={[styles.thTxt, styles.cData]}>DATA ALVO</Text>
                <Text style={[styles.thTxt, styles.cStatus]}>STATUS</Text>
                <Text style={[styles.thTxt, styles.cObs]}>OBS.</Text>
              </View>
              {s.itens.map((it, i) => {
                const st = it.status ? STATUS[it.status] : null;
                return (
                  <View key={i} style={i % 2 === 1 ? [styles.row, styles.rowAlt] : styles.row}>
                    <Text style={[styles.td, styles.cItem]}>{it.item}</Text>
                    <Text style={[styles.td, styles.cResp]}>{it.responsavel || "—"}</Text>
                    <Text style={[styles.td, styles.cRede]}>{it.naRede ? (NAREDE[it.naRede] ?? it.naRede) : "—"}</Text>
                    <Text style={[styles.td, styles.cData]}>{fmtDate(it.dataAlvo)}</Text>
                    <View style={styles.cStatus}>
                      {st ? <Text style={[styles.badge, { color: st.cor, backgroundColor: st.bg }]}>{st.label}</Text> : <Text style={styles.td}>—</Text>}
                    </View>
                    <Text style={[styles.td, styles.cObs]}>{it.observacoes || "—"}</Text>
                  </View>
                );
              })}
            </View>
          ))
        )}

        <View style={styles.emissao} fixed>
          <Text>Emitido em {geradoEm.toLocaleDateString("pt-BR")} às {geradoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</Text>
          <Text>BÈR Engenharia · Kickoff de Obra</Text>
        </View>
      </Page>
    </Document>
  );
}
