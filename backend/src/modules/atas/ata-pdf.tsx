import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import * as React from "react";

// ── Tipos (espelham o retorno de getAtaCorrida) ───────────────────────────
interface ObraHeader {
  name: string;
  client: string | null;
  address: string | null;
  arquiteturaEscritorio: string | null;
  gerenciadora: string | null;
  areaM2: number | null;
  dataInicioObra: Date | string | null;
  dataFimObra: Date | string | null;
}
interface Stakeholder {
  nome: string; empresa: string; funcao: string | null; email: string | null; telefone: string | null;
}
interface Topico {
  ordem: number;
  status: string;
  impacto: string;
  changeOrder: boolean;
  disciplina: string | null;
  tema: string | null;
  observacoes: string | null;
  acao: string | null;
  confirmado: boolean;
  dataInfo: Date | string | null;
  dataAlvo: Date | string | null;
  dataFinal: Date | string | null;
  responsavelStakeholder: { nome: string; empresa: string } | null;
}

export interface AtaPDFProps {
  obra: ObraHeader;
  stakeholders: Stakeholder[];
  topicos: Topico[];
  geradoEm: Date;
}

// ── Helpers ───────────────────────────────────────────────────────────────
const fmtDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

// Paleta da identidade BÈR (globals.css)
const BER = {
  carbon: "#2D2D2D",
  teal: "#5A7A7A",
  olive: "#B5B820",
  gray: "#868686",
  offwhite: "#D8DDD8",
  surface: "#F7F7F5",
  border: "#E8E8E4",
  red: "#E05555",
  green: "#3D9E5F",
  amber: "#E6A23C",
};

const STATUS: Record<string, { label: string; cor: string; bg: string; rank: number }> = {
  atrasado:     { label: "Atrasado",     cor: "#B23B3B", bg: "#FBE9E9", rank: 0 },
  em_andamento: { label: "Em andamento", cor: BER.teal, bg: "#EAF0F0", rank: 1 },
  concluido:    { label: "Concluído",    cor: BER.green, bg: "#E7F3EC", rank: 2 },
};
const IMPACTO: Record<string, string> = {
  sem_impacto: "Sem impacto", custo: "Custo", cronograma: "Cronograma", projeto: "Projeto",
};
const ACAO: Record<string, string> = { informacao: "Informação", acao: "Ação" };

const statusOf = (s: string) => STATUS[s] ?? STATUS.em_andamento;
const daysDiff = (alvo: Date | string | null, fin: Date | string | null) => {
  if (!alvo || !fin) return null;
  return Math.round((new Date(fin).getTime() - new Date(alvo).getTime()) / 86400000);
};

