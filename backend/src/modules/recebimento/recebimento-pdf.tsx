/**
 * PDF do Relatório de Vistoria Fotográfica (Recebimento do Imóvel) —
 * replica o modelo BÈR (606.26): dados gerais, objetivo, registro
 * fotográfico em grade 2 colunas por ambiente (numeração X.Y), assinatura RT.
 */
import * as React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

const AZUL = '#1F4E79';
const CINZA = '#4B5563';
const BORDA = '#D1D5DB';
const FUNDO_LINHA = '#F3F4F6';

const s = StyleSheet.create({
  page: { padding: 46, fontSize: 10, color: '#111827', fontFamily: 'Helvetica', lineHeight: 1.45 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  logo: { fontSize: 26, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginRight: 18 },
  titulo: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: AZUL },
  subtitulo: { textAlign: 'center', fontSize: 11, color: CINZA, marginTop: 6, marginBottom: 16, fontFamily: 'Helvetica-Oblique' },
  secao: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: AZUL, marginTop: 14, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 2, borderBottomColor: '#111827' },
  tabela: { borderWidth: 1, borderColor: BORDA },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDA },
  th: { width: '38%', padding: 6, fontFamily: 'Helvetica-Bold', backgroundColor: FUNDO_LINHA },
  td: { width: '62%', padding: 6 },
  objetivo: { fontFamily: 'Helvetica-Bold', marginTop: 4 },
  fotoRow: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  fotoCol: { width: '48%' },
  fotoImg: { width: '100%', height: 150, objectFit: 'cover', borderWidth: 1, borderColor: BORDA },
  legenda: { backgroundColor: FUNDO_LINHA, padding: 6, marginTop: 4, fontSize: 9 },
  legendaTitulo: { fontFamily: 'Helvetica-Bold', color: AZUL },
  legendaPatologia: { color: '#B91C1C' },
  assinatura: { marginTop: 40 },
  assinaturaNome: { color: CINZA },
  assinaturaCargo: { fontFamily: 'Helvetica-Bold', marginTop: 2 },
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

/** Quebra a lista de fotos em pares (grade de 2 colunas). */
function pares<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2));
  return out;
}

export const RecebimentoPDF = ({ obraNome, obraTipo, endereco, cliente, responsavel, dataVistoria, objetivo, ambientes }: RecebimentoPdfProps) => (
  <Document title={`Relatório de Vistoria Fotográfica — ${obraNome}`} author="BÈR Engenharia">
    <Page size="A4" style={s.page}>
      <View style={s.headerRow}>
        <Text style={s.logo}>BÈR</Text>
        <Text style={s.titulo}>RELATÓRIO DE VISTORIA FOTOGRÁFICA</Text>
      </View>
      <Text style={s.subtitulo}>Registro das Condições Existentes</Text>

      <Text style={s.secao}>1. DADOS GERAIS DO EMPREENDIMENTO</Text>
      <View style={s.tabela}>
        <View style={s.tr}><Text style={s.th}>Obra:</Text><Text style={s.td}>{obraNome}{obraTipo ? ` — ${obraTipo}` : ''}</Text></View>
        <View style={s.tr}><Text style={s.th}>Endereço Completo:</Text><Text style={s.td}>{endereco ?? '—'}</Text></View>
        <View style={s.tr}><Text style={s.th}>Proprietário / Cliente:</Text><Text style={s.td}>{cliente ?? '—'}</Text></View>
        <View style={s.tr}><Text style={s.th}>Responsável Técnico:</Text><Text style={s.td}>{responsavel ?? '—'}</Text></View>
        <View style={{ ...s.tr, borderBottomWidth: 0 }}><Text style={s.th}>Data da Vistoria:</Text><Text style={s.td}>{fmtBR(dataVistoria)}</Text></View>
      </View>

      <Text style={s.secao}>2. OBJETIVO DO RELATÓRIO</Text>
      <Text style={s.objetivo}>{objetivo ?? ''}</Text>

      <Text style={s.secao}>3. REGISTRO FOTOGRÁFICO DE CAMPO</Text>
      {ambientes.map((amb, ai) => (
        <View key={ai}>
          {pares(amb.fotos).map((par, pi) => (
            <View key={pi} style={s.fotoRow} wrap={false}>
              {par.map((foto, fi) => {
                const idx = pi * 2 + fi;
                const num = `${ai + 1}.${idx}`;
                return (
                  <View key={fi} style={s.fotoCol}>
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image src={foto.url} style={s.fotoImg} />
                    <View style={s.legenda}>
                      <Text>
                        <Text style={s.legendaTitulo}>Foto {num}: {amb.nome}. </Text>
                        {foto.legenda ? (
                          <Text style={foto.patologia ? s.legendaPatologia : undefined}>{foto.legenda}</Text>
                        ) : null}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      ))}

      <View style={s.assinatura} wrap={false}>
        <Text style={s.assinaturaNome}>{responsavel ?? ''}</Text>
        <Text style={s.assinaturaCargo}>Responsável Técnico</Text>
      </View>
    </Page>
  </Document>
);
