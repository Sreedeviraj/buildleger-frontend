import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { BarChart3, Download, Printer } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useProjectsOverview, type FinanceData, type ProjectWithSummary } from '../api/hooks';
import { PageHeader } from '../components/layout/PageHeader';
import { TransactionLedger } from '../components/project/TransactionLedger';
import { CashFlowChart } from '../components/reports/CashFlowChart';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { inputClass } from '../components/ui/Fields';
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/ui/States';
import {
  cashInRange,
  costByCategory,
  costLines,
  forProject,
  inRange,
  monthlyCashFlow,
  percentLabel,
  supplierBalances,
  sum,
  type DateRange,
  type FinanceRecords,
} from '../lib/calc';
import { categoryLabel, findOption, SUPPLIER_TYPES } from '../lib/constants';
import { errorMessage } from '../lib/errors';
import { downloadCSV } from '../lib/export';
import { formatDate, formatINR, formatMonth, toISODate, todayISO } from '../lib/format';
import { buildLedger, EMPTY_FILTER, filterLedger, type LedgerFilter } from '../lib/ledger';

type ReportId = 'projects' | 'cashflow' | 'clients' | 'suppliers' | 'categories' | 'budget' | 'profit' | 'ledger';

const REPORTS: { id: ReportId; label: string; dated: boolean }[] = [
  { id: 'projects', label: 'Project income & expenses', dated: true },
  { id: 'cashflow', label: 'Monthly cash flow', dated: true },
  { id: 'clients', label: 'Client outstanding', dated: false },
  { id: 'suppliers', label: 'Supplier outstanding', dated: false },
  { id: 'categories', label: 'Expenses by category', dated: true },
  { id: 'budget', label: 'Budget vs actual', dated: false },
  { id: 'profit', label: 'Project profitability', dated: false },
  { id: 'ledger', label: 'Transaction ledger', dated: true },
];

type Preset = 'all' | 'thisMonth' | 'lastMonth' | 'thisFY' | 'lastFY' | 'custom';

/** Indian financial year: April to March. */
function presetRange(preset: Preset, today: string): DateRange {
  const d = new Date(`${today}T00:00:00`);
  const y = d.getFullYear();
  const m = d.getMonth();
  const fyStart = m >= 3 ? y : y - 1;
  switch (preset) {
    case 'thisMonth':
      return { from: toISODate(new Date(y, m, 1)), to: today };
    case 'lastMonth':
      return { from: toISODate(new Date(y, m - 1, 1)), to: toISODate(new Date(y, m, 0)) };
    case 'thisFY':
      return { from: `${fyStart}-04-01`, to: today };
    case 'lastFY':
      return { from: `${fyStart - 1}-04-01`, to: `${fyStart}-03-31` };
    default:
      return {};
  }
}

type Cell = string | number;
interface Column {
  label: string;
  /** Numbers are formatted as rupees on screen and exported raw. */
  money?: boolean;
  percent?: boolean;
}

