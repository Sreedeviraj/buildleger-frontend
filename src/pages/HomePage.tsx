import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight, CircleCheck, CircleX, FileText, FolderKanban, FolderPlus, HandCoins, TriangleAlert, Wallet } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useProjectsOverview, type ProjectWithSummary } from '../api/hooks';
import { buttonClass } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/ui/States';
import { StatusBadge } from '../components/ui/StatusBadge';
import { projectAlerts, sortAlerts, type Alert } from '../lib/alerts';
import { billOutstanding, billPayments, sum } from '../lib/calc';
import { errorMessage } from '../lib/errors';
import { formatDate, formatINR, toISODate, todayISO } from '../lib/format';

/** How many projects and alerts the home page lists before linking to the full view. */
const PROJECT_LIMIT = 6;
const ALERT_LIMIT = 5;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function HomePage() {
  const { session } = useAuth();
  const { data, finance, isLoading, error, refetch } = useProjectsOverview();

  if (isLoading) return <LoadingBlock />;
  if (error || !data || !finance) return <ErrorBlock message={error ? errorMessage(error) : undefined} onRetry={refetch} />;

  const firstName = session?.user.name.split(' ')[0] ?? '';
  const today = todayISO();

  // Archived projects are out of the everyday view; completed ones still count for money owed.
  const current = data.filter((d) => !d.project.archived);
  const active = current.filter((d) => d.project.status !== 'completed');
  const total = (pick: (s: ProjectWithSummary['summary']) => number) => sum(current.map((d) => pick(d.summary)));
  const received = total((s) => s.received);
  const paid = total((s) => s.paid);
  const netCash = received - paid;
  const clientOwes = total((s) => s.clientOutstanding);
  const overdue = total((s) => s.overdue);
  const overdueProjects = current.filter((d) => d.summary.overdue > 0).length;
  const unpaidBills = total((s) => s.unpaidBills);
  const overdueBills = total((s) => s.overdueBills);
  const alerts = sortAlerts(current.flatMap((d) => projectAlerts(d.project, d.summary)));

  // Supplier bills falling due in the next 7 days (overdue ones are counted separately).
  const weekEnd = toISODate(new Date(Date.now() + 7 * 86_400_000));
  const currentIds = new Set(current.map((d) => d.project.id));
  const paidByBill = billPayments(finance.bills, finance.expenses);
  const dueThisWeek = sum(
    finance.bills
      .filter((b) => currentIds.has(b.projectId) && b.dueDate && b.dueDate >= today && b.dueDate <= weekEnd)
      .map((b) => billOutstanding(b, paidByBill)),
  );

  const overBudget = active.filter((d) => d.summary.health === 'over').length;
  const onHold = active.filter((d) => d.project.status === 'on_hold').length;

  // Projects that need action come first, so the short list is always the useful one.
  const urgency = (d: ProjectWithSummary) =>
    (alerts.some((a) => a.projectId === d.project.id && a.serious) ? 4 : 0) +
    (d.summary.overdue > 0 ? 2 : 0) +
    (d.summary.health !== 'good' || d.summary.netCash < 0 ? 1 : 0);
  const ranked = [...active].sort((a, b) => urgency(b) - urgency(a) || a.project.name.localeCompare(b.project.name));

  return (
    <>
      {/* Navy welcome banner, same family as the sidebar. Quick add lives in the sidebar / mobile Add button. */}
      <section className="relative mb-6 overflow-hidden rounded-2xl bg-navy-900 text-white shadow-sm">
        <span className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/5" aria-hidden />
        <span className="pointer-events-none absolute -bottom-24 right-40 size-48 rounded-full bg-white/[0.03]" aria-hidden />
        <div className="relative p-5 sm:px-6">
          <p className="text-xs font-semibold tracking-[0.18em] text-navy-300 uppercase">{formatDate(today)}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-navy-100">
            {active.length === 0
              ? 'Start by adding your first project.'
              : alerts.length === 0
                ? `${plural(active.length, 'active project')} · everything looks fine.`
                : `${plural(active.length, 'active project')} · ${plural(alerts.length, 'thing needs', 'things need')} your attention.`}
          </p>
        </div>
      </section>

      {data.length === 0 ? (
        <EmptyState
          icon={FolderPlus}
          title="No projects yet"
          text="Add your first project with the contract amount. Then you can record payments and expenses."
          action={
            <Link to="/projects/new" className={buttonClass('primary', 'lg')}>
              <FolderPlus className="size-5" aria-hidden /> Add first project
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <SectionLabel>Your business today</SectionLabel>
            <p className="text-sm text-slate-500">
              All projects, all entries to date ·{' '}
              <Link to="/reports" className="font-semibold text-navy-800 hover:underline">
                Reports
              </Link>
            </p>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              icon={Wallet}
              label="Cash position"
              value={formatINR(netCash)}
              tone={netCash < 0 ? 'text-red-700' : 'text-navy-800'}
              note={`In ${formatINR(received)} · Out ${formatINR(paid)}`}
              alert={netCash < 0}
            />
            <Kpi
              icon={HandCoins}
              label="To collect from clients"
              value={formatINR(clientOwes)}
              note={
                overdue > 0 ? (
                  <span className="font-semibold text-red-700">
                    {formatINR(overdue)} overdue · {plural(overdueProjects, 'project')}
                  </span>
                ) : (
                  'Nothing overdue'
                )
              }
              alert={overdue > 0}
            />
            <Kpi
              icon={FileText}
              label="To pay suppliers"
              value={formatINR(unpaidBills)}
              note={
                overdueBills > 0 ? (
                  <span className="font-semibold text-red-700">{formatINR(overdueBills)} past due</span>
                ) : dueThisWeek > 0 ? (
                  <span className="font-semibold text-amber-800">{formatINR(dueThisWeek)} due this week</span>
                ) : (
                  'Nothing due this week'
                )
              }
              alert={overdueBills > 0}
            />
            <Kpi
              icon={FolderKanban}
              label="Projects"
              value={`${active.length} active`}
              note={
                overBudget + onHold === 0 ? (
                  'All on budget'
                ) : (
                  <>
                    {overBudget > 0 && <span className="font-semibold text-red-700">{overBudget} over budget</span>}
                    {overBudget > 0 && onHold > 0 && ' · '}
                    {onHold > 0 && <span className="font-semibold text-amber-800">{onHold} on hold</span>}
                  </>
                )
              }
              to="/projects"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Card className="overflow-hidden xl:col-span-2">
              <SectionHead title="Active projects" link={{ to: '/projects', label: `See all (${current.length})` }} />
              {ranked.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-slate-600">All your projects are completed.</p>
              ) : (
                <>
                  <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_1rem] gap-4 border-y border-slate-100 bg-slate-50 px-5 py-2 text-xs font-semibold text-slate-500 sm:grid">
                    <span>Project</span>
                    <span>Budget used</span>
                    <span className="text-right">Client owes</span>
                    <span />
                  </div>
                  <ul className="divide-y divide-slate-100 border-t border-slate-100 sm:border-t-0">
                    {ranked.slice(0, PROJECT_LIMIT).map((d) => (
                      <ProjectRow key={d.project.id} {...d} />
                    ))}
                  </ul>
                  {ranked.length > PROJECT_LIMIT && (
                    <Link
                      to="/projects"
                      className="flex items-center gap-1 border-t border-slate-100 px-5 py-3 text-sm font-semibold text-navy-800 hover:bg-slate-50"
                    >
                      See {ranked.length - PROJECT_LIMIT} more active projects <ChevronRight className="size-4" aria-hidden />
                    </Link>
                  )}
                </>
              )}
            </Card>

            <AttentionCard alerts={alerts} />
          </div>
        </>
      )}
    </>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">{children}</h2>;
}

