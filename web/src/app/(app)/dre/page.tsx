'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { ShieldAlert } from 'lucide-react';

/* ────────── constants ────────── */

const MONTHS = [
  'mar25','abr25','mai25','jun25','jul25','ago25','set25','out25',
  'nov25','dez25','jan26','fev26','mar26','abr26','mai26','jun26',
] as const;

const MONTH_LABELS = [
  'Mar/25','Abr/25','Mai/25','Jun/25','Jul/25','Ago/25','Set/25','Out/25',
  'Nov/25','Dez/25','Jan/26','Fev/26','Mar/26','Abr/26','Mai/26','Jun/26',
];

const COLS = ['anual', ...MONTHS] as const;
type Col = (typeof COLS)[number];

// Editable rows + their defaults
const DEFAULT_R3_ANUAL = 25_000_000;
const DEFAULT_R3_MAR = 1_100_000;
const DEFAULT_R3_ABR = 2_500_000;

const DEFAULT_R5_MAR = 990_000;
const DEFAULT_R5_ABR = 2_250_000;

const DEFAULT_R35_ANUAL_MONTHLY = 131_000;
const DEFAULT_R35_MAR = 122_000;
const DEFAULT_R35_ABR = 145_000;

const DEFAULT_R50_ANUAL = 320_000;
const DEFAULT_R50_H = 100_000; // jul25 index=4

const DEFAULT_R54 = 50_000;

// KPIs
const KPIS: Record<string, number> = {
  r5_ratio: 0.9,   // C5 = C3 * 0.9
  r6: 0.7, r7: 0.2, r8: 0.1,
  r10: 0.2, r11: 0.3, r12: 0.5,
  r15: 0.7,
  r18: 0.1, r19: 0.15,
  r26: 0.025, r27: 0.01, r28: 0.03,
  r31: 0.1, r32: 0.15,
  r41: 0.05,
  r47: 0.53, r48: 0.30,
};

const R28_ANUAL = 111_000 * 12;

/* ────────── types ────────── */

interface DbRow { rowKey: string; colKey: string; value: number; kpi?: number | null }
type Grid = Record<string, Record<string, number>>;

/* ────────── helpers ────────── */

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const fmtPct = (v: number) => (isFinite(v) ? (v * 100).toFixed(1) + '%' : '—');

/* ────────── component ────────── */

