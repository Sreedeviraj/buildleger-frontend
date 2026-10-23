import { useState } from 'react';
import { Link } from 'react-router';
import { FolderPlus, Search, SearchX } from 'lucide-react';
import { useProjectsOverview } from '../api/hooks';
import { PageHeader } from '../components/layout/PageHeader';
import { ProjectCard } from '../components/project/ProjectCard';
import { buttonClass } from '../components/ui/Button';
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/ui/States';
import { errorMessage } from '../lib/errors';

type Filter = 'active' | 'completed' | 'archived' | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
];

export default function ProjectsPage() {
  const { data, isLoading, error, refetch } = useProjectsOverview();
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');

  const newProjectButton = (
    <Link to="/projects/new" className={buttonClass('primary', 'md')}>
      <FolderPlus className="size-4" aria-hidden /> New project
    </Link>
  );

  if (isLoading) return <LoadingBlock />;
  if (error || !data) return <ErrorBlock message={error ? errorMessage(error) : undefined} onRetry={refetch} />;

  // Active = ongoing or on hold. Archived projects only show under Archived and All.
  const matches = (f: Filter, project: (typeof data)[number]['project']) =>
    f === 'all' ||
    (f === 'archived' ? project.archived : !project.archived && (f === 'completed') === (project.status === 'completed'));
  const countOf = (f: Filter) => data.filter((d) => matches(f, d.project)).length;

  const term = search.trim().toLowerCase();
  const visible = data.filter(({ project }) => {
    const matchesFilter = matches(filter, project);
    const matchesSearch =
      !term || [project.name, project.clientName, project.location].some((v) => v.toLowerCase().includes(term));
    return matchesFilter && matchesSearch;
  });

  return (
    <>
      <PageHeader title="Projects" subtitle="Tap a project to see its money details." actions={newProjectButton} />

      {data.length === 0 ? (
        <EmptyState
          icon={FolderPlus}
          title="No projects yet"
          text="Add your first project with the contract amount agreed with your client."
          action={newProjectButton}
        />
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by project, client or place"
                aria-label="Search projects"
                className="block min-h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />
            </div>
            <div className="flex gap-1 rounded-lg bg-slate-200/70 p-1" role="group" aria-label="Show projects">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                    filter === f.value ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {f.label} <span className="font-normal text-slate-500">({countOf(f.value)})</span>
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState icon={SearchX} title="No projects found" text="Try a different word, or choose another filter above." />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {visible.map((item) => (
                <ProjectCard key={item.project.id} {...item} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
