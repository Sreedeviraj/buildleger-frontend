import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useAddPayment, useProjectsOverview, useUpdatePayment, type ProjectWithSummary } from '../api/hooks';
import { PageHeader } from '../components/layout/PageHeader';
import { Button, buttonClass } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormActions, FormGrid, FormMain, FormSide } from '../components/ui/FormLayout';
import { DuplicateDialog, newRequestId } from '../components/ui/DuplicateDialog';
import { AmountField, ChoiceGrid, DateField, SelectField, TextAreaField, TextField } from '../components/ui/Fields';
import { ErrorBlock, LoadingBlock } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { PAYMENT_KINDS, PAYMENT_MODES } from '../lib/constants';
import { errorMessage, isDuplicateError } from '../lib/errors';
import { formatDate, formatINR, todayISO } from '../lib/format';
import type { Payment, PaymentKind, PaymentMode } from '../types';

/** Record money received (/payments/new) or correct an entry (/payments/:id/edit). */
export default function PaymentFormPage() {
  const { id } = useParams();
  const overview = useProjectsOverview();
  if (overview.isLoading) return <LoadingBlock />;
  if (overview.error || !overview.data || !overview.finance) {
    return <ErrorBlock message={overview.error ? errorMessage(overview.error) : undefined} onRetry={overview.refetch} />;
  }
  const payment = id ? overview.finance.payments.find((p) => p.id === id) : undefined;
  if (id && !payment) return <ErrorBlock message="This payment was not found." />;
  if (payment?.voided) return <ErrorBlock message="This payment has been voided and cannot be edited." />;
  return <PaymentForm projects={overview.data} payment={payment} />;
}

type Errors = Partial<Record<'projectId' | 'amount' | 'date' | 'reason', string>>;

