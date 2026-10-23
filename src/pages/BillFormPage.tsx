import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useAddBill, useProjectsOverview, useUpdateBill, type FinanceData, type ProjectWithSummary } from '../api/hooks';
import { PageHeader } from '../components/layout/PageHeader';
import { SupplierPicker } from '../components/project/SupplierPicker';
import { Button, buttonClass } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormActions, FormGrid, FormMain, FormSide } from '../components/ui/FormLayout';
import { newRequestId } from '../components/ui/DuplicateDialog';
import { AmountField, AttachmentField, ChoiceGrid, DateField, SelectField, TextAreaField, TextField } from '../components/ui/Fields';
import { ErrorBlock, LoadingBlock } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { billPayments } from '../lib/calc';
import { categoryLabel, EXPENSE_CATEGORIES } from '../lib/constants';
import { errorMessage } from '../lib/errors';
import { formatDate, formatINR, todayISO } from '../lib/format';
import type { Attachment, Bill, ExpenseCategory } from '../types';

/** Record a supplier/subcontractor bill (/bills/new) or correct one (/bills/:id/edit). */
export default function BillFormPage() {
  const { id } = useParams();
  const overview = useProjectsOverview();
  if (overview.isLoading) return <LoadingBlock />;
  if (overview.error || !overview.data || !overview.finance) {
    return <ErrorBlock message={overview.error ? errorMessage(overview.error) : undefined} onRetry={overview.refetch} />;
  }
  const bill = id ? overview.finance.bills.find((b) => b.id === id) : undefined;
  if (id && !bill) return <ErrorBlock message="This bill was not found." />;
  if (bill?.voided) return <ErrorBlock message="This bill has been voided and cannot be edited." />;
  return <BillForm projects={overview.data} finance={overview.finance} bill={bill} />;
}

type Errors = Partial<Record<'projectId' | 'supplierId' | 'amount' | 'category' | 'billDate' | 'dueDate' | 'reason', string>>;

