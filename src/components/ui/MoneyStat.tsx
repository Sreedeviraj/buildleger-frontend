import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatINR } from '../../lib/format';

type Tone = 'neutral' | 'positive' | 'warning' | 'negative';

const TONES: Record<Tone, { icon: string; amount: string }> = {
  neutral: { icon: 'bg-navy-50 text-navy-700', amount: 'text-slate-900' },
  positive: { icon: 'bg-blue-50 text-blue-700', amount: 'text-navy-800' },
  warning: { icon: 'bg-amber-50 text-amber-700', amount: 'text-amber-800' },
  negative: { icon: 'bg-red-50 text-red-700', amount: 'text-red-700' },
};

interface MoneyStatProps {
  label: string;
  amount: number;
  /** One plain sentence telling what this number means. */
  explain: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
}

export function MoneyStat({ label, amount, explain, icon: Icon, tone = 'neutral' }: MoneyStatProps) {
  const styles = TONES[tone];
  return (
    <div className="rounded-xl border border-slate-200 border-t-navy-800 border-t-[3px] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`flex size-8 items-center justify-center rounded-lg ${styles.icon}`}>
          <Icon className="size-5" aria-hidden />
        </span>
        <p className="text-sm font-semibold text-slate-600">{label}</p>
      </div>
      <p className={`mt-3 text-xl font-bold tabular-nums sm:text-2xl ${styles.amount}`}>
        {formatINR(amount)}
      </p>
      <p className="mt-1 text-sm text-slate-600">{explain}</p>
    </div>
  );
}
