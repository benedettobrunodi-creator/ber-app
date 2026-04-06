import { create } from 'zustand';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function loadPeriod(): string {
  if (typeof window === 'undefined') return currentMonth();
  return localStorage.getItem('ber-period') ?? currentMonth();
}

interface PeriodStore {
  /** Format: "YYYY-MM" */
  period: string;
  setPeriod: (p: string) => void;
  /** Returns display label like "Abr/26" */
  label: () => string;
  /** Returns start/end ISO dates for the selected month */
  range: () => { start: string; end: string };
}

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export const usePeriodStore = create<PeriodStore>((set, get) => ({
  period: loadPeriod(),

  setPeriod: (p: string) => {
    set({ period: p });
    if (typeof window !== 'undefined') localStorage.setItem('ber-period', p);
  },

  label: () => {
    const [y, m] = get().period.split('-');
    return `${MONTHS[parseInt(m, 10) - 1]}/${y.slice(2)}`;
  },

  range: () => {
    const [y, m] = get().period.split('-').map(Number);
    const start = new Date(y, m - 1, 1).toISOString();
    const end = new Date(y, m, 0, 23, 59, 59).toISOString();
    return { start, end };
  },
}));
