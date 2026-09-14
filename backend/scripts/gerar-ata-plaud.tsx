/**
 * Gerador de ATA DE REUNIÃO padrão BÈR a partir de JSON (14/09/26).
 * Parte do pipeline Plaud: transcrição → ata estruturada (JSON) → PDF marca BÈR.
 * Uso: npx tsx scripts/gerar-ata-plaud.tsx <ata.json> <saida.pdf>
 *
 * Formato do JSON:
 * { titulo, data, local?, participantes: string[], resumo?,
 *   secoes: [{ titulo, pontos: string[], decisoes?: string[] }],
 *   acoes: [{ acao, responsavel?, prazo? }],
 *   pontosAbertos?: string[] }
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer';
import path from 'path';
import fs from 'fs';

const fontsDir = path.resolve(__dirname, '../assets/fonts');
Font.register({
  family: 'Montserrat',
  fonts: [
    { src: path.join(fontsDir, 'Montserrat-Regular.ttf'), fontWeight: 400 },
    { src: path.join(fontsDir, 'Montserrat-SemiBold.ttf'), fontWeight: 600 },
    { src: path.join(fontsDir, 'Montserrat-Bold.ttf'), fontWeight: 700 },
  ],
});

const CARVAO = '#1E1E22';
const OLIVA = '#B5B820';
const OLIVA_DARK = '#5E6B0F';
const GRAY = '#5C5E54';
const GRAY_LIGHT = '#8B8D82';
const LINE = '#E4E6DA';
const CREME = '#F7F7F5';

const s = StyleSheet.create({
  page: { padding: 46, paddingBottom: 58, fontSize: 9.5, color: CARVAO, fontFamily: 'Montserrat', fontWeight: 400, lineHeight: 1.55, backgroundColor: '#FBFBF9' },
  regua: { width: 30, height: 3, backgroundColor: OLIVA, marginBottom: 6 },
  eyebrow: { fontSize: 8, fontWeight: 700, letterSpacing: 1.6, color: GRAY, textTransform: 'uppercase', marginBottom: 8 },
  h1: { fontSize: 18, fontWeight: 700, lineHeight: 1.25, marginBottom: 4 },
  sub: { fontSize: 10, color: GRAY, lineHeight: 1.3, marginBottom: 14 },
  bloco: { backgroundColor: CREME, borderLeftWidth: 3, borderLeftColor: OLIVA, padding: 9, marginBottom: 14 },
  blocoTitulo: { fontSize: 7.5, fontWeight: 700, letterSpacing: 1.2, color: OLIVA_DARK, textTransform: 'uppercase', marginBottom: 3 },
  blocoTxt: { fontSize: 9.5 },
  secTitulo: { fontSize: 10.5, fontWeight: 700, color: OLIVA_DARK, marginTop: 14, marginBottom: 5, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: LINE },
  ponto: { flexDirection: 'row', marginBottom: 3.5 },
  bullet: { width: 12, color: OLIVA_DARK, fontWeight: 700 },
  pontoTxt: { flex: 1, fontSize: 9.5, color: '#3A3A38' },
  decisao: { flexDirection: 'row', backgroundColor: CREME, borderLeftWidth: 3, borderLeftColor: OLIVA_DARK, paddingVertical: 4, paddingHorizontal: 8, marginBottom: 4, marginTop: 2 },
  decisaoLabel: { fontSize: 7, fontWeight: 700, letterSpacing: 1, color: OLIVA_DARK, textTransform: 'uppercase', marginRight: 6, marginTop: 1 },
  decisaoTxt: { flex: 1, fontSize: 9.5, fontWeight: 600 },
  trHead: { flexDirection: 'row', backgroundColor: CARVAO, paddingVertical: 5, paddingHorizontal: 6, marginTop: 4 },
  th: { fontSize: 6.5, fontWeight: 700, color: '#FFFFFF', letterSpacing: 0.8, textTransform: 'uppercase' },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 4.5, paddingHorizontal: 6 },
  trAlt: { backgroundColor: '#F4F1E8' },
  td: { fontSize: 9, color: '#3A3A38' },
  aberto: { flexDirection: 'row', marginBottom: 3.5 },
  abertoBullet: { width: 12, color: '#B42318', fontWeight: 700 },
  rodape: { position: 'absolute', bottom: 24, left: 46, right: 46, flexDirection: 'row', justifyContent: 'space-between' },
  rodapeTxt: { fontSize: 7, fontWeight: 700, letterSpacing: 1, color: CARVAO },
  rodapeCentro: { fontSize: 6.5, color: GRAY_LIGHT, letterSpacing: 1, textTransform: 'uppercase' },
  rodapePag: { fontSize: 7, fontWeight: 700, color: OLIVA_DARK },
});

interface Ata {
  titulo: string;
  data: string;
  local?: string | null;
  participantes: string[];
  resumo?: string | null;
  secoes: { titulo: string; pontos: string[]; decisoes?: string[] }[];
  acoes: { acao: string; responsavel?: string | null; prazo?: string | null }[];
  pontosAbertos?: string[];
}

function AtaPDF({ ata }: { ata: Ata }) {
  const dataFmt = new Date(ata.data).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <View style={s.regua} />
        <Text style={s.eyebrow}>BÈR Engenharia · Ata de Reunião</Text>
        <Text style={s.h1}>{ata.titulo}</Text>
        <Text style={s.sub}>{dataFmt}{ata.local ? ` · ${ata.local}` : ''}</Text>

        <View style={s.bloco} wrap={false}>
          <Text style={s.blocoTitulo}>Participantes</Text>
          <Text style={s.blocoTxt}>{ata.participantes.join(' · ')}</Text>
        </View>

        {ata.resumo ? (
          <View style={s.bloco} wrap={false}>
            <Text style={s.blocoTitulo}>Resumo executivo</Text>
            <Text style={s.blocoTxt}>{ata.resumo}</Text>
          </View>
        ) : null}

        {ata.secoes.map((sec, i) => (
          <View key={i}>
            <Text style={s.secTitulo}>{i + 1}. {sec.titulo}</Text>
            {sec.pontos.map((p, j) => (
              <View key={j} style={s.ponto} wrap={false}>
                <Text style={s.bullet}>·</Text>
                <Text style={s.pontoTxt}>{p}</Text>
              </View>
            ))}
            {(sec.decisoes ?? []).map((d, j) => (
              <View key={`d${j}`} style={s.decisao} wrap={false}>
                <Text style={s.decisaoLabel}>Decisão</Text>
                <Text style={s.decisaoTxt}>{d}</Text>
              </View>
            ))}
          </View>
        ))}

        {ata.acoes.length > 0 && (
          <View>
            <Text style={s.secTitulo}>Ações e próximos passos ({ata.acoes.length})</Text>
            <View style={s.trHead} wrap={false}>
              <Text style={[s.th, { flex: 2.4, paddingRight: 6 }]}>Ação</Text>
              <Text style={[s.th, { flex: 0.8, paddingRight: 6 }]}>Responsável</Text>
              <Text style={[s.th, { flex: 0.5 }]}>Prazo</Text>
            </View>
            {ata.acoes.map((a, i) => (
              <View key={i} style={[s.tr, ...(i % 2 ? [s.trAlt] : [])]} wrap={false}>
                <Text style={[s.td, { flex: 2.4, paddingRight: 6 }]}>{a.acao}</Text>
                <Text style={[s.td, { flex: 0.8, paddingRight: 6 }]}>{a.responsavel ?? 'a definir'}</Text>
                <Text style={[s.td, { flex: 0.5 }]}>{a.prazo ?? '—'}</Text>
              </View>
            ))}
          </View>
        )}

        {(ata.pontosAbertos ?? []).length > 0 && (
          <View>
            <Text style={s.secTitulo}>Pontos em aberto (atenção)</Text>
            {ata.pontosAbertos!.map((p, i) => (
              <View key={i} style={s.aberto} wrap={false}>
                <Text style={s.abertoBullet}>!</Text>
                <Text style={s.pontoTxt}>{p}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.rodape} fixed>
          <Text style={s.rodapeTxt}>BÈR</Text>
          <Text style={s.rodapeCentro}>Ata de Reunião · Engenharia BÈR · Cuidado em cada obra</Text>
          <Text style={s.rodapePag} render={({ pageNumber }) => String(pageNumber)} />
        </View>
      </Page>
    </Document>
  );
}

(async () => {
  const [jsonPath, outPath] = process.argv.slice(2);
  if (!jsonPath || !outPath) { console.error('uso: gerar-ata-plaud.tsx <ata.json> <saida.pdf>'); process.exit(1); }
  const ata: Ata = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const buf = await renderToBuffer(<AtaPDF ata={ata} /> as never);
  fs.writeFileSync(outPath, buf);
  console.log('PDF gerado:', outPath, buf.length, 'bytes');
})();
