import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { CloudOff, RotateCw } from 'lucide-react';
import { Button } from './Button';

export function LoadingBlock() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-64 rounded-lg bg-slate-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-36 rounded-xl bg-slate-200" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-slate-200" />
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <CloudOff className="size-8 text-red-600" aria-hidden />
      <p className="mt-3 text-base font-semibold text-red-800">Something went wrong</p>
      <p className="mt-1 text-base text-red-700">{message ?? 'Please check your internet and try again.'}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          <RotateCw className="size-5" aria-hidden /> Try again
        </Button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, text, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="mt-4 text-base font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-md text-base text-slate-600">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
