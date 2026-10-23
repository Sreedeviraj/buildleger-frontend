// One list of every money record (client payments, refunds, expenses, supplier bills),
// used by the project transaction list and the ledger report.
import type { FinanceData } from '../api/hooks';
import type { Attachment, Bill, Expense, ExpenseCategory, Payment } from '../types';
import { billOutstanding, billPayments, inRange, isLive, sum } from './calc';
import { categoryLabel, findOption, PAYMENT_KINDS, PAYMENT_MODES } from './constants';

export type LedgerType = 'receipt' | 'refund' | 'expense' | 'bill';

export interface LedgerRow {
  key: string;
  type: LedgerType;
  id: string;
  projectId: string;
  date: string;
  /** Always positive; `type` tells the direction. */
  amount: number;
  category: ExpenseCategory | null;
  title: string;
  party: string;
  details: string[];
  reference: string;
  voided: Payment['voided'];
  /** Bills only: amount still unpaid. */
  outstanding: number;
  dueDate: string;
  overdue: boolean;
  billId: string | null;
  attachments: Attachment[];
  createdBy: string;
  createdAt: string;
  record: Payment | Expense | Bill;
}

export function buildLedger(data: Pick<FinanceData, 'payments' | 'expenses' | 'bills' | 'suppliers' | 'projects'>, today: string): LedgerRow[] {
  const supplierName = new Map(data.suppliers.map((s) => [s.id, s.name]));
  const clientName = new Map(data.projects.map((p) => [p.id, p.clientName]));
  const paidByBill = billPayments(data.bills, data.expenses);
  const billLabel = new Map(data.bills.map((b) => [b.id, b.billNumber ? `bill ${b.billNumber}` : 'a bill']));

  const payments: LedgerRow[] = data.payments.map((p) => {
    const kind = findOption(PAYMENT_KINDS, p.kind).label;
    return {
      key: `pay-${p.id}`,
      type: p.kind === 'refund' ? 'refund' : 'receipt',
      id: p.id,
      projectId: p.projectId,
      date: p.date,
      amount: p.amount,
      category: null,
      title: p.note || kind,
      party: clientName.get(p.projectId) ?? '',
      details: [kind, findOption(PAYMENT_MODES, p.mode).label, p.reference && `Ref ${p.reference}`].filter(Boolean) as string[],
      reference: p.reference,
      voided: p.voided,
      outstanding: 0,
      dueDate: '',
      overdue: false,
      billId: null,
      attachments: [],
      createdBy: p.createdBy,
      createdAt: p.createdAt,
      record: p,
    };
  });

  const expenses: LedgerRow[] = data.expenses.map((e) => ({
    key: `exp-${e.id}`,
    type: 'expense',
    id: e.id,
    projectId: e.projectId,
    date: e.date,
    amount: e.amount,
    category: e.category,
    title: e.note || categoryLabel(e.category),
    party: (e.supplierId && supplierName.get(e.supplierId)) || e.paidTo,
    details: [
      categoryLabel(e.category),
      findOption(PAYMENT_MODES, e.mode).label,
      e.billId ? `Pays ${billLabel.get(e.billId) ?? 'a bill'}` : '',
      e.invoiceRef && `Invoice ${e.invoiceRef}`,
    ].filter(Boolean),
    reference: e.invoiceRef,
    voided: e.voided,
    outstanding: 0,
    dueDate: '',
    overdue: false,
    billId: e.billId,
    attachments: e.attachments,
    createdBy: e.createdBy,
    createdAt: e.createdAt,
    record: e,
  }));

  const bills: LedgerRow[] = data.bills.map((b) => {
    const outstanding = billOutstanding(b, paidByBill);
    return {
      key: `bill-${b.id}`,
      type: 'bill',
      id: b.id,
      projectId: b.projectId,
      date: b.billDate,
      amount: b.amount,
      category: b.category,
      title: b.note || `Bill ${b.billNumber}`.trim(),
      party: supplierName.get(b.supplierId) ?? '',
      details: [categoryLabel(b.category), b.billNumber && `Bill no. ${b.billNumber}`].filter(Boolean),
      reference: b.billNumber,
      voided: b.voided,
      outstanding,
      dueDate: b.dueDate,
      overdue: outstanding > 0 && Boolean(b.dueDate) && b.dueDate < today,
      billId: b.id,
      attachments: b.attachments,
      createdBy: b.createdBy,
      createdAt: b.createdAt,
      record: b,
    };
  });

  return [...payments, ...expenses, ...bills];
}

export type LedgerView = 'all' | 'in' | 'out' | 'bills' | 'unpaid';
export type LedgerSort = 'newest' | 'oldest' | 'largest';

export interface LedgerFilter {
  view: LedgerView;
  category: ExpenseCategory | '';
  from: string;
  to: string;
  search: string;
  showVoided: boolean;
  sort: LedgerSort;
}

export const EMPTY_FILTER: LedgerFilter = {
  view: 'all',
  category: '',
  from: '',
  to: '',
  search: '',
  showVoided: false,
  sort: 'newest',
};

const VIEW_TYPES: Record<LedgerView, LedgerType[]> = {
  all: ['receipt', 'refund', 'expense', 'bill'],
  in: ['receipt', 'refund'],
  out: ['expense'],
  bills: ['bill'],
  unpaid: ['bill'],
};

export function filterLedger(rows: LedgerRow[], filter: LedgerFilter): LedgerRow[] {
  const term = filter.search.trim().toLowerCase();
  const filtered = rows.filter(
    (r) =>
      VIEW_TYPES[filter.view].includes(r.type) &&
      (filter.view !== 'unpaid' || r.outstanding > 0) &&
      (!filter.category || r.category === filter.category) &&
      inRange(r.date, filter) &&
      (filter.showVoided || !r.voided) &&
      (!term || [r.title, r.party, r.reference, ...r.details].some((v) => v.toLowerCase().includes(term))),
  );
  const order: Record<LedgerSort, (a: LedgerRow, b: LedgerRow) => number> = {
    newest: (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    oldest: (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
    largest: (a, b) => b.amount - a.amount,
  };
  return filtered.sort(order[filter.sort]);
}

/** Totals of the rows shown. Voided rows never count. */
export function ledgerTotals(rows: LedgerRow[]) {
  const live = rows.filter(isLive);
  return {
    cashIn: sum(live.filter((r) => r.type === 'receipt').map((r) => r.amount)) - sum(live.filter((r) => r.type === 'refund').map((r) => r.amount)),
    cashOut: sum(live.filter((r) => r.type === 'expense').map((r) => r.amount)),
    billed: sum(live.filter((r) => r.type === 'bill').map((r) => r.amount)),
    unpaid: sum(live.filter((r) => r.type === 'bill').map((r) => r.outstanding)),
  };
}
