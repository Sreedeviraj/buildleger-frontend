import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Archive, ArchiveRestore, ChevronDown, Download, FileText, Pencil, Phone, Plus, Truck, Wallet } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useAddSupplier, useFinance, useSetSupplierArchived, useUpdateSupplier } from '../api/hooks';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Button, buttonClass } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ChoiceGrid, inputClass, TextAreaField, TextField } from '../components/ui/Fields';
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { billOutstanding, billPayments, isLive, supplierBalances, sum, type SupplierBalance } from '../lib/calc';
import { findOption, SUPPLIER_TYPES } from '../lib/constants';
import { errorMessage } from '../lib/errors';
import { downloadCSV } from '../lib/export';
import { formatDate, formatINR, todayISO } from '../lib/format';
import type { Supplier, SupplierType } from '../types';

const EMPTY_BALANCE = { billed: 0, paid: 0, outstanding: 0, overdue: 0, unlinkedPaid: 0 };

export default function SuppliersPage() {
  const finance = useFinance();
  const { session } = useAuth();
  const toast = useToast();
  const setArchived = useSetSupplierArchived();
  const isOwner = session?.user.role === 'owner';
  const [showArchived, setShowArchived] = useState(false);
  const [type, setType] = useState<SupplierType | ''>('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
  const today = todayISO();

  const balances = useMemo(
    () => new Map<string, SupplierBalance>(finance.data ? supplierBalances(finance.data, today).map((b) => [b.supplierId, b]) : []),
    [finance.data, today],
  );

  if (finance.isLoading) return <LoadingBlock />;
  if (finance.error || !finance.data) return <ErrorBlock message={finance.error ? errorMessage(finance.error) : undefined} onRetry={finance.refetch} />;
  const data = finance.data;

  const term = search.trim().toLowerCase();
  const rows = data.suppliers
    .filter((s) => (showArchived || !s.archived) && (!type || s.type === type) && (!term || s.name.toLowerCase().includes(term)))
    .map((s) => ({ supplier: s, balance: balances.get(s.id) ?? { supplierId: s.id, ...EMPTY_BALANCE } }))
    .sort((a, b) => b.balance.outstanding - a.balance.outstanding || a.supplier.name.localeCompare(b.supplier.name));
  const totalOutstanding = sum(rows.map((r) => r.balance.outstanding));
  const totalOverdue = sum(rows.map((r) => r.balance.overdue));
  const paidByBill = billPayments(data.bills, data.expenses);
  const projectName = new Map(data.projects.map((p) => [p.id, p.name]));

  const exportCSV = () =>
    downloadCSV(`suppliers-${today}`, [
      ['Supplier', 'Type', 'Phone', 'Billed', 'Paid', 'Unpaid bills', 'Overdue', 'Paid without a bill'],
      ...rows.map(({ supplier: s, balance: b }) => [s.name, findOption(SUPPLIER_TYPES, s.type).label, s.phone, b.billed, b.paid, b.outstanding, b.overdue, b.unlinkedPaid]),
      ['Total', '', '', sum(rows.map((r) => r.balance.billed)), sum(rows.map((r) => r.balance.paid)), totalOutstanding, totalOverdue, sum(rows.map((r) => r.balance.unlinkedPaid))],
    ]);

  return (
    <>
      <PageHeader
        title="Suppliers & labour"
        subtitle={`Bills, payments and what you still owe, as on ${formatDate(today)}.`}
        actions={
          <>
            <Button variant="secondary" onClick={exportCSV} disabled={rows.length === 0}>
              <Download className="size-4" aria-hidden /> CSV
            </Button>
            <Button onClick={() => setEditing('new')}>
              <Plus className="size-4" aria-hidden /> New supplier
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <Card className="p-4">
          <p className="text-sm text-slate-600">You owe suppliers</p>
          <p className="text-xl font-bold text-sky-900 tabular-nums">{formatINR(totalOutstanding)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-600">Past due date</p>
          <p className={`text-xl font-bold tabular-nums ${totalOverdue > 0 ? 'text-red-700' : 'text-slate-900'}`}>{formatINR(totalOverdue)}</p>
        </Card>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search suppliers"
          aria-label="Search suppliers"
          className={`${inputClass.replace('mt-1.5 ', '')} sm:max-w-xs`}
        />
        <select value={type} onChange={(e) => setType(e.target.value as SupplierType | '')} aria-label="Supplier type" className={`${inputClass.replace('mt-1.5 ', '')} sm:max-w-56`}>
          <option value="">All types</option>
          {SUPPLIER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {data.suppliers.some((x) => x.archived) && (
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:ml-2">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="size-4 accent-blue-700" />
            Show archived
          </label>
        )}
      </div>

      {data.suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No suppliers yet"
          text="Add the shops, subcontractors and labour teams you pay. Then record their bills and payments."
          action={<Button onClick={() => setEditing('new')}>Add first supplier</Button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState icon={Truck} title="No suppliers match" text="Try another name or type." />
      ) : (
        <Card className="divide-y divide-slate-100">
          {rows.map(({ supplier, balance }) => {
            const expanded = open === supplier.id;
            const bills = data.bills.filter((b) => b.supplierId === supplier.id && isLive(b));
            const payments = data.expenses.filter((e) => e.supplierId === supplier.id && isLive(e)).slice(0, 8);
            return (
              <div key={supplier.id}>
                <button type="button" onClick={() => setOpen(expanded ? null : supplier.id)} aria-expanded={expanded} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold text-slate-900">
                      {supplier.name}
                      {supplier.archived && <Badge tone="neutral">Archived</Badge>}
                    </p>
                    <p className="text-sm text-slate-600">
                      {findOption(SUPPLIER_TYPES, supplier.type).label}
                      {supplier.phone && ` · ${supplier.phone}`}
                    </p>
                  </div>
                  <div className="hidden text-right text-sm sm:block">
                    <p className="text-slate-500">Paid</p>
                    <p className="font-semibold tabular-nums">{formatINR(balance.paid)}</p>
                  </div>
                  <div className="w-32 text-right text-sm">
                    <p className="text-slate-500">You owe</p>
                    <p className={`font-bold tabular-nums ${balance.overdue > 0 ? 'text-red-700' : balance.outstanding > 0 ? 'text-sky-900' : 'text-slate-900'}`}>
                      {formatINR(balance.outstanding)}
                    </p>
                  </div>
                  <ChevronDown className={`size-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {expanded && (
                  <div className="space-y-4 bg-slate-50 px-4 py-4 text-sm">
                    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Figure label="Billed" value={balance.billed} />
                      <Figure label="Paid (all)" value={balance.paid} />
                      <Figure label="Unpaid bills" value={balance.outstanding} tone={balance.outstanding > 0 ? 'text-sky-900' : undefined} />
                      <Figure label="Paid without a bill" value={balance.unlinkedPaid} note="Direct purchases or advances" />
                    </dl>

                    <div>
                      <p className="mb-1 font-semibold text-slate-800">Bills</p>
                      {bills.length === 0 ? (
                        <p className="text-slate-600">No bills recorded.</p>
                      ) : (
                        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                          {bills.map((b) => {
                            const due = billOutstanding(b, paidByBill);
                            const overdue = due > 0 && b.dueDate && b.dueDate < today;
                            return (
                              <li key={b.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                                <FileText className="size-4 text-sky-700" aria-hidden />
                                <span className="min-w-0 flex-1">
                                  <span className="font-medium">{b.billNumber || 'Bill'}</span> · {projectName.get(b.projectId)} · {formatDate(b.billDate)}
                                  {b.dueDate && ` · due ${formatDate(b.dueDate)}`}
                                </span>
                                <span className="tabular-nums">{formatINR(b.amount)}</span>
                                {due === 0 ? <Badge tone="green">Paid</Badge> : <Badge tone={overdue ? 'red' : 'amber'}>{formatINR(due)} {overdue ? 'overdue' : 'unpaid'}</Badge>}
                                {due > 0 && (
                                  <Link to={`/expenses/new?projectId=${b.projectId}&billId=${b.id}`} className={buttonClass('expense', 'md', 'min-h-8 px-3')}>
                                    <Wallet className="size-4" aria-hidden /> Pay
                                  </Link>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div>
                      <p className="mb-1 font-semibold text-slate-800">Recent payments</p>
                      {payments.length === 0 ? (
                        <p className="text-slate-600">No payments recorded.</p>
                      ) : (
                        <ul className="space-y-0.5">
                          {payments.map((e) => (
                            <li key={e.id} className="flex justify-between gap-3 text-slate-700">
                              <span>
                                {formatDate(e.date)} · {projectName.get(e.projectId)} · {e.note || 'Payment'}
                                {e.billId ? '' : ' (no bill)'}
                              </span>
                              <span className="tabular-nums">{formatINR(e.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link to={`/bills/new?supplierId=${supplier.id}`} className={buttonClass('secondary', 'md', 'min-h-9')}>
                        <FileText className="size-4" aria-hidden /> Add bill
                      </Link>
                      {supplier.phone && (
                        <a href={`tel:${supplier.phone}`} className={buttonClass('secondary', 'md', 'min-h-9')}>
                          <Phone className="size-4" aria-hidden /> Call
                        </a>
                      )}
                      <Button variant="ghost" className="min-h-9" onClick={() => setEditing(supplier)}>
                        <Pencil className="size-4" aria-hidden /> Edit details
                      </Button>
                      {isOwner && (
                        <Button
                          variant="ghost"
                          className="min-h-9"
                          disabled={setArchived.isPending}
                          onClick={async () => {
                            try {
                              await setArchived.mutateAsync([supplier.id, !supplier.archived]);
                              toast(supplier.archived ? `${supplier.name} restored` : `${supplier.name} archived`);
                            } catch (err) {
                              toast(errorMessage(err), 'error');
                            }
                          }}
                        >
                          {supplier.archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
                          {supplier.archived ? 'Restore' : 'Archive'}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {editing && <SupplierDialog supplier={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function Figure({ label, value, tone = 'text-slate-900', note }: { label: string; value: number; tone?: string; note?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-600">{label}</dt>
      <dd className={`font-bold tabular-nums ${tone}`}>{formatINR(value)}</dd>
      {note && <dd className="text-xs text-slate-500">{note}</dd>}
    </div>
  );
}

function SupplierDialog({ supplier, onClose }: { supplier?: Supplier; onClose: () => void }) {
  const toast = useToast();
  const addSupplier = useAddSupplier();
  const updateSupplier = useUpdateSupplier();
  const [name, setName] = useState(supplier?.name ?? '');
  const [type, setType] = useState<SupplierType>(supplier?.type ?? 'supplier');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [note, setNote] = useState(supplier?.note ?? '');
  const [error, setError] = useState('');
  const busy = addSupplier.isPending || updateSupplier.isPending;

  async function save(e?: FormEvent) {
    e?.preventDefault();
    setError('');
    try {
      const input = { name, type, phone, note };
      if (supplier) await updateSupplier.mutateAsync([supplier.id, input]);
      else await addSupplier.mutateAsync(input);
      toast(supplier ? 'Supplier updated' : 'Supplier added');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <ConfirmDialog
      open
      title={supplier ? 'Edit supplier' : 'New supplier'}
      message=""
      confirmLabel={supplier ? 'Save' : 'Add supplier'}
      busy={busy}
      confirmDisabled={!name.trim()}
      onCancel={onClose}
      onConfirm={() => void save()}
    >
      <form onSubmit={save} className="space-y-4" noValidate>
        <TextField label="Name" value={name} onChange={setName} placeholder="e.g. Kerala Cements & Steel" />
        <ChoiceGrid label="Type" options={SUPPLIER_TYPES} value={type} onChange={setType} columns="grid-cols-1" />
        <TextField label="Phone" type="tel" inputMode="tel" value={phone} onChange={setPhone} optional />
        <TextAreaField label="Note" value={note} onChange={setNote} placeholder="e.g. GSTIN, bank details" />
        {error && <p className="text-sm font-medium text-red-700" role="alert">{error}</p>}
      </form>
    </ConfirmDialog>
  );
}
