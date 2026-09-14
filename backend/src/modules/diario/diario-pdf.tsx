/**
 * PDF do Diário de Obra (14/09/26) — vai ANEXO no e-mail ao cliente no lugar
 * do link (pedido do Bruno: destinatário externo não tem login no app).
 * Conteúdo CLIENTE-FACING: avanço, clima, atividades, efetivo agregado,
 * observações ao cliente e registro fotográfico. Ocorrências/materiais/
 * equipamentos são internos e ficam de fora.
 */
import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';
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
const GRAY_LIGHT = '#8B8D82';
const LINE = '#E4E6DA';
const CREME = '#F7F7F5';

const s = StyleSheet.create({
  page: { padding: 46, paddingBottom: 58, fontSize: 9.5, color: CARVAO, fontFamily: 'Montserrat', fontWeight: 400, lineHeight: 1.5, backgroundColor: '#FBFBF9' },
  regua: { width: 30, height: 3, backgroundColor: OLIVA, marginBottom: 6 },
  eyebrow: { fontSize: 8, fontWeight: 700, letterSpacing: 1.6, color: GRAY, textTransform: 'uppercase', marginBottom: 8 },
  h1: { fontSize: 19, fontWeight: 700, marginBottom: 2 },
  sub: { fontSize: 10.5, color: GRAY, marginBottom: 14 },
  cards: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  card: { flex: 1, backgroundColor: CREME, borderLeftWidth: 3, borderLeftColor: OLIVA, padding: 8 },
  cardLabel: { fontSize: 7, fontWeight: 700, letterSpacing: 1, color: OLIVA_DARK, textTransform: 'uppercase', marginBottom: 2 },
  cardValor: { fontSize: 12, fontWeight: 700 },
  secTitulo: { fontSize: 8.5, fontWeight: 700, letterSpacing: 1.2, color: OLIVA_DARK, textTransform: 'uppercase', marginTop: 12, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: LINE },
  linha: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: LINE },
  atividadeTxt: { flex: 1, paddingRight: 8 },
  statusTag: { fontSize: 7.5, fontWeight: 700, color: GRAY },
  p: { fontSize: 9.5, color: '#3A3A38', marginBottom: 4 },
  fotosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  fotoBox: { width: '48.5%' },
  foto: { width: '100%', height: 170, objectFit: 'cover', borderRadius: 4 },
  fotoLegenda: { fontSize: 7.5, color: GRAY_LIGHT, marginTop: 2 },
  rodape: { position: 'absolute', bottom: 24, left: 46, right: 46, flexDirection: 'row', justifyContent: 'space-between' },
  rodapeTxt: { fontSize: 7, fontWeight: 700, letterSpacing: 1, color: CARVAO },
  rodapeCentro: { fontSize: 6.5, color: GRAY_LIGHT, letterSpacing: 1, textTransform: 'uppercase' },
});

const CLIMA_LABEL: Record<string, string> = { sol: 'Sol', nublado: 'Nublado', chuva: 'Chuva', chuva_forte: 'Chuva forte' };
const COND_LABEL: Record<string, string> = { praticavel: 'Praticável', impraticavel: 'Impraticável', parcial: 'Parcial' };
const ATIV_STATUS: Record<string, string> = { concluida: 'Concluída', em_andamento: 'Em andamento', paralisada: 'Paralisada' };

export interface DiarioPdfProps {
  obraNome: string;
  data: Date | string;
  clima?: string | null;
  condicaoTrabalho?: string | null;
  avancoDia?: number | string | null;
  observacoesCliente?: string | null;
  atividades: { descricao: string; status: string }[];
  efetivo: { funcao?: string | null; categoria?: string | null; quantidade: number; nome?: string | null }[];
  fotos: { fileUrl: string; legenda?: string | null; ambiente?: string | null }[];
}

export function DiarioPDF(p: DiarioPdfProps) {
  const dataFmt = new Date(p.data).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const totalEfetivo = p.efetivo.reduce((acc, e) => acc + (e.quantidade || 1), 0);
  const efetivoPorFuncao = new Map<string, number>();
  for (const e of p.efetivo) {
    const k = e.funcao || e.categoria || 'Equipe';
    efetivoPorFuncao.set(k, (efetivoPorFuncao.get(k) ?? 0) + (e.quantidade || 1));
  }
  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <View style={s.regua} />
        <Text style={s.eyebrow}>BÈR Engenharia · Diário de Obra</Text>
        <Text style={s.h1}>{p.obraNome}</Text>
        <Text style={s.sub}>{dataFmt}</Text>

        <View style={s.cards}>
          {p.avancoDia != null && (
            <View style={s.card}>
              <Text style={s.cardLabel}>Avanço do dia</Text>
              <Text style={s.cardValor}>{Number(p.avancoDia).toLocaleString('pt-BR')}%</Text>
            </View>
          )}
          {p.clima && (
            <View style={s.card}>
              <Text style={s.cardLabel}>Clima</Text>
              <Text style={s.cardValor}>{CLIMA_LABEL[p.clima] ?? p.clima}</Text>
            </View>
          )}
          {p.condicaoTrabalho && (
            <View style={s.card}>
              <Text style={s.cardLabel}>Condição de trabalho</Text>
              <Text style={s.cardValor}>{COND_LABEL[p.condicaoTrabalho] ?? p.condicaoTrabalho}</Text>
            </View>
          )}
          {totalEfetivo > 0 && (
            <View style={s.card}>
              <Text style={s.cardLabel}>Efetivo em campo</Text>
              <Text style={s.cardValor}>{totalEfetivo} pessoa(s)</Text>
            </View>
          )}
        </View>

        {p.observacoesCliente ? (
          <View>
            <Text style={s.secTitulo}>Resumo do dia</Text>
            <Text style={s.p}>{p.observacoesCliente}</Text>
          </View>
        ) : null}

        {p.atividades.length > 0 && (
          <View>
            <Text style={s.secTitulo}>Atividades executadas ({p.atividades.length})</Text>
            {p.atividades.map((a, i) => (
              <View key={i} style={s.linha} wrap={false}>
                <Text style={s.atividadeTxt}>{a.descricao}</Text>
                <Text style={s.statusTag}>{ATIV_STATUS[a.status] ?? a.status}</Text>
              </View>
            ))}
          </View>
        )}

        {efetivoPorFuncao.size > 0 && (
          <View>
            <Text style={s.secTitulo}>Efetivo</Text>
            {Array.from(efetivoPorFuncao.entries()).map(([funcao, qtd], i) => (
              <View key={i} style={s.linha} wrap={false}>
                <Text style={s.atividadeTxt}>{funcao}</Text>
                <Text style={s.statusTag}>{qtd}</Text>
              </View>
            ))}
          </View>
        )}

        {p.fotos.length > 0 && (
          <View>
            <Text style={s.secTitulo}>Registro fotográfico ({p.fotos.length})</Text>
            <View style={s.fotosGrid}>
              {p.fotos.map((f, i) => (
                <View key={i} style={s.fotoBox} wrap={false}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image src={f.fileUrl} style={s.foto} />
                  {(f.legenda || f.ambiente) && <Text style={s.fotoLegenda}>{[f.ambiente, f.legenda].filter(Boolean).join(' — ')}</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={s.rodape} fixed>
          <Text style={s.rodapeTxt}>BÈR</Text>
          <Text style={s.rodapeCentro}>Diário de Obra · Engenharia BÈR</Text>
        </View>
      </Page>
    </Document>
  );
}
