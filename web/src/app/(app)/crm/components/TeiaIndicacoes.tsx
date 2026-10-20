'use client';

/**
 * Teia de Indicações (Bruno 20/10/26): grafo de relações empresa indicadora →
 * negócios. Indicadoras são os nós escuros; cada negócio orbita quem o indicou,
 * colorido pelo desfecho (aberto / ganho / perdido). Tamanho = valor.
 *
 * Layout por simulação de força própria (repulsão + mola nos links + centro +
 * anti-sobreposição), rodada de forma síncrona e determinística no useMemo —
 * sem dependência de d3 e sem animação (resultado estático, leve pro mobile).
 * Clique na indicadora abre o drill-down com os negócios dela.
 */
import { useMemo, useState } from 'react';
import { Oportunidade, fmt } from '../types';

const COR_INDICADORA = '#1E1E22';
const COR_RESULTADO: Record<string, string> = {
  aberto: '#5A7A7A',
  ganho: '#3D9E5F',
  perdido: '#E05555',
};
const ETAPAS_PERDA = ['perdido', 'declinado', 'cancelado'];

const W = 900;
const H = 620;

interface NodoBase {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}
interface NodoInd extends NodoBase { tipo: 'ind'; nome: string; total: number; ops: Oportunidade[] }
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

export default function TeiaIndicacoes({
  oportunidades,
  onDrill,
}: {
  oportunidades: Oportunidade[];
  onDrill: (title: string, ops: Oportunidade[]) => void;
}) {
  const [hover, setHover] = useState<Nodo | null>(null);

  const { nodos, links } = useMemo(() => {
    const comInd = oportunidades.filter((o) => o.origemEmpresa);
    const porInd = new Map<string, { nome: string; ops: Oportunidade[] }>();
    for (const op of comInd) {
      const e = op.origemEmpresa!;
      if (!porInd.has(e.id)) porInd.set(e.id, { nome: e.razaoSocial, ops: [] });
      porInd.get(e.id)!.ops.push(op);
    }
    if (!porInd.size) return { nodos: [] as Nodo[], links: [] as [Nodo, Nodo][] };

    const maxValor = Math.max(1, ...comInd.map(val));
    const rNeg = (v: number) => 4 + 18 * Math.sqrt((v || 0) / maxValor);
    const maxTotal = Math.max(1, ...[...porInd.values()].map((g) => g.ops.reduce((s, o) => s + val(o), 0)));
    const rInd = (t: number) => 10 + 14 * Math.sqrt(t / maxTotal);

    const nodos: Nodo[] = [];
    const links: [Nodo, Nodo][] = [];
    for (const [id, g] of porInd) {
      const total = g.ops.reduce((s, o) => s + val(o), 0);
      const a = hash01(id) * Math.PI * 2;
      const ind: NodoInd = {
        tipo: 'ind', id, nome: g.nome, total, ops: g.ops, r: rInd(total),
        x: W / 2 + Math.cos(a) * 200, y: H / 2 + Math.sin(a) * 140, vx: 0, vy: 0,
      };
      nodos.push(ind);
      for (const op of g.ops) {
        const b = hash01(op.id) * Math.PI * 2;
        const neg: NodoNeg = {
          tipo: 'neg', id: op.id, op, res: resultadoDe(op), r: rNeg(val(op)),
          x: ind.x + Math.cos(b) * 60, y: ind.y + Math.sin(b) * 60, vx: 0, vy: 0,
        };
        nodos.push(neg);
        links.push([ind, neg]);
      }
    }

    // Simulação: repulsão (indicadoras mais fortes), mola nos links, atração
    // leve pro centro e separação por colisão. 320 passos bastam pra assentar.
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
          const forca = (a.tipo === 'ind' && b.tipo === 'ind' ? 3800 : 420) / d2;
          const fx = (dx / d) * forca, fy = (dy / d) * forca;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
          const minD = a.r + b.r + 6;
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
        const alvo = a.r + b.r + 34;
        const f = (d - alvo) * 0.045;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
      for (const n of nodos) {
        n.vx += (W / 2 - n.x) * 0.012;
        n.vy += (H / 2 - n.y) * 0.016;
        n.x += n.vx * 0.08 * esfria;
        n.y += n.vy * 0.08 * esfria;
        n.vx *= 0.55; n.vy *= 0.55;
        const mx = n.tipo === 'ind' ? 64 : 10; // margem extra pro rótulo da indicadora
        n.x = Math.max(n.r + mx, Math.min(W - n.r - mx, n.x));
        n.y = Math.max(n.r + 18, Math.min(H - n.r - 12, n.y));
      }
    }
    return { nodos, links };
  }, [oportunidades]);

  if (!nodos.length) return null;

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-[11px] text-ber-gray">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COR_INDICADORA }} />Indicadora (clique = negócios dela)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COR_RESULTADO.aberto }} />Em aberto</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COR_RESULTADO.ganho }} />Ganho</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COR_RESULTADO.perdido }} />Perdido</span>
        <span className="text-ber-gray/60">tamanho = valor</span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label="Teia de indicações: empresas indicadoras conectadas aos negócios">
          {links.map(([a, b]) => (
            <line key={`${a.id}-${b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#D4D6CA" strokeWidth={1.2} />
          ))}
          {nodos.map((n) => (
            <g
              key={n.id}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover((h) => (h?.id === n.id ? null : h))}
              onClick={() => {
                if (n.tipo === 'ind') onDrill(`Indicados por ${n.nome}`, n.ops);
                else setHover((h) => (h?.id === n.id ? null : n)); // mobile: toque mostra o tooltip
              }}
              className="cursor-pointer"
            >
              {/* alvo de toque maior que o nó (mobile) */}
              <circle cx={n.x} cy={n.y} r={Math.max(n.r, 16)} fill="transparent" />
              <circle
                cx={n.x} cy={n.y} r={n.r}
                fill={n.tipo === 'ind' ? COR_INDICADORA : COR_RESULTADO[n.res]}
                stroke="#F7F7F5" strokeWidth={2}
                opacity={hover && hover.id !== n.id && hover.tipo === 'ind' && n.tipo === 'neg' && !(hover as NodoInd).ops.some((o) => o.id === n.id) ? 0.35 : 1}
              />
            </g>
          ))}
          {/* rótulos numa camada própria, por cima de todos os nós, com halo */}
          {nodos.filter((n): n is NodoInd => n.tipo === 'ind').map((n) => (
            <text
              key={`l-${n.id}`} x={n.x} y={n.y - n.r - 6} textAnchor="middle"
              fontSize={11.5} fontWeight={700} fill="#1E1E22"
              stroke="#F7F7F5" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round"
              className="pointer-events-none"
            >
              {encurta(n.nome)}
            </text>
          ))}
        </svg>
      </div>
      {hover && (
        <div className="absolute top-8 right-2 bg-white border border-ber-border rounded-lg shadow-lg px-3 py-2 max-w-[260px] pointer-events-none">
          {hover.tipo === 'ind' ? (
            <>
              <p className="text-xs font-bold text-ber-carbon">{hover.nome}</p>
              <p className="text-[11px] text-ber-gray">{hover.ops.length} negócio{hover.ops.length > 1 ? 's' : ''} indicado{hover.ops.length > 1 ? 's' : ''} · {fmt(hover.total)}</p>
            </>
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
