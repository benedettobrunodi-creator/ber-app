/**
 * PDF do Relatório de Vistoria Fotográfica (Recebimento do Imóvel) —
 * identidade visual BÈR com direção de arte do Tom (02/09/26):
 * Montserrat (400/600/700), carvão #1E1E22, cinzas de viés oliva,
 * OLIVA #B5B820 como cor de marca (réguas, cards, seções, rodapé),
 * faixa de marca fixa nas páginas 2+, patologia em #B42318.
 */
import * as React from 'react';
import path from 'path';
import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';

// Fontes oficiais BÈR — TTFs versionados em backend/assets/fonts
const FONT_DIR = path.resolve(__dirname, '../../../assets/fonts');
Font.register({
  family: 'Montserrat',
  fonts: [
    { src: path.join(FONT_DIR, 'Montserrat-Regular.ttf'), fontWeight: 400 },
    { src: path.join(FONT_DIR, 'Montserrat-SemiBold.ttf'), fontWeight: 600 },
    { src: path.join(FONT_DIR, 'Montserrat-Bold.ttf'), fontWeight: 700 },
  ],
});

// Paleta BÈR (Tom, 02/09/26)
const CARVAO = '#1E1E22';
const GRAY = '#5C5E54';
const GRAY_LIGHT = '#8B8D82';
const LINE = '#E4E6DA';
const BORDER = '#D4D6CA';
const RED = '#B42318';
const OFFWHITE = '#F7F7F5';
const OLIVA = '#B5B820';
const OLIVA_DARK = '#5E6B0F';

const s = StyleSheet.create({
  page: { padding: 42, paddingBottom: 56, fontSize: 9, color: CARVAO, fontFamily: 'Montserrat', fontWeight: 400, lineHeight: 1.45 },

  // Faixa de marca fixa (páginas 2+)
  bandFixed: { position: 'absolute', top: 14, left: 42, right: 42 },
  bandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 4, borderBottomWidth: 1.5, borderBottomColor: OLIVA },
  bandObra: { fontSize: 7, color: GRAY_LIGHT, fontWeight: 600 },
  bandMarca: { fontSize: 7, color: OLIVA_DARK, fontWeight: 700, letterSpacing: 1.2 },

  // Cabeçalho — página 1
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 10, borderBottomWidth: 2.5, borderBottomColor: OLIVA, marginBottom: 16 },
  kicker: { fontSize: 6.5, fontWeight: 600, letterSpacing: 1.6, color: GRAY_LIGHT, textTransform: 'uppercase', marginBottom: 3 },
  obraNome: { fontSize: 19, fontWeight: 700, color: CARVAO, lineHeight: 1.1 },
  cliente: { fontSize: 10, color: GRAY, marginTop: 2 },
  logotipo: { fontSize: 13, fontWeight: 700, letterSpacing: 1.6, color: OLIVA_DARK, textAlign: 'right', lineHeight: 1.15 },
  tagline: { fontSize: 5.5, fontWeight: 600, letterSpacing: 1.2, color: GRAY_LIGHT, textTransform: 'uppercase', marginTop: 4, textAlign: 'right' },
  dataHeader: { fontSize: 8, color: GRAY, marginTop: 6, textAlign: 'right' },

  sectionTitle: { fontSize: 6.5, fontWeight: 600, letterSpacing: 1.6, color: OLIVA_DARK, textTransform: 'uppercase', borderBottomWidth: 1.5, borderBottomColor: OLIVA, paddingBottom: 3, marginBottom: 8, marginTop: 14 },

  // Dados gerais — cartões com fundo creme + barra oliva
  dadosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dadoCard: { backgroundColor: OFFWHITE, borderLeftWidth: 3, borderLeftColor: OLIVA, borderRadius: 4, padding: 8, flexGrow: 1, flexBasis: '30%' },
  dadoCardWide: { backgroundColor: OFFWHITE, borderLeftWidth: 3, borderLeftColor: OLIVA, borderRadius: 4, padding: 8, width: '100%' },
  dadoLabel: { fontSize: 6, fontWeight: 600, letterSpacing: 1, color: OLIVA_DARK, textTransform: 'uppercase', marginBottom: 2 },
  dadoValor: { fontSize: 10, fontWeight: 700, color: CARVAO },

  objetivo: { fontSize: 9, color: GRAY, lineHeight: 1.55 },

  // Ambiente
  ambienteHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 8 },
  ambienteNum: { fontSize: 10, fontWeight: 700, color: OLIVA_DARK },
  ambienteNome: { fontSize: 11, fontWeight: 700, color: CARVAO, textTransform: 'uppercase', letterSpacing: 0.5 },
  ambienteLinha: { flex: 1, height: 1.5, backgroundColor: OLIVA },

  // Fotos
  fotoRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  fotoCol: { width: '48.5%' },
  fotoImg: { width: '100%', height: 148, objectFit: 'cover', borderRadius: 6 },
  legendaBox: { marginTop: 4, paddingLeft: 7, borderLeftWidth: 2, borderLeftColor: OLIVA },
  legendaBoxPat: { marginTop: 4, paddingLeft: 7, borderLeftWidth: 2, borderLeftColor: RED },
  fotoNum: { fontSize: 6, fontWeight: 600, letterSpacing: 1, color: GRAY_LIGHT, textTransform: 'uppercase' },
  legendaTexto: { fontSize: 8.5, color: CARVAO, marginTop: 1.5, lineHeight: 1.4 },
  patologiaTag: { fontSize: 6, fontWeight: 600, letterSpacing: 0.8, color: RED, textTransform: 'uppercase' },

  // Assinatura + rodapé
  assinatura: { marginTop: 34, paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER, width: 220 },
  assinaturaNome: { fontSize: 10, fontWeight: 700, color: CARVAO },
  assinaturaCargo: { fontSize: 7, fontWeight: 600, color: GRAY, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  footer: { position: 'absolute', bottom: 24, left: 42, right: 42, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: OLIVA, paddingTop: 6 },
  footerText: { fontSize: 6.5, fontWeight: 600, color: GRAY_LIGHT, letterSpacing: 1, textTransform: 'uppercase' },
});

