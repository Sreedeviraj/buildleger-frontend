import { useState } from 'react';
import type { MonthLine } from '../../lib/calc';
import { formatINR, formatMonth } from '../../lib/format';

// Same meaning as everywhere in the app: blue = money in, light sky = money out.
// Kept far apart in lightness so the two series stay distinct; the table below is the accessible view.
const IN = '#1d4ed8';
const OUT = '#38bdf8';

/** Grouped bars: money in vs money out per month. The table under it is the accessible view. */
export function CashFlowChart({ months }: { months: MonthLine[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...months.flatMap((m) => [m.cashIn, m.cashOut]));
  const shown = hover !== null ? months[hover] : null;

  return (
    <figure className="print:break-inside-avoid">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <figcaption className="font-semibold text-slate-900">Money in and out by month</figcaption>
        <div className="flex gap-4 text-slate-700" aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ background: IN }} /> Money in
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ background: OUT }} /> Money out
          </span>
        </div>
      </div>
      <div className="relative" role="img" aria-label={`Bar chart of money in and out for ${months.length} months. Values are in the table below.`}>
        <div className="flex h-44 items-end gap-1 border-b border-slate-300 px-1" onMouseLeave={() => setHover(null)}>
          {months.map((m, i) => (
            <div
              key={m.month}
              className={`flex h-full flex-1 cursor-default items-end justify-center gap-0.5 rounded-t-md pt-2 ${hover === i ? 'bg-slate-100' : ''}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${formatMonth(m.month)}: in ${formatINR(m.cashIn)}, out ${formatINR(m.cashOut)}`}
            >
              <span className="w-full max-w-4 rounded-t" style={{ height: `${(m.cashIn / max) * 100}%`, background: IN, minHeight: m.cashIn > 0 ? 2 : 0 }} />
              <span className="w-full max-w-4 rounded-t" style={{ height: `${(m.cashOut / max) * 100}%`, background: OUT, minHeight: m.cashOut > 0 ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1 px-1 text-[10px] text-slate-500">
          {months.map((m, i) => (
            <span key={m.month} className="flex-1 truncate text-center">
              {months.length <= 12 || i % Math.ceil(months.length / 12) === 0 ? formatMonth(m.month).replace(' 20', " '") : ''}
            </span>
          ))}
        </div>
        <p className="absolute top-0 left-1 text-[10px] text-slate-400">{formatINR(max)}</p>
        {shown && (
          <div className="pointer-events-none absolute top-2 right-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
            <p className="font-semibold text-slate-900">{formatMonth(shown.month)}</p>
            <p className="flex items-center gap-1.5 text-slate-700">
              <span className="size-2 rounded-sm" style={{ background: IN }} /> In <strong className="ml-auto pl-3 tabular-nums">{formatINR(shown.cashIn)}</strong>
            </p>
            <p className="flex items-center gap-1.5 text-slate-700">
              <span className="size-2 rounded-sm" style={{ background: OUT }} /> Out <strong className="ml-auto pl-3 tabular-nums">{formatINR(shown.cashOut)}</strong>
            </p>
            <p className="mt-0.5 border-t border-slate-100 pt-0.5 text-slate-700">
              Net <strong className={`tabular-nums ${shown.net < 0 ? 'text-red-700' : ''}`}>{formatINR(shown.net)}</strong>
            </p>
          </div>
        )}
      </div>
    </figure>
  );
}
