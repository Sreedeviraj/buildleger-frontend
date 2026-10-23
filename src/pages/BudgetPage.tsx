import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { History } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useBudgetRevisions, useProjectsOverview, useReviseBudget } from '../api/hooks';
import { PageHeader } from '../components/layout/PageHeader';
import { Button, buttonClass } from '../components/ui/Button';
import { Card, CardTitle } from '../components/ui/Card';
import { AmountField, TextAreaField } from '../components/ui/Fields';
import { ErrorBlock, LoadingBlock } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { sum } from '../lib/calc';
import { categoryLabel, EXPENSE_CATEGORIES } from '../lib/constants';
import { errorMessage } from '../lib/errors';
import { formatDateTime, formatINR } from '../lib/format';
import type { CategoryBudgets, ExpenseCategory } from '../types';

export default function BudgetPage() {
  const { id = '' } = useParams();
  const overview = useProjectsOverview();
  if (overview.isLoading) return <LoadingBlock />;
  const item = overview.data?.find((d) => d.project.id === id);
  if (overview.error || !item) {
    return <ErrorBlock message={overview.error ? errorMessage(overview.error) : 'This project was not found.'} onRetry={overview.refetch} />;
  }
  return <BudgetForm key={item.project.updatedAt} {...item} />;
}

function BudgetForm({ project, summary }: NonNullable<ReturnType<typeof useProjectsOverview>['data']>[number]) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const revise = useReviseBudget();
  const revisions = useBudgetRevisions(project.id);
  const [estimatedCost, setEstimatedCost] = useState<number | null>(project.estimatedCost);
  const [budgets, setBudgets] = useState<CategoryBudgets>(project.categoryBudgets);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const actualBy = new Map(summary.categories.map((c) => [c.category, c.actual]));
  const allocated = sum(Object.values(budgets).map((v) => v ?? 0));
  const unallocated = (estimatedCost ?? 0) - allocated;

  if (session?.user.role !== 'owner') {
    return <ErrorBlock message="Only the owner can change the budget." />;
  }

  const setCategory = (category: ExpenseCategory, raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 12);
    setBudgets((b) => ({ ...b, [category]: digits ? Number(digits) : undefined }));
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!estimatedCost) return setError('Please enter the estimated cost.');
    if (!reason.trim()) return setError('Please write why the budget is changing.');
    setError('');
    try {
      await revise.mutateAsync([project.id, { estimatedCost, categoryBudgets: budgets, reason }]);
      toast('Budget updated');
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Budget" subtitle={project.name} back={{ to: `/projects/${project.id}`, label: 'Back to project' }} />

      <Card className="p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <AmountField
            label="Estimated project cost (total budget)"
            value={estimatedCost}
            onChange={setEstimatedCost}
            hint={`Cost incurred so far: ${formatINR(summary.actualCost)}.`}
          />

          <div>
            <p className="text-sm font-semibold text-slate-800">Split by category (optional)</p>
            <p className="text-sm text-slate-600">Leave a category empty if you don’t want a separate budget for it.</p>
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600 uppercase">
                  <tr>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Budget (₹)</th>
                    <th className="px-3 py-2 text-right">Actual so far</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {EXPENSE_CATEGORIES.map(({ value, label }) => {
                    const actual = actualBy.get(value) ?? 0;
                    const budget = budgets[value];
                    const over = budget !== undefined && actual > budget;
                    return (
                      <tr key={value}>
                        <td className="px-3 py-1.5 font-medium text-slate-800">{label}</td>
                        <td className="px-3 py-1.5">
                          <input
                            inputMode="numeric"
                            aria-label={`${label} budget`}
                            value={budget === undefined ? '' : budget.toLocaleString('en-IN')}
                            onChange={(e) => setCategory(value, e.target.value)}
                            placeholder="—"
                            className={`block min-h-9 w-full min-w-28 rounded-md border px-2 tabular-nums focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none ${over ? 'border-red-400' : 'border-slate-300'}`}
                          />
                        </td>
                        <td className={`px-3 py-1.5 text-right tabular-nums ${over ? 'font-semibold text-red-700' : 'text-slate-700'}`}>{formatINR(actual)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 text-sm">
                  <tr>
                    <td className="px-3 py-2 font-semibold">Assigned to categories</td>
                    <td className="px-3 py-2 font-semibold tabular-nums">{formatINR(allocated)}</td>
                    <td />
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-semibold">Not assigned</td>
                    <td className={`px-3 py-2 font-semibold tabular-nums ${unallocated < 0 ? 'text-red-700' : ''}`}>{formatINR(unallocated)}</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-500">{unallocated < 0 ? 'Categories add up to more than the total' : ''}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <TextAreaField optional={false} label="Reason for this change" placeholder="e.g. Steel price increase; client added a terrace" value={reason} onChange={setReason} />
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800" role="alert">{error}</p>}

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <Link to={`/projects/${project.id}`} className={buttonClass('secondary', 'lg')}>
              Cancel
            </Link>
            <Button type="submit" size="lg" disabled={revise.isPending} className="sm:min-w-56">
              {revise.isPending ? 'Saving…' : 'Save budget'}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-5 sm:p-6">
        <CardTitle>
          <span className="flex items-center gap-2">
            <History className="size-5 text-slate-500" aria-hidden /> Budget history
          </span>
        </CardTitle>
        {!revisions.data || revisions.data.length === 0 ? (
          <p className="text-sm text-slate-600">No changes yet. The original budget was {formatINR(project.estimatedCost)}.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {revisions.data.map((r) => {
              const changed = EXPENSE_CATEGORIES.filter(({ value }) => r.before.categoryBudgets[value] !== r.after.categoryBudgets[value]);
              return (
                <li key={r.id} className="py-3">
                  <p className="font-semibold text-slate-900">
                    {formatINR(r.before.estimatedCost)} → {formatINR(r.after.estimatedCost)}
                  </p>
                  <p className="text-slate-600">
                    {formatDateTime(r.at)} · {r.byName} · “{r.reason}”
                  </p>
                  {changed.length > 0 && (
                    <p className="mt-1 text-slate-600">
                      {changed
                        .map(({ value }) => {
                          const show = (v?: number) => (v === undefined ? '—' : formatINR(v));
                          return `${categoryLabel(value)} ${show(r.before.categoryBudgets[value])} → ${show(r.after.categoryBudgets[value])}`;
                        })
                        .join(' · ')}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
