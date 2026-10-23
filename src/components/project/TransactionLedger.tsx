import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  History,
  Paperclip,
  Pencil,
  Printer,
  Receipt,
  SearchX,
  Undo2,
  Wallet,
} from 'lucide-react';
import { useAudit, useVoidBill, useVoidExpense, useVoidPayment } from '../../api/hooks';
import { openAttachment } from '../../lib/attachments';
import { EXPENSE_CATEGORIES } from '../../lib/constants';
import { errorMessage } from '../../lib/errors';
import { formatDate, formatDateTime, formatINR } from '../../lib/format';
import { EMPTY_FILTER, filterLedger, ledgerTotals, type LedgerFilter, type LedgerRow, type LedgerView } from '../../lib/ledger';
import { Badge } from '../ui/Badge';
import { buttonClass } from '../ui/Button';
import { ReasonDialog } from '../ui/ConfirmDialog';
import { inputClass } from '../ui/Fields';
import { EmptyState } from '../ui/States';
import { useToast } from '../ui/Toast';

const PAGE_SIZE = 15;

const VIEWS: { value: LedgerView; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in', label: 'Money received' },
  { value: 'out', label: 'Paid out' },
  { value: 'bills', label: 'Supplier bills' },
  { value: 'unpaid', label: 'Unpaid bills' },
];

const TYPE_STYLE = {
  receipt: { icon: ArrowDownLeft, box: 'bg-blue-50 text-blue-700', amount: 'text-blue-800', sign: '+ ', label: 'Received' },
  refund: { icon: Undo2, box: 'bg-red-50 text-red-700', amount: 'text-red-700', sign: '− ', label: 'Refund' },
  expense: { icon: ArrowUpRight, box: 'bg-indigo-50 text-indigo-700', amount: 'text-slate-900', sign: '− ', label: 'Paid' },
  bill: { icon: FileText, box: 'bg-sky-50 text-sky-700', amount: 'text-sky-900', sign: '', label: 'Bill' },
} as const;

const compactInput = inputClass.replace('mt-1.5 ', '').replace('min-h-11', 'min-h-10').replace('text-base', 'text-sm');

interface TransactionLedgerProps {
  rows: LedgerRow[];
  filter: LedgerFilter;
  onFilterChange: (filter: LedgerFilter) => void;
  canEdit: boolean;
  /** Shown when the list covers several projects. */
  projectNames?: Map<string, string>;
  /** All rows (including other projects) so linked bill payments can be listed. */
  allRows?: LedgerRow[];
  /** Dates come from outside (e.g. the report period), so the date inputs are hidden. */
  fixedDates?: boolean;
  /** Hide the All / Money received / Paid out… switch (list already limited to one type). */
  hideViews?: boolean;
}