export default function ReportsPage() {
  const overview = useProjectsOverview();
  const { session } = useAuth();
  const today = todayISO();
  const [report, setReport] = useState<ReportId>('projects');
  const [preset, setPreset] = useState<Preset>('thisFY');
  const [custom, setCustom] = useState<DateRange>({});
  const [projectId, setProjectId] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>(EMPTY_FILTER);

  const range = preset === 'custom' ? custom : presetRange(preset, today);
  const meta = REPORTS.find((r) => r.id === report)!;

  const scope = useMemo(() => {
    if (!overview.data || !overview.finance) return null;
    const items = overview.data.filter((d) => (includeArchived || !d.project.archived) && (!projectId || d.project.id === projectId));
    const ids = new Set(items.map((d) => d.project.id));
    const finance = overview.finance;
    const records: FinanceRecords = {
      payments: finance.payments.filter((r) => ids.has(r.projectId)),
      expenses: finance.expenses.filter((r) => ids.has(r.projectId)),
      bills: finance.bills.filter((r) => ids.has(r.projectId)),
      installments: finance.installments.filter((r) => ids.has(r.projectId)),
    };
    return { items, records, finance };
  }, [overview.data, overview.finance, includeArchived, projectId]);

  if (overview.isLoading) return <LoadingBlock />;
  if (overview.error || !scope) return <ErrorBlock message={overview.error ? errorMessage(overview.error) : undefined} onRetry={overview.refetch} />;

  const periodLabel = meta.dated
    ? range.from || range.to
      ? `${range.from ? formatDate(range.from) : 'Start'} – ${range.to ? formatDate(range.to) : formatDate(today)}`
      : `All dates up to ${formatDate(today)}`
    : `As on ${formatDate(today)} (all dates)`;
  const projectLabel = projectId ? scope.items[0]?.project.name ?? '' : `${scope.items.length} projects${includeArchived ? ' incl. archived' : ''}`;
  const allProjects = overview.data!.filter((d) => includeArchived || !d.project.archived);

  return (
    <>
      <PageHeader title="Reports" subtitle="Every figure is worked out from the saved entries. Voided entries are left out." />

      {/* Filters */}
      <Card className="mb-4 p-4 print:hidden">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="text-sm font-semibold text-slate-800">
            Report
            <select value={report} onChange={(e) => setReport(e.target.value as ReportId)} className={`${inputClass} truncate`}>
              {REPORTS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Project
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${inputClass} truncate`}>
              <option value="">All projects</option>
              {allProjects.map((d) => (
                <option key={d.project.id} value={d.project.id}>
                  {d.project.name}
                </option>
              ))}
            </select>
          </label>
          <label className={`text-sm font-semibold ${meta.dated ? 'text-slate-800' : 'text-slate-400'}`}>
            Period
            <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)} disabled={!meta.dated} className={`${inputClass} truncate disabled:bg-slate-100`}>
              <option value="thisMonth">This month</option>
              <option value="lastMonth">Last month</option>
              <option value="thisFY">This financial year</option>
              <option value="lastFY">Last financial year</option>
              <option value="all">All time</option>
              <option value="custom">Choose dates…</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm whitespace-nowrap text-slate-700 xl:items-end xl:pb-3">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} className="size-4 accent-blue-700" />
            Include archived projects
          </label>
        </div>
        {meta.dated && preset === 'custom' && (
          <div className="mt-3 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:max-w-md">
            <label className="text-sm font-semibold text-slate-800">
              From
              <input type="date" value={custom.from ?? ''} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value || undefined })} className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              To
              <input type="date" value={custom.to ?? ''} min={custom.from} onChange={(e) => setCustom({ ...custom, to: e.target.value || undefined })} className={inputClass} />
            </label>
          </div>
        )}
      </Card>

      <ReportBody
        report={report}
        title={meta.label}
        subtitle={`${session?.company.name ?? ''} · ${projectLabel} · ${periodLabel}`}
        items={scope.items}
        records={scope.records}
        finance={scope.finance}
        range={meta.dated ? range : {}}
        today={today}
        ledgerFilter={ledgerFilter}
        onLedgerFilter={setLedgerFilter}
        canEdit={session?.user.role === 'owner'}
      />
    </>
  );
}

interface ReportBodyProps {
  report: ReportId;
  title: string;
  subtitle: string;
  items: ProjectWithSummary[];
  records: FinanceRecords;
  finance: FinanceData;
  range: DateRange;
  today: string;
  ledgerFilter: LedgerFilter;
  onLedgerFilter: (f: LedgerFilter) => void;
  canEdit: boolean;
}

function ReportBody({ report, title, subtitle, items, records, finance, range, today, ledgerFilter, onLedgerFilter, canEdit }: ReportBodyProps) {
  const fileName = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${today}`;

  if (report === 'ledger') {
    const rows = buildLedger({ ...records, suppliers: finance.suppliers, projects: finance.projects }, today);
    const filter = { ...ledgerFilter, from: range.from ?? '', to: range.to ?? '' };
    const projectNames = new Map(finance.projects.map((p) => [p.id, p.name]));
    const exportLedger = () => {
      const visible = filterLedger(rows, filter);
      const signed = (r: (typeof visible)[number]) => (r.type === 'receipt' ? r.amount : r.type === 'bill' ? 0 : -r.amount);
      downloadCSV(fileName, [
        ['Date', 'Project', 'Type', 'Party', 'Description', 'Category', 'Reference', 'Money in', 'Money out', 'Bill amount', 'Bill unpaid', 'Status'],
        ...visible.map((r) => [
          r.date,
          projectNames.get(r.projectId) ?? '',
          r.type,
          r.party,
          r.title,
          r.category ? categoryLabel(r.category) : '',
          r.reference,
          r.type === 'receipt' ? r.amount : r.type === 'refund' ? -r.amount : '',
          r.type === 'expense' ? r.amount : '',
          r.type === 'bill' ? r.amount : '',
          r.type === 'bill' ? r.outstanding : '',
          r.voided ? `Voided: ${r.voided.reason}` : '',
        ]),
        ['', '', '', '', 'Net cash (live entries)', '', '', '', '', '', '', sum(visible.filter((r) => !r.voided).map(signed))],
      ]);
    };
    return (
      <ReportCard title={title} subtitle={subtitle} onExport={exportLedger}>
        <TransactionLedger
          rows={rows}
          filter={filter}
          onFilterChange={(f) => onLedgerFilter({ ...f, from: '', to: '' })}
          canEdit={canEdit}
          projectNames={projectNames}
          fixedDates
        />
      </ReportCard>
    );
  }

  const table = buildTable(report, items, records, finance, range, today);
  const exportTable = () =>
    downloadCSV(fileName, [
      [title],
      [subtitle],
      [],
      table.columns.map((c) => c.label),
      ...table.rows,
      ...(table.totals ? [table.totals] : []),
    ]);

  return (
    <ReportCard title={title} subtitle={subtitle} onExport={table.rows.length > 0 ? exportTable : undefined}>
      {report === 'cashflow' && table.rows.length > 0 && (
        <div className="mb-5">
          <CashFlowChart months={monthlyCashFlow(records, range)} />
        </div>
      )}
      {table.rows.length === 0 ? (
        <EmptyState icon={BarChart3} title="Nothing to show" text="There are no entries for this selection. Try another period or project." />
      ) : (
        <DataTable table={table} />
      )}
      {table.note && <p className="mt-3 text-xs text-slate-500">{table.note}</p>}
    </ReportCard>
  );
}

function ReportCard({ title, subtitle, onExport, children }: { title: string; subtitle: string; onExport?: () => void; children: ReactNode }) {
  return (
    <Card className="p-4 sm:p-5 print:border-0 print:p-0 print:shadow-none">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {onExport && (
            <Button variant="secondary" onClick={onExport}>
              <Download className="size-4" aria-hidden /> CSV
            </Button>
          )}
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden /> Print / PDF
          </Button>
        </div>
      </div>
      {children}
    </Card>
  );
}

interface Table {
  columns: Column[];
  rows: Cell[][];
  totals?: Cell[];
  /** Index of a column holding a project id for linking (removed before display). */
  links?: (string | null)[];
  note?: string;
}

function DataTable({ table }: { table: Table }) {
  const show = (cell: Cell, col: Column) =>
    typeof cell === 'number' ? (col.money ? formatINR(cell) : col.percent ? `${cell}%` : cell.toLocaleString('en-IN')) : cell;
  const tone = (cell: Cell, col: Column) => (typeof cell === 'number' && col.money && cell < 0 ? 'text-red-700' : '');
  return (
    <>
    {/* Phones: one card per row, label beside each figure */}
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 sm:hidden print:hidden">
      {table.rows.map((row, r) => {
        const link = table.links?.[r];
        return (
          <li key={r} className="px-3 py-3">
            {link ? (
              <Link to={`/projects/${link}`} className="font-semibold text-navy-800 hover:underline">
                {show(row[0], table.columns[0])}
              </Link>
            ) : (
              <p className="font-semibold text-slate-900">{show(row[0], table.columns[0])}</p>
            )}
            <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              {row.slice(1).map((cell, i) =>
                cell === '' ? null : (
                  <div key={i} className="min-w-0">
                    <dt className="truncate text-xs text-slate-500">{table.columns[i + 1].label}</dt>
                    <dd className={`truncate tabular-nums ${tone(cell, table.columns[i + 1])}`}>{show(cell, table.columns[i + 1])}</dd>
                  </div>
                ),
              )}
            </dl>
          </li>
        );
      })}
      {table.totals && (
        <li className="bg-slate-50 px-3 py-3">
          <p className="font-bold text-slate-900">{table.totals[0]}</p>
          <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            {table.totals.slice(1).map((cell, i) =>
              cell === '' ? null : (
                <div key={i} className="min-w-0">
                  <dt className="truncate text-xs text-slate-500">{table.columns[i + 1].label}</dt>
                  <dd className={`truncate font-bold tabular-nums ${tone(cell, table.columns[i + 1])}`}>{show(cell, table.columns[i + 1])}</dd>
                </div>
              ),
            )}
          </dl>
        </li>
      )}
    </ul>

    <div className="hidden overflow-x-auto sm:block print:block">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-600 uppercase">
            {table.columns.map((c, i) => (
              <th key={c.label} scope="col" className={`px-2 py-2 ${i > 0 && (c.money || c.percent) ? 'text-right' : ''}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {table.rows.map((row, r) => (
            <tr key={r} className="hover:bg-slate-50">
              {row.map((cell, i) => {
                const col = table.columns[i];
                const link = i === 0 ? table.links?.[r] : null;
                return (
                  <td key={i} className={`px-2 py-2 ${col.money || col.percent ? 'text-right tabular-nums' : ''} ${tone(cell, col)}`}>
                    {link ? (
                      <Link to={`/projects/${link}`} className="font-medium text-blue-800 hover:underline">
                        {show(cell, col)}
                      </Link>
                    ) : (
                      show(cell, col)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {table.totals && (
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-bold">
              {table.totals.map((cell, i) => (
                <td key={i} className={`px-2 py-2 ${table.columns[i].money || table.columns[i].percent ? 'text-right tabular-nums' : ''} ${tone(cell, table.columns[i])}`}>
                  {show(cell, table.columns[i])}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
    </>
  );
}

/** Builds every report from raw numbers; the totals row is the sum of the rows shown. */
function buildTable(report: ReportId, items: ProjectWithSummary[], records: FinanceRecords, finance: FinanceData, range: DateRange, today: string): Table {
  const total = (rows: Cell[][], i: number) => sum(rows.map((r) => r[i] as number));
  const ids = items.map((d) => d.project.id);

  switch (report) {
    case 'projects': {
      const lines = items.map(({ project }) => {
        const own = forProject(records, project.id);
        const cash = cashInRange(own, range);
        const cost = sum(costLines(own).filter((c) => inRange(c.date, range)).map((c) => c.amount));
        return { id: project.id, row: [project.name, cash.cashIn, cash.cashOut, cash.cashIn - cash.cashOut, cost] as Cell[] };
      });
      const active = lines.filter((l) => l.row.slice(1).some((v) => v !== 0));
      const rows = active.map((l) => l.row);
      return {
        columns: [{ label: 'Project' }, { label: 'Money in', money: true }, { label: 'Money out', money: true }, { label: 'Net cash', money: true }, { label: 'Cost incurred', money: true }],
        rows,
        links: active.map((l) => l.id),
        totals: ['Total', total(rows, 1), total(rows, 2), total(rows, 3), total(rows, 4)],
        note: 'Money in = client payments − refunds. Money out = payments made. Cost incurred = supplier bills + payments not linked to a bill, by bill or payment date.',
      };
    }
    case 'cashflow': {
      let running = 0;
      const rows = monthlyCashFlow(records, range).map((m) => {
        running += m.net;
        return [formatMonth(m.month), m.cashIn, m.cashOut, m.net, running] as Cell[];
      });
      return {
        columns: [{ label: 'Month' }, { label: 'Money in', money: true }, { label: 'Money out', money: true }, { label: 'Net', money: true }, { label: 'Running total', money: true }],
        rows,
        totals: ['Total', total(rows, 1), total(rows, 2), total(rows, 3), ''],
        note: 'Running total starts at zero at the beginning of the selected period.',
      };
    }
    case 'clients': {
      const shown = items.filter((d) => d.summary.clientOutstanding > 0 || d.summary.clientOverpaid > 0);
      const rows = shown.map(({ project, summary }) => [
        project.name,
        project.clientName,
        project.contractValue,
        summary.received,
        summary.clientOutstanding - summary.clientOverpaid,
        summary.overdue,
        summary.nextInstallment ? `${summary.nextInstallment.label} · ${formatDate(summary.nextInstallment.dueDate)}` : '—',
      ]);
      return {
        columns: [
          { label: 'Project' },
          { label: 'Client' },
          { label: 'Contract', money: true },
          { label: 'Received', money: true },
          { label: 'Outstanding', money: true },
          { label: 'Overdue', money: true },
          { label: 'Next due' },
        ],
        rows,
        links: shown.map((d) => d.project.id),
        totals: ['Total', '', total(rows, 2), total(rows, 3), total(rows, 4), total(rows, 5), ''],
        note: 'Outstanding below zero means the client has paid more than the contract value. Overdue uses the client payment schedule.',
      };
    }
    case 'suppliers': {
      const name = new Map(finance.suppliers.map((s) => [s.id, s]));
      const rows = supplierBalances(records, today)
        .filter((b) => b.billed > 0 || b.paid > 0)
        .sort((a, b) => b.outstanding - a.outstanding)
        .map((b) => [
          name.get(b.supplierId)?.name ?? '—',
          findOption(SUPPLIER_TYPES, name.get(b.supplierId)?.type ?? 'supplier').label,
          b.billed,
          b.paid,
          b.outstanding,
          b.overdue,
          b.unlinkedPaid,
        ]);
      return {
        columns: [
          { label: 'Supplier' },
          { label: 'Type' },
          { label: 'Billed', money: true },
          { label: 'Paid', money: true },
          { label: 'Unpaid bills', money: true },
          { label: 'Overdue', money: true },
          { label: 'Paid without bill', money: true },
        ],
        rows,
        totals: ['Total', '', total(rows, 2), total(rows, 3), total(rows, 4), total(rows, 5), total(rows, 6)],
        note: 'Payments not linked to a supplier (free-text payee) are not included here.',
      };
    }
    case 'categories': {
      const lines = costByCategory(records, range);
      const all = sum(lines.map((l) => l.amount));
      const rows = lines.map((l) => [categoryLabel(l.category), l.amount, all ? Math.round((l.amount / all) * 100) : 0]);
      return {
        columns: [{ label: 'Category' }, { label: 'Cost incurred', money: true }, { label: 'Share', percent: true }],
        rows,
        totals: ['Total', all, ''],
        note: 'Cost incurred = supplier bills + payments not linked to a bill. A bill and its payments are counted once.',
      };
    }
    case 'budget': {
      if (items.length === 1) {
        const { summary } = items[0];
        const rows = summary.categories.map((c) => [
          categoryLabel(c.category),
          c.budget ?? '—',
          c.actual,
          c.remaining ?? '—',
          c.usedRatio === null ? '—' : percentLabel(c.usedRatio),
        ]);
        return {
          columns: [{ label: 'Category' }, { label: 'Budget', money: true }, { label: 'Actual', money: true }, { label: 'Remaining', money: true }, { label: 'Used', percent: true }],
          rows,
          totals: ['Whole project', summary.estimatedCost, summary.actualCost, summary.remainingBudget, summary.budgetUsedPercent],
          note: 'Category rows without a budget use the part of the total budget that is not assigned to a category.',
        };
      }
      const rows = items.map(({ project, summary }) => [
        project.name,
        summary.estimatedCost,
        summary.actualCost,
        summary.remainingBudget,
        summary.budgetUsedPercent,
        summary.overBudgetCategories.map((c) => categoryLabel(c.category)).join(', ') || '—',
      ]);
      return {
        columns: [{ label: 'Project' }, { label: 'Budget', money: true }, { label: 'Actual cost', money: true }, { label: 'Remaining', money: true }, { label: 'Used', percent: true }, { label: 'Overspent categories' }],
        rows,
        links: ids,
        totals: ['Total', total(rows, 1), total(rows, 2), total(rows, 3), percentLabel(total(rows, 2) / Math.max(total(rows, 1), 1)), ''],
        note: 'Choose one project above to see its categories.',
      };
    }
    case 'profit': {
      const rows = items.map(({ project, summary }) => [
        project.name,
        project.contractValue,
        summary.estimatedProfit,
        summary.forecastProfit,
        summary.profitToDateCash,
        summary.profitToDateAccrual,
        project.contractValue ? Math.round((summary.forecastProfit / project.contractValue) * 100) : 0,
      ]);
      const contract = total(rows, 1);
      return {
        columns: [
          { label: 'Project' },
          { label: 'Contract', money: true },
          { label: 'Estimated profit', money: true },
          { label: 'Forecast profit', money: true },
          { label: 'To date (cash)', money: true },
          { label: 'To date (work done)', money: true },
          { label: 'Forecast margin', percent: true },
        ],
        rows,
        links: ids,
        totals: ['Total', contract, total(rows, 2), total(rows, 3), total(rows, 4), total(rows, 5), contract ? Math.round((total(rows, 3) / contract) * 100) : 0],
        note: 'Estimated = contract − budget. Forecast = contract − (cost so far + budget still planned). Cash = received − paid. Work done = contract × % complete − cost incurred.',
      };
    }
    default:
      return { columns: [], rows: [] };
  }
}
