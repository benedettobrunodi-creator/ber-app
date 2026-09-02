/**
 * PDF do Relatório de Vistoria Fotográfica (Recebimento do Imóvel) —
 * identidade visual BÈR (mesma linguagem do Relatório Gerencial de Obra):
 * carbono #111827, labels uppercase minúsculos cinza, tipografia pesada,
 * cartões com borda sutil, patologia em vermelho. (redesign 02/09/26 após
 * feedback do Bruno — v1 copiava o Word azul antigo)
 */
import * as React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

const CARBON = '#111827';
const GRAY = '#6b7280';
const GRAY_LIGHT = '#9ca3af';
const LINE = '#f3f4f6';
const BORDER = '#e5e7eb';
const RED = '#DC2626';
const OFFWHITE = '#F7F7F5';

const s = StyleSheet.create({
  page: { padding: 42, paddingBottom: 56, fontSize: 9, color: CARBON, fontFamily: 'Helvetica', lineHeight: 1.45 },

  // Cabeçalho — padrão do Relatório Gerencial
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: CARBON, marginBottom: 16 },
  kicker: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.6, color: GRAY_LIGHT, textTransform: 'uppercase', marginBottom: 3 },
  obraNome: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: CARBON, lineHeight: 1.1 },
  cliente: { fontSize: 10, color: GRAY, marginTop: 2 },
  logotipo: { fontSize: 22, fontFamily: 'Helvetica-Bold', letterSpacing: 2, color: CARBON, textAlign: 'right', lineHeight: 1 },
  tagline: { fontSize: 5.5, letterSpacing: 1.2, color: GRAY_LIGHT, textTransform: 'uppercase', marginTop: 4, textAlign: 'right' },
  dataHeader: { fontSize: 8, color: GRAY, marginTop: 6, textAlign: 'right' },

  sectionTitle: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.6, color: GRAY_LIGHT, textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 3, marginBottom: 8, marginTop: 14 },

  // Dados gerais — cartões kpi-style
  dadosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dadoCard: { borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 8, flexGrow: 1, flexBasis: '30%' },
  dadoCardWide: { borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 8, width: '100%' },
  dadoLabel: { fontSize: 6, fontFamily: 'Helvetica-Bold', letterSpacing: 1, color: GRAY_LIGHT, textTransform: 'uppercase', marginBottom: 2 },
  dadoValor: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: CARBON },

  objetivo: { fontSize: 9, color: GRAY, lineHeight: 1.55 },

  // Ambiente
  ambienteHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 8 },
  ambienteNum: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: GRAY_LIGHT },
  ambienteNome: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: CARBON, textTransform: 'uppercase', letterSpacing: 0.5 },
  ambienteLinha: { flex: 1, height: 1, backgroundColor: LINE },

  // Fotos
  fotoRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  fotoCol: { width: '48.5%' },
  fotoImg: { width: '100%', height: 148, objectFit: 'cover', borderRadius: 6 },
  legendaBox: { marginTop: 4, paddingLeft: 7, borderLeftWidth: 2, borderLeftColor: BORDER },
  legendaBoxPat: { marginTop: 4, paddingLeft: 7, borderLeftWidth: 2, borderLeftColor: RED },
  fotoNum: { fontSize: 6, fontFamily: 'Helvetica-Bold', letterSpacing: 1, color: GRAY_LIGHT, textTransform: 'uppercase' },
  legendaTexto: { fontSize: 8.5, color: CARBON, marginTop: 1.5, lineHeight: 1.4 },
  patologiaTag: { fontSize: 6, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8, color: RED, textTransform: 'uppercase' },

  // Assinatura + rodapé
  assinatura: { marginTop: 34, paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER, width: 220 },
  assinaturaNome: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: CARBON },
  assinaturaCargo: { fontSize: 7, color: GRAY, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  footer: { position: 'absolute', bottom: 24, left: 42, right: 42, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 },
  footerText: { fontSize: 6.5, color: GRAY_LIGHT, letterSpacing: 1, textTransform: 'uppercase' },
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
      {/* Cabeçalho */}
      <View style={s.header} fixed={false}>
        <View style={{ maxWidth: '68%' }}>
          <Text style={s.kicker}>Relatório de Vistoria Fotográfica</Text>
          <Text style={{ ...s.kicker, marginBottom: 4 }}>Registro das Condições Existentes</Text>
          <Text style={s.obraNome}>{obraNome}</Text>
          {(cliente || obraTipo) ? <Text style={s.cliente}>{[cliente, obraTipo].filter(Boolean).join(' · ')}</Text> : null}
        </View>
        <View style={{ width: 130, alignItems: 'flex-end' }}>
          <Text style={s.logotipo}>BÈR</Text>
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