export default function DREPage() {
  const { user } = useAuthStore();
  const [raw, setRaw] = useState<Grid>({});
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<DbRow[]>([]);

  /* ── load ── */
  useEffect(() => {
    if (user?.role !== 'diretoria') return;
    api.get('/dre').then(({ data }) => {
      const grid: Grid = {};
      (data.data as DbRow[]).forEach(({ rowKey, colKey, value, kpi }) => {
        if (!grid[rowKey]) grid[rowKey] = {};
        grid[rowKey][colKey] = value;
        if (kpi != null) {
          if (!grid[`${rowKey}_kpi`]) grid[`${rowKey}_kpi`] = {};
          grid[`${rowKey}_kpi`][colKey] = kpi;
        }
      });
      setRaw(grid);
    }).finally(() => setLoading(false));
  }, [user]);

  /* ── auto-save with debounce ── */
  const flush = useCallback(() => {
    if (pendingRef.current.length === 0) return;
    const items = [...pendingRef.current];
    pendingRef.current = [];
    api.put('/dre', items).catch(() => {
      // re-enqueue on failure
      pendingRef.current.push(...items);
    });
  }, []);

  const enqueue = useCallback((rowKey: string, colKey: string, value: number, kpi?: number | null) => {
    pendingRef.current = pendingRef.current.filter(
      (p) => !(p.rowKey === rowKey && p.colKey === colKey),
    );
    const item: DbRow = { rowKey, colKey, value };
    if (kpi != null) item.kpi = kpi;
    pendingRef.current.push(item);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 1000);
  }, [flush]);

  const setCell = useCallback((row: string, col: string, value: number) => {
    setRaw((prev) => {
      const next = { ...prev };
      if (!next[row]) next[row] = {};
      next[row] = { ...next[row], [col]: value };
      return next;
    });
    enqueue(row, col, value);
  }, [enqueue]);

  /* ── editable getters (with defaults) ── */
  const g = useCallback((row: string, col: string, def?: number): number => {
    return raw[row]?.[col] ?? def ?? 0;
  }, [raw]);

  /* ── full computed grid ── */
  const computed = useMemo(() => {
    const out: Record<string, Record<Col, number>> = {};
    const set = (row: string, col: Col, v: number) => {
      if (!out[row]) out[row] = {} as Record<Col, number>;
      out[row][col] = v;
    };
    const get = (row: string, col: Col): number => out[row]?.[col] ?? 0;

    // ── R3: Valor Referência ──
    set('r3', 'anual', g('r3', 'anual', DEFAULT_R3_ANUAL));
    set('r3', 'mar25', g('r3', 'mar25', DEFAULT_R3_MAR));
    set('r3', 'abr25', g('r3', 'abr25', DEFAULT_R3_ABR));
    for (let i = 2; i < MONTHS.length; i++) {
      set('r3', MONTHS[i], g('r3', MONTHS[i], get('r3', MONTHS[i - 1])));
    }

    // ── R5: Receita Bruta ──
    set('r5', 'anual', get('r3', 'anual') * KPIS.r5_ratio);
    set('r5', 'mar25', g('r5', 'mar25', DEFAULT_R5_MAR));
    set('r5', 'abr25', g('r5', 'abr25', DEFAULT_R5_ABR));
    for (let i = 2; i < MONTHS.length; i++) {
      set('r5', MONTHS[i], g('r5', MONTHS[i], get('r5', MONTHS[i - 1])));
    }

    // ── R6-R8: Breakdown vendas ──
    for (const col of COLS) {
      const r5 = get('r5', col);
      set('r6', col, KPIS.r6 * r5);
      set('r7', col, KPIS.r7 * r5);
      set('r8', col, KPIS.r8 * r5);
    }

    // ── R10-R12: Canais ──
    for (const col of COLS) {
      const r5 = get('r5', col);
      set('r10', col, KPIS.r10 * r5);
      set('r11', col, KPIS.r11 * r5);
      set('r12', col, KPIS.r12 * r5);
    }

    // ── R15: Deduções Faturamento Direto ──
    for (const col of COLS) {
      set('r15', col, KPIS.r15 * get('r5', col));
    }

    // ── R17: Receita Bruta líquida ──
    for (const col of COLS) {
      set('r17', col, get('r5', col) - get('r15', col));
    }

    // ── R18: Savings ──
    for (const col of COLS) {
      set('r18', col, KPIS.r18 * get('r5', col));
    }

    // ── R19: Imposto savings ──
    for (const col of COLS) {
      set('r19', col, KPIS.r19 * get('r18', col));
    }

    // ── R21: Receita Líquida ──
    for (const col of COLS) {
      set('r21', col, get('r17', col) + get('r18', col) - get('r19', col));
    }

    // ── R23: Custo das Vendas ──
    for (const col of COLS) {
      set('r23', col, get('r21', col));
    }

    // ── R28: MO Direta ──
    set('r28', 'anual', R28_ANUAL);
    for (const m of MONTHS) {
      set('r28', m, KPIS.r28 * get('r5', m));
    }

    // ── R26: Budget Prêmios ──
    set('r26', 'anual', KPIS.r26 * get('r5', 'anual'));
    for (const m of MONTHS) {
      set('r26', m, KPIS.r26 * get('r23', m));
    }

    // ── R27: Budget Discricionárias ──
    for (const col of COLS) {
      set('r27', col, KPIS.r27 * get('r23', col));
    }

    // ── R25: Fornecedores ──
    for (const col of COLS) {
      set('r25', col, get('r17', col) - get('r26', col) - get('r27', col) - get('r28', col));
    }

    // ── R31: Taxa Adm ──
    set('r31', 'anual', get('r3', 'anual') * KPIS.r31);
    // março: r3 - r5
    set('r31', 'mar25', get('r3', 'mar25') - get('r5', 'mar25'));
    for (let i = 1; i < MONTHS.length; i++) {
      const r3m = get('r3', MONTHS[i]);
      const r5m = get('r5', MONTHS[i]);
      const r3ref = get('r3', MONTHS[i]);
      set('r31', MONTHS[i], r3ref > 0 ? 277_000 * (r5m / r3ref) : r3m - r5m);
    }

    // ── R32: Imposto ADM ──
    for (const col of COLS) {
      set('r32', col, KPIS.r32 * get('r31', col));
    }

    // ── R33: Savings (margem) ──
    for (const col of COLS) {
      set('r33', col, get('r18', col) - get('r19', col));
    }

    // ── R30: Margem de Contribuição ──
    for (const col of COLS) {
      set('r30', col, (get('r31', col) - get('r32', col)) + get('r33', col));
    }

    // ── R35: Despesas Fixas (editável) ──
    set('r35', 'anual', g('r35', 'anual', DEFAULT_R35_ANUAL_MONTHLY * 12));
    set('r35', 'mar25', g('r35', 'mar25', DEFAULT_R35_MAR));
    set('r35', 'abr25', g('r35', 'abr25', DEFAULT_R35_ABR));
    for (let i = 2; i < MONTHS.length; i++) {
      set('r35', MONTHS[i], g('r35', MONTHS[i], get('r35', MONTHS[i - 1])));
    }

    // ── R37: Geração de Caixa ──
    for (const col of COLS) {
      set('r37', col, get('r30', col) - get('r35', col));
    }

    // ── R38: % margem EBITDA ──
    for (const col of COLS) {
      const r17 = get('r17', col);
      set('r38', col, r17 !== 0 ? get('r37', col) / r17 : 0);
    }

    // ── R41: Liabilities/Sinistro ──
    for (const col of COLS) {
      set('r41', col, KPIS.r41 * get('r37', col));
    }

    // ── R50: Saída Eduardo (editável) ──
    set('r50', 'anual', g('r50', 'anual', DEFAULT_R50_ANUAL));
    for (let i = 0; i < MONTHS.length; i++) {
      const def = i === 4 ? DEFAULT_R50_H : 0; // jul25
      set('r50', MONTHS[i], g('r50', MONTHS[i], def));
    }

    // ── R46: Lucro ──
    for (const col of COLS) {
      set('r46', col, get('r37', col) - get('r41', col) - get('r50', col));
    }

    // ── R49: Reserva Burn-in ──
    const c49 = (get('r35', 'anual') / 12) * 3;
    const c46 = get('r46', 'anual');
    const b49 = c46 !== 0 ? c49 / c46 : 0;
    for (const col of COLS) {
      set('r49', col, get('r46', col) * b49);
    }

    // ── R47: Adiantamento dividendos ──
    for (const col of COLS) {
      set('r47', col, KPIS.r47 * get('r46', col));
    }

    // ── R48: Reserva Opex ──
    for (const col of COLS) {
      set('r48', col, KPIS.r48 * get('r46', col));
    }

    // ── R53: 3x Burn-in (só anual) ──
    set('r53', 'anual', get('r35', 'anual') * 3);

    // ── R54: Opex ──
    set('r54', 'anual', g('r54', 'anual', DEFAULT_R54));

    return out;
  }, [raw, g]);

  /* ── row definitions for rendering ── */
  type RowDef = {
    key: string;
    label: string;
    kpiLabel?: string;
    isBold?: boolean;
    isPct?: boolean;
    editable?: boolean | 'months' | 'anual';
    editableMonths?: boolean;
    indent?: boolean;
    separator?: boolean;
  };

  const ROWS: RowDef[] = [
    { key: 'r3',  label: 'Valor Referência', editable: true },
    { key: '_sep1', label: '', separator: true },
    { key: 'r5',  label: '1. RECEITA BRUTA', isBold: true },
    { key: 'r6',  label: 'Venda Corporativo', kpiLabel: `KPI<${(KPIS.r6 * 100)}%`, indent: true },
    { key: 'r7',  label: 'Venda Residencial', kpiLabel: `KPI<${(KPIS.r7 * 100)}%`, indent: true },
    { key: 'r8',  label: 'Venda Hospedagem', kpiLabel: `KPI<${(KPIS.r8 * 100)}%`, indent: true },
    { key: '_sep2', label: '', separator: true },
    { key: 'r10', label: 'Gerenciadora', kpiLabel: `${(KPIS.r10 * 100)}%`, indent: true },
    { key: 'r11', label: 'Arquitetura', kpiLabel: `${(KPIS.r11 * 100)}%`, indent: true },
    { key: 'r12', label: 'Networking', kpiLabel: `${(KPIS.r12 * 100)}%`, indent: true },
    { key: '_sep3', label: '', separator: true },
    { key: 'r15', label: 'Deduções Faturamento Direto', kpiLabel: `~${(KPIS.r15 * 100)}%` },
    { key: '_sep4', label: '', separator: true },
    { key: 'r17', label: 'RECEITA BRUTA líquida', isBold: true },
    { key: 'r18', label: 'Savings', kpiLabel: `${(KPIS.r18 * 100)}%`, indent: true },
    { key: 'r19', label: 'Imposto savings', kpiLabel: `${(KPIS.r19 * 100)}%`, indent: true },
    { key: '_sep5', label: '', separator: true },
    { key: 'r21', label: '2. RECEITA LÍQUIDA', isBold: true },
    { key: '_sep6', label: '', separator: true },
    { key: 'r23', label: '(-) CUSTO DAS VENDAS', isBold: true },
    { key: 'r25', label: 'Fornecedores', indent: true },
    { key: 'r26', label: 'Budget Prêmios', kpiLabel: `${(KPIS.r26 * 100)}%`, indent: true },
    { key: 'r27', label: 'Budget Discricionárias', kpiLabel: `${(KPIS.r27 * 100)}%`, indent: true },
    { key: 'r28', label: 'MO Direta', kpiLabel: `${(KPIS.r28 * 100)}%`, indent: true },
    { key: '_sep7', label: '', separator: true },
    { key: 'r30', label: '3. MARGEM DE CONTRIBUIÇÃO', isBold: true },
    { key: 'r31', label: 'Taxa Adm', kpiLabel: `${(KPIS.r31 * 100)}%`, indent: true },
    { key: 'r32', label: 'Imposto ADM', kpiLabel: `${(KPIS.r32 * 100)}%`, indent: true },
    { key: 'r33', label: 'Savings (margem)', indent: true },
    { key: '_sep8', label: '', separator: true },
    { key: 'r35', label: '3.5 DESPESAS FIXAS', isBold: true, editable: true },
    { key: '_sep9', label: '', separator: true },
    { key: 'r37', label: '4. GERAÇÃO DE CAIXA', isBold: true },
    { key: 'r38', label: '% margem EBITDA', isPct: true, indent: true },
    { key: '_sep10', label: '', separator: true },
    { key: 'r41', label: '5. LIABILITIES/SINISTRO', isBold: true, kpiLabel: `${(KPIS.r41 * 100)}%` },
    { key: '_sep11', label: '', separator: true },
    { key: 'r46', label: '7. LUCRO', isBold: true },
    { key: 'r47', label: 'Adiantamento dividendos', kpiLabel: `${(KPIS.r47 * 100)}%`, indent: true },
    { key: 'r48', label: 'Reserva Opex', kpiLabel: `${(KPIS.r48 * 100)}%`, indent: true },
    { key: 'r49', label: 'Reserva Burn-in', indent: true },
    { key: 'r50', label: 'Saída Eduardo', editable: true },
    { key: '_sep12', label: '', separator: true },
    { key: 'r53', label: '3x Burn-in', editable: 'anual' },
    { key: 'r54', label: 'Opex', editable: 'anual' },
  ];

  const BOLD_ROWS = new Set(['r5','r17','r21','r23','r30','r37','r41','r46']);
  const EDITABLE_ROWS = new Set(['r3', 'r35', 'r50']);

  /* ── access guard ── */
  if (user?.role !== 'diretoria') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-gray-500">
        <ShieldAlert size={48} />
        <p className="text-lg font-medium">Acesso restrito à Diretoria</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-ber-olive" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-4">DRE — Demonstrativo de Resultados</h1>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-max w-full text-xs">
          <thead>
            <tr className="bg-gray-100 text-gray-600 uppercase text-[10px]">
              <th className="sticky left-0 z-10 bg-gray-100 px-3 py-2 text-left min-w-[220px]">Linha</th>
              <th className="px-3 py-2 text-left min-w-[60px]">KPI</th>
              {COLS.map((col, i) => (
                <th key={col} className="px-3 py-2 text-right min-w-[110px]">
                  {col === 'anual' ? 'Orç. Anual' : MONTH_LABELS[i - 1]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, idx) => {
              if (row.separator) {
                return <tr key={row.key} className="h-1 bg-gray-50"><td colSpan={COLS.length + 2} /></tr>;
              }

              const isBold = row.isBold || BOLD_ROWS.has(row.key);
              const zebra = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
              const boldBg = isBold ? 'bg-blue-50/60 font-semibold' : '';

              return (
                <tr key={row.key} className={`${boldBg || zebra} hover:bg-yellow-50/40 transition-colors`}>
                  {/* Label */}
                  <td className={`sticky left-0 z-10 px-3 py-1.5 whitespace-nowrap ${boldBg || zebra} ${row.indent ? 'pl-8' : ''}`}>
                    {row.label}
                  </td>
                  {/* KPI */}
                  <td className="px-3 py-1.5 text-gray-400 text-[10px]">{row.kpiLabel || ''}</td>
                  {/* Values */}
                  {COLS.map((col) => {
                    const val = computed[row.key]?.[col] ?? 0;
                    const isEditable =
                      row.editable === true ||
                      (row.editable === 'anual' && col === 'anual') ||
                      (row.editableMonths && col !== 'anual');

                    // Check if truly editable
                    const canEdit = EDITABLE_ROWS.has(row.key) || (row.editable === 'anual' && col === 'anual');

                    if (canEdit) {
                      return (
                        <td key={col} className="px-1 py-0.5">
                          <CellInput
                            value={val}
                            onChange={(v) => setCell(row.key, col, v)}
                          />
                        </td>
                      );
                    }

                    return (
                      <td key={col} className={`px-3 py-1.5 text-right tabular-nums ${isBold ? 'font-semibold' : ''}`}>
                        {row.isPct ? fmtPct(val) : fmtBRL(val)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ────────── inline editable cell ────────── */

function CellInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setText(String(Math.round(value)));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = () => {
    setEditing(false);
    const parsed = parseFloat(text.replace(/[^\d.,-]/g, '').replace(',', '.'));
    if (!isNaN(parsed) && parsed !== value) {
      onChange(parsed);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className="w-full bg-yellow-50 border border-yellow-300 rounded px-2 py-1 text-right text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-yellow-400"
        autoFocus
      />
    );
  }

  return (
    <button
      onClick={startEdit}
      className="w-full text-right px-2 py-1 rounded hover:bg-yellow-100 cursor-text tabular-nums text-xs text-blue-700 font-medium"
      title="Clique para editar"
    >
      {fmtBRL(value)}
    </button>
  );
}
