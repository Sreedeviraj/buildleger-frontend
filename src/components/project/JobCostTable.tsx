import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Paperclip } from 'lucide-react';
import { sum, type ProjectSummary } from '../../lib/calc';
import { EXPENSE_CATEGORIES } from '../../lib/constants';
import { formatDate, formatINR } from '../../lib/format';
import type { LedgerRow } from '../../lib/ledger';
import type { BudgetRevision, CategoryBudgets, ExpenseCategory, Project } from '../../types';

/** Cost code per category, in the fixed category order: 1000, 1100, 1200… */
const CODE = new Map(EXPENSE_CATEGORIES.map((c, i) => [c.value, String(1000 + i * 100)]));

interface Line {
  key: string;
  name: string;
  detail: string;
  amount: number;
  isBill: boolean;
  attachments: number;
}

interface Group {
  key: string;
  code: string;
  name: string;
  original: number | null;
  revised: number | null;
  actual: number;
  lines: Line[];
}

interface JobCostTableProps {
  project: Project;
  summary: ProjectSummary;
  /** This project's ledger rows. */
  rows: LedgerRow[];
  /** Newest first, as the API returns them. */
  revisions: BudgetRevision[];
}

/** Job costing: estimate vs actual per cost code, with the entries behind each actual. */
export function JobCostTable({ project, summary, rows, revisions }: JobCostTableProps) {
  const [filter, setFilter] = useState<'all' | 'over' | ExpenseCategory>('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    // Original = the budget before the first revision.
    const first = revisions[revisions.length - 1];
    const original: { estimatedCost: number; categoryBudgets: CategoryBudgets } = first ? first.before : project;

    // Cost lines: live bills, plus live payments not linked to a live bill (same rule as the totals).
    const liveBillIds = new Set(rows.filter((r) => r.type === 'bill' && !r.voided).map((r) => r.id));
    const costRows = rows.filter((r) => !r.voided && (r.type === 'bill' || (r.type === 'expense' && !(r.billId && liveBillIds.has(r.billId)))));
    const linesBy = new Map<ExpenseCategory, Line[]>();
    for (const r of costRows.sort((a, b) => a.date.localeCompare(b.date))) {
      const list = linesBy.get(r.category!) ?? [];
      list.push({
        key: r.key,
        name: r.title,
        detail: [formatDate(r.date), r.party, r.type === 'bill' ? (r.outstanding > 0 ? `bill · ${formatINR(r.outstanding)} unpaid` : 'bill · paid') : ''].filter(Boolean).join(' · '),
        amount: r.amount,
        isBill: r.type === 'bill',
        attachments: r.attachments.length,
      });
      linesBy.set(r.category!, list);
    }

    const result: Group[] = EXPENSE_CATEGORIES.filter(
      ({ value }) => project.categoryBudgets[value] !== undefined || original.categoryBudgets[value] !== undefined || linesBy.has(value),
    ).map(({ value, label }) => {
      const lines = linesBy.get(value) ?? [];
      return {
        key: value,
        code: CODE.get(value)!,
        name: label,
        original: original.categoryBudgets[value] ?? null,
        revised: project.categoryBudgets[value] ?? null,
        actual: sum(lines.map((l) => l.amount)),
        lines,
      };
    });

    // Budget not split into categories pays for categories that have no budget of their own.
    const unbudgetedActual = sum(result.filter((g) => g.revised === null).map((g) => g.actual));
    const allocated = sum(Object.values(project.categoryBudgets).map((v) => v ?? 0));
    const originalAllocated = sum(Object.values(original.categoryBudgets).map((v) => v ?? 0));
    const unassigned: Group = {
      key: 'unassigned',
      code: '9000',
      name: allocated > 0 ? 'Not assigned to a category' : 'Whole-project budget',
      original: original.estimatedCost - originalAllocated,
      revised: project.estimatedCost - allocated,
      actual: unbudgetedActual,
      lines: [],
    };
    return { list: result, unassigned, originalTotal: original.estimatedCost };
  }, [project, rows, revisions]);

  const visible = groups.list.filter((g) =>
    filter === 'all' ? true : filter === 'over' ? g.revised !== null && g.actual > g.revised : g.key === filter,
  );
  const allOpen = collapsed.size === 0;
  const toggle = (key: string) =>
    setCollapsed((c) => {
      const next = new Set(c);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          aria-label="Show categories"
          className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
        >
          <option value="all">Categories: All</option>
          <option value="over">Over budget only</option>
          {groups.list.map((g) => (
            <option key={g.key} value={g.key}>
              {g.name}
            </option>
          ))}
        </select>
        <div className="flex gap-1 text-sm">
          <button type="button" disabled={allOpen} onClick={() => setCollapsed(new Set())} className="rounded-md px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100 disabled:text-slate-400">
            Expand all
          </button>
          <button
            type="button"
            disabled={collapsed.size === groups.list.length}
            onClick={() => setCollapsed(new Set(groups.list.map((g) => g.key)))}
            className="rounded-md px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100 disabled:text-slate-400"
          >
            Collapse all
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px] sm:min-w-[680px]">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th scope="col" className="hidden w-16 py-2 pr-2 font-medium sm:table-cell">Code</th>
              <th scope="col" className="py-2 pr-2 font-medium">Name</th>
              <th scope="col" className="hidden w-12 py-2 text-center font-medium sm:table-cell">Docs</th>
              <th scope="col" className="hidden py-2 pl-2 text-right font-medium md:table-cell">Original est.</th>
              <th scope="col" className="py-2 pl-2 text-right font-medium"><span className="md:hidden">Budget</span><span className="hidden md:inline">Revised est.</span></th>
              <th scope="col" className="py-2 pl-2 text-right font-medium">Actual</th>
              <th scope="col" className="hidden py-2 pl-2 text-right font-medium sm:table-cell">Variance</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  {groups.list.length === 0 ? 'No costs yet. Bills and expenses will appear here by category.' : 'No categories match this filter.'}
                </td>
              </tr>
            )}
            {visible.map((g) => {
              const open = !collapsed.has(g.key);
              return (
                <Fragment key={g.key}>
                  <tr className="border-b border-slate-200 bg-slate-100/80 font-semibold text-slate-900">
                    <td className="hidden py-2 pr-2 pl-2 sm:table-cell">{g.code}</td>
                    <td className="py-2 pr-2">
                      <button type="button" onClick={() => toggle(g.key)} aria-expanded={open} className="flex items-center gap-1.5 hover:text-blue-800" disabled={g.lines.length === 0}>
                        {g.name}
                        {g.lines.length > 0 && (open ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />)}
                        {g.lines.length > 0 && <span className="font-normal text-slate-500">({g.lines.length})</span>}
                      </button>
                    </td>
                    <td className="hidden sm:table-cell" />
                    <Money value={g.original} wide />
                    <Money value={g.revised} />
                    <Actual budget={g.revised} actual={g.actual} />
                    <Variance budget={g.revised} actual={g.actual} />
                  </tr>
                  {open &&
                    g.lines.map((line) => (
                      <tr key={line.key} className="border-b border-slate-100 text-slate-700">
                        <td className="hidden sm:table-cell" />
                        <td className="py-1.5 pr-2">
                          <span className="block text-slate-800 sm:truncate">{line.name}</span>
                          <span className="block text-xs text-slate-500 sm:truncate">{line.detail}</span>
                        </td>
                        <td className="hidden text-center text-slate-400 sm:table-cell">
                          {line.isBill ? (
                            <FileText className="inline size-3.5" aria-label="Supplier bill" />
                          ) : line.attachments > 0 ? (
                            <Paperclip className="inline size-3.5" aria-label={`${line.attachments} attachment(s)`} />
                          ) : null}
                        </td>
                        <td className="hidden md:table-cell" />
                        <td />
                        <td className="py-1.5 pl-2 text-right tabular-nums">{formatINR(line.amount)}</td>
                        <td className="hidden sm:table-cell" />
                      </tr>
                    ))}
                </Fragment>
              );
            })}
            {filter === 'all' && (groups.unassigned.revised !== 0 || groups.unassigned.actual !== 0) && (
              <tr className="border-b border-slate-200 bg-slate-100/80 font-semibold text-slate-900">
                <td className="hidden py-2 pr-2 pl-2 sm:table-cell">{groups.unassigned.code}</td>
                <td className="py-2 pr-2">
                  {groups.unassigned.name}
                  <span className="block text-xs font-normal text-slate-500">Covers costs in categories with no budget of their own</span>
                </td>
                <td className="hidden sm:table-cell" />
                <Money value={groups.unassigned.original} wide />
                <Money value={groups.unassigned.revised} />
                <Actual budget={groups.unassigned.revised} actual={groups.unassigned.actual} />
                <Variance budget={groups.unassigned.revised} actual={groups.unassigned.actual} />
              </tr>
            )}
          </tbody>
          {filter === 'all' && (
            <tfoot>
              <tr className="font-bold text-slate-900">
                <td className="hidden py-2.5 pr-2 pl-2 sm:table-cell" />
                <td className="py-2.5 pr-2">Total</td>
                <td className="hidden sm:table-cell" />
                <Money value={groups.originalTotal} wide />
                <Money value={project.estimatedCost} />
                <Actual budget={project.estimatedCost} actual={summary.actualCost} />
                <Variance budget={project.estimatedCost} actual={summary.actualCost} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Actual = supplier bills + payments not linked to a bill (a bill and its payments count once). Variance = revised estimate − actual.
      </p>
    </div>
  );
}