export interface RecebimentoPdfProps {
  obraNome: string;
  obraTipo: string | null;
  endereco: string | null;
  cliente: string | null;
  responsavel: string | null;
  dataVistoria: Date | null;
  objetivo: string | null;
  ambientes: { nome: string; fotos: { url: string; legenda: string | null; patologia: boolean }[] }[];
}

const fmtBR = (d: Date | null) => (d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');

function pares<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2));
  return out;
}

export const RecebimentoPDF = ({ obraNome, obraTipo, endereco, cliente, responsavel, dataVistoria, objetivo, ambientes }: RecebimentoPdfProps) => (
  <Document title={`Relatório de Vistoria Fotográfica — ${obraNome}`} author="BÈR Engenharia">
    <Page size="A4" style={s.page}>
      {/* Faixa de marca nas páginas 2+ (fixa; oculta na capa, que tem o cabeçalho completo) */}
      <View
        style={s.bandFixed}
        fixed
        render={({ pageNumber }) => pageNumber > 1 ? (
          <View style={s.bandRow}>
            <Text style={s.bandObra}>{obraNome}</Text>
            <Text style={s.bandMarca}>BÈR ENGENHARIA</Text>
          </View>
        ) : null}
      />

      {/* Cabeçalho — capa */}
      <View style={s.header}>
        <View style={{ maxWidth: '66%' }}>
          <Text style={s.kicker}>Relatório de Vistoria Fotográfica</Text>
          <Text style={{ ...s.kicker, marginBottom: 4 }}>Registro das Condições Existentes</Text>
          <Text style={s.obraNome}>{obraNome}</Text>
          {(cliente || obraTipo) ? <Text style={s.cliente}>{[cliente, obraTipo].filter(Boolean).join(' · ')}</Text> : null}
        </View>
        <View style={{ width: 150, alignItems: 'flex-end' }}>
          <Text style={s.logotipo}>BÈR ENGENHARIA</Text>
          <Text style={s.tagline}>Cuidado em Cada Obra</Text>
          <Text style={s.dataHeader}>{fmtBR(dataVistoria)}</Text>
        </View>
      </View>

      {/* Dados gerais */}
      <Text style={s.sectionTitle}>Dados Gerais do Empreendimento</Text>
      <View style={s.dadosGrid}>
        <View style={s.dadoCardWide}>
          <Text style={s.dadoLabel}>Endereço completo</Text>
          <Text style={s.dadoValor}>{endereco ?? '—'}</Text>
        </View>
        <View style={s.dadoCard}>
          <Text style={s.dadoLabel}>Proprietário / Cliente</Text>
          <Text style={s.dadoValor}>{cliente ?? '—'}</Text>
        </View>
        <View style={s.dadoCard}>
          <Text style={s.dadoLabel}>Responsável Técnico</Text>
          <Text style={s.dadoValor}>{responsavel ?? '—'}</Text>
        </View>
        <View style={s.dadoCard}>
          <Text style={s.dadoLabel}>Data da Vistoria</Text>
          <Text style={s.dadoValor}>{fmtBR(dataVistoria)}</Text>
        </View>
      </View>

      {/* Objetivo */}
      <Text style={s.sectionTitle}>Objetivo do Relatório</Text>
      <Text style={s.objetivo}>{objetivo ?? ''}</Text>

      {/* Registro fotográfico */}
      <Text style={s.sectionTitle}>Registro Fotográfico de Campo</Text>
      {ambientes.map((amb, ai) => (
        <View key={ai}>
          <View style={s.ambienteHeader} wrap={false}>
            <Text style={s.ambienteNum}>{String(ai + 1).padStart(2, '0')}</Text>
            <Text style={s.ambienteNome}>{amb.nome}</Text>
            <View style={s.ambienteLinha} />
          </View>
          {pares(amb.fotos).map((par, pi) => (
            <View key={pi} style={s.fotoRow} wrap={false}>
              {par.map((foto, fi) => {
                const idx = pi * 2 + fi;
                const num = `${ai + 1}.${idx}`;
                return (
                  <View key={fi} style={s.fotoCol}>
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image src={foto.url} style={s.fotoImg} />
                    <View style={foto.patologia ? s.legendaBoxPat : s.legendaBox}>
                      <Text style={s.fotoNum}>
                        Foto {num}
                        {foto.patologia ? <Text style={s.patologiaTag}>   · Patologia</Text> : null}
                      </Text>
                      <Text style={s.legendaTexto}>{foto.legenda ?? ''}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      ))}

      {/* Assinatura */}
      <View style={s.assinatura} wrap={false}>
        <Text style={s.assinaturaNome}>{responsavel ?? ''}</Text>
        <Text style={s.assinaturaCargo}>Responsável Técnico</Text>
      </View>

      {/* Rodapé em todas as páginas */}
      <View style={s.footer} fixed>
        <Text style={s.footerText}>BÈR Engenharia · Excelência Operacional</Text>
        <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  </Document>
);