function BillForm({ projects, finance, bill }: { projects: ProjectWithSummary[]; finance: FinanceData; bill?: Bill }) {
  const [params] = useSearchParams();
  const fromProject = bill?.projectId ?? params.get('projectId');
  const navigate = useNavigate();
  const toast = useToast();
  const addBill = useAddBill();
  const updateBill = useUpdateBill();
  const saving = addBill.isPending || updateBill.isPending;
  const alreadyPaid = bill ? (billPayments([bill], finance.expenses).get(bill.id) ?? 0) : 0;

  const [requestId] = useState(newRequestId);
  const [projectId, setProjectId] = useState(fromProject ?? '');
  const [supplierId, setSupplierId] = useState(bill?.supplierId ?? params.get('supplierId') ?? '');
  const [category, setCategory] = useState<ExpenseCategory | null>(bill?.category ?? null);
  const [billNumber, setBillNumber] = useState(bill?.billNumber ?? '');
  const [billDate, setBillDate] = useState(bill?.billDate ?? todayISO());
  const [dueDate, setDueDate] = useState(bill?.dueDate ?? '');
  const [amount, setAmount] = useState<number | null>(bill?.amount ?? null);
  const [note, setNote] = useState(bill?.note ?? '');
  const [attachments, setAttachments] = useState<Attachment[]>(bill?.attachments ?? []);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const backTo = fromProject ? `/projects/${fromProject}` : '/suppliers';
  const choices = projects.filter((d) => (d.project.status !== 'completed' && !d.project.archived) || d.project.id === projectId);
  const selected = projects.find((d) => d.project.id === projectId);
  const previousCost = bill ? Math.max(bill.amount, alreadyPaid) : 0;
  const budgetAfter = selected && amount ? selected.summary.remainingBudget + previousCost - amount : null;
  const categoryLine = selected?.summary.categories.find((c) => c.category === category);
  const categoryAfter =
    categoryLine && categoryLine.remaining !== null && amount ? categoryLine.remaining + (bill?.category === category ? previousCost : 0) - amount : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!projectId) next.projectId = 'Please choose a project.';
    if (!supplierId) next.supplierId = 'Please choose the supplier.';
    if (!amount) next.amount = 'Please enter the bill amount.';
    else if (amount < alreadyPaid) next.amount = `${formatINR(alreadyPaid)} is already paid against this bill.`;
    if (!category) next.category = 'Please choose what the bill is for.';
    if (!billDate) next.billDate = 'Please choose the bill date.';
    if (dueDate && billDate && dueDate < billDate) next.dueDate = 'The due date must be on or after the bill date.';
    if (bill && !reason.trim()) next.reason = 'Please write why you are changing this bill.';
    setErrors(next);
    if (Object.keys(next).length > 0 || !amount || !category) return;

    const input = { projectId, supplierId, category, billNumber, billDate, dueDate, amount, note, attachments, requestId };
    try {
      if (bill) await updateBill.mutateAsync([bill.id, input, reason]);
      else await addBill.mutateAsync(input);
      toast(bill ? 'Bill updated' : `Bill of ${formatINR(amount)} saved`);
      navigate(`/projects/${projectId}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={bill ? 'Edit supplier bill' : 'Supplier bill'}
        subtitle={
          bill
            ? `Recorded on ${formatDate(bill.createdAt)} by ${bill.createdBy}. ${alreadyPaid > 0 ? `${formatINR(alreadyPaid)} already paid.` : ''}`
            : 'A bill you have to pay: material on credit, subcontractor invoice, wage sheet…'
        }
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
                disabled={Boolean(bill)}
                options={choices.map((d) => ({ value: d.project.id, label: d.project.name }))}
                error={errors.projectId}
              />

              <SupplierPicker
                label="Supplier"
                suppliers={finance.suppliers}
                value={supplierId}
                onChange={setSupplierId}
                disabled={alreadyPaid > 0}
                error={errors.supplierId}
              />

              <AmountField
                label="Bill amount"
                value={amount}
                onChange={setAmount}
                error={errors.amount}
                hint={
                  budgetAfter === null ? (
                    'The cost counts against the budget now; you pay it later with “Pay this bill”.'
                  ) : (
                    <span className={budgetAfter < 0 || (categoryAfter ?? 0) < 0 ? 'font-semibold text-red-700' : 'text-blue-800'}>
                      {budgetAfter < 0 ? `After this, the project will be ${formatINR(-budgetAfter)} over budget.` : `After this, ${formatINR(budgetAfter)} of the budget will be left.`}
                      {categoryAfter !== null && category && ` ${categoryLabel(category)}: ${categoryAfter < 0 ? `${formatINR(-categoryAfter)} over its budget` : `${formatINR(categoryAfter)} left`}.`}
                    </span>
                  )
                }
              />

              <ChoiceGrid label="What is the bill for?" options={EXPENSE_CATEGORIES} value={category} onChange={setCategory} error={errors.category} />

            </FormMain>
            <FormSide>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 lg:grid-cols-1">
                <TextField label="Bill number" placeholder="e.g. KCS/7781" value={billNumber} onChange={setBillNumber} optional />
                <DateField label="Bill date" value={billDate} onChange={setBillDate} max={todayISO()} error={errors.billDate} />
                <DateField label="Pay by" value={dueDate} min={billDate} onChange={setDueDate} error={errors.dueDate} optional />
              </div>

              <TextAreaField label="Note" placeholder="e.g. Roof slab steel – 2 tonnes" value={note} onChange={setNote} />

              <AttachmentField label="Bill copy" value={attachments} onChange={setAttachments} />

              {bill && (
                <div>
                  <TextAreaField optional={false} label="Reason for change" placeholder="e.g. Supplier corrected the bill" value={reason} onChange={setReason} />
                  {errors.reason && <p className="mt-1.5 text-sm font-medium text-red-700">{errors.reason}</p>}
                </div>
              )}

            </FormSide>
          </FormGrid>

          <FormActions>
            <Link to={backTo} className={buttonClass('secondary', 'lg')}>
              Cancel
            </Link>
            <Button type="submit" size="lg" disabled={saving} className="sm:min-w-56">
              {saving ? 'Saving…' : bill ? 'Save changes' : 'Save bill'}
            </Button>
          </FormActions>
        </form>
      </Card>
    </div>
  );
}
