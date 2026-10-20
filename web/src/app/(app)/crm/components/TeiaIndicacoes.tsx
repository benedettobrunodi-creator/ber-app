'use client';

/**
 * Teia de Indicações (Bruno 20/10/26): grafo de relações empresa indicadora →
 * negócios. Indicadoras são os nós escuros; cada negócio orbita quem o indicou,
 * colorido pelo desfecho (aberto / ganho / perdido). Tamanho = valor.
 *
 * Layout por simulação de força própria (repulsão + mola nos links + âncora do
 * grupo + anti-sobreposição), síncrona e determinística no useMemo — sem d3.
 * Interações (pedidos Bruno 20/10): zoom (scroll + botões), pan no fundo,
 * arrastar uma INDICADORA move o cluster dela, tooltip segue o mouse, clique
 * na indicadora abre o drill-down. v3: default agrupado por categoria
 * (Gerenciadoras × Arquitetura × Brokers) com filtro, canvas largo e baixo.
 *
 * v5 — Radar de Aproximação (Bruno 20/10): empresas-alvo curadas (flag radar
 * no cadastro) entram na teia mesmo sem indicação, como nós tracejados no
 * cluster do segmento. Quando geram a 1ª indicação, "acendem" (nó normal).
 * Alvo sem contato há 45+ dias ganha o anel laranja de esfriamento.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Minus, Plus, RotateCcw } from 'lucide-react';
import { Oportunidade, fmt } from '../types';

const COR_INDICADORA = '#1E1E22';
const COR_RESULTADO: Record<string, string> = {
  aberto: '#5A7A7A',
  ganho: '#3D9E5F',
  perdido: '#E05555',
};
const ETAPAS_PERDA = ['perdido', 'declinado', 'cancelado'];

const W = 1280;
const H = 520;

type Categoria = 'gerenciadora' | 'arquitetura' | 'broker' | 'outras';
const CATEGORIAS: { id: Categoria | 'todas'; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'gerenciadora', label: 'Gerenciadoras' },
  { id: 'arquitetura', label: 'Arquitetura' },
  { id: 'broker', label: 'Brokers' },
  { id: 'outras', label: 'Outras' },
];
const GRUPO_LABEL: Record<Categoria, string> = {
  gerenciadora: 'GERENCIADORAS',
  arquitetura: 'ARQUITETURA',
  broker: 'BROKERS',
  outras: 'OUTRAS',
};
/** Âncoras dos grupos no modo "todas" (gerenciadoras à esquerda, arquitetura à direita). */
const ANCORAS: Record<Categoria, { x: number; y: number }> = {
  gerenciadora: { x: W * 0.23, y: H * 0.52 },
  arquitetura: { x: W * 0.74, y: H * 0.52 },
  broker: { x: W * 0.48, y: H * 0.74 },
  outras: { x: W * 0.48, y: H * 0.3 },
};

interface NodoBase {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  cat: Categoria;
}
interface NodoInd extends NodoBase {
  tipo: 'ind';
  nome: string;
  total: number;
  ops: Oportunidade[];
  /** dias desde a última indicação (entrada no pipeline ou criação) */
  diasUltima: number;
  /** indicadora recorrente (2+) sem indicar há 60+ dias — relação esfriando;
   *  pra alvo do radar sem negócio: 45+ dias sem contato registrado */
  esfriando: boolean;
  /** empresa na lista curada do Radar de Aproximação */
  radar: boolean;
  /** dias desde o último contato registrado (null = sem registro) — só radar */
  diasContato: number | null;
}
interface NodoNeg extends NodoBase { tipo: 'neg'; op: Oportunidade; res: string }
type Nodo = NodoInd | NodoNeg;

/** Pseudo-aleatório determinístico a partir do id (layout estável entre renders). */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

function encurta(nome: string): string {
  return nome
    .replace(' Jones Lang La Salle Brasil', '')
    .replace(' Administração Predial', '')
    .replace(' Consultoria', '')
    .replace(' Arquitetura', '');
}