// Mesma ordenação da tela: confirmados por status+data alvo/info; pendentes no fim por ordem.
function sortTopicos(ts: Topico[]): Topico[] {
  const prio = (t: Topico) => {
    const d = t.dataAlvo ?? t.dataInfo;
    return d ? new Date(d).getTime() : Number.POSITIVE_INFINITY;
  };
  const conf = ts.filter((t) => t.confirmado).sort((a, b) =>
    statusOf(a.status).rank - statusOf(b.status).rank || prio(a) - prio(b));
  const pend = ts.filter((t) => !t.confirmado).sort((a, b) => a.ordem - b.ordem);
  return [...conf, ...pend];
}

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

  infoGrid: { flexDirection: "row", flexWrap: "wrap" },
  infoCell: { width: "50%", flexDirection: "row", paddingVertical: 2 },
  infoLabel: { width: 78, fontSize: 8, color: BER.gray },
  infoValue: { flex: 1, fontSize: 9, paddingRight: 8 },

  tableHeader: { flexDirection: "row", backgroundColor: BER.surface, borderTop: `1.5pt solid ${BER.teal}`, borderBottom: `0.5pt solid ${BER.border}`, paddingVertical: 5, paddingHorizontal: 4 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 7, color: BER.carbon },
  row: { flexDirection: "row", paddingTop: 8, paddingBottom: 6, paddingHorizontal: 4 },
  cell: { fontSize: 8, paddingRight: 6 },

  // stakeholders cols
  skNome: { width: "26%" }, skEmpresa: { width: "22%" }, skFuncao: { width: "18%" }, skContato: { width: "34%" },

  // tópicos cols
  tOrdem: { width: "4%" },
  tTema: { width: "30%" },
  tStatus: { width: "13%" },
  tResp: { width: "18%" },
  tAcao: { width: "11%" },
  tDatas: { width: "16%" },
  tDelta: { width: "8%", textAlign: "right" },

  topicoBlock: { borderBottom: `0.5pt solid ${BER.border}` },
  rowAlt: { backgroundColor: "#FAFAF8" },
  temaTxt: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: BER.carbon },
  badge: { fontSize: 7, fontFamily: "Helvetica-Bold", paddingVertical: 1, paddingHorizontal: 4, borderRadius: 2, alignSelf: "flex-start" },
  // Etiquetas (chips) — disciplina, change order e impacto, todas na linha de meta
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 3 },
  chip: { fontSize: 6, fontFamily: "Helvetica-Bold", paddingVertical: 1, paddingHorizontal: 4, borderRadius: 2, marginRight: 3, letterSpacing: 0.3 },
  chipDisc: { color: BER.teal, backgroundColor: "#EAF0F0" },
  chipCO: { color: "#6E7A0E", backgroundColor: "#F1F2D4" },
  chipImpacto: { color: "#8A6D1E", backgroundColor: "#F6EFDD" },
  // Observação — recuada, sem itálico, com respiro e um filete à esquerda
  obs: { fontSize: 8, color: "#555555", marginTop: 5, marginBottom: 7, marginLeft: 18, paddingLeft: 7, borderLeft: `1.5pt solid ${BER.offwhite}`, lineHeight: 1.4 },
  respNome: { fontSize: 8, color: BER.carbon },
  respEmpresa: { fontSize: 7, color: BER.gray },
  dateAlvo: { fontSize: 8, fontFamily: "Helvetica-Bold", color: BER.carbon },
  dateSub: { fontSize: 7, color: BER.gray },
  emissao: { position: "absolute", bottom: 18, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: BER.gray, borderTop: `0.5pt solid ${BER.border}`, paddingTop: 5 },
  empty: { fontSize: 9, color: BER.gray, fontStyle: "italic", paddingVertical: 8 },
});

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={styles.infoCell}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "—"}</Text>
    </View>
  );
}

