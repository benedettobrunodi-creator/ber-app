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
// pgs 46-51 do modelo (manutenção preventiva) substituídas por Secao52Manutencao — tabela estruturada (12/09)
const PGS_GARANTIA = [53, 54, 55];
// pgs 58-61 (serviços não cobertos) substituídas por Secao62NaoCobertos — tabela estruturada (12/09)
const PGS_UTILIDADE = [62, 63, 64, 65];
const PGS_PRAZOS_GARANTIA = [67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86];
// Termos de aceite provisório/definitivo (pgs 87-88 do modelo) EXCLUÍDOS do
// databook a pedido do Bruno (11/09/26) — assinados fora do manual.
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
    galeriaProjetos?: { url: string; legenda?: string | null }[] | null;
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

const RodapeFixo: React.FC = () => (
  <>
    <View style={s.footerRegua} fixed />
    <View style={s.footer} fixed>
      <Text style={s.footerMarca}>BÈR</Text>
      <Text style={s.footerCentro}>Manual do Proprietário · Engenharia BÈR</Text>
      <Text style={s.footerPag} render={({ pageNumber }) => String(pageNumber)} />
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

// ─── 5.2 Manutenção preventiva mínima — tabela ESTRUTURADA ──────────────────
// As pgs 46-51 do modelo eram tabelas com células mescladas que o pdftotext
// -layout fragmenta (tabela saía desconfigurada — reclamação 12/09). Conteúdo
// reconstruído à mão, mesma solução da Tabela das Concessionárias (6.3).
const MANUT_52: { periodo: string; itens: { sist: string; comp?: string; ativ: string; resp?: string; nota?: string }[] }[] = [
  {
    periodo: 'A CADA 1 MÊS',
    itens: [
      { sist: 'Equipamentos industrializados', comp: 'Ar condicionado', ativ: 'Verificar todos os componentes do sistema e, caso seja detectada qualquer anomalia, providenciar reparos necessários', resp: 'Equipe de manutenção local / Proprietário', nota: 'Verificar se está funcionando corretamente, se as unidades de montagem estão firmemente instaladas e se a rede frigorígena está devidamente isolada termicamente.' },
      { sist: 'Equipamentos industrializados', comp: 'Sistema de exaustão mecânica', ativ: 'Realizar a manutenção dos ventiladores que compõem os sistemas de exaustão', resp: 'Empresa especializada' },
      { sist: 'Revestimentos de piso, parede, teto e bancadas', comp: 'Pedras naturais (mármore, granito, pedra mineira, mosaico e outros)', ativ: 'No caso de peças polidas (ex.: pisos, bancadas de granito etc.), verificar e, se necessário, encerar', nota: 'Nas áreas de circulação intensa o enceramento deve acontecer com periodicidade inferior, para manter uma camada protetora.' },
    ],
  },
  {
    periodo: 'A CADA 1 MÊS OU MENOS, CASO NECESSÁRIO',
    itens: [
      { sist: 'Equipamentos industrializados', comp: 'Ar condicionado', ativ: 'Realizar a limpeza dos componentes e filtros, mesmo em período de não utilização', resp: 'Equipe de manutenção local / Proprietário' },
    ],
  },
  {
    periodo: 'A CADA 3 MESES',
    itens: [
      { sist: 'Sistemas hidrossanitários', comp: 'Elementos do sistema de distribuição de água quente e fria, esgoto e água da chuva', ativ: 'Limpeza dos dispositivos que impossibilitem a entrada de resíduos na tubulação' },
      { sist: 'Esquadrias de alumínio', ativ: 'Efetuar limpeza geral das esquadrias e seus componentes' },
    ],
  },
  {
    periodo: 'A CADA 6 MESES',
    itens: [
      { sist: 'Instalações elétricas', ativ: 'Testar o disjuntor tipo DR apertando o botão localizado no próprio aparelho — a energia será interrompida. Caso isso não ocorra, trocar o DR', resp: 'Equipe de manutenção local / Proprietário / Empresa capacitada' },
      { sist: 'Instalações hidrossanitárias', comp: 'Água potável / não potável', ativ: 'Limpar e verificar a regulagem dos mecanismos de descarga e os mecanismos internos da caixa acoplada; limpar os aeradores (bicos removíveis) das torneiras; verificar a estanqueidade dos registros de gaveta', resp: 'Equipe de manutenção local / Proprietário', nota: 'Abrir e fechar completamente os registros para evitar emperramentos e mantê-los em condições de manobra.' },
      { sist: 'Esquadrias de ferro e aço', ativ: 'Verificar as esquadrias para identificação de pontos de oxidação e, se necessário, proceder os reparos', resp: 'Empresa capacitada / especializada' },
      { sist: 'Esquadrias de madeira', ativ: 'Verificar a existência de fungos, mofos, bolores e focos de insetos e tratar, quando necessário', resp: 'Equipe de manutenção local / Empresa capacitada' },
      { sist: 'Revestimentos de piso, parede, teto e bancadas', comp: 'Pisos de madeira e laminados', ativ: 'Verificar a existência de fungos, mofos, bolores e focos de insetos e tratar, quando necessário' },
    ],
  },
  {
    periodo: 'A CADA 1 ANO',
    itens: [
      { sist: 'Sistemas hidrossanitários', comp: 'Água potável / não potável', ativ: 'Verificar a estanqueidade da válvula de descarga, torneira automática e torneira eletrônica', resp: 'Equipe de manutenção local' },
      { sist: 'Sistemas hidrossanitários', comp: 'Água potável / não potável', ativ: 'Verificar as tubulações de água potável para detectar obstruções, perda de estanqueidade e sua fixação; recuperar sua integridade onde necessário', resp: 'Equipe de manutenção local / Proprietário / Empresa capacitada', nota: 'Verificar e, se necessário, substituir os vedantes (courinhos) das torneiras, misturadores e registros de pressão, para garantir a vedação e evitar vazamentos.' },
      { sist: 'Sistemas hidrossanitários', ativ: 'Verificar o funcionamento do sistema de aquecimento individual e efetuar limpeza e regulagem, conforme legislação vigente', resp: 'Empresa capacitada' },
      { sist: 'Sistemas hidrossanitários', ativ: 'Verificar a integridade e reconstituir os rejuntamentos dos ralos, peças sanitárias, bordas de banheiras e outros elementos, onde houver', resp: 'Equipe de manutenção local / Proprietário / Empresa especializada' },
      { sist: 'Sistemas hidrossanitários', ativ: 'Verificar as tubulações de água servida para detectar obstruções, perda de estanqueidade e sua fixação, reconstituindo sua integridade onde necessário', resp: 'Equipe de manutenção local / Empresa capacitada' },
      { sist: 'Instalações elétricas', ativ: 'Rever o estado de isolamento das emendas de fios e, no caso de problemas, providenciar as correções; verificar e, se necessário, reapertar as conexões do quadro de distribuição', resp: 'Empresa especializada', nota: 'Verificar o estado dos contatos elétricos; caso possuam desgaste, substituir as peças (tomadas, interruptores, pontos de luz e outros).' },
      { sist: 'Impermeabilização', ativ: 'Verificar a integridade e reconstituir os rejuntamentos internos e externos de pisos, paredes, peitoris, soleiras, ralos, peças sanitárias, bordas de banheiras e outros elementos', resp: 'Empresa capacitada / especializada', nota: 'Verificar a integridade dos sistemas de impermeabilização e reconstituir a proteção mecânica, sinais de infiltração ou falhas da impermeabilização exposta.' },
      { sist: 'Esquadrias de ferro e aço', ativ: 'Verificar e, se necessário, pintar ou executar serviços com as mesmas especificações da pintura original; verificar a vedação e a fixação dos vidros' },
      { sist: 'Guarda-corpos e corrimãos', ativ: 'Realizar inspeção das condições de fixação e solidez do guarda-corpo, corrimão e barras; reconstituir onde necessário', resp: 'Equipe de manutenção local / Empresa capacitada' },
      { sist: 'Esquadrias de madeira', ativ: 'Verificar falhas de vedação e fixação das esquadrias e reconstituir sua integridade onde for necessário. No caso de esquadrias envernizadas, recomenda-se a reaplicação do produto', resp: 'Empresa capacitada / especializada' },
      { sist: 'Esquadrias de alumínio', ativ: 'Verificar a presença de fissuras, falhas na vedação e fixação dos caixilhos e reconstituir sua integridade onde for necessário', resp: 'Empresa capacitada / especializada' },
      { sist: 'Esquadrias de alumínio', ativ: 'Verificar vedação e fixação dos vidros', resp: 'Equipe de manutenção local' },
      { sist: 'Revestimentos de piso, parede, teto e bancadas', comp: 'Revestimento cerâmico', ativ: 'Verificar e, se necessário, efetuar as manutenções, a fim de manter a estanqueidade do sistema', resp: 'Empresa capacitada / especializada', nota: 'Verificar sua integridade e reconstituir os rejuntamentos internos e externos de pisos, paredes, peitoris, soleiras, ralos, peças sanitárias, bordas de banheiras e outros elementos.' },
      { sist: 'Revestimentos de piso, parede, teto e bancadas', comp: 'Paredes e tetos em argamassa ou gesso e forro de gesso (interno e externo)', ativ: 'Repintar os forros dos banheiros e áreas úmidas' },
      { sist: 'Revestimentos de piso, parede, teto e bancadas', comp: 'Pedras naturais (mármore, granito, pedra mineira, mosaico e outros)', ativ: 'Verificar a integridade e reconstituir, onde necessário, os rejuntamentos internos e externos, respeitando a recomendação do projeto original ou especificação de especialista', nota: 'Atentar para as juntas de dilatação, que devem ser preenchidas com mastique — nunca com argamassa de rejuntamento.' },
      { sist: 'Revestimentos de piso, parede, teto e bancadas', comp: 'Pisos de madeira e laminados', ativ: 'Verificar e, se necessário, refazer a calafetação das juntas', resp: 'Equipe de manutenção local / Proprietário / Empresa capacitada' },
      { sist: 'Revestimentos de piso, parede, teto e bancadas', comp: 'Rejuntes', ativ: 'Verificar sua integridade e reconstituir os rejuntamentos internos e externos de pisos, paredes, peitoris, soleiras, ralos, peças sanitárias, bordas de banheiras e outros elementos, onde houver', resp: 'Equipe de manutenção local / Proprietário / Empresa especializada' },
      { sist: 'Vidros', ativ: 'Verificar o desempenho das vedações e fixações dos vidros nos caixilhos', resp: 'Empresa especializada', nota: 'Nos vidros temperados, efetuar inspeção do funcionamento do sistema de molas e dobradiças e verificar a necessidade de lubrificação.' },
    ],
  },
  {
    periodo: 'A CADA 2 ANOS',
    itens: [
      { sist: 'Instalações elétricas', ativ: 'Reapertar todas as conexões (tomadas, interruptores, pontos de luz, entre outros)', resp: 'Empresa capacitada / especializada' },
      { sist: 'Esquadrias de madeira', ativ: 'Nos casos das esquadrias enceradas, é aconselhável o tratamento de todas as partes' },
      { sist: 'Revestimentos de piso, parede, teto e bancadas', comp: 'Paredes e tetos em argamassa ou gesso, forro de gesso (interno e externo) e pintura', ativ: 'Revisar a pintura das áreas secas e, se necessário, repintá-las, evitando o envelhecimento, a perda de brilho, o descascamento e eventuais fissuras' },
    ],
  },
  {
    periodo: 'A CADA 3 ANOS',
    itens: [
      { sist: 'Esquadrias de madeira', ativ: 'Nos casos de esquadrias pintadas, repintar', nota: 'No caso de esquadrias envernizadas, recomenda-se, além do tratamento anual, efetuar a raspagem total e a reaplicação do verniz.' },
    ],
  },
];

const Secao52Manutencao: React.FC = () => (
  <Page size="A4" style={s.page} wrap>
    <Cabecalho eyebrow="Manual do Proprietário" kicker="5.2 MANUTENÇÃO PREVENTIVA MÍNIMA" titulo="Manutenção preventiva mínima" />
    <Text style={s.p}>No momento da entrega, é fundamental que o cliente realize a verificação de possíveis falhas aparentes e ocorrências nos acabamentos, sistemas, componentes e equipamentos. A identificação dessas irregularidades deve ser feita de forma detalhada e imediata, garantindo que qualquer situação seja devidamente registrada e solucionada dentro dos parâmetros de garantia estabelecidos pela BÈR.</Text>
    <Text style={s.p}>A partir do momento da entrega do imóvel, é imperativo que o cliente assuma a demanda de manutenções do seu novo espaço, abrangendo, mas não se limitando a:</Text>
    {MANUT_52.map((grupo) => (
      <View key={grupo.periodo} style={{ marginTop: 10 }}>
        <View style={s.destaque} wrap={false}>
          <Text style={s.destaqueTxt}>{grupo.periodo}</Text>
        </View>
        <View style={s.trHead} wrap={false}>
          <Text style={[s.thTxt, { flex: 1.3, paddingRight: 6 }]}>Sistema · Elemento</Text>
          <Text style={[s.thTxt, { flex: 2, paddingRight: 6 }]}>Atividade</Text>
          <Text style={[s.thTxt, { flex: 1 }]}>Responsável</Text>
        </View>
        {grupo.itens.map((it, i) => (
          <View key={i} wrap={false}>
            <View style={[s.tr, ...(i % 2 ? [s.trAlt] : [])]}>
              <View style={{ flex: 1.3, paddingRight: 6 }}>
                <Text style={[s.tdTxt, { fontWeight: 600 }]}>{it.sist}</Text>
                {it.comp ? <Text style={[s.tdTxt, { fontSize: 7, color: GRAY }]}>{it.comp}</Text> : null}
              </View>
              <Text style={[s.tdTxt, { flex: 2, paddingRight: 6 }]}>{it.ativ}</Text>
              <Text style={[s.tdTxt, { flex: 1 }]}>{it.resp ?? '—'}</Text>
            </View>
            {it.nota ? <Text style={s.notaTabela}>{it.nota}</Text> : null}
          </View>
        ))}
      </View>
    ))}
    <RodapeFixo />
  </Page>
);

// ─── 6.2 Serviços não cobertos — tabela ESTRUTURADA ─────────────────────────
// Pgs 58-61 do modelo: mesma doença da 5.2 (células mescladas fragmentadas
// pelo pdftotext). Reconstruída à mão em 12/09 (2º print do Bruno).
const NAO_COBERTOS_62: { sistema: string; itens: { comp: string; desc: string }[] }[] = [
  {
    sistema: 'VEDAÇÕES VERTICAIS EXTERNAS E INTERNAS',
    itens: [
      { comp: 'Portas corta-fogo', desc: 'Falha de regulagem de dobradiças e molas. Ocorrências em acabamentos: manchas, lascamento de pintura ou acabamento superficial.' },
      { comp: 'Portas de acesso e internas de áreas comuns e privativas', desc: 'Ocorrências em acabamentos: manchas, lascamento de pintura ou acabamento superficial.' },
      { comp: 'Revestimentos decorativos de qualquer natureza', desc: 'Ocorrências em acabamentos: lascamento, diferenças de tonalidades, manchas e riscos, falhas de rejuntamento.' },
      { comp: 'Pinturas', desc: 'Ocorrências em acabamentos: lascamento, diferenças de tonalidades, manchas e riscos.' },
      { comp: 'Esquadrias de alumínio, madeira, aço e PVC', desc: 'Falha pela dificuldade de abertura ou fechamento. Ocorrências em acabamentos: riscos, manchas, amassamento, lascamento.' },
      { comp: 'Vidros', desc: 'Ocorrências em acabamentos: lascamento, trincas, quebras, riscos ou manchas.' },
    ],
  },
  {
    sistema: 'PISOS',
    itens: [
      { comp: 'Contrapiso', desc: 'Ocorrências em acabamentos: depressões e irregularidades, quebra.' },
      { comp: 'Revestimentos/acabamento de qualquer natureza, inclusive o rejuntamento', desc: 'Ocorrências em acabamentos: lascamento, diferenças de tonalidades, manchas e riscos, falhas de rejuntamento, falhas de polimento.' },
      { comp: 'Pisos acabados', desc: 'Alagamentos em pisos de qualquer natureza, decorrentes de entupimento das tubulações de coleta de água pluvial por quaisquer elementos decorrentes de sua exposição ao tempo (ventos, chuvas, acúmulo de sujidades nos coletores etc.).' },
      { comp: 'Pisos acabados', desc: 'Alagamentos provenientes de esquadrias (portas, janelas, envidraçamento de varanda) deixadas abertas ou semiabertas, que permitam entrada de águas que danifiquem pisos de madeira, móveis, marcenarias, tecidos etc.' },
      { comp: 'Pisos acabados', desc: 'Manchas em revestimentos por aplicação de produtos incorretos, independente da informação constante ou ausente no manual de entrega.' },
    ],
  },
  {
    sistema: 'ACESSIBILIDADE',
    itens: [
      { comp: 'Sinalização', desc: 'Ocorrências em acabamentos: trincas, quebras, amassados ou manchas.' },
      { comp: 'Sinalização — piso tátil', desc: 'Destacamentos, descolamentos, desprendimentos de peças ou partes.' },
    ],
  },
  {
    sistema: 'FORROS',
    itens: [
      { comp: 'Superfície', desc: 'Ocorrências em acabamentos: lascamentos, quebras, manchas, irregularidades e desnivelamentos.' },
      { comp: 'Forros acabados', desc: 'Alagamentos em forros decorrentes de entupimento das tubulações de coleta de água pluvial por quaisquer elementos decorrentes de sua exposição ao tempo (ventos, chuvas, acúmulo de sujidades nos coletores etc.).' },
    ],
  },
  {
    sistema: 'COBERTURAS',
    itens: [
      { comp: 'Telhados e coberturas', desc: 'Alagamentos decorrentes de entupimento das tubulações de coleta de água pluvial por quaisquer elementos decorrentes de sua exposição ao tempo (ventos, chuvas, acúmulo de sujidades nos coletores etc.).' },
    ],
  },
  {
    sistema: 'SISTEMAS HIDRÁULICOS',
    itens: [
      { comp: 'Louças sanitárias, banheiras, bancadas e cubas', desc: 'Ocorrências em acabamentos: lascamento, quebra, manchas, fixação, riscos ou amassados.' },
      { comp: 'Metais sanitários', desc: 'Ocorrências em acabamentos: manchamento. Falhas de fixação; falha de abertura e fechamento.' },
      { comp: 'Obstrução de vazão', desc: 'Entupimentos, parcial ou total, na tubulação hidráulica (banheiros, cozinhas, copa, áreas gourmet, jardins etc.), decorrentes do descarte, intencional ou não, de quaisquer resíduos inapropriados à tubulação (cabelos, alimentos, plásticos e afins). Inclui entupimento de caixa de gordura, com seu provável transbordamento e potencial estrago de pisos, móveis e acabamentos no entorno, até mesmo em vizinhos abaixo.' },
    ],
  },
  {
    sistema: 'SISTEMAS ELÉTRICOS',
    itens: [
      { comp: 'Espelhos de tomadas, interruptores e outros dispositivos', desc: 'Falha de fixação e de instalação, componentes danificados.' },
      { comp: 'Conduítes, fiações, interligações', desc: 'Alagamentos em tubulações elétricas, decorrentes de entupimento das tubulações de coleta de água pluvial por quaisquer elementos decorrentes de sua exposição ao tempo (ventos, chuvas, acúmulo de sujidades nos coletores etc.).' },
    ],
  },
  {
    sistema: 'PISCINAS',
    itens: [
      { comp: 'Revestimentos, iluminação', desc: 'Ocorrências em acabamentos: lascamento, quebras, diferença de tonalidade.' },
    ],
  },
  {
    sistema: 'QUADRAS POLIESPORTIVAS',
    itens: [
      { comp: 'Equipamentos da quadra, pisos e alambrados', desc: 'Ocorrências em acabamentos: lascamento e falhas na pintura, riscos ou manchas.' },
    ],
  },
  {
    sistema: 'PREVENÇÃO E COMBATE A INCÊNDIO',
    itens: [
      { comp: 'Sinalização', desc: 'Ocorrências em acabamentos: lascamento, diferenças de tonalidades, manchas e riscos, falhas de colagem, falhas de polimento.' },
    ],
  },
];

const Secao62NaoCobertos: React.FC = () => (
  <Page size="A4" style={s.page} wrap>
    <Cabecalho eyebrow="Manual do Proprietário · Termos das garantias" kicker="6.2 SERVIÇOS NÃO COBERTOS POR GARANTIA" titulo="Serviços não cobertos" />
    <Text style={s.p}>Falhas aparentes e ocorrências em acabamentos, sistemas, componentes e equipamentos cuja identificação deve ser feita no ato da entrega.</Text>
    <View style={[s.trHead, { marginTop: 8 }]} wrap={false}>
      <Text style={[s.thTxt, { flex: 1.2, paddingRight: 6 }]}>Sistema · Componente</Text>
      <Text style={[s.thTxt, { flex: 2.5 }]}>Tipos de falhas aparentes e ocorrências em acabamentos</Text>
    </View>
    {NAO_COBERTOS_62.map((grupo) => (
      <View key={grupo.sistema}>
        <View style={s.destaque} wrap={false}>
          <Text style={s.destaqueTxt}>{grupo.sistema}</Text>
        </View>
        {grupo.itens.map((it, i) => (
          <View key={i} style={[s.tr, ...(i % 2 ? [s.trAlt] : [])]} wrap={false}>
            <Text style={[s.tdTxt, { flex: 1.2, paddingRight: 6, fontWeight: 600 }]}>{it.comp}</Text>
            <Text style={[s.tdTxt, { flex: 2.5 }]}>{it.desc}</Text>
          </View>
        ))}
      </View>
    ))}
    <Text style={s.notaTabela}>Manchas em revestimentos por aplicação de produtos incorretos não são cobertas, independente da informação constante ou ausente no manual de entrega.</Text>
    <RodapeFixo />
  </Page>
);

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

      {/* ─── 3.2 PROJETOS — PRANCHAS (imagens, separado da galeria de fotos — pedido 12/09) ─── */}
      {(manual.galeriaProjetos ?? []).length > 0 &&
        Array.from({ length: Math.ceil((manual.galeriaProjetos ?? []).length / 4) }).map((_, pageIdx) => {
          const imgs = (manual.galeriaProjetos ?? []).slice(pageIdx * 4, pageIdx * 4 + 4);
          return (
            <Page key={`galproj-${pageIdx}`} size="A4" style={s.page}>
              <Cabecalho
                eyebrow="Manual do Proprietário · Lista de projetos"
                kicker="3.2 PROJETOS — PRANCHAS"
                titulo={pageIdx === 0 ? 'Imagens dos projetos' : 'Imagens dos projetos (continuação)'}
              />
              {[0, 2].map((rowStart) => (
                <View key={rowStart} style={s.galRow}>
                  {imgs.slice(rowStart, rowStart + 2).map((g, i) => (
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
      <Secao52Manutencao />

      {/* ─── SEÇÃO 06 · GARANTIAS ─── */}
      <SecaoEscura num="06" titulo="Termos das garantias" desc="Prazos de garantia, o que está coberto e os contatos de assistência." />
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

      <Secao62NaoCobertos />
      {/* 6.3 · pg 62 reconstruída COM a Tabela das Concessionárias — a tabela do
          Caderno se perdeu na extração do modelo (Bruno, 11/09/26) */}
      <Page size="A4" style={s.page}>
        <Cabecalho eyebrow="Manual do Proprietário" kicker="6.3 SERVIÇOS DE UTILIDADE PÚBLICA" titulo="Serviços de utilidade pública" />
        <CorpoModelo lines={pagina(62)?.lines ?? []} startIdx={2} />
        <View style={{ marginTop: 18 }}>
          <Text style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.4, color: OLIVA_DARK, textTransform: 'uppercase', marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1.5, borderBottomColor: OLIVA }}>
            Tabela das concessionárias
          </Text>
          {[
            ['Água — SABESP', '0800 055 0195'],
            ['Luz e força — ENEL', '0800 72 72 120'],
            ['Gás — COMGÁS', '0800 011 0197'],
          ].map(([nome, tel]) => (
            <View key={nome} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 7 }}>
              <Text style={{ flex: 2, fontSize: 9.5, fontWeight: 600, color: CARVAO }}>{nome}</Text>
              <Text style={{ flex: 1, fontSize: 9.5, fontWeight: 700, color: OLIVA_DARK, textAlign: 'right' }}>{tel}</Text>
            </View>
          ))}
        </View>
        <Rodape />
      </Page>
      {PGS_UTILIDADE.filter((n) => n !== 62).map((n) => <PaginaModeloComp key={n} num={n} />)}
      {PGS_PRAZOS_GARANTIA.map((n) => <PaginaModeloComp key={n} num={n} />)}

      {/* Cartão rápido final */}
      <PaginaModeloComp num={PG_CARTAO} kickerOverride={`${obra.name.toUpperCase()} — CARTÃO RÁPIDO`} />
    </Document>
  );
}
