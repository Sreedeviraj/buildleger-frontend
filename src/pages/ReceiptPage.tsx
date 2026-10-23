import { Link, useParams } from 'react-router';
import { ArrowLeft, Printer } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useFinance } from '../api/hooks';
import { Button, buttonClass } from '../components/ui/Button';
import { ErrorBlock, LoadingBlock } from '../components/ui/States';
import { isLive, signedPayment, sum } from '../lib/calc';
import { findOption, PAYMENT_KINDS, PAYMENT_MODES } from '../lib/constants';
import { errorMessage } from '../lib/errors';
import { amountInWords, formatDate, formatDateTime, formatINR } from '../lib/format';

/** Printable payment receipt / refund note. "Save as PDF" in the print dialog gives a downloadable copy. */
export default function ReceiptPage() {
  const { id = '' } = useParams();
  const { session } = useAuth();
  const finance = useFinance();

  if (finance.isLoading) return <LoadingBlock />;
  if (finance.error || !finance.data) return <ErrorBlock message={finance.error ? errorMessage(finance.error) : undefined} onRetry={finance.refetch} />;
  const payment = finance.data.payments.find((p) => p.id === id);
  const project = payment && finance.data.projects.find((p) => p.id === payment.projectId);
  if (!payment || !project || !session) return <ErrorBlock message="This payment was not found." />;

  const isRefund = payment.kind === 'refund';
  // Balance right after this payment: every live payment up to and including it.
  const upToThis = finance.data.payments.filter(
    (p) => p.projectId === project.id && isLive(p) && (p.date < payment.date || (p.date === payment.date && p.createdAt <= payment.createdAt)),
  );
  const receivedToDate = sum(upToThis.map(signedPayment));
  const balance = project.contractValue - receivedToDate;
  const number = `${isRefund ? 'RF' : 'RC'}-${payment.date.replace(/-/g, '')}-${payment.id.slice(-4).toUpperCase()}`;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link to={`/projects/${project.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-800 hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Back to project
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> Print / Save as PDF
        </Button>
      </div>

      <article className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10 print:border-0 print:shadow-none">
        {payment.voided && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-7xl font-black tracking-widest text-red-200/70 -rotate-12" aria-hidden>
            VOID
          </p>
        )}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xl font-bold text-slate-900">{session.company.name}</p>
            {session.company.city && <p className="text-sm text-slate-600">{session.company.city}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-slate-900">{isRefund ? 'Refund note' : 'Payment receipt'}</p>
            <p className="text-sm text-slate-600">No. {number}</p>
            <p className="text-sm text-slate-600">Date {formatDate(payment.date)}</p>
          </div>
        </header>

        <p className="mt-6 text-base leading-relaxed text-slate-800">
          {isRefund ? 'Refunded to' : 'Received with thanks from'} <strong>{project.clientName}</strong> the sum of{' '}
          <strong className="tabular-nums">{formatINR(payment.amount)}</strong> ({amountInWords(payment.amount)}) by{' '}
          {findOption(PAYMENT_MODES, payment.mode).label.toLowerCase()}
          {payment.reference && <> (ref. {payment.reference})</>} {isRefund ? 'for' : 'towards'} <strong>{project.name}</strong>.
        </p>

        <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <Item label="Payment type" value={findOption(PAYMENT_KINDS, payment.kind).label} />
          <Item label="Site" value={project.location} />
          {payment.note && <Item label="Note" value={payment.note} />}
          <Item label="Contract value" value={formatINR(project.contractValue)} />
          <Item label="Received to date (after this)" value={formatINR(receivedToDate)} />
          <Item label="Balance due (after this)" value={formatINR(Math.max(balance, 0))} strong />
        </dl>

        {payment.voided && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
            This entry was voided on {formatDateTime(payment.voided.at)} by {payment.voided.byName}: “{payment.voided.reason}”. It is not valid.
          </p>
        )}

        <footer className="mt-10 flex items-end justify-between gap-4 text-sm text-slate-600">
          <p>Recorded by {payment.createdBy}</p>
          <p className="border-t border-slate-400 pt-1">For {session.company.name}</p>
        </footer>
      </article>

      <p className="mt-3 text-center text-xs text-slate-500 print:hidden">
        Tip: choose “Save as PDF” as the printer to download this receipt, then share it on WhatsApp or email.
      </p>
      <div className="mt-4 text-center print:hidden">
        <Link to={`/projects/${project.id}`} className={buttonClass('secondary')}>
          Done
        </Link>
      </div>
    </div>
  );
}

function Item({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3 sm:block">
      <dt className="text-slate-600">{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}`}>{value}</dd>
    </div>
  );
}
