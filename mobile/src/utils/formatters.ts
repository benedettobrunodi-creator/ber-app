// ──────────────────────────────────────────────
// Formatting utilities – BRL locale conventions
// ──────────────────────────────────────────────

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/**
 * Format a numeric value as Brazilian Real.
 * @example formatCurrency(1234567.89) → "R$ 1.234.567,89"
 */
export function formatCurrency(value: number): string {
  return BRL.format(value);
}

// ── Date helpers ────────────────────────────────

const MONTHS_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

function toDate(date: string | Date): Date {
  return typeof date === 'string' ? new Date(date) : date;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * @example formatDate('2026-03-08') → "08 Mar 2026"
 */
export function formatDate(date: string | Date): string {
  const d = toDate(date);
  return `${pad(d.getDate())} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * @example formatDateTime('2026-03-08T14:30:00Z') → "08 Mar 2026, 14:30"
 */
export function formatDateTime(date: string | Date): string {
  const d = toDate(date);
  return `${formatDate(d)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * @example formatTime('2026-03-08T14:30:00Z') → "14:30"
 */
export function formatTime(date: string | Date): string {
  const d = toDate(date);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Human-friendly relative time in Portuguese.
 * Falls back to formatDate for dates older than 7 days.
 *
 * @example formatTimeAgo(fiveMinutesAgo) → "há 5 min"
 * @example formatTimeAgo(twoHoursAgo)    → "há 2h"
 * @example formatTimeAgo(threeDaysAgo)   → "há 3 dias"
 * @example formatTimeAgo(twoWeeksAgo)    → "08 Mar"
 */
export function formatTimeAgo(date: string | Date): string {
  const d = toDate(date);
  const now = Date.now();
  const diffMs = now - d.getTime();

  if (diffMs < 0) {
    return formatDate(d);
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffHour < 24) return `há ${diffHour}h`;
  if (diffDay <= 7) return `há ${diffDay} ${diffDay === 1 ? 'dia' : 'dias'}`;

  return formatDate(d);
}

/**
 * Format decimal hours as "Xh YYmin".
 * @example formatHoursWorked(8.5) → "8h 30min"
 * @example formatHoursWorked(2)   → "2h 00min"
 */
export function formatHoursWorked(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${pad(m)}min`;
}

/**
 * Format a raw phone string into Brazilian format.
 * @example formatPhone('11999999999') → "(11) 99999-9999"
 * @example formatPhone('1133334444')  → "(11) 3333-4444"
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  // Return as-is when the digit count is unexpected
  return phone;
}
