/**
 * PDF da Vistoria de Qualidade (item 12 da aprovação 1-a-1 do Bruno, 10/09/26).
 * Identidade BÈR (guia do Tom 02/09): Montserrat 400/600/700, carvão, cinzas
 * viés oliva, OLIVA como marca, patologia em #B42318, faixa fixa nas págs 2+.
 */
import * as React from 'react';
import path from 'path';
import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';

const FONT_DIR = path.resolve(__dirname, '../../../assets/fonts');
Font.register({
  family: 'Montserrat',
  fonts: [
    { src: path.join(FONT_DIR, 'Montserrat-Regular.ttf'), fontWeight: 400 },
    { src: path.join(FONT_DIR, 'Montserrat-SemiBold.ttf'), fontWeight: 600 },
    { src: path.join(FONT_DIR, 'Montserrat-Bold.ttf'), fontWeight: 700 },
  ],
});

const CARVAO = '#1E1E22';
const GRAY = '#5C5E54';
const GRAY_LIGHT = '#8B8D82';
const LINE = '#E4E6DA';
const RED = '#B42318';
const OFFWHITE = '#F7F7F5';
const CREME = '#F4F1E8';
const OLIVA = '#B5B820';
const OLIVA_DARK = '#5E6B0F';

const s = StyleSheet.create({
  page: { padding: 42, paddingBottom: 56, fontSize: 9, color: CARVAO, fontFamily: 'Montserrat', fontWeight: 400, lineHeight: 1.45 },
  bandFixed: { position: 'absolute', top: 14, left: 42, right: 42 },
  bandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 4, borderBottomWidth: 1.5, borderBottomColor: OLIVA },
  bandObra: { fontSize: 7, color: GRAY_LIGHT, fontWeight: 600 },
  bandMarca: { fontSize: 7, color: OLIVA_DARK, fontWeight: 700, letterSpacing: 1.2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 10, borderBottomWidth: 2.5, borderBottomColor: OLIVA, marginBottom: 14 },
  kicker: { fontSize: 6.5, fontWeight: 600, letterSpacing: 1.6, color: GRAY_LIGHT, textTransform: 'uppercase', marginBottom: 3 },
  obraNome: { fontSize: 18, fontWeight: 700, color: CARVAO, lineHeight: 1.1 },
  logotipo: { fontSize: 13, fontWeight: 700, letterSpacing: 1.6, color: OLIVA_DARK, textAlign: 'right', lineHeight: 1.15 },
  meta: { fontSize: 8, color: GRAY, marginTop: 2 },
  notaCard: { backgroundColor: CREME, borderLeftWidth: 3, borderLeftColor: OLIVA, padding: 12, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notaValor: { fontSize: 26, fontWeight: 700, color: OLIVA_DARK },
  notaLabel: { fontSize: 8, fontWeight: 600, color: GRAY, textTransform: 'uppercase', letterSpacing: 1 },
  secao: { fontSize: 10, fontWeight: 700, color: OLIVA_DARK, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 12, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: LINE },
  th: { fontSize: 7, fontWeight: 600, color: GRAY_LIGHT, textTransform: 'uppercase', letterSpacing: 0.8 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 3.5 },
  cNome: { flex: 3 }, cNum: { flex: 1, textAlign: 'right' },
  pend: { backgroundColor: OFFWHITE, borderLeftWidth: 2.5, borderLeftColor: RED, padding: 8, marginBottom: 6 },
  pendTexto: { fontSize: 9, fontWeight: 600, color: CARVAO },
  pendObs: { fontSize: 8, color: RED, marginTop: 2 },
  pendFoto: { width: 160, height: 110, objectFit: 'cover', marginTop: 5, borderRadius: 2 },
  rodape: { position: 'absolute', bottom: 20, left: 42, right: 42, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: LINE, paddingTop: 5 },
  rodapeTxt: { fontSize: 6.5, color: GRAY_LIGHT },
});

const fmtBR = (d: Date | string) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
const nota = (n: unknown) => Number(n).toFixed(2).replace('.', ',');

const CLASSIF: Record<string, string> = {
  excelente: 'Excelente', boa: 'Boa conformidade', regular: 'Regular', critico: 'Crítico', inaceitavel: 'Inaceitável',
};

export interface VistoriaPdfData {
  obraNome: string;
  data: Date;
  vistoriador: string | null;
  cienciaNome: string | null;
  notaFinal: unknown;
  classificacao: string;
  resumo: { key: string; nome: string; peso: number; sim: number; nao: number; na: number; nota: number | null }[];
  atividades: { titulo: string; trecho?: string | null; projetoDisciplina?: string | null }[];
  observacoes: string | null;
  pendencias: { itemKey: string; texto: string; observacao: string | null; fotoUrl: string | null; resolvido: boolean }[];
}

