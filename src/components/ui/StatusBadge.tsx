import { PROJECT_STATUS_LABEL } from '../../lib/constants';
import type { ProjectStatus } from '../../types';

const STYLES: Record<ProjectStatus, string> = {
  ongoing: 'bg-blue-50 text-blue-800 ring-blue-200',
  on_hold: 'bg-amber-50 text-amber-800 ring-amber-200',
  completed: 'bg-slate-100 text-slate-700 ring-slate-300',
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STYLES[status]}`}>
      {PROJECT_STATUS_LABEL[status]}
    </span>
  );
}
