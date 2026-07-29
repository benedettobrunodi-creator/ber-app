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

const STATUS: Record<string, { label: string; cor: string; bg: string; rank: number }> = {
  atrasado:     { label: "Atrasado",     cor: "#b91c1c", bg: "#fee2e2", rank: 0 },
  em_andamento: { label: "Em andamento", cor: "#1d4ed8", bg: "#dbeafe", rank: 1 },
  concluido:    { label: "Concluído",    cor: "#15803d", bg: "#dcfce7", rank: 2 },
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
  page: { paddingTop: 32, paddingBottom: 40, paddingHorizontal: 32, fontFamily: "Helvetica", fontSize: 9, color: "#171717" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1pt solid #e5e5e5", paddingBottom: 8, marginBottom: 12 },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#111" },
  brandSub: { fontSize: 7, color: "#737373", marginTop: 1, letterSpacing: 0.5 },
  docTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "right" },
  docMeta: { fontSize: 8, color: "#737373", textAlign: "right", marginTop: 2 },

  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#737373", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 14, marginBottom: 5 },

  infoGrid: { flexDirection: "row", flexWrap: "wrap" },
  infoCell: { width: "50%", flexDirection: "row", paddingVertical: 2 },
  infoLabel: { width: 78, fontSize: 8, color: "#737373" },
  infoValue: { flex: 1, fontSize: 9, paddingRight: 8 },

  tableHeader: { flexDirection: "row", backgroundColor: "#f5f5f5", borderBottom: "1pt solid #d4d4d4", paddingVertical: 4, paddingHorizontal: 3 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 7, color: "#525252" },
  row: { flexDirection: "row", borderBottom: "0.5pt solid #f0f0f0", paddingVertical: 4, paddingHorizontal: 3 },
  cell: { fontSize: 8, paddingRight: 4 },

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

  disciplina: { fontSize: 7, color: "#737373" },
  temaTxt: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  badge: { fontSize: 7, fontFamily: "Helvetica-Bold", paddingVertical: 1, paddingHorizontal: 3, borderRadius: 2, alignSelf: "flex-start" },
  impactoTxt: { fontSize: 6.5, color: "#737373", marginTop: 1 },
  obs: { fontSize: 7.5, color: "#525252", marginTop: 2, marginLeft: "4%", fontStyle: "italic" },
  co: { fontSize: 6.5, color: "#b45309", fontFamily: "Helvetica-Bold" },
  emissao: { position: "absolute", bottom: 20, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#a3a3a3", borderTop: "0.5pt solid #e5e5e5", paddingTop: 5 },
  empty: { fontSize: 9, color: "#737373", fontStyle: "italic", paddingVertical: 8 },
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
        {/* Cabeçalho */}
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.brand}>BER Engenharia</Text>
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
              <Text style={[styles.th, styles.tDatas]}>INFO / ALVO / FINAL</Text>
              <Text style={[styles.th, styles.tDelta]}>Δ DIAS</Text>
            </View>
            {ordered.map((t, i) => {
              const sc = statusOf(t.status);
              const dd = daysDiff(t.dataAlvo, t.dataFinal);
              return (
                <View key={i} wrap={false}>
                  <View style={styles.row}>
                    <Text style={[styles.cell, styles.tOrdem]}>{i + 1}</Text>
                    <View style={styles.tTema}>
                      {t.disciplina ? <Text style={styles.disciplina}>{t.disciplina}</Text> : null}
                      <Text style={styles.temaTxt}>{t.tema || "—"}</Text>
                      {t.changeOrder ? <Text style={styles.co}>CHANGE ORDER</Text> : null}
                      {t.impacto && t.impacto !== "sem_impacto" ? <Text style={styles.impactoTxt}>Impacto: {IMPACTO[t.impacto] ?? t.impacto}</Text> : null}
                    </View>
                    <View style={styles.tStatus}>
                      <Text style={[styles.badge, { color: sc.cor, backgroundColor: sc.bg }]}>{sc.label}</Text>
                    </View>
                    <Text style={[styles.cell, styles.tResp]}>
                      {t.responsavelStakeholder ? t.responsavelStakeholder.nome : "—"}
                      {t.responsavelStakeholder?.empresa ? `\n${t.responsavelStakeholder.empresa}` : ""}
                    </Text>
                    <Text style={[styles.cell, styles.tAcao]}>{t.acao ? (ACAO[t.acao] ?? t.acao) : "—"}</Text>
                    <Text style={[styles.cell, styles.tDatas]}>{fmtDate(t.dataInfo)} / {fmtDate(t.dataAlvo)} / {fmtDate(t.dataFinal)}</Text>
                    <Text style={[styles.cell, styles.tDelta, { color: dd === null ? "#a3a3a3" : dd > 0 ? "#b91c1c" : "#15803d" }]}>{dd === null ? "—" : dd}</Text>
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