function Money({ value, wide }: { value: number | null; wide?: boolean }) {
  return <td className={`py-2 pl-2 text-right tabular-nums ${wide ? "hidden md:table-cell" : ""}`}>{value === null ? <span className="text-slate-400">—</span> : formatINR(value)}</td>;
}

function varianceText(budget: number, actual: number) {
  const v = budget - actual;
  return { text: `${v < 0 ? '− ' : '+ '}${formatINR(Math.abs(v))}`, tone: v < 0 ? 'text-red-600' : 'text-blue-700' };
}

function Variance({ budget, actual }: { budget: number | null; actual: number }) {
  if (budget === null) return <td className="hidden py-2 pl-2 text-right text-slate-400 sm:table-cell">—</td>;
  const v = varianceText(budget, actual);
  return <td className={`hidden py-2 pl-2 text-right tabular-nums sm:table-cell ${v.tone}`}>{v.text}</td>;
}

/** Actual amount; on phones the variance is shown under it instead of in its own column. */
function Actual({ budget, actual }: { budget: number | null; actual: number }) {
  const v = budget === null ? null : varianceText(budget, actual);
  return (
    <td className="py-2 pl-2 text-right tabular-nums">
      {formatINR(actual)}
      {v && <span className={`block text-[11px] font-medium sm:hidden ${v.tone}`}>{v.text}</span>}
    </td>
  );
}
