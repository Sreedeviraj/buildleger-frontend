// All money calculations live here, never inside UI components.
// Inputs are raw records with numeric amounts; nothing here ever parses formatted currency.
//
// Definitions used everywhere in the app:
// - Received (cash in)      = client receipts − refunds, excluding voided entries.
// - Paid (cash out)         = expenses paid, excluding voided entries.
// - Net cash position       = received − paid.
// - Cost incurred (accrual) = supplier bills + payments not linked to a bill.
//   A payment linked to a bill settles that bill, so it is never counted twice.
// - Unpaid bills (payables) = bill amount − payments linked to it.
// - Client outstanding      = contract value − received (receivable, not cash).
// - Remaining budget        = estimated cost − cost incurred.
import type {
  Bill,
  BudgetHealth,
  ExpenseCategory,
  Expense,
  Installment,
  Payment,
  Project,
} from '../types';

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export const isLive = (record: { voided: unknown }) => !record.voided;

/** Refunds reduce what the client has paid. */
export function signedPayment(payment: Payment): number {
  return payment.kind === 'refund' ? -payment.amount : payment.amount;
}

export interface FinanceRecords {
  payments: Payment[];
  expenses: Expense[];
  bills: Bill[];
  installments: Installment[];
}

export interface DateRange {
  from?: string;
  to?: string;
}

export function inRange(date: string, range: DateRange): boolean {
  return (!range.from || date >= range.from) && (!range.to || date <= range.to);
}

export function forProject(records: FinanceRecords, projectId: string): FinanceRecords {
  return {
    payments: records.payments.filter((r) => r.projectId === projectId),
    expenses: records.expenses.filter((r) => r.projectId === projectId),
    bills: records.bills.filter((r) => r.projectId === projectId),
    installments: records.installments.filter((r) => r.projectId === projectId),
  };
}

/** How much of each live bill has been paid through linked live expenses. */
export function billPayments(bills: Bill[], expenses: Expense[]): Map<string, number> {
  const liveBillIds = new Set(bills.filter(isLive).map((b) => b.id));
  const paid = new Map<string, number>();
  for (const e of expenses) {
    if (isLive(e) && e.billId && liveBillIds.has(e.billId)) {
      paid.set(e.billId, (paid.get(e.billId) ?? 0) + e.amount);
    }
  }
  return paid;
}

export function billOutstanding(bill: Bill, paidByBill: Map<string, number>): number {
  return bill.voided ? 0 : Math.max(bill.amount - (paidByBill.get(bill.id) ?? 0), 0);
}

export interface CostLine {
  category: ExpenseCategory;
  amount: number;
  date: string;
}

/**
 * Cost incurred, one line per bill or unlinked payment. A bill counts at the larger of its
 * amount and what was paid against it, so neither side is ever counted twice.
 */
export function costLines(records: Pick<FinanceRecords, 'expenses' | 'bills'>): CostLine[] {
  const paidByBill = billPayments(records.bills, records.expenses);
  const liveBills = records.bills.filter(isLive);
  const liveBillIds = new Set(liveBills.map((b) => b.id));
  return [
    ...liveBills.map((b) => ({
      category: b.category,
      amount: Math.max(b.amount, paidByBill.get(b.id) ?? 0),
      date: b.billDate,
    })),
    ...records.expenses
      .filter((e) => isLive(e) && !(e.billId && liveBillIds.has(e.billId)))
      .map((e) => ({ category: e.category, amount: e.amount, date: e.date })),
  ];
}

export interface CategoryLine {
  category: ExpenseCategory;
  /** null when no budget was set for this category. */
  budget: number | null;
  actual: number;
  remaining: number | null;
  usedRatio: number | null;
  over: boolean;
}

export function categoryLines(project: Project, costs: CostLine[]): CategoryLine[] {
  const actualBy = new Map<ExpenseCategory, number>();
  for (const line of costs) actualBy.set(line.category, (actualBy.get(line.category) ?? 0) + line.amount);
  const categories = new Set<ExpenseCategory>([
    ...(Object.keys(project.categoryBudgets) as ExpenseCategory[]),
    ...actualBy.keys(),
  ]);
  return [...categories]
    .map((category) => {
      const budget = project.categoryBudgets[category] ?? null;
      const actual = actualBy.get(category) ?? 0;
      return {
        category,
        budget,
        actual,
        remaining: budget === null ? null : budget - actual,
        usedRatio: budget ? actual / budget : null,
        over: budget !== null && actual > budget,
      };
    })
    .sort((a, b) => b.actual - a.actual || (b.budget ?? 0) - (a.budget ?? 0));
}