export function AtaPDF({ obra, stakeholders, topicos, geradoEm }: AtaPDFProps) {
  const ordered = sortTopicos(topicos);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Faixas da identidade BÈR no topo (repetem em toda página) */}
        <View style={styles.topBar} fixed />
        <View style={styles.topBarOlive} fixed />

        {/* Cabeçalho */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>BÈR Engenharia</Text>
            <Text style={styles.brandSub}>CONSTRUÇÃO E INTERIORES CORPORATIVOS</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>Ata de Reunião</Text>
            <Text style={styles.docMeta}>{obra.name}</Text>
          </View>
        </View>

        {/* Dados da obra */}
        <Text style={styles.sectionTitle}>Obra</Text>
        <View style={styles.infoGrid}>
          <InfoRow label="Nome" value={obra.name} />
          <InfoRow label="Cliente" value={obra.client} />
          <InfoRow label="Endereço" value={obra.address} />
          <InfoRow label="Arquitetura" value={obra.arquiteturaEscritorio} />
          <InfoRow label="Gerenciadora" value={obra.gerenciadora} />
          <InfoRow label="Área (m²)" value={obra.areaM2 ? `${obra.areaM2.toLocaleString("pt-BR")} m²` : null} />
          <InfoRow label="Início" value={fmtDate(obra.dataInicioObra)} />
          <InfoRow label="Término" value={fmtDate(obra.dataFimObra)} />
        </View>

        {/* Stakeholders */}
        <Text style={styles.sectionTitle}>Stakeholders ({stakeholders.length})</Text>
        {stakeholders.length === 0 ? (
          <Text style={styles.empty}>Nenhum stakeholder cadastrado.</Text>
        ) : (
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.skNome]}>NOME</Text>
              <Text style={[styles.th, styles.skEmpresa]}>EMPRESA</Text>
              <Text style={[styles.th, styles.skFuncao]}>FUNÇÃO</Text>
              <Text style={[styles.th, styles.skContato]}>CONTATO</Text>
            </View>
            {stakeholders.map((s, i) => (
              <View key={i} style={styles.row} wrap={false}>
                <Text style={[styles.cell, styles.skNome]}>{s.nome}</Text>
                <Text style={[styles.cell, styles.skEmpresa]}>{s.empresa}</Text>
                <Text style={[styles.cell, styles.skFuncao]}>{s.funcao || "—"}</Text>
                <Text style={[styles.cell, styles.skContato]}>{[s.email, s.telefone].filter(Boolean).join(" · ") || "—"}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Tópicos */}
        <Text style={styles.sectionTitle}>Tópicos ({topicos.length})</Text>
        {ordered.length === 0 ? (
          <Text style={styles.empty}>Nenhum tópico registrado.</Text>
        ) : (
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.tOrdem]}>#</Text>
              <Text style={[styles.th, styles.tTema]}>DISCIPLINA / TEMA</Text>
              <Text style={[styles.th, styles.tStatus]}>STATUS</Text>
              <Text style={[styles.th, styles.tResp]}>RESPONSÁVEL</Text>
              <Text style={[styles.th, styles.tAcao]}>TIPO</Text>
              <Text style={[styles.th, styles.tDatas]}>PRAZOS</Text>
              <Text style={[styles.th, styles.tDelta]}>DESVIO (d)</Text>
            </View>
            {ordered.map((t, i) => {
              const sc = statusOf(t.status);
              const dd = daysDiff(t.dataAlvo, t.dataFinal);
              const temImpacto = !!t.impacto && t.impacto !== "sem_impacto";
              return (
                <View key={i} style={i % 2 === 1 ? [styles.topicoBlock, styles.rowAlt] : styles.topicoBlock} wrap={false}>
                  <View style={styles.row}>
                    <Text style={[styles.cell, styles.tOrdem]}>{i + 1}</Text>
                    <View style={styles.tTema}>
                      <Text style={styles.temaTxt}>{t.tema || "—"}</Text>
                      {(t.disciplina || t.changeOrder || temImpacto) ? (
                        <View style={styles.chipRow}>
                          {t.disciplina ? <Text style={[styles.chip, styles.chipDisc]}>{t.disciplina}</Text> : null}
                          {t.changeOrder ? <Text style={[styles.chip, styles.chipCO]}>CHANGE ORDER</Text> : null}
                          {temImpacto ? <Text style={[styles.chip, styles.chipImpacto]}>{IMPACTO[t.impacto] ?? t.impacto}</Text> : null}
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.tStatus}>
                      <Text style={[styles.badge, { color: sc.cor, backgroundColor: sc.bg }]}>{sc.label}</Text>
                    </View>
                    <View style={styles.tResp}>
                      <Text style={styles.respNome}>{t.responsavelStakeholder ? t.responsavelStakeholder.nome : "—"}</Text>
                      {t.responsavelStakeholder?.empresa ? <Text style={styles.respEmpresa}>{t.responsavelStakeholder.empresa}</Text> : null}
                    </View>
                    <Text style={[styles.cell, styles.tAcao]}>{t.acao ? (ACAO[t.acao] ?? t.acao) : "—"}</Text>
                    <View style={styles.tDatas}>
                      {t.dataAlvo ? <Text style={styles.dateAlvo}>Alvo {fmtDate(t.dataAlvo)}</Text> : null}
                      {t.dataInfo ? <Text style={styles.dateSub}>Info {fmtDate(t.dataInfo)}</Text> : null}
                      {t.dataFinal ? <Text style={styles.dateSub}>Final {fmtDate(t.dataFinal)}</Text> : null}
                      {!t.dataAlvo && !t.dataInfo && !t.dataFinal ? <Text style={styles.dateSub}>—</Text> : null}
                    </View>
                    <Text style={[styles.cell, styles.tDelta, { color: dd === null ? BER.gray : dd > 0 ? BER.red : BER.green }]}>{dd === null ? "—" : (dd > 0 ? `+${dd}` : dd)}</Text>
                  </View>
                  {t.observacoes ? <Text style={styles.obs}>{t.observacoes}</Text> : null}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.emissao} fixed>
          <Text>Emitido em {geradoEm.toLocaleDateString("pt-BR")} às {geradoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</Text>
          <Text>BER Engenharia · Ata de Reunião</Text>
        </View>
      </Page>
    </Document>
  );
}