interface KpiProps {
  icon: LucideIcon;
  label: string;
  value: string;
  note: ReactNode;
  tone?: string;
  /** Red top edge when the number needs action. */
  alert?: boolean;
  to?: string;
}

function Kpi({ icon: Icon, label, value, note, tone = 'text-slate-900', alert = false, to }: KpiProps) {
  const body = (
    <>
      <p className="flex items-center gap-2.5 text-sm font-semibold text-slate-600">
        <span className={`flex size-8 items-center justify-center rounded-lg ${alert ? 'bg-red-50 text-red-700' : 'bg-navy-50 text-navy-700'}`}>
          <Icon className="size-4" aria-hidden />
        </span>
        {label}
      </p>
      <p className={`mt-3 truncate text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 truncate text-sm text-slate-500">{note}</p>
    </>
  );
  const box = `block min-w-0 rounded-xl border border-t-[3px] border-slate-200 bg-white p-5 shadow-sm ${alert ? 'border-t-red-600' : 'border-t-navy-800'}`;
  return to ? (
    <Link to={to} className={`${box} transition hover:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

function SectionHead({ title, link }: { title: string; link?: { to: string; label: string } }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <span className="h-4 w-1 rounded-full bg-navy-800" aria-hidden /> {title}
      </h2>
      {link && (
        <Link to={link.to} className="flex items-center gap-0.5 text-sm font-semibold text-navy-800 hover:underline">
          {link.label} <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

const BAR = { good: 'bg-blue-600', watch: 'bg-amber-500', over: 'bg-red-600' } as const;

function ProjectRow({ project, summary }: ProjectWithSummary) {
  return (
    <li>
      <Link
        to={`/projects/${project.id}`}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3 hover:bg-slate-50 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_1rem]"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900">{project.name}</span>
            <span className="shrink-0">
              <StatusBadge status={project.status} />
            </span>
          </span>
          <span className="block truncate text-xs text-slate-500">{project.clientName}</span>
        </span>

        <span className="col-span-2 row-start-2 flex items-center gap-2 sm:col-span-1 sm:row-start-auto">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <span className={`block h-full rounded-full ${BAR[summary.health]}`} style={{ width: `${Math.min(summary.budgetUsedPercent, 100)}%` }} />
          </span>
          <span className={`w-10 text-right text-xs font-semibold tabular-nums ${summary.health === 'over' ? 'text-red-700' : 'text-slate-600'}`}>
            {summary.budgetUsedPercent}%
          </span>
          <span className="sr-only">of budget used</span>
        </span>

        <span className="text-right">
          <span className="block text-sm font-semibold text-slate-900 tabular-nums">{formatINR(summary.clientOutstanding)}</span>
          {summary.overdue > 0 && <span className="block text-xs font-semibold text-red-700 tabular-nums">{formatINR(summary.overdue)} overdue</span>}
        </span>

        <ChevronRight className="hidden size-4 text-slate-400 sm:block" aria-hidden />
      </Link>
    </li>
  );
}

function AttentionCard({ alerts }: { alerts: Alert[] }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? alerts : alerts.slice(0, ALERT_LIMIT);
  return (
    <Card className="self-start overflow-hidden">
      <SectionHead title="Needs your attention" />
      {alerts.length === 0 ? (
        <p className="flex items-center gap-2 px-5 pb-5 text-sm font-medium text-navy-800">
          <CircleCheck className="size-5" aria-hidden /> All projects look fine.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {shown.map((alert) => (
              <li key={alert.key}>
                <Link to={`/projects/${alert.projectId}`} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50">
                  {alert.serious ? (
                    <CircleX className="mt-0.5 size-4 shrink-0 text-red-600" aria-label="Serious" />
                  ) : (
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-label="Warning" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{alert.projectName}</span>
                    <span className="text-sm text-slate-600">{alert.message}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {alerts.length > ALERT_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="block w-full border-t border-slate-100 px-5 py-3 text-left text-sm font-semibold text-navy-800 hover:bg-slate-50"
            >
              {showAll ? 'Show less' : `Show ${alerts.length - ALERT_LIMIT} more`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}