export function healthOf(actual: number, budget: number): BudgetHealth {
  if (budget <= 0) return actual > 0 ? 'over' : 'good';
  if (actual > budget) return 'over';
  return actual / budget >= 0.85 ? 'watch' : 'good';
}

/** Whole-number percent for display that never shows 100% unless exactly on budget. */
export function percentLabel(ratio: number): number {
  const rounded = Math.round(ratio * 100);
  if (ratio > 1 && rounded <= 100) return 101;
  if (ratio < 1 && rounded >= 100) return 99;
  return rounded;
}

export interface ProjectSummary {
  contractValue: number;
  estimatedCost: number;
  /** Client receipts before refunds. */
  receipts: number;
  refunds: number;
  /** Net money received from the client (cash basis). */
  received: number;
  /** Contract value − received. Never negative; see clientOverpaid. */
  clientOutstanding: number;
  clientOverpaid: number;
  /** Scheduled installments past their due date that are not yet covered by payments. */
  overdue: number;
  nextInstallment: Installment | null;
  /** Cash paid out. */
  paid: number;
  billed: number;
  /** Payables: unpaid supplier bill balances. */
  unpaidBills: number;
  overdueBills: number;
  /** Cost incurred (accrual): bills + unlinked payments. */
  actualCost: number;
  remainingBudget: number;
  budgetUsedRatio: number;
  budgetUsedPercent: number;
  health: BudgetHealth;
  netCash: number;
  estimatedProfit: number;
  forecastCost: number;
  forecastProfit: number;
  /** Cash basis: received − paid. */
  profitToDateCash: number;
  /** Percentage of completion: contract × progress − cost incurred. */
  earnedRevenue: number;
  profitToDateAccrual: number;
  categories: CategoryLine[];
  overBudgetCategories: CategoryLine[];
  firstDate: string | null;
  lastDate: string | null;
}

export function summarizeProject(project: Project, all: FinanceRecords, today: string): ProjectSummary {
  const records = forProject(all, project.id);
  const livePayments = records.payments.filter(isLive);
  const liveExpenses = records.expenses.filter(isLive);
  const liveBills = records.bills.filter(isLive);

  const receipts = sum(livePayments.filter((p) => p.kind !== 'refund').map((p) => p.amount));
  const refunds = sum(livePayments.filter((p) => p.kind === 'refund').map((p) => p.amount));
  const received = receipts - refunds;

  const dueSoFar = sum(records.installments.filter((i) => i.dueDate < today).map((i) => i.amount));
  // Payments cover installments in due-date order, so the next one is the first not yet covered.
  let scheduled = 0;
  const nextInstallment =
    [...records.installments]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .find((i) => (scheduled += i.amount) > received) ?? null;

  const paid = sum(liveExpenses.map((e) => e.amount));
  const paidByBill = billPayments(records.bills, records.expenses);
  const billed = sum(liveBills.map((b) => b.amount));
  const unpaidBills = sum(liveBills.map((b) => billOutstanding(b, paidByBill)));
  const overdueBills = sum(liveBills.filter((b) => b.dueDate && b.dueDate < today).map((b) => billOutstanding(b, paidByBill)));

  const costs = costLines(records);
  const actualCost = sum(costs.map((c) => c.amount));
  const categories = categoryLines(project, costs);

  // Forecast: what is spent so far plus what the plan still expects to spend.
  // Budgeted categories keep their unspent budget; unbudgeted spending eats the unallocated part.
  const allocated = sum(Object.values(project.categoryBudgets).map((v) => v ?? 0));
  const unallocated = Math.max(project.estimatedCost - allocated, 0);
  const unbudgetedActual = sum(categories.filter((c) => c.budget === null).map((c) => c.actual));
  const plannedStillToSpend =
    sum(categories.filter((c) => c.budget !== null).map((c) => Math.max((c.budget ?? 0) - c.actual, 0))) +
    Math.max(unallocated - unbudgetedActual, 0);
  const forecastCost = actualCost + plannedStillToSpend;

  const earnedRevenue = Math.round((project.contractValue * project.progress) / 100);
  const budgetUsedRatio = project.estimatedCost > 0 ? actualCost / project.estimatedCost : actualCost > 0 ? 1 : 0;

  const dates = [
    ...livePayments.map((p) => p.date),
    ...liveExpenses.map((e) => e.date),
    ...liveBills.map((b) => b.billDate),
  ].sort();

  return {
    contractValue: project.contractValue,
    estimatedCost: project.estimatedCost,
    receipts,
    refunds,
    received,
    clientOutstanding: Math.max(project.contractValue - received, 0),
    clientOverpaid: Math.max(received - project.contractValue, 0),
    overdue: Math.max(dueSoFar - received, 0),
    nextInstallment,
    paid,
    billed,
    unpaidBills,
    overdueBills,
    actualCost,
    remainingBudget: project.estimatedCost - actualCost,
    budgetUsedRatio,
    budgetUsedPercent: percentLabel(budgetUsedRatio),
    health: healthOf(actualCost, project.estimatedCost),
    netCash: received - paid,
    estimatedProfit: project.contractValue - project.estimatedCost,
    forecastCost,
    forecastProfit: project.contractValue - forecastCost,
    profitToDateCash: received - paid,
    earnedRevenue,
    profitToDateAccrual: earnedRevenue - actualCost,
    categories,
    overBudgetCategories: categories.filter((c) => c.over),
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
  };
}

