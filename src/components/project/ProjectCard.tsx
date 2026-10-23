import { Link } from 'react-router';
import { ChevronRight, MapPin, User } from 'lucide-react';
import type { ProjectWithSummary } from '../../api/hooks';
import { formatINR } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { HealthBar } from '../ui/HealthBar';
import { StatusBadge } from '../ui/StatusBadge';

export function ProjectCard({ project, summary }: ProjectWithSummary) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="group block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-800">{project.name}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <User className="size-3.5" aria-hidden /> {project.clientName}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden /> {project.location}
            </span>
          </p>
        </div>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={project.status} />
          {project.archived && <Badge tone="neutral">Archived</Badge>}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3">
        <div>
          <dt className="text-xs text-slate-600">Contract</dt>
          <dd className="text-sm font-semibold tabular-nums">{formatINR(project.contractValue)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-600">Received</dt>
          <dd className="text-sm font-semibold text-blue-800 tabular-nums">{formatINR(summary.received)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-600">Cost so far</dt>
          <dd className="text-sm font-semibold tabular-nums">{formatINR(summary.actualCost)}</dd>
        </div>
      </dl>

      {(summary.overdue > 0 || summary.netCash < 0) && (
        <p className="mt-2 flex flex-wrap gap-1">
          {summary.overdue > 0 && <Badge tone="red">{formatINR(summary.overdue)} overdue from client</Badge>}
          {summary.netCash < 0 && <Badge tone="amber">Cash {formatINR(summary.netCash)}</Badge>}
        </p>
      )}

      {project.status !== 'completed' && (
        <div className="mt-3">
          <HealthBar percent={summary.budgetUsedPercent} health={summary.health} />
        </div>
      )}

      <p className="mt-3 flex items-center gap-1 text-sm font-semibold text-blue-800">
        Open project <ChevronRight className="size-4" aria-hidden />
      </p>
    </Link>
  );
}
