import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  Archive,
  ArchiveRestore,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CircleCheck,
  FileText,
  FolderSearch,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useAudit, useBudgetRevisions, useDeleteProject, useProjectsOverview, useSetProjectArchived, useUpdateProject } from '../api/hooks';
import { FinancialSummary, type InspectTarget } from '../components/project/FinancialSummary';
import { JobCostTable } from '../components/project/JobCostTable';
import { PaymentSchedule } from '../components/project/PaymentSchedule';
import { TransactionLedger } from '../components/project/TransactionLedger';
import { buttonClass } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Menu, type MenuItem } from '../components/ui/Menu';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { projectAlerts, sortAlerts } from '../lib/alerts';
import { canManage } from '../lib/constants';
import { forProject, type ProjectSummary } from '../lib/calc';
import { errorMessage } from '../lib/errors';
import { formatDate, formatDateTime, formatINR, todayISO } from '../lib/format';
import { buildLedger, EMPTY_FILTER, type LedgerFilter } from '../lib/ledger';
import type { Project } from '../types';

/** Statement for the client. It deliberately leaves out spending and profit. */
function whatsappLink(project: Project, summary: ProjectSummary, companyName: string): string {
  const text = [
    `*${project.name}*`,
    `Statement as on ${formatDate(todayISO())}`,
    '',
    `Contract value: ${formatINR(project.contractValue)}`,
    `Received so far: ${formatINR(summary.received)}`,
    `Balance due: ${formatINR(summary.clientOutstanding)}`,
    summary.overdue > 0 ? `Overdue now: ${formatINR(summary.overdue)}` : '',
    summary.nextInstallment ? `Next payment: ${summary.nextInstallment.label} – ${formatDate(summary.nextInstallment.dueDate)}` : '',
    '',
    `– ${companyName}`,
  ]
    .filter((line, i, all) => line !== '' || all[i - 1] !== '')
    .join('\n');
  const digits = project.clientPhone.replace(/\D/g, '');
  const phone = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000);
}

type Tab = 'budget' | 'transactions' | 'client' | 'summary' | 'activity';

