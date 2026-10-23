import type { ReactNode } from 'react';

type Tone = 'neutral' | 'indigo' | 'green' | 'amber' | 'red' | 'orange' | 'sky';

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-300',
  indigo: 'bg-blue-50 text-blue-800 ring-blue-200',
  green: 'bg-blue-50 text-blue-800 ring-blue-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  orange: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  sky: 'bg-sky-50 text-sky-800 ring-sky-200',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ${TONES[tone]}`}>
      {children}
    </span>
  );
}
