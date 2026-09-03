/**
 * Gerador do Manual do Proprietário em PDF (03/09/26) — reproduz o modelo
 * BER_Manual_ObraPoatek_v3 na identidade BÈR (Montserrat, oliva, seções
 * escuras numeradas). Conteúdo padrão vem FIEL do próprio modelo:
 * assets/manual/modelo-poatek-paginas.json (texto integral extraído por
 * página). As seções "Usar e manter" entram conforme os materiais marcados.
 */
import * as React from 'react';
import path from 'path';
import fs from 'fs';
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
Font.registerHyphenationCallback((w) => [w]);

const CARVAO = '#1E1E22';
const ESCURO = '#232323';
const GRAY = '#5C5E54';
const GRAY_LIGHT = '#8B8D82';
const LINE = '#E4E6DA';
const BORDER = '#D4D6CA';
const OFFWHITE = '#F7F7F5';
const CREME = '#F4F1E8';
const OLIVA = '#B5B820';
const OLIVA_DARK = '#5E6B0F';
const OLIVA_ESCURO_BG = '#2E3320';

// ─── Conteúdo padrão (fiel ao modelo) ───────────────────────────────────────
interface PaginaModelo { page: number; lines: string[] }
const PAGINAS: PaginaModelo[] = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../assets/manual/modelo-poatek-paginas.json'), 'utf-8'),
);
const pagina = (n: number) => PAGINAS.find((p) => p.page === n);

/** Páginas "Usar e manter" por material marcado no formulário. */
const USAR_MANTER_POR_MATERIAL: Record<string, number[]> = {
  eletrica: [23, 24],
  hidraulica: [44],
  porcelanato: [25],
  ceramica_azulejo: [26],
  carpete: [27],
  tacos_madeira: [28],
  laminado: [29],
  vinilico: [29, 30],
  forro_gesso: [31],
  forro_madeira: [31],
  forro_acustico: [31, 32],
  laje_aparente: [32],
  pintura_acrilica: [34],
  pintura_cimenticia: [33],
  esquadrias_aluminio: [32, 33],
  portas_pintadas: [38],
  divisorias_vidro: [38],
  vidros: [39],
  marmore_granito: [35],
  pedras_naturais: [37],
  tijolo_aparente: [37],
  rejunte: [36],
  marcenaria: [40],
  metais: [41, 42],
  fechaduras: [43],
  plasticos_resinas: [42],
  eletrodomesticos: [45],
  ar_condicionado: [],
};

// Blocos estáticos sempre presentes
const PG_IMPORTANTE = 22;
const PGS_RESPONSABILIDADES = [9, 10];
const PG_NORMAS = 18;
const PGS_MANUTENCAO = [46, 47, 48, 49, 50, 51];
const PGS_GARANTIA = [53, 54, 55];
const PGS_NAO_COBERTOS = [58, 59, 60, 61];
const PGS_UTILIDADE = [62, 63, 64, 65];
const PGS_PRAZOS_GARANTIA = [67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86];
const PGS_TERMOS = [87, 88];
const PG_CARTAO = 89;
const PG_SOBRE = 6;

