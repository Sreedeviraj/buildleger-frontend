/** ₹12,50,000 — Indian digit grouping. */
export function formatINR(amount: number): string {
  const sign = amount < 0 ? '−' : '';
  return `${sign}₹${Math.abs(Math.round(amount)).toLocaleString('en-IN')}`;
}

function trimDecimals(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '');
}

/** ₹52 Lakh, ₹1.95 Crore — easier to read than a long number. */
export function amountInWords(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_00_00_000) return `₹${trimDecimals(abs / 1_00_00_000)} Crore`;
  if (abs >= 1_00_000) return `₹${trimDecimals(abs / 1_00_000)} Lakh`;
  if (abs >= 1_000) return `₹${trimDecimals(abs / 1_000)} Thousand`;
  return `₹${abs}`;
}

/** 09 Oct 2026 */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** "2026-10" → "Oct 2026" */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

/** 09 Oct 2026, 3:45 pm */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** yyyy-mm-dd in the user's local time zone. */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}
