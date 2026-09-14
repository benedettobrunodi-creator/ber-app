/**
 * Capa do PDF consolidado da Reunião de Engenharia (14/09/26).
 * As páginas seguintes são as atas por obra (AtaPDF), mescladas via pdf-lib,
 * na MESMA ordem dos grupos por responsável listados aqui.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import path from 'path';

const fontsDir = path.resolve(__dirname, '../../../assets/fonts');
try {
  Font.register({
    family: 'Montserrat',
    fonts: [
      { src: path.join(fontsDir, 'Montserrat-Regular.ttf'), fontWeight: 400 },
      { src: path.join(fontsDir, 'Montserrat-SemiBold.ttf'), fontWeight: 600 },
      { src: path.join(fontsDir, 'Montserrat-Bold.ttf'), fontWeight: 700 },
    ],
  });
} catch { /* já registrada */ }

const CARVAO = '#1E1E22';
const OLIVA = '#B5B820';
const OLIVA_DARK = '#5E6B0F';
const GRAY = '#5C5E54';
const LINE = '#E4E6DA';
const CREME = '#F7F7F5';

const s = StyleSheet.create({
  page: { padding: 46, fontSize: 10, color: CARVAO, fontFamily: 'Montserrat', fontWeight: 400, backgroundColor: '#FBFBF9' },
  regua: { width: 30, height: 3, backgroundColor: OLIVA, marginBottom: 6 },
  eyebrow: { fontSize: 8, fontWeight: 700, letterSpacing: 1.6, color: GRAY, textTransform: 'uppercase', marginBottom: 10 },
  h1: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  sub: { fontSize: 11, color: GRAY, marginBottom: 18 },
  bloco: { backgroundColor: CREME, borderLeftWidth: 3, borderLeftColor: OLIVA, padding: 10, marginBottom: 14 },
  blocoTitulo: { fontSize: 8, fontWeight: 700, letterSpacing: 1.2, color: OLIVA_DARK, textTransform: 'uppercase', marginBottom: 4 },
  linha: { fontSize: 10, marginBottom: 2 },
  grupo: { marginBottom: 12 },
  grupoNome: { fontSize: 11, fontWeight: 700, color: OLIVA_DARK, marginBottom: 4, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: LINE },
  obraLinha: { fontSize: 10, marginBottom: 2, paddingLeft: 8 },
  rodape: { position: 'absolute', bottom: 24, left: 46, right: 46, flexDirection: 'row', justifyContent: 'space-between' },
  rodapeTxt: { fontSize: 7, fontWeight: 700, letterSpacing: 1, color: CARVAO },
  rodapeCentro: { fontSize: 6.5, color: GRAY, letterSpacing: 1, textTransform: 'uppercase' },
});

export interface CapaReuniaoProps {
  data: Date;
  status: string;
  participantes: { name: string }[];
  grupos: { coordenador: string; obras: { obraNome: string; totalTopicos: number; engenheiroNome?: string | null }[] }[];
}

export function CapaReuniaoPDF({ data, status, participantes, grupos }: CapaReuniaoProps) {
  const dataFmt = new Date(data).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.regua} />
        <Text style={s.eyebrow}>BÈR Engenharia · Reunião de Engenharia</Text>
        <Text style={s.h1}>Ata consolidada</Text>
        <Text style={s.sub}>{dataFmt}{status === 'encerrada' ? '' : ' · reunião em andamento'}</Text>

        <View style={s.bloco}>
          <Text style={s.blocoTitulo}>Participantes</Text>
          {participantes.length === 0
            ? <Text style={s.linha}>—</Text>
            : participantes.map((p, i) => <Text key={i} style={s.linha}>• {p.name}</Text>)}
        </View>

        <Text style={[s.blocoTitulo, { marginBottom: 8 }]}>Obras por responsável (ordem deste documento)</Text>
        {grupos.map((g, i) => (
          <View key={i} style={s.grupo} wrap={false}>
            <Text style={s.grupoNome}>{g.coordenador}</Text>
            {g.obras.map((o, j) => (
              <Text key={j} style={s.obraLinha}>· {o.obraNome} — {o.totalTopicos} tópico(s){o.engenheiroNome ? ` · Eng. residente: ${o.engenheiroNome}` : ''}</Text>
            ))}
          </View>
        ))}

        <View style={s.rodape} fixed>
          <Text style={s.rodapeTxt}>BÈR</Text>
          <Text style={s.rodapeCentro}>Reunião de Engenharia · Engenharia BÈR</Text>
        </View>
      </Page>
    </Document>
  );
}