// ---- Reports ----

export interface MonthLine {
  month: string; // yyyy-mm
  cashIn: number;
  cashOut: number;
  net: number;
}

export function monthlyCashFlow(records: FinanceRecords, range: DateRange): MonthLine[] {
  const months = new Map<string, MonthLine>();
  const line = (month: string) => {
    if (!months.has(month)) months.set(month, { month, cashIn: 0, cashOut: 0, net: 0 });
    return months.get(month)!;
  };
  for (const p of records.payments) {
    if (!isLive(p) || !inRange(p.date, range)) continue;
    line(p.date.slice(0, 7)).cashIn += signedPayment(p);
  }
  for (const e of records.expenses) {
    if (!isLive(e) || !inRange(e.date, range)) continue;
    line(e.date.slice(0, 7)).cashOut += e.amount;
  }
  return [...months.values()]
    .map((m) => ({ ...m, net: m.cashIn - m.cashOut }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** Cash in/out for one project within a date range (cash basis). */
export function cashInRange(records: FinanceRecords, range: DateRange): { cashIn: number; cashOut: number } {
  return {
    cashIn: sum(records.payments.filter((p) => isLive(p) && inRange(p.date, range)).map(signedPayment)),
    cashOut: sum(records.expenses.filter((e) => isLive(e) && inRange(e.date, range)).map((e) => e.amount)),
  };
}

export function costByCategory(records: FinanceRecords, range: DateRange): { category: ExpenseCategory; amount: number }[] {
  const totals = new Map<ExpenseCategory, number>();
  for (const line of costLines(records)) {
    if (!inRange(line.date, range)) continue;
    totals.set(line.category, (totals.get(line.category) ?? 0) + line.amount);
  }
  return [...totals.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

export interface SupplierBalance {
  supplierId: string;
  billed: number;
  paid: number;
  /** Bills not yet paid. */
  outstanding: number;
  overdue: number;
  /** Payments not linked to any bill (advances, or bills not entered). */
  unlinkedPaid: number;
}

export function supplierBalances(records: Pick<FinanceRecords, 'expenses' | 'bills'>, today: string): SupplierBalance[] {
  const paidByBill = billPayments(records.bills, records.expenses);
  const liveBillIds = new Set(records.bills.filter(isLive).map((b) => b.id));
  const bySupplier = new Map<string, SupplierBalance>();
  const get = (supplierId: string) => {
    if (!bySupplier.has(supplierId)) {
      bySupplier.set(supplierId, { supplierId, billed: 0, paid: 0, outstanding: 0, overdue: 0, unlinkedPaid: 0 });
    }
    return bySupplier.get(supplierId)!;
  };
  for (const b of records.bills.filter(isLive)) {
    const row = get(b.supplierId);
    const due = billOutstanding(b, paidByBill);
    row.billed += b.amount;
    row.outstanding += due;
    if (b.dueDate && b.dueDate < today) row.overdue += due;
  }
  for (const e of records.expenses.filter(isLive)) {
    if (!e.supplierId) continue;
    const row = get(e.supplierId);
    row.paid += e.amount;
    if (!(e.billId && liveBillIds.has(e.billId))) row.unlinkedPaid += e.amount;
  }
  return [...bySupplier.values()];
}
