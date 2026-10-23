import { CircleCheck, TriangleAlert, CircleX } from 'lucide-react';
import type { BudgetHealth } from '../../types';

const HEALTH = {
  good: { label: 'On track', bar: 'bg-blue-600', text: 'text-blue-800', icon: CircleCheck },
  watch: { label: 'Close to budget', bar: 'bg-amber-500', text: 'text-amber-800', icon: TriangleAlert },
  over: { label: 'Over budget', bar: 'bg-red-600', text: 'text-red-700', icon: CircleX },
} satisfies Record<BudgetHealth, unknown>;

/** Bar showing how much of the estimated cost is already spent. Status is shown with icon + words, not just colour. */
export function HealthBar({ percent, health }: { percent: number; health: BudgetHealth }) {
  const style = HEALTH[health];
  const Icon = style.icon;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={`flex items-center gap-1.5 font-semibold ${style.text}`}>
          <Icon className="size-3.5" aria-hidden />
          {style.label}
        </span>
        <span className="font-medium text-slate-600 tabular-nums">{percent}% of budget used</span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Budget used"
      >
        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}