function resultadoDe(op: Oportunidade): string {
  if (op.etapa === 'ganho') return 'ganho';
  if (ETAPAS_PERDA.includes(op.etapa)) return 'perdido';
  return 'aberto';
}

/** valor vem da API como string (Decimal do Prisma serializado) — somar sem
 *  converter vira concatenação e NaN derruba o layout inteiro (bug 20/10). */
function val(op: Oportunidade): number {
  const n = Number(op.valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Dias desde a última indicação da empresa (entrada no pipeline ou criação). */
function diasDesdeUltima(ops: Oportunidade[]): number {
  const ultima = Math.max(...ops.map((o) => new Date(o.dataEntradaPipeline ?? o.createdAt).getTime()));
  return Number.isFinite(ultima) ? Math.floor((Date.now() - ultima) / 86_400_000) : 0;
}

/** Conversão da indicadora: quantos ganhos/perdidos/abertos e R$ ganho. */
function statsInd(ops: Oportunidade[]): { ganhos: number; perdidos: number; abertos: number; valorGanho: number } {
  let ganhos = 0, perdidos = 0, abertos = 0, valorGanho = 0;
  for (const o of ops) {
    const r = resultadoDe(o);
    if (r === 'ganho') { ganhos++; valorGanho += val(o); }
    else if (r === 'perdido') perdidos++;
    else abertos++;
  }
  return { ganhos, perdidos, abertos, valorGanho };
}

/** Categoria da indicadora: classificação do CADASTRO manda (Bruno 20/10:
 *  "Gamaro não é arquitetura, é incorporadora"); sem classificação, vale a
 *  origem mais frequente entre os negócios dela. */
function categoriaDe(ops: Oportunidade[], classificacao?: string | null): Categoria {
  if (classificacao) return categoriaDeClassificacao(classificacao);
  const cont: Record<string, number> = {};
  for (const o of ops) if (o.origem) cont[o.origem] = (cont[o.origem] ?? 0) + 1;
  const top = Object.entries(cont).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (top === 'gerenciadora' || top === 'arquitetura' || top === 'broker') return top;
  return 'outras';
}

/** Empresa do Radar de Aproximação (o que a teia usa do GET /crm/empresas?radar=true). */
export interface EmpresaRadar {
  id: string;
  razaoSocial: string;
  classificacao: string | null;
  ultimoContato: string | null;
}

/** Categoria de um alvo do radar sem negócio = classificação do cadastro. */
function categoriaDeClassificacao(c: string | null): Categoria {
  const low = (c ?? '').toLowerCase();
  if (low === 'gerenciadora') return 'gerenciadora';
  if (low === 'arquitetura') return 'arquitetura';
  if (low === 'broker') return 'broker';
  return 'outras';
}

/** Dias desde o último contato registrado no cadastro (null = sem registro). */
function diasDesdeContato(ultimoContato: string | null): number | null {
  if (!ultimoContato) return null;
  const t = new Date(ultimoContato).getTime();
  return Number.isFinite(t) ? Math.floor((Date.now() - t) / 86_400_000) : null;
}

type Drag =
  | { modo: 'pan'; px: number; py: number; baseTx: number; baseTy: number; moved: boolean }
  | { modo: 'no'; id: string; px: number; py: number; baseDx: number; baseDy: number; moved: boolean };

/** Escala e offsets reais do conteúdo dentro do <svg> (preserveAspectRatio meet letterboxa). */
function geomSvg(svg: SVGSVGElement): { s: number; ox: number; oy: number; left: number; top: number } {
  const r = svg.getBoundingClientRect();
  const s = Math.min(r.width / W, r.height / H);
  return { s, ox: (r.width - W * s) / 2, oy: (r.height - H * s) / 2, left: r.left, top: r.top };
}

export default function TeiaIndicacoes({
  oportunidades,
  radar = [],
  onDrill,
}: {
  oportunidades: Oportunidade[];
  /** empresas-alvo do Radar de Aproximação (aparecem mesmo sem indicação) */
  radar?: EmpresaRadar[];
  onDrill: (title: string, ops: Oportunidade[]) => void;
}) {
  const [hover, setHover] = useState<Nodo | null>(null);
  const [mouse, setMouse] = useState<{ x: number; y: number; cw: number } | null>(null);
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const [filtro, setFiltro] = useState<Categoria | 'todas'>('todas');
  const [soRadar, setSoRadar] = useState(false);
  const [ano, setAno] = useState<'todos' | number>('todos');
  /** Deslocamento manual por indicadora (arrasto move o cluster inteiro).
   *  Guardado junto com a identidade do layout base: layout novo → arrastos
   *  antigos descartados sem precisar de effect. */
  const [offsBox, setOffsBox] = useState<{ base: unknown; offs: Record<string, { dx: number; dy: number }> }>({ base: null, offs: {} });
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const arrastouRef = useRef(false); // suprime o clique que vem depois de um arrasto

  /** Anos com indicação (pro filtro de período). */
  const anos = useMemo(() => {
    const ys = new Set<number>();
    for (const o of oportunidades) {
      if (o.origemEmpresa) ys.add(new Date(o.dataEntradaPipeline ?? o.createdAt).getFullYear());
    }
    return [...ys].sort((a, b) => b - a);
  }, [oportunidades]);

  const { nodos, links, indDe, categorias } = useMemo(() => {
    const comInd = oportunidades.filter((o) =>
      o.origemEmpresa &&
      (ano === 'todos' || new Date(o.dataEntradaPipeline ?? o.createdAt).getFullYear() === ano));
    const porInd = new Map<string, { nome: string; classificacao: string | null; ops: Oportunidade[] }>();
    for (const op of comInd) {
      const e = op.origemEmpresa!;
      if (!porInd.has(e.id)) porInd.set(e.id, { nome: e.razaoSocial, classificacao: e.classificacao ?? null, ops: [] });
      porInd.get(e.id)!.ops.push(op);
    }
    const indDe = new Map<string, string>(); // id do negócio → id da indicadora
    const categorias = new Set<Categoria>();
    const radarIds = new Set(radar.map((e) => e.id));
    // alvos do radar que ainda não indicaram nada — entram tracejados
    const radarSo = radar.filter((e) => !porInd.has(e.id));
    if (!porInd.size && !radarSo.length) return { nodos: [] as Nodo[], links: [] as [Nodo, Nodo][], indDe, categorias };

    const grupos = [...porInd.entries()].map(([id, g]) => ({ id, ...g, cat: categoriaDe(g.ops, g.classificacao) }));
    grupos.forEach((g) => categorias.add(g.cat));
    radarSo.forEach((e) => categorias.add(categoriaDeClassificacao(e.classificacao)));
    const visiveis = (filtro === 'todas' ? grupos : grupos.filter((g) => g.cat === filtro))
      .filter((g) => !soRadar || radarIds.has(g.id));
    const radarVisiveis = radarSo.filter((e) => filtro === 'todas' || categoriaDeClassificacao(e.classificacao) === filtro);
    if (!visiveis.length && !radarVisiveis.length) return { nodos: [] as Nodo[], links: [] as [Nodo, Nodo][], indDe, categorias };

    const opsVisiveis = visiveis.flatMap((g) => g.ops);
    const maxValor = Math.max(1, ...opsVisiveis.map(val));
    const rNeg = (v: number) => 4 + 18 * Math.sqrt((v || 0) / maxValor);
    const maxTotal = Math.max(1, ...visiveis.map((g) => g.ops.reduce((s, o) => s + val(o), 0)));
    const rInd = (t: number) => 10 + 14 * Math.sqrt(t / maxTotal);

    const nodos: Nodo[] = [];
    const links: [Nodo, Nodo][] = [];
    for (const g of visiveis) {
      const total = g.ops.reduce((s, o) => s + val(o), 0);
      const anc = filtro === 'todas' ? ANCORAS[g.cat] : { x: W / 2, y: H / 2 };
      const a = hash01(g.id) * Math.PI * 2;
      const diasUltima = diasDesdeUltima(g.ops);
      const ind: NodoInd = {
        tipo: 'ind', id: g.id, nome: g.nome, total, ops: g.ops, r: rInd(total), cat: g.cat,
        diasUltima, esfriando: g.ops.length >= 2 && diasUltima > 60,
        radar: radarIds.has(g.id), diasContato: null,
        x: anc.x + Math.cos(a) * 130, y: anc.y + Math.sin(a) * 90, vx: 0, vy: 0,
      };
      nodos.push(ind);
      for (const op of g.ops) {
        const b = hash01(op.id) * Math.PI * 2;
        const neg: NodoNeg = {
          tipo: 'neg', id: op.id, op, res: resultadoDe(op), r: rNeg(val(op)), cat: g.cat,
          x: ind.x + Math.cos(b) * 55, y: ind.y + Math.sin(b) * 55, vx: 0, vy: 0,
        };
        nodos.push(neg);
        links.push([ind, neg]);
        indDe.set(op.id, g.id);
      }
    }

    // Alvos do radar sem indicação: nós tracejados no cluster do segmento.
    for (const e of radarVisiveis) {
      const cat = categoriaDeClassificacao(e.classificacao);
      const anc = filtro === 'todas' ? ANCORAS[cat] : { x: W / 2, y: H / 2 };
      const a = hash01(e.id) * Math.PI * 2;
      const diasContato = diasDesdeContato(e.ultimoContato);
      nodos.push({
        tipo: 'ind', id: e.id, nome: e.razaoSocial, total: 0, ops: [], r: 11, cat,
        diasUltima: 0, esfriando: diasContato !== null && diasContato > 45,
        radar: true, diasContato,
        x: anc.x + Math.cos(a) * 150, y: anc.y + Math.sin(a) * 100, vx: 0, vy: 0,
      } satisfies NodoInd);
    }

    // Simulação: repulsão (indicadoras bem mais fortes = clusters espaçados),
    // mola nos links, âncora do grupo e separação por colisão.
    const ancoraDe = (n: Nodo) => (filtro === 'todas' ? ANCORAS[n.cat] : { x: W / 2, y: H / 2 });
    for (let passo = 0; passo < 320; passo++) {
      const esfria = 1 - passo / 320;
      for (let i = 0; i < nodos.length; i++) {
        const a = nodos[i];
        for (let j = i + 1; j < nodos.length; j++) {
          const b = nodos[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) { dx = (hash01(a.id + j) - 0.5); dy = (hash01(b.id + i) - 0.5); d2 = 1; }
          const d = Math.sqrt(d2);
          const forca = (a.tipo === 'ind' && b.tipo === 'ind' ? 7200 : 460) / d2;
          const fx = (dx / d) * forca, fy = (dy / d) * forca;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
          const minD = a.r + b.r + 7;
          if (d < minD) {
            const emp = (minD - d) / 2;
            a.vx += (dx / d) * emp; a.vy += (dy / d) * emp;
            b.vx -= (dx / d) * emp; b.vy -= (dy / d) * emp;
          }
        }
      }
      for (const [a, b] of links) {
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const alvo = a.r + b.r + 30;
        const f = (d - alvo) * 0.05;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
      for (const n of nodos) {
        const anc = ancoraDe(n);
        const forcaAnc = n.tipo === 'ind' ? 0.028 : 0.01;
        n.vx += (anc.x - n.x) * forcaAnc;
        n.vy += (anc.y - n.y) * (forcaAnc * 1.4); // segura mais na vertical (canvas baixo)
        n.x += n.vx * 0.08 * esfria;
        n.y += n.vy * 0.08 * esfria;
        n.vx *= 0.55; n.vy *= 0.55;
        const mx = n.tipo === 'ind' ? 70 : 10; // margem extra pro rótulo da indicadora
        n.x = Math.max(n.r + mx, Math.min(W - n.r - mx, n.x));
        n.y = Math.max(n.r + 34, Math.min(H - n.r - 12, n.y));
      }
    }
    return { nodos, links, indDe, categorias };
  }, [oportunidades, radar, filtro, soRadar, ano]);

  /** Posições salvas pelo usuário (Bruno 20/10: arrasto tem que persistir).
   *  Guardadas como posição ABSOLUTA por empresa e por vista (filtro+radar),
   *  no localStorage — sobrevive a reload e a layout novo (offset é derivado). */
  const chavePos = `teia-pos:v1:${filtro}:${soRadar ? 1 : 0}`;
  const posSalvas = useMemo<Record<string, { x: number; y: number }>>(() => {
    void nodos; // layout novo relê o storage (pode ter sido salvo depois da 1ª leitura)
    try {
      return JSON.parse(localStorage.getItem(chavePos) ?? '{}');
    } catch {
      return {};
    }
  }, [chavePos, nodos]);

  const offs = useMemo<Record<string, { dx: number; dy: number }>>(() => {
    if (offsBox.base === nodos) return offsBox.offs;
    const derivados: Record<string, { dx: number; dy: number }> = {};
    for (const n of nodos) {
      if (n.tipo !== 'ind') continue;
      const s = posSalvas[n.id];
      if (s && Number.isFinite(s.x) && Number.isFinite(s.y)) derivados[n.id] = { dx: s.x - n.x, dy: s.y - n.y };
    }
    return derivados;
  }, [offsBox, nodos, posSalvas]);

  /** Persiste a posição final (layout + arrasto) das empresas movidas. */
  const salvarPosicoes = () => {
    try {
      const m: Record<string, { x: number; y: number }> = {};
      for (const n of nodos) {
        if (n.tipo !== 'ind') continue;
        const o = offs[n.id];
        if (o) m[n.id] = { x: n.x + o.dx, y: n.y + o.dy };
      }
      localStorage.setItem(chavePos, JSON.stringify(m));
    } catch {
      /* storage indisponível (modo privado etc.) — segue sem persistir */
    }
  };

  // Zoom pelo scroll precisa de listener não-passivo (preventDefault barra o scroll da página)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const g = geomSvg(svg);
      const ux = (e.clientX - g.left - g.ox) / g.s;
      const uy = (e.clientY - g.top - g.oy) / g.s;
      const fator = Math.exp(-e.deltaY * 0.0016);
      setView((v) => {
        const k = Math.min(4, Math.max(0.4, v.k * fator));
        return { k, tx: ux - ((ux - v.tx) / v.k) * k, ty: uy - ((uy - v.ty) / v.k) * k };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  if (!nodos.length && filtro === 'todas' && !soRadar) return null;

  /** Posição final do nó = layout da simulação + arrasto manual do cluster. */
  const fin = (n: Nodo): { x: number; y: number } => {
    const indId = n.tipo === 'ind' ? n.id : indDe.get(n.id);
    const o = indId ? offs[indId] : undefined;
    return o ? { x: n.x + o.dx, y: n.y + o.dy } : { x: n.x, y: n.y };
  };

  const zoomBotao = (fator: number) =>
    setView((v) => {
      const k = Math.min(4, Math.max(0.4, v.k * fator));
      const cx = W / 2, cy = H / 2;
      return { k, tx: cx - ((cx - v.tx) / v.k) * k, ty: cy - ((cy - v.ty) / v.k) * k };
    });

  const onPointerDownFundo = (e: React.PointerEvent<SVGSVGElement>) => {
    svgRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = { modo: 'pan', px: e.clientX, py: e.clientY, baseTx: view.tx, baseTy: view.ty, moved: false };
  };

  const onPointerDownInd = (n: NodoInd) => (e: React.PointerEvent) => {
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    const o = offs[n.id] ?? { dx: 0, dy: 0 };
    dragRef.current = { modo: 'no', id: n.id, px: e.clientX, py: e.clientY, baseDx: o.dx, baseDy: o.dy, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d || !svgRef.current) return;
    const g = geomSvg(svgRef.current);
    const dx = (e.clientX - d.px) / g.s;
    const dy = (e.clientY - d.py) / g.s;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.modo === 'pan') {
      setView((v) => ({ ...v, tx: d.baseTx + dx, ty: d.baseTy + dy }));
    } else {
      const id = d.id;
      // base = offs efetivo do render (inclui posições salvas derivadas) — senão
      // o 1º arrasto depois do reload descartaria as posições das outras empresas
      setOffsBox({
        base: nodos,
        offs: { ...offs, [id]: { dx: d.baseDx + dx / view.k, dy: d.baseDy + dy / view.k } },
      });
    }
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    arrastouRef.current = d?.moved ?? false;
    dragRef.current = null;
    if (d?.modo === 'no' && d.moved) salvarPosicoes(); // persiste onde o usuário soltou
  };

  /** Exporta o desenho atual como PNG (2x, fundo branco). */
  const exportarPng = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(W));
    clone.setAttribute('height', String(H));
    clone.setAttribute('style', 'font-family:Arial,Helvetica,sans-serif;background:#ffffff');
    const fundo = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    fundo.setAttribute('width', String(W));
    fundo.setAttribute('height', String(H));
    fundo.setAttribute('fill', '#ffffff');
    clone.insertBefore(fundo, clone.firstChild);
    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = W * 2;
      canvas.height = H * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); return; }
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `teia-indicacoes-${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      }, 'image/png');
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  const larguraTooltip = 260;
  const gruposVisiveis = filtro === 'todas' ? [...categorias] : [];

  return (
    <div
      className="relative"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setMouse({ x: e.clientX - r.left, y: e.clientY - r.top, cw: r.width });
      }}
      onMouseLeave={() => setHover(null)}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-[11px] text-ber-gray">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COR_INDICADORA }} />Indicadora (clique = negócios · arraste = reposiciona)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COR_RESULTADO.aberto }} />Em aberto</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COR_RESULTADO.ganho }} />Ganho</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COR_RESULTADO.perdido }} />Perdido</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border-2 border-dashed bg-white" style={{ borderColor: '#5E6B0F' }} />No radar (sem indicação ainda)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border-2 border-dashed" style={{ borderColor: '#E6A23C' }} />Esfriando</span>
        <span className="text-ber-gray/60">tamanho = valor · scroll = zoom · arraste o fundo = navega</span>
      </div>

      {/* filtros: categoria + ano */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {CATEGORIAS.filter((c) => c.id === 'todas' || categorias.has(c.id as Categoria)).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => { setFiltro(c.id); setView({ k: 1, tx: 0, ty: 0 }); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filtro === c.id
                ? 'bg-ber-carbon text-white border-ber-carbon'
                : 'bg-white text-ber-gray border-ber-border hover:bg-ber-surface'
            }`}
          >
            {c.label}
          </button>
        ))}
        {radar.length > 0 && (
          <button
            type="button"
            onClick={() => { setSoRadar((v) => !v); setView({ k: 1, tx: 0, ty: 0 }); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              soRadar
                ? 'text-white border-transparent'
                : 'bg-white border-ber-border hover:bg-ber-surface'
            }`}
            style={soRadar ? { background: '#5E6B0F' } : { color: '#5E6B0F' }}
          >
            ◎ Radar
          </button>
        )}
        {anos.length > 1 && (
          <select
            value={String(ano)}
            onChange={(e) => { setAno(e.target.value === 'todos' ? 'todos' : Number(e.target.value)); setView({ k: 1, tx: 0, ty: 0 }); }}
            className="ml-1 border border-ber-border rounded-full px-3 py-1.5 text-xs text-ber-gray bg-white focus:outline-none focus:border-ber-teal"
            aria-label="Filtrar por ano"
          >
            <option value="todos">Todos os anos</option>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
      </div>

      {/* controles de zoom */}
      <div className="absolute right-2 top-16 z-10 flex flex-col gap-1">
        <button type="button" onClick={() => zoomBotao(1.35)} aria-label="Aproximar"
          className="w-9 h-9 rounded-lg bg-white border border-ber-border text-ber-carbon flex items-center justify-center hover:bg-ber-surface shadow-sm">
          <Plus size={16} />
        </button>
        <button type="button" onClick={() => zoomBotao(1 / 1.35)} aria-label="Afastar"
          className="w-9 h-9 rounded-lg bg-white border border-ber-border text-ber-carbon flex items-center justify-center hover:bg-ber-surface shadow-sm">
          <Minus size={16} />
        </button>
        <button type="button" onClick={() => { setView({ k: 1, tx: 0, ty: 0 }); setOffsBox({ base: nodos, offs: {} }); try { localStorage.removeItem(chavePos); } catch { /* sem storage */ } }} aria-label="Restaurar desenho"
          className="w-9 h-9 rounded-lg bg-white border border-ber-border text-ber-gray flex items-center justify-center hover:bg-ber-surface shadow-sm">
          <RotateCcw size={14} />
        </button>
        <button type="button" onClick={exportarPng} aria-label="Baixar imagem da teia"
          className="w-9 h-9 rounded-lg bg-white border border-ber-border text-ber-gray flex items-center justify-center hover:bg-ber-surface shadow-sm">
          <Download size={14} />
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full cursor-grab active:cursor-grabbing select-none"
        style={{ height: 'clamp(300px, 36vw, 520px)', touchAction: 'pan-y' }}
        role="img"
        aria-label="Teia de indicações: empresas indicadoras conectadas aos negócios"
        onPointerDown={onPointerDownFundo}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          {/* rótulos dos grupos (só no modo Todas) */}
          {gruposVisiveis.map((cat) => (
            <text
              key={`g-${cat}`} x={ANCORAS[cat].x} y={22} textAnchor="middle"
              fontSize={12} fontWeight={700} letterSpacing={2} fill="#B9BBAF"
              className="pointer-events-none"
            >
              {GRUPO_LABEL[cat]}
            </text>
          ))}
          {links.map(([a, b]) => {
            const pa = fin(a), pb = fin(b);
            return <line key={`${a.id}-${b.id}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#D4D6CA" strokeWidth={1.2} />;
          })}
          {nodos.map((n) => {
            const p = fin(n);
            return (
              <g
                key={n.id}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover((h) => (h?.id === n.id ? null : h))}
                onPointerDown={n.tipo === 'ind' ? onPointerDownInd(n) : undefined}
                onClick={() => {
                  if (arrastouRef.current) { arrastouRef.current = false; return; }
                  if (n.tipo === 'ind') { if (n.ops.length) onDrill(`Indicados por ${n.nome}`, n.ops); }
                  else onDrill(n.op.titulo, [n.op]); // negócio: abre os detalhes dele
                }}
                className={n.tipo === 'ind' ? 'cursor-move' : 'cursor-pointer'}
              >
                {/* alvo de toque maior que o nó (mobile) */}
                <circle cx={p.x} cy={p.y} r={Math.max(n.r, 16)} fill="transparent" />
                {/* anel de alerta: esfriando (sem indicar há 60+ dias; radar sem contato há 45+) */}
                {n.tipo === 'ind' && n.esfriando && (
                  <circle cx={p.x} cy={p.y} r={n.r + 5} fill="none" stroke="#E6A23C" strokeWidth={2.5} strokeDasharray="5 4" />
                )}
                {n.tipo === 'ind' && !n.ops.length ? (
                  /* alvo do radar sem indicação: nó tracejado (acende quando indicar) */
                  <circle
                    cx={p.x} cy={p.y} r={n.r}
                    fill="#FFFFFF" stroke="#5E6B0F" strokeWidth={2} strokeDasharray="5 4"
                  />
                ) : (
                  <circle
                    cx={p.x} cy={p.y} r={n.r}
                    fill={n.tipo === 'ind' ? COR_INDICADORA : COR_RESULTADO[n.res]}
                    stroke="#F7F7F5" strokeWidth={2}
                    opacity={hover && hover.id !== n.id && hover.tipo === 'ind' && n.tipo === 'neg' && !(hover as NodoInd).ops.some((o) => o.id === n.id) ? 0.35 : 1}
                  />
                )}
              </g>
            );
          })}
          {/* rótulos numa camada própria, por cima de todos os nós, com halo */}
          {nodos.filter((n): n is NodoInd => n.tipo === 'ind').map((n) => {
            const p = fin(n);
            return (
              <text
                key={`l-${n.id}`} x={p.x} y={p.y - n.r - 6} textAnchor="middle"
                fontSize={11.5} fontWeight={700} fill={n.ops.length ? '#1E1E22' : '#5E6B0F'}
                stroke="#F7F7F5" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round"
                className="pointer-events-none"
              >
                {encurta(n.nome)}
              </text>
            );
          })}
        </g>
      </svg>

      {!nodos.length && (
        <p className="text-sm text-ber-gray py-8 text-center">
          {soRadar ? 'Nenhuma empresa do radar nessa categoria.' : 'Nenhuma indicadora nessa categoria.'}
        </p>
      )}

      {hover && mouse && (
        <div
          className="absolute bg-white border border-ber-border rounded-lg shadow-lg px-3 py-2 pointer-events-none z-10"
          style={{
            left: Math.min(mouse.x + 14, Math.max(0, mouse.cw - larguraTooltip)),
            top: mouse.y + 16,
            maxWidth: larguraTooltip,
          }}
        >
          {hover.tipo === 'ind' ? (
            hover.ops.length ? (
              (() => {
                const s = statsInd(hover.ops);
                return (
                  <>
                    <p className="text-xs font-bold text-ber-carbon">{hover.nome}</p>
                    {hover.radar && <p className="text-[11px] font-semibold" style={{ color: '#5E6B0F' }}>◎ no radar de aproximação</p>}
                    <p className="text-[11px] text-ber-gray">{hover.ops.length} indicado{hover.ops.length > 1 ? 's' : ''} · {fmt(hover.total)}</p>
                    <p className="text-[11px] text-ber-gray">
                      <span className="font-semibold" style={{ color: COR_RESULTADO.ganho }}>{s.ganhos} ganho{s.ganhos !== 1 ? 's' : ''}</span>
                      {s.valorGanho > 0 ? ` (${fmt(s.valorGanho)})` : ''} · <span style={{ color: COR_RESULTADO.perdido }}>{s.perdidos} perdido{s.perdidos !== 1 ? 's' : ''}</span> · {s.abertos} em aberto
                    </p>
                    <p className="text-[11px] text-ber-gray">última indicação há {hover.diasUltima} dia{hover.diasUltima !== 1 ? 's' : ''}{hover.esfriando ? ' — esfriando ⚠️' : ''}</p>
                  </>
                );
              })()
            ) : (
              <>
                <p className="text-xs font-bold" style={{ color: '#5E6B0F' }}>{hover.nome}</p>
                <p className="text-[11px] text-ber-gray">◎ no radar · ainda sem indicações</p>
                <p className="text-[11px] text-ber-gray">
                  {hover.diasContato === null
                    ? 'sem contato registrado'
                    : `último contato há ${hover.diasContato} dia${hover.diasContato !== 1 ? 's' : ''}`}
                  {hover.esfriando ? ' — esfriando ⚠️' : ''}
                </p>
              </>
            )
          ) : (
            <>
              <p className="text-xs font-bold text-ber-carbon">{hover.op.titulo}</p>
              <p className="text-[11px] text-ber-gray">
                {val(hover.op) ? fmt(val(hover.op)) : 'sem valor'} · {hover.res === 'aberto' ? 'em aberto' : hover.res}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
