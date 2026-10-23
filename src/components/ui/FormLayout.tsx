import type { ReactNode } from 'react';

/**
 * Two-column form body on wide screens: the main inputs on the left, the
 * supporting details (date, reference, note, attachments) in a narrower column
 * on the right. On phones and tablets it falls back to one column.
 */
export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,1fr)_20rem]">{children}</div>;
}

export function FormMain({ children }: { children: ReactNode }) {
  return <div className="min-w-0 space-y-5">{children}</div>;
}

export function FormSide({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-5 lg:border-l lg:border-slate-100 lg:pl-8">
      <p className="hidden text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase lg:block">Details</p>
      {children}
    </div>
  );
}

/** Cancel / save row under the form. */
export function FormActions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">{children}</div>;
}