function PaymentForm({ projects, payment }: { projects: ProjectWithSummary[]; payment?: Payment }) {
  const [params] = useSearchParams();
  const fromProject = payment?.projectId ?? params.get('projectId');
  const navigate = useNavigate();
  const toast = useToast();
  const addPayment = useAddPayment();
  const updatePayment = useUpdatePayment();
  const saving = addPayment.isPending || updatePayment.isPending;

  const [requestId] = useState(newRequestId);
  const [projectId, setProjectId] = useState(fromProject ?? '');
  const [kind, setKind] = useState<PaymentKind>(payment?.kind ?? 'installment');
  const [amount, setAmount] = useState<number | null>(payment?.amount ?? null);
  const [date, setDate] = useState(payment?.date ?? todayISO());
  const [mode, setMode] = useState<PaymentMode>(payment?.mode ?? 'bank');
  const [reference, setReference] = useState(payment?.reference ?? '');
  const [note, setNote] = useState(payment?.note ?? '');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [duplicate, setDuplicate] = useState<string | null>(null);

  const backTo = fromProject ? `/projects/${fromProject}` : '/';
  const choices = projects.filter((d) => (d.project.status !== 'completed' && !d.project.archived) || d.project.id === projectId);
  const selected = projects.find((d) => d.project.id === projectId);
  const isRefund = kind === 'refund';
  // When editing, the old amount is already inside the summary, so take it out first.
  const previous = payment ? (payment.kind === 'refund' ? -payment.amount : payment.amount) : 0;
  const owesNow = selected ? selected.summary.contractValue - (selected.summary.received - previous) : 0;
  const owesAfter = selected && amount ? owesNow - (isRefund ? -amount : amount) : null;

  async function save(allowDuplicate = false) {
    const next: Errors = {};
    if (!projectId) next.projectId = 'Please choose a project.';
    if (!amount) next.amount = 'Please enter the amount.';
    if (!date) next.date = 'Please choose a date.';
    if (payment && !reason.trim()) next.reason = 'Please write why you are changing this entry.';
    setErrors(next);
    if (Object.keys(next).length > 0 || !amount) return;

    const input = { projectId, kind, amount, date, mode, reference, note, requestId, allowDuplicate };
    try {
      if (payment) await updatePayment.mutateAsync([payment.id, input, reason]);
      else await addPayment.mutateAsync(input);
      setDuplicate(null);
      toast(payment ? 'Payment updated' : `${isRefund ? 'Refund' : 'Payment'} of ${formatINR(amount)} saved`);
      navigate(`/projects/${projectId}`);
    } catch (err) {
      if (isDuplicateError(err)) setDuplicate(err.message);
      else toast(errorMessage(err), 'error');
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void save();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={payment ? 'Edit payment' : 'Money received'}
        subtitle={payment ? `Recorded on ${formatDate(payment.createdAt)} by ${payment.createdBy}. Changes are kept in the history.` : 'Payment you got from the client.'}
        back={{ to: backTo, label: 'Back' }}
      />
      <Card className="p-5 sm:p-7">
        <form onSubmit={handleSubmit} noValidate>
          <FormGrid>
            <FormMain>
              <SelectField
                label="Project"
                placeholder="Choose a project"
                value={projectId}
                onChange={setProjectId}
                disabled={Boolean(payment)}
                options={choices.map((d) => ({ value: d.project.id, label: `${d.project.name} — ${d.project.clientName}` }))}
                error={errors.projectId}
              />

              {selected && (
                <p className="-mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {selected.project.clientName} owes <strong className="tabular-nums">{formatINR(Math.max(owesNow, 0))}</strong>
                  {selected.summary.overdue > 0 && (
                    <>
                      , of which <strong className="text-red-700">{formatINR(selected.summary.overdue)} is overdue</strong>
                    </>
                  )}
                  .
                </p>
              )}

              <ChoiceGrid label="Type of payment" options={PAYMENT_KINDS} value={kind} onChange={setKind} columns="grid-cols-2" />

              <AmountField
                label={isRefund ? 'How much did you refund?' : 'How much did you receive?'}
                value={amount}
                onChange={setAmount}
                error={errors.amount}
                autoFocus={Boolean(fromProject) && !payment}
                hint={
                  owesAfter === null ? undefined : owesAfter > 0 ? (
                    `After this, the client will still owe ${formatINR(owesAfter)}.`
                  ) : owesAfter === 0 ? (
                    <span className="font-semibold text-blue-800">After this, the client has paid in full.</span>
                  ) : (
                    <span className="font-semibold text-amber-800">
                      This is {formatINR(-owesAfter)} more than the contract value. Please check the amount.
                    </span>
                  )
                }
              />

              <ChoiceGrid label={isRefund ? 'How was it refunded?' : 'How was it paid?'} options={PAYMENT_MODES} value={mode} onChange={setMode} />

            </FormMain>
            <FormSide>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-1">
                <DateField label={isRefund ? 'Date refunded' : 'Date received'} value={date} onChange={setDate} max={todayISO()} error={errors.date} />
                <TextField label="Reference number" placeholder="e.g. UTR / cheque no." value={reference} onChange={setReference} optional />
              </div>

              <TextAreaField label="Note" placeholder="e.g. Second floor slab payment" value={note} onChange={setNote} />

              {payment && (
                <div>
                  <TextAreaField optional={false} label="Reason for change" placeholder="e.g. Amount was typed wrong" value={reason} onChange={setReason} />
                  {errors.reason && <p className="mt-1.5 text-sm font-medium text-red-700">{errors.reason}</p>}
                </div>
              )}

            </FormSide>
          </FormGrid>

          <FormActions>
            <Link to={backTo} className={buttonClass('secondary', 'lg')}>
              Cancel
            </Link>
            <Button type="submit" variant={isRefund ? 'danger' : 'success'} size="lg" disabled={saving} className="sm:min-w-56">
              {saving ? 'Saving…' : payment ? 'Save changes' : isRefund ? 'Save refund' : 'Save payment'}
            </Button>
          </FormActions>
        </form>
      </Card>

      <DuplicateDialog message={duplicate} busy={saving} onCancel={() => setDuplicate(null)} onSaveAnyway={() => void save(true)} />
    </div>
  );
}