export default function ProjectDetailPage() {
  const { id = '' } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const overview = useProjectsOverview();
  const revisions = useBudgetRevisions(id);
  const updateProject = useUpdateProject();
  const setArchived = useSetProjectArchived();
  const deleteProject = useDeleteProject();
  const [tab, setTab] = useState<Tab>('budget');
  const [filter, setFilter] = useState<LedgerFilter>(EMPTY_FILTER);
  const [clientFilter, setClientFilter] = useState<LedgerFilter>({ ...EMPTY_FILTER, view: 'in' });
  const [showAlerts, setShowAlerts] = useState(false);
  const [confirm, setConfirm] = useState<'status' | 'archive' | 'delete' | null>(null);
  const activity = useAudit({ projectId: id }, tab === 'activity');
  const today = todayISO();

  const item = overview.data?.find((d) => d.project.id === id);
  const finance = overview.finance;
  const ledgerRows = useMemo(() => {
    if (!finance) return [];
    return buildLedger({ ...forProject(finance, id), suppliers: finance.suppliers, projects: finance.projects }, today);
  }, [finance, id, today]);

  if (overview.isLoading) return <LoadingBlock />;
  if (overview.error || !finance) return <ErrorBlock message={overview.error ? errorMessage(overview.error) : undefined} onRetry={overview.refetch} />;
  if (!item) {
    return (
      <EmptyState
        icon={FolderSearch}
        title="This project does not exist"
        text="It may have been deleted, or the link is wrong."
        action={
          <Link to="/projects" className={buttonClass('primary')}>
            See all projects
          </Link>
        }
      />
    );
  }

  const { project, summary: s } = item;
  const isOwner = session?.user.role === 'owner';
  const canEdit = canManage(session?.user.role);
  const isCompleted = project.status === 'completed';
  const alerts = sortAlerts(projectAlerts(project, s));
  const installments = finance.installments.filter((i) => i.projectId === id);
  const daysLeft = project.expectedEndDate && !isCompleted ? daysBetween(today, project.expectedEndDate) : null;
  const variance = project.estimatedCost - s.actualCost;

  function inspect(target: InspectTarget) {
    if (target === 'schedule') return setTab('client');
    if (target === 'budget') return setTab('budget');
    if (target === 'received') return setTab('client');
    const view = { paid: 'out', bills: 'bills', unpaid: 'unpaid', costs: 'all' } as const;
    setFilter({ ...EMPTY_FILTER, view: view[target] });
    setTab('transactions');
  }

  async function runConfirmed() {
    try {
      if (confirm === 'status') {
        await updateProject.mutateAsync([project.id, isCompleted ? { status: 'ongoing' } : { status: 'completed', progress: 100 }]);
        toast(isCompleted ? 'Project reopened' : 'Project marked as completed');
      } else if (confirm === 'archive') {
        await setArchived.mutateAsync([project.id, !project.archived]);
        toast(project.archived ? 'Project restored' : 'Project archived');
      } else if (confirm === 'delete') {
        await deleteProject.mutateAsync(project.id);
        toast('Project deleted');
        navigate('/projects');
      }
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setConfirm(null);
    }
  }

  const addItems: MenuItem[] = [
    { label: 'Money received', icon: ArrowDownLeft, to: `/payments/new?projectId=${project.id}` },
    { label: 'Expense paid', icon: ArrowUpRight, to: `/expenses/new?projectId=${project.id}` },
    { label: 'Supplier bill', icon: FileText, to: `/bills/new?projectId=${project.id}` },
  ];
  const actionItems: MenuItem[] = [
    { label: 'Send statement on WhatsApp', icon: MessageCircle, to: whatsappLink(project, s, session?.company.name ?? ''), external: true },
    ...(project.clientPhone ? [{ label: 'Call client', icon: Phone, to: `tel:${project.clientPhone}`, external: true }] : []),
    ...(canEdit
      ? [
          { label: 'Edit project', icon: Pencil, to: `/projects/${project.id}/edit` },
          { label: 'Budget setup', icon: SlidersHorizontal, to: `/projects/${project.id}/budget` },
          { label: isCompleted ? 'Reopen project' : 'Mark as completed', icon: isCompleted ? RotateCcw : CircleCheck, onSelect: () => setConfirm('status') },
          { label: project.archived ? 'Restore from archive' : 'Archive project', icon: project.archived ? ArchiveRestore : Archive, onSelect: () => setConfirm('archive') },
          ...(isOwner && ledgerRows.length === 0 ? [{ label: 'Delete project', icon: Trash2, danger: true, onSelect: () => setConfirm('delete') }] : []),
        ]
      : []),
  ];

  const tabs: { id: Tab; label: string }[] = [
    { id: 'budget', label: 'Budget' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'client', label: 'Client payments' },
    { id: 'summary', label: 'Financial summary' },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      {/* Header */}
      <Link to="/projects" className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-3.5" aria-hidden /> Projects
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold text-slate-900">
            {project.name} <StatusBadge status={project.status} />
            {project.archived && <span className="text-xs font-medium text-slate-500">Archived</span>}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {[
              project.clientName,
              project.location,
              `${formatDate(project.startDate)}${project.expectedEndDate ? ` → ${formatDate(project.expectedEndDate)}` : ''}`,
              `${project.progress}% complete`,
              daysLeft !== null ? (daysLeft < 0 ? `${-daysLeft} days late` : `${daysLeft} days left`) : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex gap-2">
          <Menu label="Actions" items={actionItems} />
          <Menu label="Add" icon={Plus} items={addItems} variant="primary" />
        </div>
      </div>

      {/* Key figures */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Estimated" value={formatINR(project.estimatedCost)} />
        <Kpi label="Actual cost" value={formatINR(s.actualCost)} />
        <Kpi
          label="Variance"
          value={`${variance < 0 ? '− ' : '+ '}${formatINR(Math.abs(variance))}`}
          tone={variance < 0 ? 'bad' : 'good'}
          note={`${s.budgetUsedPercent}% of budget used`}
        />
        <Kpi label="Received" value={formatINR(s.received)} note={`of ${formatINR(project.contractValue)} contract`} />
        <Kpi
          label="Client owes"
          value={formatINR(s.clientOutstanding)}
          tone={s.overdue > 0 ? 'bad' : undefined}
          note={s.overdue > 0 ? `${formatINR(s.overdue)} overdue` : s.nextInstallment ? `Next due ${formatDate(s.nextInstallment.dueDate)}` : undefined}
        />
      </div>

      {/* Attention: one line, expandable */}
      {alerts.length > 0 && (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <button type="button" onClick={() => setShowAlerts(!showAlerts)} className="flex w-full items-start gap-2 text-left" aria-expanded={showAlerts}>
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
            <span className="flex-1">
              {alerts[0].message}
              {alerts.length > 1 && <span className="ml-1 font-semibold text-amber-800 underline-offset-2 hover:underline">{showAlerts ? 'Show less' : `+${alerts.length - 1} more`}</span>}
            </span>
          </button>
          {showAlerts && (
            <ul className="mt-1 space-y-1 pl-6">
              {alerts.slice(1).map((a) => (
                <li key={a.key}>{a.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${
              tab === t.id ? 'border-navy-800 font-semibold text-navy-900' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-4" role="tabpanel">
        {tab === 'budget' && <JobCostTable project={project} summary={s} rows={ledgerRows} revisions={revisions.data ?? []} />}
        {tab === 'transactions' && <TransactionLedger rows={ledgerRows} filter={filter} onFilterChange={setFilter} canEdit={canEdit} />}
        {tab === 'client' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <PaymentSchedule project={project} installments={installments} summary={s} today={today} canEdit={canEdit} />
            <div>
              <h2 className="mb-3 text-lg font-semibold text-slate-900">Payment history</h2>
              <TransactionLedger rows={ledgerRows.filter((r) => r.type === 'receipt' || r.type === 'refund')} filter={clientFilter} onFilterChange={setClientFilter} canEdit={canEdit} hideViews />
            </div>
          </div>
        )}
        {tab === 'summary' && <FinancialSummary project={project} summary={s} today={today} budgetRevisions={revisions.data?.length ?? 0} onInspect={inspect} />}
        {tab === 'activity' &&
          (!activity.data ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : activity.data.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No changes recorded yet. Edits, voids, budget changes and archiving will appear here.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {activity.data.map((event) => (
                <li key={event.id} className="py-2 text-slate-700">
                  <span className="text-slate-500">{formatDateTime(event.at)}</span> · {event.byName} {event.action} a {event.entity}
                  {event.changes.length > 0 && `: ${event.changes.map((c) => `${c.field} ${c.from} → ${c.to}`).join(', ')}`}
                  {event.reason && ` — “${event.reason}”`}
                </li>
              ))}
            </ul>
          ))}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm === 'status'
            ? isCompleted
              ? 'Reopen this project?'
              : 'Mark as completed?'
            : confirm === 'archive'
              ? project.archived
                ? 'Restore this project?'
                : 'Archive this project?'
              : 'Delete this project?'
        }
        message={
          confirm === 'status'
            ? isCompleted
              ? 'The project will show again in your active projects.'
              : 'Work completed will be set to 100%. You can still add entries and reopen it later.'
            : confirm === 'archive'
              ? project.archived
                ? 'The project will show again in your project lists.'
                : 'The project will be hidden from your lists and the dashboard. All its money records are kept and still appear in reports.'
              : 'This project has no money records. It will be removed permanently.'
        }
        confirmLabel={confirm === 'delete' ? 'Yes, delete' : 'Yes, continue'}
        danger={confirm === 'delete'}
        busy={updateProject.isPending || setArchived.isPending || deleteProject.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runConfirmed()}
      />
    </div>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'good' | 'bad' }) {
  const border = tone === 'bad' ? 'border-l-red-500' : tone === 'good' ? 'border-l-blue-500' : 'border-l-slate-300';
  return (
    <div className={`rounded-md border-l-2 bg-slate-50 px-3 py-2 ${border}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-base font-semibold tabular-nums ${tone === 'bad' ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
      {note && <p className="truncate text-[11px] text-slate-500">{note}</p>}
    </div>
  );
}