export function VistoriaPdf({ d }: { d: VistoriaPdfData }) {
  const abertas = d.pendencias.filter((p) => !p.resolvido);
  return (
    <Document title={`Vistoria de Qualidade — ${d.obraNome}`} author="BÈR Engenharia">
      <Page size="A4" style={s.page}>
        <View style={s.bandFixed} fixed render={({ pageNumber }) => (pageNumber > 1 ? (
          <View style={s.bandRow}>
            <Text style={s.bandObra}>{d.obraNome} · Vistoria de Qualidade · {fmtBR(d.data)}</Text>
            <Text style={s.bandMarca}>BÈR ENGENHARIA</Text>
          </View>
        ) : null)} />

        <View style={s.header}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={s.kicker}>Vistoria de Qualidade</Text>
            <Text style={s.obraNome}>{d.obraNome}</Text>
            <Text style={s.meta}>
              {fmtBR(d.data)}{d.vistoriador ? ` · vistoriada por ${d.vistoriador}` : ''}{d.cienciaNome ? ` · acompanhada por ${d.cienciaNome}` : ''}
            </Text>
          </View>
          <View>
            <Text style={s.logotipo}>BÈR{'\n'}ENGENHARIA</Text>
          </View>
        </View>

        <View style={s.notaCard}>
          <View>
            <Text style={s.notaLabel}>Nota da vistoria</Text>
            <Text style={s.notaValor}>{nota(d.notaFinal)} / 5</Text>
          </View>
          <Text style={{ fontSize: 12, fontWeight: 700, color: d.classificacao === 'critico' || d.classificacao === 'inaceitavel' ? RED : OLIVA_DARK }}>
            {CLASSIF[d.classificacao] ?? d.classificacao}
          </Text>
        </View>

        <Text style={s.secao}>Resultado por categoria</Text>
        <View style={[s.row, { borderBottomColor: OLIVA, borderBottomWidth: 1 }]}>
          <Text style={[s.th, s.cNome]}>Categoria</Text>
          <Text style={[s.th, s.cNum]}>Peso</Text>
          <Text style={[s.th, s.cNum]}>Sim</Text>
          <Text style={[s.th, s.cNum]}>Não</Text>
          <Text style={[s.th, s.cNum]}>N/A</Text>
          <Text style={[s.th, s.cNum]}>Nota</Text>
        </View>
        {d.resumo.map((c) => (
          <View key={c.key} style={s.row}>
            <Text style={s.cNome}>{c.nome}</Text>
            <Text style={s.cNum}>{Math.round(c.peso * 100)}%</Text>
            <Text style={s.cNum}>{c.sim}</Text>
            <Text style={[s.cNum, c.nao > 0 ? { color: RED, fontWeight: 600 } : {}]}>{c.nao}</Text>
            <Text style={s.cNum}>{c.na}</Text>
            <Text style={[s.cNum, { fontWeight: 700 }]}>{c.nota === null ? '—' : nota(c.nota)}</Text>
          </View>
        ))}

        {d.atividades.length > 0 && (
          <>
            <Text style={s.secao}>Atividades em execução no momento</Text>
            {d.atividades.map((a, i) => (
              <Text key={i} style={{ fontSize: 8.5, marginBottom: 2 }}>
                • {a.titulo}{a.trecho ? ` — ${a.trecho}` : ''}{a.projetoDisciplina ? `  (projeto: ${a.projetoDisciplina})` : ''}
              </Text>
            ))}
          </>
        )}

        {abertas.length > 0 && (
          <>
            <Text style={s.secao}>Pendências ({abertas.length})</Text>
            {abertas.map((p, i) => (
              <View key={i} style={s.pend} wrap={false}>
                <Text style={s.pendTexto}>{p.itemKey} · {p.texto}</Text>
                {p.observacao ? <Text style={s.pendObs}>{p.observacao}</Text> : null}
                {p.fotoUrl ? <Image src={p.fotoUrl} style={s.pendFoto} /> : null}
              </View>
            ))}
          </>
        )}

        {d.observacoes ? (
          <>
            <Text style={s.secao}>Observações gerais</Text>
            <Text style={{ fontSize: 9 }}>{d.observacoes}</Text>
          </>
        ) : null}

        <View style={s.rodape} fixed>
          <Text style={s.rodapeTxt}>BÈR Engenharia · Excelência Operacional · Vistoria de Qualidade</Text>
          <Text style={s.rodapeTxt} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