// ─── Estilos ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: { padding: 46, paddingBottom: 60, fontSize: 9, color: CARVAO, fontFamily: 'Montserrat', fontWeight: 400, lineHeight: 1.5, backgroundColor: '#FBFBF9' },
  footer: { position: 'absolute', bottom: 22, left: 46, right: 46, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 0, paddingTop: 4 },
  footerMarca: { fontSize: 7, fontWeight: 700, letterSpacing: 1, color: CARVAO },
  footerRegua: { position: 'absolute', bottom: 34, left: 46, width: 26, height: 2.5, backgroundColor: OLIVA },
  footerCentro: { fontSize: 6.5, color: GRAY_LIGHT, letterSpacing: 1, textTransform: 'uppercase' },
  footerPag: { fontSize: 7, fontWeight: 700, color: OLIVA_DARK },

  eyebrowRegua: { width: 30, height: 3, backgroundColor: OLIVA, marginBottom: 5 },
  eyebrow: { fontSize: 7, fontWeight: 700, letterSpacing: 1.6, color: GRAY, textTransform: 'uppercase', marginBottom: 10 },
  kickerNum: { fontSize: 7.5, fontWeight: 700, letterSpacing: 1.4, color: OLIVA_DARK, textTransform: 'uppercase', marginBottom: 2 },
  h1: { fontSize: 22, fontWeight: 700, color: CARVAO, marginBottom: 12, lineHeight: 1.15 },

  p: { fontSize: 9, color: '#3A3A38', marginBottom: 6, lineHeight: 1.55 },
  sub: { fontSize: 10.5, fontWeight: 700, color: CARVAO, marginTop: 10, marginBottom: 4, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: LINE },
  destaque: { backgroundColor: CREME, borderLeftWidth: 3, borderLeftColor: OLIVA, paddingVertical: 4, paddingHorizontal: 8, marginTop: 8, marginBottom: 6 },
  destaqueTxt: { fontSize: 7.5, fontWeight: 700, letterSpacing: 1.2, color: CARVAO, textTransform: 'uppercase' },

  tabela: { marginTop: 8 },
  trHead: { flexDirection: 'row', backgroundColor: CARVAO, paddingVertical: 5, paddingHorizontal: 6 },
  thTxt: { fontSize: 6.5, fontWeight: 700, color: '#FFFFFF', letterSpacing: 0.8, textTransform: 'uppercase' },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 5, paddingHorizontal: 6 },
  trAlt: { backgroundColor: OFFWHITE },
  tdTxt: { fontSize: 7.5, color: '#3A3A38', lineHeight: 1.4 },
  notaTabela: { fontSize: 7, color: GRAY_LIGHT, backgroundColor: OFFWHITE, padding: 5, marginTop: 2 },

  // Seção escura (capas 02..06)
  secPage: { backgroundColor: ESCURO, padding: 56, color: '#FFFFFF', fontFamily: 'Montserrat', position: 'relative' },
  secNum: { position: 'absolute', top: -30, right: 10, fontSize: 190, fontWeight: 700, color: OLIVA, opacity: 0.16 },
  secKicker: { fontSize: 9, fontWeight: 700, letterSpacing: 3, color: OLIVA, marginBottom: 10 },
  secTitulo: { fontSize: 40, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.05 },
  secRegua: { width: 60, height: 4, backgroundColor: OLIVA, marginTop: 16, marginBottom: 18 },
  secDesc: { fontSize: 12, color: '#C9CBC0', lineHeight: 1.5, maxWidth: 380 },

  // Capa
  capaFoto: { width: '100%', height: 380, objectFit: 'cover' },
  capaFotoPlaceholder: { width: '100%', height: 380, backgroundColor: ESCURO },
  capaBody: { padding: 52, paddingTop: 34 },
  capaLogo: { fontSize: 15, fontWeight: 700, letterSpacing: 2, color: CARVAO },
  capaTag: { fontSize: 5.5, fontWeight: 600, letterSpacing: 1.4, color: GRAY_LIGHT, textTransform: 'uppercase', marginTop: 2 },
  capaKicker: { fontSize: 9, fontWeight: 700, letterSpacing: 2.6, color: OLIVA_DARK, textTransform: 'uppercase', marginTop: 26 },
  capaTitulo: { fontSize: 42, fontWeight: 700, color: CARVAO, lineHeight: 1.05, marginTop: 6 },
  capaCliente: { fontSize: 11, fontWeight: 700, color: OLIVA_DARK, marginTop: 14 },
  capaEndereco: { fontSize: 10, color: GRAY, marginTop: 3, lineHeight: 1.5 },
  capaBanner: { backgroundColor: CARVAO, alignSelf: 'flex-start', paddingVertical: 7, paddingHorizontal: 12, marginTop: 22 },
  capaBannerTxt: { fontSize: 8, fontWeight: 700, letterSpacing: 1.4, color: '#FFFFFF', textTransform: 'uppercase' },

  // Galeria
  galFotoFull: { width: '100%', height: 300, objectFit: 'cover', borderRadius: 6 },
  galRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  galCol: { flex: 1 },
  galFotoHalf: { width: '100%', height: 190, objectFit: 'cover', borderRadius: 6 },
  galLegenda: { position: 'absolute', bottom: 8, left: 8, backgroundColor: CARVAO, paddingVertical: 3, paddingHorizontal: 7 },
  galLegendaTxt: { fontSize: 7, fontWeight: 600, color: '#FFFFFF' },

  // Acesso rápido
  arGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  arCard: { width: '47.5%', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 8, padding: 14 },
  arIcone: { width: 26, height: 26, backgroundColor: OLIVA, borderRadius: 6, marginBottom: 8 },
  arTag: { position: 'absolute', top: 10, right: 10, fontSize: 6.5, fontWeight: 700, color: OLIVA_DARK, backgroundColor: CREME, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  arTitulo: { fontSize: 11, fontWeight: 700, color: CARVAO },
  arDesc: { fontSize: 8, color: GRAY, marginTop: 3, lineHeight: 1.45 },
  emergencia: { flexDirection: 'row', backgroundColor: CARVAO, borderRadius: 8, marginTop: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', gap: 22 },
  emergLabel: { fontSize: 8, fontWeight: 700, letterSpacing: 1.6, color: OLIVA },
  emergTitulo: { fontSize: 11, fontWeight: 700, color: '#FFFFFF' },
  emergDesc: { fontSize: 7, color: '#9FA194', marginTop: 1 },
  qrRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  qrCard: { flex: 1, flexDirection: 'row', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 8, padding: 12, alignItems: 'center' },
  qrBox: { width: 40, height: 40, borderWidth: 1.5, borderColor: OLIVA, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  qrBoxTxt: { fontSize: 8, fontWeight: 700, color: OLIVA_DARK },

  // Ficha técnica
  ftGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  ftItem: { width: '50%', paddingRight: 20, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 6 },
  ftLabel: { fontSize: 6.5, fontWeight: 700, letterSpacing: 1, color: OLIVA_DARK, textTransform: 'uppercase', marginBottom: 2 },
  ftValor: { fontSize: 10, fontWeight: 700, color: CARVAO },
  ftSecao: { fontSize: 8, fontWeight: 700, letterSpacing: 1.2, color: OLIVA_DARK, textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  ftPessoa: { fontSize: 9.5, marginBottom: 3 },

  // Memorial (acabamentos)
  memGrupo: { fontSize: 8, fontWeight: 700, letterSpacing: 1.2, color: OLIVA_DARK, textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  memGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memCard: { width: '31.5%', borderWidth: 1, borderColor: LINE, borderRadius: 6, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  memSwatch: { height: 54, position: 'relative' },
  memHex: { position: 'absolute', bottom: 4, right: 4, fontSize: 6, color: '#FFFFFF', backgroundColor: 'rgba(30,30,34,0.55)', paddingVertical: 1, paddingHorizontal: 4, borderRadius: 3 },
  memBody: { padding: 7 },
  memNome: { fontSize: 8.5, fontWeight: 700, color: CARVAO },
  memTipo: { fontSize: 6.5, color: GRAY_LIGHT, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 },

  // Mobiliário
  mobGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  mobCard: { width: '48%', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 10 },
  mobHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 4, marginBottom: 4 },
  mobNome: { fontSize: 8.5, fontWeight: 700, color: CARVAO, flex: 1 },
  mobMedida: { fontSize: 7, fontWeight: 600, color: GRAY_LIGHT },
  mobDesc: { fontSize: 7.5, color: GRAY, lineHeight: 1.4 },

  // Fornecedores
  fornCols: { flexDirection: 'row', gap: 24, marginTop: 10 },
  fornCol: { flex: 1 },
  fornItem: { marginBottom: 10, borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 6 },
  fornCat: { fontSize: 6.5, fontWeight: 700, letterSpacing: 1, color: OLIVA_DARK, textTransform: 'uppercase' },
  fornNome: { fontSize: 9.5, fontWeight: 700, color: CARVAO, marginTop: 1 },
  fornInfo: { fontSize: 7.5, color: GRAY, lineHeight: 1.4 },

  // Projetos
  projDisc: { fontSize: 7.5, fontWeight: 700, color: CARVAO, backgroundColor: CREME, paddingVertical: 4, paddingHorizontal: 6 },
});

// ─── Tipos de dados ─────────────────────────────────────────────────────────
export interface ManualPdfData {
  obra: { name: string; client: string | null; address: string | null; areaM2: number | null };
  manual: {
    fotoCapaUrl: string | null;
    dataEntrega: Date | string | null;
    urlOnline: string | null;
    canalAssistencia: string | null;
    textoBemVindos: string | null;
    materiais: string[];
    galeria: { url: string; legenda?: string | null }[];
    acabamentos: { grupo: string; nome: string; cor?: string | null; tipo?: string | null; fornecedor?: string | null }[];
    mobiliario: { nome: string; medida?: string | null; descricao?: string | null }[];
    fornecedores: { categoria: string; nome: string; telefone?: string | null; email?: string | null; endereco?: string | null }[];
    equipe: { papel: string; nome: string; email?: string | null }[];
    anexos: { tipo: string; nome: string; url: string }[];
  };
  projetos: { codigo: string; disciplina: string; revisao: string }[];
}

const fmtData = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';

// ─── Blocos reutilizáveis ───────────────────────────────────────────────────
const Rodape: React.FC<{ escuro?: boolean }> = ({ escuro }) => (
  <>
    <View style={s.footerRegua} fixed />
    <View style={s.footer} fixed>
      <Text style={[s.footerMarca, escuro ? { color: '#FFFFFF' } : {}]}>BÈR</Text>
      <Text style={s.footerCentro}>Manual do Proprietário · Engenharia BÈR</Text>
      <Text
        style={s.footerPag}
        render={({ pageNumber }) => String(pageNumber)}
      />
    </View>
  </>
);

const Cabecalho: React.FC<{ eyebrow: string; kicker?: string; titulo: string }> = ({ eyebrow, kicker, titulo }) => (
  <View>
    <View style={s.eyebrowRegua} />
    <Text style={s.eyebrow}>{eyebrow}</Text>
    {kicker ? <Text style={s.kickerNum}>{kicker}</Text> : null}
    <Text style={s.h1}>{titulo}</Text>
  </View>
);

const SecaoEscura: React.FC<{ num: string; titulo: string; desc: string }> = ({ num, titulo, desc }) => (
  <Page size="A4" style={s.secPage}>
    <Text style={s.secNum}>{num}</Text>
    <View style={{ position: 'absolute', bottom: 110, left: 56, right: 56 }}>
      <Text style={s.secKicker}>SEÇÃO {num}</Text>
      <Text style={s.secTitulo}>{titulo}</Text>
      <View style={s.secRegua} />
      <Text style={s.secDesc}>{desc}</Text>
    </View>
    <Rodape escuro />
  </Page>
);

// ─── Renderização de páginas do modelo (texto fiel) ─────────────────────────
const CAPS_DESTAQUE = /^(IMPORTANTE|CUIDADOS:?|LIMPEZA:?|LIMPEZA DIÁRIA|LIMPEZA PESADA|INFORMAÇÕES ADICIONAIS|I M P O R TA N T E|C U I D A D O S|L I M P E Z A.*|BEM VINDOS!|EMERGÊNCIA)$/i;

function ehSubHeader(l: string): boolean {
  if (/^\d+(\.\d+)*\.?\s+\S/.test(l) && l.length < 70 && !l.endsWith(';') && !l.endsWith('.')) return true;
  return false;
}
function ehDestaque(l: string): boolean {
  const limpo = l.replace(/\s+/g, ' ').trim();
  return CAPS_DESTAQUE.test(limpo) || (limpo === limpo.toUpperCase() && limpo.length > 3 && limpo.length < 52 && /^[A-ZÀ-Ü ÇÃÕÉÊÍÓÚ!/–-]+$/.test(limpo));
}
function ehLinhaTabela(l: string): boolean {
  return /\s{3,}/.test(l) && l.split(/\s{3,}/).length >= 2;
}

/** Renderiza o corpo de uma página do modelo com heurística de estrutura. */
function CorpoModelo({ lines, startIdx }: { lines: string[]; startIdx: number }) {
  const body = lines.slice(startIdx);
  const tabelaLinhas = body.filter(ehLinhaTabela).length;
  const modoTabela = tabelaLinhas >= Math.max(4, body.length * 0.4);

  if (modoTabela) {
    // Reconstrói colunas por espaçamento (extraído com pdftotext -layout)
    const rows = body.map((l) => (ehLinhaTabela(l) ? l.split(/\s{3,}/).map((c) => c.trim()) : [l.trim()]));
    return (
      <View style={s.tabela}>
        {rows.map((cols, i) =>
          cols.length === 1 ? (
            ehDestaque(cols[0]) || ehSubHeader(cols[0]) ? (
              <Text key={i} style={[s.sub, { fontSize: 9 }]}>{cols[0]}</Text>
            ) : (
              <Text key={i} style={s.notaTabela}>{cols[0]}</Text>
            )
          ) : (
            <View key={i} style={[s.tr, ...(i % 2 ? [s.trAlt] : [])]} wrap={false}>
              {cols.map((c, j) => (
                <Text key={j} style={[s.tdTxt, { flex: j === cols.length - 1 ? 2 : 1, paddingRight: 6, fontWeight: i === 0 ? 700 : 400 }]}>{c}</Text>
              ))}
            </View>
          ),
        )}
      </View>
    );
  }

  return (
    <View>
      {body.map((l, i) => {
        const limpo = l.replace(/\s{2,}/g, ' ').trim();
        if (ehDestaque(limpo)) {
          return (
            <View key={i} style={s.destaque}>
              <Text style={s.destaqueTxt}>{limpo.replace(/\s(?=\S)/g, (m, off) => (limpo.includes('  ') ? '' : m))}</Text>
            </View>
          );
        }
        if (ehSubHeader(limpo)) return <Text key={i} style={s.sub}>{limpo}</Text>;
        return <Text key={i} style={s.p}>{limpo}</Text>;
      })}
    </View>
  );
}

const PaginaModeloComp: React.FC<{ num: number; kickerOverride?: string }> = ({ num, kickerOverride }) => {
  const p = pagina(num);
  if (!p) return null;
  // A 1ª linha é o kicker numerado ("5.0 USAR E MANTER") quando parece rótulo
  // de seção E a 2ª linha é curta o bastante pra ser um título; senão a
  // própria 1ª linha é o título (ex: "Sobre este manual").
  const l0 = p.lines[0] ?? '';
  const l1 = p.lines[1] ?? '';
  const l0EhKicker = (/^\d/.test(l0) || l0 === l0.toUpperCase()) && l0.length < 60 && l1.length > 0 && l1.length < 60;
  const kicker = kickerOverride ?? (l0EhKicker ? l0 : undefined);
  const titulo = l0EhKicker ? l1 : l0;
  return (
    <Page size="A4" style={s.page}>
      <Cabecalho eyebrow="Manual do Proprietário" kicker={kicker} titulo={titulo} />
      <CorpoModelo lines={p.lines} startIdx={l0EhKicker ? 2 : 1} />
      <Rodape />
    </Page>
  );
};

// ─── Documento ──────────────────────────────────────────────────────────────
export function ManualProprietarioPdf({ data }: { data: ManualPdfData }) {
  const { obra, manual, projetos } = data;
  const cliente = obra.client ?? obra.name;

  const paginasUsarManter = Array.from(
    new Set(manual.materiais.flatMap((m) => USAR_MANTER_POR_MATERIAL[m] ?? [])),
  ).sort((a, b) => a - b);

  const projPorDisc = new Map<string, typeof projetos>();
  for (const pr of projetos) {
    const l = projPorDisc.get(pr.disciplina) ?? [];
    l.push(pr);
    projPorDisc.set(pr.disciplina, l);
  }

  const acabPorGrupo = new Map<string, typeof manual.acabamentos>();
  for (const a of manual.acabamentos) {
    const l = acabPorGrupo.get(a.grupo) ?? [];
    l.push(a);
    acabPorGrupo.set(a.grupo, l);
  }

  const metadeForn = Math.ceil(manual.fornecedores.length / 2);

  return (
    <Document title={`Manual do Proprietário — ${obra.name}`} author="BÈR Engenharia">
      {/* ─── CAPA ─── */}
      <Page size="A4" style={{ fontFamily: 'Montserrat', backgroundColor: '#FBFBF9' }}>
        {manual.fotoCapaUrl
          ? <Image src={manual.fotoCapaUrl} style={s.capaFoto} />
          : <View style={s.capaFotoPlaceholder} />}
        <View style={s.capaBody}>
          <Text style={s.capaLogo}>BÈR</Text>
          <Text style={s.capaTag}>Engenharia e Gerenciamento</Text>
          <Text style={s.capaKicker}>Manual do Proprietário</Text>
          <Text style={s.capaTitulo}>{obra.name}</Text>
          {obra.client ? <Text style={s.capaCliente}>{obra.client}</Text> : null}
          <Text style={s.capaEndereco}>
            {[obra.address, obra.areaM2 ? `${obra.areaM2} m²` : null].filter(Boolean).join(' · ')}
          </Text>
          <View style={s.capaBanner}>
            <Text style={s.capaBannerTxt}>Entregue em {fmtData(manual.dataEntrega)}</Text>
          </View>
        </View>
      </Page>

      {/* ─── GALERIA ─── */}
      {manual.galeria.length > 0 && (
        <Page size="A4" style={s.page}>
          <Cabecalho eyebrow="Manual do Proprietário" kicker="1.1 GALERIA DA OBRA" titulo={obra.name} />
          {manual.galeria.slice(0, 3).map((g, i) =>
            i === 0 ? (
              <View key={i} style={{ position: 'relative' }}>
                <Image src={g.url} style={s.galFotoFull} />
                {g.legenda ? (
                  <View style={s.galLegenda}><Text style={s.galLegendaTxt}>01  {g.legenda}</Text></View>
                ) : null}
              </View>
            ) : null,
          )}
          <View style={s.galRow}>
            {manual.galeria.slice(1, 3).map((g, i) => (
              <View key={i} style={[s.galCol, { position: 'relative' }]}>
                <Image src={g.url} style={s.galFotoHalf} />
                {g.legenda ? (
                  <View style={s.galLegenda}><Text style={s.galLegendaTxt}>{String(i + 2).padStart(2, '0')}  {g.legenda}</Text></View>
                ) : null}
              </View>
            ))}
          </View>
          <Rodape />
        </Page>
      )}
      {manual.galeria.length > 3 &&
        Array.from({ length: Math.ceil((manual.galeria.length - 3) / 4) }).map((_, pageIdx) => {
          const fotos = manual.galeria.slice(3 + pageIdx * 4, 3 + pageIdx * 4 + 4);
          return (
            <Page key={`gal-${pageIdx}`} size="A4" style={s.page}>
              <Cabecalho eyebrow="Manual do Proprietário" kicker="1.1 GALERIA DA OBRA" titulo="Galeria (continuação)" />
              {[0, 2].map((rowStart) => (
                <View key={rowStart} style={s.galRow}>
                  {fotos.slice(rowStart, rowStart + 2).map((g, i) => (
                    <View key={i} style={[s.galCol, { position: 'relative' }]}>
                      <Image src={g.url} style={s.galFotoHalf} />
                      {g.legenda ? (
                        <View style={s.galLegenda}><Text style={s.galLegendaTxt}>{g.legenda}</Text></View>
                      ) : null}
                    </View>
                  ))}
                </View>
              ))}
              <Rodape />
            </Page>
          );
        })}

      {/* ─── ACESSO RÁPIDO ─── */}
      <Page size="A4" style={s.page}>
        <Cabecalho eyebrow="Manual do Proprietário · Acesso rápido" titulo="Do que você precisa agora?" />
        <View style={s.arGrid}>
          {[
            { tag: 'Usar e Manter', titulo: 'Limpar e manter', desc: 'Como cuidar de cada piso, parede, vidro e equipamento.' },
            { tag: 'Garantias', titulo: 'Acionar a garantia', desc: 'O que está coberto, até quando e como acionar.' },
            { tag: 'Contatos', titulo: 'Contatos e fornecedores', desc: 'Assistência técnica e o diretório de fornecedores.' },
            { tag: 'Manutenção', titulo: 'Rotina de manutenção', desc: 'O calendário por mês, trimestre e ano.' },
          ].map((c, i) => (
            <View key={i} style={s.arCard}>
              <Text style={s.arTag}>{c.tag}</Text>
              <View style={s.arIcone} />
              <Text style={s.arTitulo}>{c.titulo}</Text>
              <Text style={s.arDesc}>{c.desc}</Text>
            </View>
          ))}
        </View>
        <View style={s.emergencia}>
          <Text style={s.emergLabel}>EMERGÊNCIA</Text>
          <View><Text style={s.emergTitulo}>193</Text><Text style={s.emergDesc}>Bombeiros / incêndio</Text></View>
          <View><Text style={s.emergTitulo}>Fechar o registro</Text><Text style={s.emergDesc}>Vazamento de gás</Text></View>
          <View><Text style={s.emergTitulo}>Disjuntor geral</Text><Text style={s.emergDesc}>Desligar o quadro de força</Text></View>
        </View>
        <View style={s.qrRow}>
          <View style={s.qrCard}>
            <View style={s.qrBox}><Text style={s.qrBoxTxt}>WEB</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, fontWeight: 700 }}>Versão online</Text>
              <Text style={{ fontSize: 7, color: GRAY }}>Manual sempre atualizado — {manual.urlOnline ?? 'em breve'}</Text>
            </View>
          </View>
          <View style={s.qrCard}>
            <View style={s.qrBox}><Text style={s.qrBoxTxt}>BÈR</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, fontWeight: 700 }}>Assistência BÈR</Text>
              <Text style={{ fontSize: 7, color: GRAY }}>Fale com a gente — {manual.canalAssistencia ?? 'assistencia@ber-engenharia.com.br'}</Text>
            </View>
          </View>
        </View>
        <Rodape />
      </Page>

      {/* ─── BEM-VINDOS ─── */}
      <Page size="A4" style={s.page}>
        <Cabecalho eyebrow="Manual do Proprietário · Introdução" kicker="1.0 INTRODUÇÃO" titulo="Bem-vindos" />
        <Text style={s.p}>Prezado {cliente},</Text>
        {(manual.textoBemVindos
          ? manual.textoBemVindos.split('\n').filter(Boolean)
          : [
              'É uma grande satisfação para a BÈR Engenharia entregar a obra do seu escritório. Este momento marca não apenas a conclusão de um projeto, mas o início de um espaço que vai abrigar conquistas, ideias e crescimento para a sua empresa.',
              'Este Manual do Proprietário foi desenvolvido para ser seu guia prático, reunindo todas as informações necessárias para a utilização, manutenção e preservação do seu novo ambiente. Nele, você encontrará:',
              'Projetos atualizados (conforme executado);',
              'Lista de produtos, materiais e fornecedores utilizados na obra;',
              'Orientações técnicas para garantir o melhor desempenho dos sistemas instalados.',
              'Nosso objetivo é que, com essas informações em mãos, você possa usufruir do espaço com tranquilidade e longevidade.',
            ]
        ).map((t, i) => (
          <Text key={i} style={s.p}>{t}</Text>
        ))}
        <View style={s.destaque}><Text style={s.destaqueTxt}>Bem-vindos!</Text></View>
        <Rodape />
      </Page>

      {/* Sobre este manual (texto fiel do modelo) */}
      <PaginaModeloComp num={PG_SOBRE} />

      {/* ─── FICHA TÉCNICA ─── */}
      <Page size="A4" style={s.page}>
        <Cabecalho eyebrow="Manual do Proprietário · Introdução" kicker="1.3 FICHA E EQUIPE TÉCNICA" titulo="Ficha técnica da obra" />
        <View style={s.ftGrid}>
          {[
            ['Nome da obra', obra.name],
            ['Área total', obra.areaM2 ? `${obra.areaM2} m²` : '—'],
            ['Cliente', obra.client ?? '—'],
            ['Endereço', obra.address ?? '—'],
            ['Data de entrega', fmtData(manual.dataEntrega)],
          ].map(([l, v], i) => (
            <View key={i} style={s.ftItem}>
              <Text style={s.ftLabel}>{l}</Text>
              <Text style={s.ftValor}>{v}</Text>
            </View>
          ))}
        </View>
        <Text style={s.ftSecao}>Engenharia e Gerenciamento · BÈR Engenharia</Text>
        <Text style={s.ftPessoa}><Text style={{ fontWeight: 700 }}>Arqto. Bruno Di Benedetto Almeida Vallim</Text> — bruno@ber-engenharia.com.br</Text>
        {manual.equipe.length > 0 && <Text style={s.ftSecao}>Execução</Text>}
        {manual.equipe.map((p, i) => (
          <Text key={i} style={s.ftPessoa}>
            <Text style={{ fontWeight: 700 }}>{p.papel}</Text> — {p.nome}{p.email ? ` · ${p.email}` : ''}
          </Text>
        ))}
        <Rodape />
      </Page>

      {/* ─── SEÇÃO 02 · RESPONSABILIDADES ─── */}
      <SecaoEscura num="02" titulo="Responsabilidades" desc="O que é responsabilidade da BÈR, do construtor e sua — como proprietário — a partir da entrega da obra." />
      {PGS_RESPONSABILIDADES.map((n) => <PaginaModeloComp key={n} num={n} />)}

      {/* Documentos técnicos (anexos dinâmicos) */}
      <Page size="A4" style={s.page}>
        <Cabecalho eyebrow="Manual do Proprietário · Responsabilidades" kicker="2.1 DOCUMENTOS TÉCNICOS" titulo="Documentos técnicos" />
        {manual.anexos.length === 0 ? (
          <Text style={s.p}>Documentos completos disponíveis na versão digital do manual.</Text>
        ) : (
          manual.anexos.map((a, i) => (
            <View key={i} style={{ marginBottom: 10 }}>
              <Text style={[s.sub, { borderBottomWidth: 0, marginBottom: 1 }]}>{a.nome.toUpperCase().startsWith(a.tipo.toUpperCase()) ? a.nome : `${a.tipo} — ${a.nome}`}</Text>
              <Text style={{ fontSize: 7.5, color: GRAY }}>Documento completo disponível na versão digital do manual</Text>
            </View>
          ))
        )}
        <Rodape />
      </Page>

      {/* ─── SEÇÃO 03 · PROJETOS ─── */}
      <SecaoEscura num="03" titulo="Projetos entregues" desc="Todos os projetos executados da obra, para consultar em futuras instalações ou mudanças no espaço." />
      <Page size="A4" style={s.page}>
        <Cabecalho eyebrow="Manual do Proprietário · Lista de projetos" kicker="3.1 PROJETOS ENTREGUES" titulo="Projetos recebidos" />
        <Text style={s.p}>Juntamente com este manual do proprietário disponibilizamos todos os projetos que recebemos da arquitetura para a execução da obra e as built se necessário.</Text>
        <Text style={s.p}>É necessária a consulta desses projetos para futuras instalações ou mudanças a se fazer em seu imóvel.</Text>
        {projetos.length === 0 ? (
          <Text style={s.p}>Lista disponível no Controle de Documentos da obra.</Text>
        ) : (
          Array.from(projPorDisc.entries()).map(([disc, lista]) => (
            <View key={disc} style={{ marginTop: 8 }} wrap={false}>
              <View style={s.trHead}><Text style={s.thTxt}>{disc} — lista de projetos recebidos</Text></View>
              {lista.map((pr, i) => (
                <View key={i} style={[s.tr, ...(i % 2 ? [s.trAlt] : [])]}>
                  <Text style={[s.tdTxt, { flex: 3, fontWeight: 600 }]}>{pr.codigo}</Text>
                  <Text style={[s.tdTxt, { flex: 1, textAlign: 'right' }]}>{pr.revisao}</Text>
                </View>
              ))}
            </View>
          ))
        )}
        <Rodape />
      </Page>

      {/* ─── SEÇÃO 04 · DEFINIÇÕES ─── */}
      <SecaoEscura num="04" titulo="Definições" desc="As normas de referência e o memorial com os materiais e acabamentos aplicados na sua obra." />
      <PaginaModeloComp num={PG_NORMAS} />

      {/* Memorial — acabamentos dinâmicos */}
      {manual.acabamentos.length > 0 && (
        <Page size="A4" style={s.page}>
          <Cabecalho eyebrow="Manual do Proprietário · Definições" kicker="4.2 MEMORIAL DESCRITIVO" titulo="Materiais e acabamentos" />
          <Text style={s.p}>Materiais e cores selecionados para o projeto executado, conforme a ordem de compra. Guarde estas referências para reposições e manutenções.</Text>
          {Array.from(acabPorGrupo.entries()).map(([grupo, itens]) => (
            <View key={grupo} wrap={false}>
              <Text style={s.memGrupo}>{grupo}</Text>
              <View style={s.memGrid}>
                {itens.map((a, i) => (
                  <View key={i} style={s.memCard}>
                    <View style={[s.memSwatch, { backgroundColor: a.cor ?? '#D9D9D3' }]}>
                      {a.cor ? <Text style={s.memHex}>{a.cor.toUpperCase()}</Text> : null}
                    </View>
                    <View style={s.memBody}>
                      <Text style={s.memNome}>{a.nome}</Text>
                      <Text style={s.memTipo}>{[a.tipo, a.fornecedor].filter(Boolean).join(' · ') || ' '}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
          <Rodape />
        </Page>
      )}

      {/* Mobiliário dinâmico */}
      {manual.mobiliario.length > 0 && (
        <Page size="A4" style={s.page}>
          <Cabecalho eyebrow="Manual do Proprietário · Definições" kicker="4.2 MEMORIAL DESCRITIVO" titulo="Mobiliário" />
          <Text style={s.p}>Mobiliário corporativo especificado e instalado na obra:</Text>
          <View style={s.mobGrid}>
            {manual.mobiliario.map((m, i) => (
              <View key={i} style={s.mobCard} wrap={false}>
                <View style={s.mobHead}>
                  <Text style={s.mobNome}>{m.nome}</Text>
                  {m.medida ? <Text style={s.mobMedida}>{m.medida}</Text> : null}
                </View>
                {m.descricao ? <Text style={s.mobDesc}>{m.descricao}</Text> : null}
              </View>
            ))}
          </View>
          <Rodape />
        </Page>
      )}

      {/* ─── SEÇÃO 05 · USAR E MANTER ─── */}
      <SecaoEscura num="05" titulo="Usar e manter" desc="Como usar, limpar e conservar cada material e sistema — para durar mais e manter a garantia." />
      <PaginaModeloComp num={PG_IMPORTANTE} />
      {paginasUsarManter.map((n) => <PaginaModeloComp key={n} num={n} />)}
      {PGS_MANUTENCAO.map((n) => <PaginaModeloComp key={n} num={n} />)}

      {/* ─── SEÇÃO 06 · GARANTIAS ─── */}
      <SecaoEscura num="06" titulo="Termos das garantias" desc="Prazos de garantia, o que está coberto, contatos de assistência e os termos de entrega." />
      {PGS_GARANTIA.map((n) => <PaginaModeloComp key={n} num={n} />)}

      {/* Fornecedores dinâmicos */}
      {manual.fornecedores.length > 0 && (
        <Page size="A4" style={s.page}>
          <Cabecalho eyebrow="Manual do Proprietário · Termos das garantias" kicker="6.1 CONTATOS E ASSISTÊNCIA TÉCNICA" titulo="Fornecedores da obra" />
          <Text style={s.p}>A partir da entrega, cabe ao usuário acionar a assistência técnica de cada fornecedor. Diretório dos fornecedores da obra:</Text>
          <View style={s.fornCols}>
            {[manual.fornecedores.slice(0, metadeForn), manual.fornecedores.slice(metadeForn)].map((col, ci) => (
              <View key={ci} style={s.fornCol}>
                {col.map((f, i) => (
                  <View key={i} style={s.fornItem} wrap={false}>
                    <Text style={s.fornCat}>{f.categoria}</Text>
                    <Text style={s.fornNome}>{f.nome}</Text>
                    {[f.telefone, f.email, f.endereco].filter(Boolean).map((info, j) => (
                      <Text key={j} style={s.fornInfo}>{info}</Text>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </View>
          <Rodape />
        </Page>
      )}

      {PGS_NAO_COBERTOS.map((n) => <PaginaModeloComp key={n} num={n} />)}
      {PGS_UTILIDADE.map((n) => <PaginaModeloComp key={n} num={n} />)}
      {PGS_PRAZOS_GARANTIA.map((n) => <PaginaModeloComp key={n} num={n} />)}
      {PGS_TERMOS.map((n) => <PaginaModeloComp key={n} num={n} />)}

      {/* Cartão rápido final */}
      <PaginaModeloComp num={PG_CARTAO} kickerOverride={`${obra.name.toUpperCase()} — CARTÃO RÁPIDO`} />
    </Document>
  );
}
