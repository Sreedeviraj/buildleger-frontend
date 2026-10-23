import { useState, type FormEvent } from 'react';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { useAddInstallment, useDeleteInstallment } from '../../api/hooks';
import { sum, type ProjectSummary } from '../../lib/calc';
import { errorMessage } from '../../lib/errors';
import { formatDate, formatINR, todayISO } from '../../lib/format';
import type { Installment, Project } from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { AmountField, DateField, TextField } from '../ui/Fields';
import { useToast } from '../ui/Toast';

type Status = 'paid' | 'part' | 'overdue' | 'due';

/** Payments received cover scheduled installments in due-date order. */
function withStatus(installments: Installment[], received: number, today: string) {
  let left = received;
  return [...installments]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((i) => {
      const covered = Math.min(Math.max(left, 0), i.amount);
      left -= i.amount;
      const status: Status = covered >= i.amount ? 'paid' : i.dueDate < today ? 'overdue' : covered > 0 ? 'part' : 'due';
      return { ...i, covered, status };
    });
}

const STATUS: Record<Status, { label: string; tone: Parameters<typeof Badge>[0]['tone'] }> = {
  paid: { label: 'Paid', tone: 'green' },
  part: { label: 'Part paid', tone: 'amber' },
  overdue: { label: 'Overdue', tone: 'red' },
  due: { label: 'Upcoming', tone: 'neutral' },
};

interface PaymentScheduleProps {
  project: Project;
  installments: Installment[];
  summary: ProjectSummary;
  today: string;
  canEdit: boolean;
}

/** Client payment schedule (milestones) with paid / overdue status. */
export function PaymentSchedule({ project, installments, summary, today, canEdit }: PaymentScheduleProps) {
  const toast = useToast();
  const addInstallment = useAddInstallment();
  const deleteInstallment = useDeleteInstallment();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState(todayISO());
  const [toDelete, setToDelete] = useState<Installment | null>(null);

  const rows = withStatus(installments, summary.received, today);
  const scheduled = sum(installments.map((i) => i.amount));
  const unscheduled = project.contractValue - scheduled;

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!label.trim() || !amount || !dueDate) {
      toast('Please fill in what it is for, the amount and the due date.', 'error');
      return;
    }
    try {
      await addInstallment.mutateAsync({ projectId: project.id, label, amount, dueDate });
      setLabel('');
      setAmount(null);
      setAdding(false);
      toast('Scheduled payment added');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Client payment schedule</h2>
        {canEdit && !adding && (
          <Button variant="secondary" className="min-h-9" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        )}
      </div>

      {summary.overdue > 0 && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {formatINR(summary.overdue)} is overdue from {project.clientName}.
        </p>
      )}

      {rows.length === 0 && !adding ? (
        <div className="flex flex-col items-center rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
          <CalendarClock className="size-6 text-slate-400" aria-hidden />
          <p className="mt-2">No payment schedule yet. Add the agreed stages (advance, slab, handover…) to track overdue payments.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{row.label}</p>
                <p className="text-slate-600">
                  Due {formatDate(row.dueDate)}
                  {row.status === 'part' || (row.status === 'overdue' && row.covered > 0) ? ` · ${formatINR(row.covered)} received` : ''}
                </p>
              </div>
              <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge>
              <span className="w-28 text-right font-semibold tabular-nums">{formatINR(row.amount)}</span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setToDelete(row)}
                  aria-label={`Remove ${row.label}`}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {rows.length > 0 && unscheduled !== 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {unscheduled > 0
            ? `${formatINR(unscheduled)} of the contract value is not in the schedule yet.`
            : `The schedule adds up to ${formatINR(-unscheduled)} more than the contract value.`}
        </p>
      )}

      {adding && (
        <form onSubmit={handleAdd} className="mt-3 space-y-3 rounded-lg border border-slate-200 p-3" noValidate>
          <TextField label="What is it for?" placeholder="e.g. Roof slab" value={label} onChange={setLabel} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AmountField label="Amount" value={amount} onChange={setAmount} />
            <DateField label="Due date" value={dueDate} onChange={setDueDate} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addInstallment.isPending}>
              {addInstallment.isPending ? 'Saving…' : 'Add to schedule'}
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Remove this scheduled payment?"
        message={toDelete ? `${toDelete.label} of ${formatINR(toDelete.amount)} will be removed from the schedule. Payments already received are not affected.` : ''}
        confirmLabel="Yes, remove"
        danger
        busy={deleteInstallment.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteInstallment.mutateAsync(toDelete.id);
            toast('Scheduled payment removed');
          } catch (err) {
            toast(errorMessage(err), 'error');
          } finally {
            setToDelete(null);
          }
        }}
      />
    </div>
  );
}
