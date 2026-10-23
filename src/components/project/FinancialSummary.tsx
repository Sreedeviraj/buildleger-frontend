import { useState, type ReactNode } from 'react';
import { ChevronRight, Info } from 'lucide-react';
import type { ProjectSummary } from '../../lib/calc';
import { formatDate, formatINR } from '../../lib/format';
import type { Project } from '../../types';

/** What kind of money a figure is. They must never be read as the same thing. */
type Basis = 'plan' | 'cashIn' | 'cashOut' | 'receivable' | 'payable' | 'cost' | 'budget' | 'cash' | 'profit' | 'forecast';

const BASIS: Record<Basis, string> = {
  plan: 'Plan',
  budget: 'Budget',
  cashIn: 'Cash in',
  cashOut: 'Cash out',
  cash: 'Cash',
  receivable: 'To receive',
  payable: 'To pay',
  cost: 'Cost',
  profit: 'Profit',
  forecast: 'Forecast',
};

/** Small inline warning next to a figure. */
function Flag({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <span className={`text-xs font-medium ${muted ? 'text-slate-500' : 'text-red-600'}`}>{children}</span>;
}

export type ProfitMethod = 'cash' | 'completion';

/** Where a click on a figure should take the user. */
export type InspectTarget = 'received' | 'paid' | 'bills' | 'unpaid' | 'costs' | 'schedule' | 'budget';

interface Row {
  label: string;
  amount: number;
  basis: Basis;
  how: ReactNode;
  /** Sub-rows are indented under the row above. */
  indent?: boolean;
  tone?: 'good' | 'bad' | 'warn';
  flag?: ReactNode;
  inspect?: InspectTarget;
}

interface FinancialSummaryProps {
  project: Project;
  summary: ProjectSummary;
  today: string;
  budgetRevisions: number;
  onInspect: (target: InspectTarget) => void;
}

export function FinancialSummary({ project, summary: s, today, budgetRevisions, onInspect }: FinancialSummaryProps) {
  const [method, setMethod] = useState<ProfitMethod>('cash');

  const groups: { title: string; rows: Row[] }[] = [
    {
      title: 'Client',
      rows: [
        { label: 'Contract value', amount: s.contractValue, basis: 'plan', how: 'Total amount agreed with the client.' },
        {
          label: 'Client payments received',
          amount: s.received,
          basis: 'cashIn',
          how: s.refunds > 0 ? `Receipts ${formatINR(s.receipts)} − refunds ${formatINR(s.refunds)}.` : 'Sum of recorded client payments.',
          inspect: 'received',
        },
        {
          label: s.clientOverpaid > 0 ? 'Client has overpaid' : 'Client outstanding balance',
          amount: s.clientOverpaid > 0 ? s.clientOverpaid : s.clientOutstanding,
          basis: 'receivable',
          how: s.clientOverpaid > 0 ? 'Received is more than the contract value. Refund or add a variation.' : 'Contract value − payments received.',
          tone: s.clientOverpaid > 0 || s.overdue > 0 ? 'bad' : s.clientOutstanding > 0 ? 'warn' : 'good',
          flag:
            s.overdue > 0 ? (
              <Flag>{formatINR(s.overdue)} overdue</Flag>
            ) : s.nextInstallment ? (
              <Flag muted>Next due {formatDate(s.nextInstallment.dueDate)}</Flag>
            ) : null,
          inspect: 'schedule',
        },
      ],
    },
    {
      title: 'Costs and budget',
      rows: [
        {
          label: 'Estimated project cost',
          amount: s.estimatedCost,
          basis: 'budget',
          how: budgetRevisions > 0 ? `Approved budget, revised ${budgetRevisions} ${budgetRevisions === 1 ? 'time' : 'times'}.` : 'Approved budget for the whole project.',
          inspect: 'budget',
        },
        {
          label: 'Actual cost incurred',
          amount: s.actualCost,
          basis: 'cost',
          how: 'Supplier bills + payments not linked to a bill. A bill and its payments are counted once.',
          inspect: 'costs',
        },
        {
          label: 'Paid to suppliers and labour',
          amount: s.paid,
          basis: 'cashOut',
          how: 'Sum of recorded expense payments.',
          indent: true,
          inspect: 'paid',
        },
        {
          label: 'Unpaid supplier bills',
          amount: s.unpaidBills,
          basis: 'payable',
          how: 'Bill amounts not yet paid.',
          indent: true,
          tone: s.overdueBills > 0 ? 'bad' : undefined,
          flag: s.overdueBills > 0 ? <Flag>{formatINR(s.overdueBills)} overdue</Flag> : null,
          inspect: 'unpaid',
        },
        {
          label: s.remainingBudget < 0 ? 'Over budget by' : 'Remaining budget',
          amount: Math.abs(s.remainingBudget),
          basis: 'budget',
          how: `Estimated cost − actual cost incurred. ${s.budgetUsedPercent}% of the budget used.`,
          tone: s.health === 'over' ? 'bad' : s.health === 'watch' ? 'warn' : 'good',
          flag: s.overBudgetCategories.length > 0 ? <Flag>{s.overBudgetCategories.length} over in categories</Flag> : null,
          inspect: 'budget',
        },
      ],
    },
    {
      title: 'Cash',
      rows: [
        {
          label: 'Net cash position',
          amount: s.netCash,
          basis: 'cash',
          how: 'Money received − money paid out. This is the cash this project has given you so far.',
          tone: s.netCash < 0 ? 'bad' : 'good',
          flag: s.netCash < 0 ? <Flag>Negative</Flag> : null,
        },
      ],
    },
    {
      title: 'Profit',
      rows: [
        {
          label: 'Estimated profit',
          amount: s.estimatedProfit,
          basis: 'plan',
          how: 'Contract value − estimated project cost.',
          tone: s.estimatedProfit < 0 ? 'bad' : undefined,
        },
        {
          label: 'Forecast profit',
          amount: s.forecastProfit,
          basis: 'forecast',
          how: `Contract value − forecast total cost of ${formatINR(s.forecastCost)} (cost so far + budget still planned; overspent categories add to it).`,
          tone: s.forecastProfit < 0 ? 'bad' : s.forecastProfit < s.estimatedProfit ? 'warn' : undefined,
        },
        method === 'cash'
          ? {
              label: 'Actual profit to date',
              amount: s.profitToDateCash,
              basis: 'profit',
              how: 'Cash basis: payments received − payments made. Unpaid bills and unbilled work are not counted.',
              tone: s.profitToDateCash < 0 ? 'bad' : undefined,
            }
          : {
              label: 'Actual profit to date',
              amount: s.profitToDateAccrual,
              basis: 'profit',
              how: `Work completed basis: ${project.progress}% of contract value (${formatINR(s.earnedRevenue)}) − actual cost incurred, including unpaid bills.`,
              tone: s.profitToDateAccrual < 0 ? 'bad' : undefined,
            },
      ],
    },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-slate-500">
          As on {formatDate(today)} · covers all entries
          {s.firstDate ? ` from ${formatDate(s.firstDate)}` : ''} · voided entries excluded
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <span className="font-semibold">Profit to date</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as ProfitMethod)}
            className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
          >
            <option value="cash">Cash basis</option>
            <option value="completion">Work completed (accrual)</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-slate-200 text-xs text-slate-500">
            <tr>
              <th scope="col" className="py-2 pr-3 pl-2 font-medium">
                Figure
              </th>
              <th scope="col" className="hidden w-24 py-2 pr-3 font-medium sm:table-cell">
                Type
              </th>
              <th scope="col" className="hidden py-2 pr-3 font-medium md:table-cell">
                How it is worked out
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Amount
              </th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.title}>
              <tr className="border-b border-slate-200">
                <th colSpan={4} scope="colgroup" className="bg-slate-100/80 px-2 py-2 font-semibold text-slate-900">
                  {group.title}
                </th>
              </tr>
              {group.rows.map((row) => (
                <SummaryRow key={row.label} row={row} onInspect={onInspect} />
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Cash figures show money that actually moved. “To receive” and “To pay” are balances still owed. Profit uses the method chosen above.
        Tap a figure to see the entries behind it.
      </p>
    </div>
  );
}

const AMOUNT_TONE = { good: 'text-blue-800', bad: 'text-red-700', warn: 'text-amber-800' };

function SummaryRow({ row, onInspect }: { row: Row; onInspect: (target: InspectTarget) => void }) {
  const basis = BASIS[row.basis];
  const negative = row.amount < 0;
  const content = (
    <>
      <span className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${row.indent ? 'pl-4' : ''}`}>
        <span className={row.indent ? 'text-slate-700' : 'font-medium text-slate-900'}>{row.label}</span>
        <span className="text-xs text-slate-400 sm:hidden">{basis}</span>
        {row.flag}
      </span>
      <span className={`mt-0.5 block text-xs text-slate-500 md:hidden ${row.indent ? 'pl-4' : ''}`}>{row.how}</span>
    </>
  );
  return (
    <tr className="border-b border-slate-100 align-top">
      <td className="py-2 pr-3 pl-2">
        {row.inspect ? (
          <button type="button" onClick={() => onInspect(row.inspect!)} className="group w-full text-left">
            {content}
          </button>
        ) : (
          content
        )}
      </td>
      <td className="hidden py-2 pr-3 text-slate-500 sm:table-cell">{basis}</td>
      <td className="hidden py-2 pr-3 text-slate-500 md:table-cell">{row.how}</td>
      <td className={`py-2 text-right font-medium whitespace-nowrap tabular-nums ${row.tone ? AMOUNT_TONE[row.tone] : negative ? 'text-red-700' : 'text-slate-900'}`}>
        {row.inspect ? (
          <button type="button" onClick={() => onInspect(row.inspect!)} className="inline-flex items-center gap-1 hover:underline" aria-label={`${row.label}: ${formatINR(row.amount)}. Show entries`}>
            {formatINR(row.amount)}
            <ChevronRight className="size-3.5 text-slate-400" aria-hidden />
          </button>
        ) : (
          formatINR(row.amount)
        )}
      </td>
    </tr>
  );
}