export function TransactionLedger({ rows, filter, onFilterChange, canEdit, projectNames, allRows = rows, fixedDates, hideViews }: TransactionLedgerProps) {
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [toVoid, setToVoid] = useState<LedgerRow | null>(null);
  const toast = useToast();
  const voidPayment = useVoidPayment();
  const voidExpense = useVoidExpense();
  const voidBill = useVoidBill();

  const visible = useMemo(() => filterLedger(rows, filter), [rows, filter]);
  const totals = ledgerTotals(visible);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = visible.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const isFiltered =
    JSON.stringify({ ...filter, sort: 'newest', ...(fixedDates && { from: '', to: '' }), ...(hideViews && { view: 'all' }) }) !== JSON.stringify(EMPTY_FILTER);

  const set = (patch: Partial<LedgerFilter>) => {
    setPage(0);
    onFilterChange({ ...filter, ...patch });
  };

  async function confirmVoid(reason: string) {
    if (!toVoid) return;
    try {
      if (toVoid.type === 'bill') await voidBill.mutateAsync([toVoid.id, reason]);
      else if (toVoid.type === 'expense') await voidExpense.mutateAsync([toVoid.id, reason]);
      else await voidPayment.mutateAsync([toVoid.id, reason]);
      toast('Entry voided. It no longer counts in any total.');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setToVoid(null);
    }
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="No money entries yet"
        text="Payments from the client, expenses and supplier bills will appear here as soon as they are added."
      />
    );
  }

  return (
    <div className="@container">
      {/* Filters: laid out by the width of this list, not the screen, so it also fits in a half-width column */}
      <div className={`mb-3 flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 ${hideViews ? 'hidden' : ''}`} role="group" aria-label="Show">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            aria-pressed={filter.view === v.value}
            onClick={() => set({ view: v.value })}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors ${
              filter.view === v.value ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-3 @lg:grid-cols-4 @4xl:grid-cols-6">
        <input
          type="search"
          value={filter.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search note, payee, ref…"
          aria-label="Search entries"
          className={`${compactInput} col-span-2 ${hideViews ? '@lg:col-span-1' : '@lg:col-span-4 @4xl:col-span-2'}`}
        />
        {!hideViews && (
        <select
          value={filter.category}
          onChange={(e) => set({ category: e.target.value as LedgerFilter['category'] })}
          aria-label="Category"
          className={compactInput}
        >
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        )}
        <select value={filter.sort} onChange={(e) => set({ sort: e.target.value as LedgerFilter['sort'] })} aria-label="Sort" className={`${compactInput} ${hideViews ? 'col-span-2 @lg:col-span-1' : ''}`}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="largest">Largest amount</option>
        </select>
        {!fixedDates && (
          <>
            <label className="relative min-w-0">
              <span className="pointer-events-none absolute -top-2 left-2.5 bg-white px-1 text-[11px] font-medium text-slate-500">From</span>
              <input type="date" value={filter.from} max={filter.to || undefined} onChange={(e) => set({ from: e.target.value })} className={`${compactInput} min-w-0`} />
            </label>
            <label className="relative min-w-0">
              <span className="pointer-events-none absolute -top-2 left-2.5 bg-white px-1 text-[11px] font-medium text-slate-500">To</span>
              <input type="date" value={filter.to} min={filter.from || undefined} onChange={(e) => set({ to: e.target.value })} className={`${compactInput} min-w-0`} />
            </label>
          </>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <label className="flex items-center gap-2 text-slate-700">
          <input type="checkbox" checked={filter.showVoided} onChange={(e) => set({ showVoided: e.target.checked })} className="size-4 accent-blue-700" />
          Show voided entries
        </label>
        {isFiltered && (
          <button
            type="button"
            onClick={() => set({ ...EMPTY_FILTER, sort: filter.sort, ...(fixedDates && { from: filter.from, to: filter.to }), ...(hideViews && { view: filter.view }) })}
            className="font-semibold text-blue-800 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Totals of what is shown */}
      <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-sm @lg:grid-cols-4">
        <Total label="Received (net)" value={totals.cashIn} tone="text-blue-800" />
        {!hideViews && (
          <>
            <Total label="Paid out" value={totals.cashOut} />
            <Total label="Bills" value={totals.billed} tone="text-sky-900" />
            <Total label="Unpaid on bills" value={totals.unpaid} tone={totals.unpaid > 0 ? 'text-amber-800' : undefined} />
          </>
        )}
        <p className="col-span-full text-xs text-slate-500">
          {visible.length} {visible.length === 1 ? 'entry' : 'entries'}
          {filter.from || filter.to
            ? ` from ${filter.from ? formatDate(filter.from) : 'the start'} to ${filter.to ? formatDate(filter.to) : 'today'}`
            : ', all dates'}
          . Voided entries never count in totals.
        </p>
      </dl>

      {visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={SearchX} title="No entries match" text="Try another filter or date range." />
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100">
          {shown.map((row) => (
            <LedgerItem
              key={row.key}
              row={row}
              expanded={open === row.key}
              onToggle={() => setOpen(open === row.key ? null : row.key)}
              canEdit={canEdit}
              projectName={projectNames?.get(row.projectId)}
              linkedPayments={row.type === 'bill' ? allRows.filter((r) => r.type === 'expense' && r.billId === row.id) : []}
              onVoid={() => setToVoid(row)}
              onError={(message) => toast(message, 'error')}
            />
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="mt-3 flex items-center justify-between text-sm" aria-label="Pages">
          <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className={buttonClass('secondary', 'md', 'min-h-9')}>
            <ChevronLeft className="size-4" aria-hidden /> Newer
          </button>
          <span className="text-slate-600">
            Page {current + 1} of {pages}
          </span>
          <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className={buttonClass('secondary', 'md', 'min-h-9')}>
            Older <ChevronRight className="size-4" aria-hidden />
          </button>
        </nav>
      )}

      <ReasonDialog
        open={toVoid !== null}
        title="Void this entry?"
        message={
          toVoid
            ? `${toVoid.title} of ${formatINR(toVoid.amount)} on ${formatDate(toVoid.date)} will stop counting in every total. It stays in the list, marked “Voided”, with your reason.`
            : ''
        }
        confirmLabel="Yes, void it"
        danger
        busy={voidPayment.isPending || voidExpense.isPending || voidBill.isPending}
        onCancel={() => setToVoid(null)}
        onConfirm={(reason) => void confirmVoid(reason)}
      />
    </div>
  );
}

function Total({ label, value, tone = 'text-slate-900' }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-600">{label}</dt>
      <dd className={`font-bold tabular-nums ${tone}`}>{formatINR(value)}</dd>
    </div>
  );
}

interface LedgerItemProps {
  row: LedgerRow;
  expanded: boolean;
  onToggle: () => void;
  canEdit: boolean;
  projectName?: string;
  linkedPayments: LedgerRow[];
  onVoid: () => void;
  onError: (message: string) => void;
}

function LedgerItem({ row, expanded, onToggle, canEdit, projectName, linkedPayments, onVoid, onError }: LedgerItemProps) {
  const style = TYPE_STYLE[row.type];
  const Icon = style.icon;
  const voided = Boolean(row.voided);
  const editPath = row.type === 'bill' ? `/bills/${row.id}/edit` : row.type === 'expense' ? `/expenses/${row.id}/edit` : `/payments/${row.id}/edit`;

  return (
    <li className={voided ? 'opacity-70' : undefined}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${style.box}`}>
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-semibold text-slate-900 ${voided ? 'line-through' : ''}`}>{row.title}</span>
          <span className="block truncate text-sm text-slate-600">
            {[formatDate(row.date), row.party, projectName, ...row.details.slice(0, 1)].filter(Boolean).join('  ·  ')}
          </span>
          <span className="mt-1 flex flex-wrap gap-1">
            {voided && <Badge tone="neutral">Voided</Badge>}
            {row.type === 'bill' && !voided && row.outstanding === 0 && <Badge tone="green">Paid</Badge>}
            {row.type === 'bill' && !voided && row.outstanding > 0 && (
              <Badge tone={row.overdue ? 'red' : 'amber'}>
                {row.overdue ? 'Overdue' : 'Unpaid'} {formatINR(row.outstanding)}
              </Badge>
            )}
            {row.attachments.length > 0 && (
              <Badge tone="neutral">
                <Paperclip className="size-3" aria-hidden /> {row.attachments.length}
              </Badge>
            )}
          </span>
        </span>
        <span className="text-right">
          <span className={`block font-bold tabular-nums ${style.amount} ${voided ? 'line-through' : ''}`}>
            {style.sign}
            {formatINR(row.amount)}
          </span>
          <span className="block text-xs text-slate-500">{style.label}</span>
        </span>
        <ChevronDown className={`size-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {expanded && (
        <div className="mb-3 ml-12 space-y-3 rounded-lg bg-slate-50 p-3 text-sm">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {row.details.map((d) => (
              <dd key={d} className="text-slate-700">
                {d}
              </dd>
            ))}
            {row.type === 'bill' && row.dueDate && <dd className="text-slate-700">Due {formatDate(row.dueDate)}</dd>}
            <dd className="text-slate-500">
              Added by {row.createdBy} on {formatDateTime(row.createdAt)}
            </dd>
          </dl>

          {row.voided && (
            <p className="rounded-md bg-white px-3 py-2 text-slate-700">
              <strong>Voided</strong> by {row.voided.byName} on {formatDateTime(row.voided.at)} — “{row.voided.reason}”
            </p>
          )}

          {row.attachments.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {row.attachments.map((file) => (
                <li key={file.id}>
                  <button
                    type="button"
                    onClick={() => void openAttachment(file).catch((err) => onError(errorMessage(err)))}
                    className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-blue-800 hover:underline"
                  >
                    <Paperclip className="size-3.5" aria-hidden /> {file.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {row.type === 'bill' && (
            <div>
              <p className="font-semibold text-slate-800">Payments against this bill</p>
              {linkedPayments.length === 0 ? (
                <p className="text-slate-600">None yet.</p>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {linkedPayments.map((p) => (
                    <li key={p.key} className={`flex justify-between gap-3 ${p.voided ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      <span>
                        {formatDate(p.date)} · {p.title}
                      </span>
                      <span className="tabular-nums">{formatINR(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {row.type === 'bill' && !voided && row.outstanding > 0 && (
              <Link to={`/expenses/new?projectId=${row.projectId}&billId=${row.id}`} className={buttonClass('expense', 'md', 'min-h-9')}>
                <Wallet className="size-4" aria-hidden /> Pay this bill
              </Link>
            )}
            {(row.type === 'receipt' || row.type === 'refund') && (
              <Link to={`/receipts/${row.id}`} className={buttonClass('secondary', 'md', 'min-h-9')}>
                {row.type === 'receipt' ? <Receipt className="size-4" aria-hidden /> : <Printer className="size-4" aria-hidden />}
                {row.type === 'receipt' ? 'Receipt' : 'Refund note'}
              </Link>
            )}
            {canEdit && !voided && (
              <>
                <Link to={editPath} className={buttonClass('secondary', 'md', 'min-h-9')}>
                  <Pencil className="size-4" aria-hidden /> Edit
                </Link>
                <button type="button" onClick={onVoid} className={buttonClass('ghost', 'md', 'min-h-9 text-red-700 hover:bg-red-50')}>
                  <Ban className="size-4" aria-hidden /> Void
                </button>
              </>
            )}
          </div>

          <EntryHistory entityId={row.id} />
        </div>
      )}
    </li>
  );
}

/** Audit trail of one entry: who created, changed or voided it. */
function EntryHistory({ entityId }: { entityId: string }) {
  const { data } = useAudit({ entityId });
  const changes = data?.filter((e) => e.action !== 'created') ?? [];
  if (changes.length === 0) return null;
  return (
    <div>
      <p className="flex items-center gap-1.5 font-semibold text-slate-800">
        <History className="size-4" aria-hidden /> Change history
      </p>
      <ul className="mt-1 space-y-1">
        {changes.map((event) => (
          <li key={event.id} className="text-slate-700">
            <span className="text-slate-500">{formatDateTime(event.at)}</span> · {event.byName} {event.action}
            {event.changes.length > 0 && `: ${event.changes.map((c) => `${c.field} ${c.from} → ${c.to}`).join(', ')}`}
            {event.reason && ` — “${event.reason}”`}
          </li>
        ))}
      </ul>
    </div>
  );
}
