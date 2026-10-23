import type { ReactNode } from 'react';
import { CircleCheck } from 'lucide-react';
import { Logo } from '../../components/layout/AppLayout';

const BENEFITS = [
  'See money received, spent and pending for every project',
  'Add an expense from the site in a few seconds',
  'Share a clear statement with your client on WhatsApp',
];

/** Two-column layout for login and sign up: form on the left, product promise on the right. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <div className="mt-1.5 text-sm text-slate-600">{subtitle}</div>
          <div className="mt-7">{children}</div>
        </div>
        <p className="text-center text-xs text-slate-400">© {new Date().getFullYear()} BuildLedger</p>
      </div>

      <div className="relative hidden overflow-hidden bg-navy-900 text-white lg:flex lg:flex-col lg:justify-center lg:px-14">
        <span className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-white/5" aria-hidden />
        <span className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-white/[0.03]" aria-hidden />

        <div className="relative max-w-lg">
          <p className="text-xs font-semibold tracking-[0.18em] text-navy-300 uppercase">For builders & contractors</p>
          <h2 className="mt-3 text-3xl leading-tight font-bold">Know where every rupee of your project goes.</h2>
          <ul className="mt-7 space-y-3.5">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3 text-sm text-navy-100">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-navy-300" aria-hidden />
                {benefit}
              </li>
            ))}
          </ul>

          {/* Sample project card, styled like the app's own cards */}
          <div className="mt-9 rounded-xl border-t-[3px] border-t-navy-300 bg-white p-5 text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">Villa – Kakkanad</p>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800 ring-1 ring-blue-200">Ongoing</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
              <div>
                <p className="text-xs text-slate-500">Money received</p>
                <p className="text-lg font-bold text-navy-800 tabular-nums">₹52,00,000</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Client still owes</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">₹33,00,000</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-navy-800">
                <CircleCheck className="size-3.5" aria-hidden /> On track
              </span>
              <span className="text-slate-500">69% of budget used</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-[69%] rounded-full bg-blue-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
