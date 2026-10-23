// CSV export. Amounts are written as plain numbers (never "₹12,50,000") so spreadsheets can total them.

type Cell = string | number | null | undefined;

function escape(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  const text = String(cell);
  // Prefix formula-like text so spreadsheets don't execute it.
  const safe = /^[=+\-@]/.test(text) && typeof cell === 'string' ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCSV(rows: Cell[][]): string {
  return rows.map((row) => row.map(escape).join(',')).join('\r\n');
}

export function downloadCSV(fileName: string, rows: Cell[][]): void {
  // BOM so Excel reads ₹ and other UTF-8 text correctly.
  const blob = new Blob(['﻿', toCSV(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
