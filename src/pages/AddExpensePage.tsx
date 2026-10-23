import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useAddExpense, useProjectsOverview, useUpdateExpense, type FinanceData, type ProjectWithSummary } from '../api/hooks';
import { PageHeader } from '../components/layout/PageHeader';
import { SupplierPicker } from '../components/project/SupplierPicker';
import { Button, buttonClass } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormActions, FormGrid, FormMain, FormSide } from '../components/ui/FormLayout';
import { DuplicateDialog, newRequestId } from '../components/ui/DuplicateDialog';
import { AmountField, AttachmentField, ChoiceGrid, DateField, SelectField, TextAreaField, TextField } from '../components/ui/Fields';
import { ErrorBlock, LoadingBlock } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { billOutstanding, billPayments } from '../lib/calc';
import { categoryLabel, EXPENSE_CATEGORIES, PAYMENT_MODES } from '../lib/constants';
import { errorMessage, isDuplicateError } from '../lib/errors';
import { formatDate, formatINR, todayISO } from '../lib/format';
import type { Attachment, Expense, ExpenseCategory, PaymentMode } from '../types';

/** Record money paid out (/expenses/new) or correct an entry (/expenses/:id/edit). */
export default function ExpenseFormPage() {
  const { id } = useParams();
  const overview = useProjectsOverview();
  if (overview.isLoading) return <LoadingBlock />;
  if (overview.error || !overview.data || !overview.finance) {
    return <ErrorBlock message={overview.error ? errorMessage(overview.error) : undefined} onRetry={overview.refetch} />;
  }
  const expense = id ? overview.finance.expenses.find((e) => e.id === id) : undefined;
  if (id && !expense) return <ErrorBlock message="This expense was not found." />;
  if (expense?.voided) return <ErrorBlock message="This expense has been voided and cannot be edited." />;
  return <ExpenseForm projects={overview.data} finance={overview.finance} expense={expense} />;
}

type Errors = Partial<Record<'projectId' | 'amount' | 'category' | 'date' | 'reason', string>>;

function ExpenseForm({ projects, finance, expense }: { projects: ProjectWithSummary[]; finance: FinanceData; expense?: Expense }) {
  const [params] = useSearchParams();
  const fromProject = expense?.projectId ?? params.get('projectId');
  const fromBill = expense ? expense.billId : params.get('billId');
  const navigate = useNavigate();
  const toast = useToast();
  const addExpense = useAddExpense();
  const updateExpense = useUpdateExpense();
  const saving = addExpense.isPending || updateExpense.isPending;

  // Unpaid amount of every bill, not counting this expense when it is being edited.
  const dueByBill = useMemo(() => {
    const others = finance.expenses.filter((e) => e.id !== expense?.id);
    const paid = billPayments(finance.bills, others);
    return new Map(finance.bills.map((b) => [b.id, billOutstanding(b, paid)]));
  }, [finance, expense?.id]);
  const initialBill = finance.bills.find((b) => b.id === fromBill);

  const [requestId] = useState(newRequestId);
  const [projectId, setProjectId] = useState(fromProject ?? initialBill?.projectId ?? '');
  const [billId, setBillId] = useState(initialBill?.id ?? '');
  const [supplierId, setSupplierId] = useState(expense?.supplierId ?? initialBill?.supplierId ?? '');
  const [amount, setAmount] = useState<number | null>(expense?.amount ?? (initialBill ? dueByBill.get(initialBill.id) || null : null));
  const [category, setCategory] = useState<ExpenseCategory | null>(expense?.category ?? initialBill?.category ?? null);
  const [date, setDate] = useState(expense?.date ?? todayISO());
  const [paidTo, setPaidTo] = useState(expense && !expense.supplierId ? expense.paidTo : '');
  const [mode, setMode] = useState<PaymentMode>(expense?.mode ?? 'cash');
  const [invoiceRef, setInvoiceRef] = useState(expense?.invoiceRef ?? '');
  const [note, setNote] = useState(expense?.note ?? '');
  const [attachments, setAttachments] = useState<Attachment[]>(expense?.attachments ?? []);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [duplicate, setDuplicate] = useState<string | null>(null);

  const backTo = fromProject ? `/projects/${fromProject}` : '/';
  const choices = projects.filter((d) => (d.project.status !== 'completed' && !d.project.archived) || d.project.id === projectId);
  const selected = projects.find((d) => d.project.id === projectId);
  const bill = finance.bills.find((b) => b.id === billId);
  const billDue = bill ? (dueByBill.get(bill.id) ?? 0) : 0;
  const openBills = finance.bills.filter(
    (b) => b.projectId === projectId && !b.voided && (b.id === billId || (dueByBill.get(b.id) ?? 0) > 0) && (!supplierId || b.supplierId === supplierId),
  );
  const supplierName = (id: string) => finance.suppliers.find((s) => s.id === id)?.name ?? '';

  // Budget effect. Paying a bill does not add cost: the bill already counted it.
  const previousCost = expense && !expense.billId ? expense.amount : 0;
  const categoryLine = selected?.summary.categories.find((c) => c.category === category);
  const budgetAfter = selected && amount && !bill ? selected.summary.remainingBudget + previousCost - amount : null;
  const categoryAfter =
    categoryLine && categoryLine.remaining !== null && amount && !bill ? categoryLine.remaining + (expense?.category === category ? previousCost : 0) - amount : null;

  function chooseBill(id: string) {
    setBillId(id);
    const chosen = finance.bills.find((b) => b.id === id);
    if (chosen) {
      setSupplierId(chosen.supplierId);
      setCategory(chosen.category);
      setAmount(dueByBill.get(chosen.id) || null);
    }
  }

  async function save(allowDuplicate = false) {
    const next: Errors = {};
    if (!projectId) next.projectId = 'Please choose a project.';
    if (!amount) next.amount = 'Please enter the amount you paid.';
    else if (bill && amount > billDue) next.amount = `Only ${formatINR(billDue)} is unpaid on this bill.`;
    if (!category) next.category = 'Please choose what this expense is for.';
    if (!date) next.date = 'Please choose a date.';
    if (expense && !reason.trim()) next.reason = 'Please write why you are changing this entry.';
    setErrors(next);
    if (Object.keys(next).length > 0 || !amount || !category) return;

    const input = {
      projectId,
      amount,
      category,
      date,
      supplierId: supplierId || null,
      billId: billId || null,
      paidTo: supplierId ? supplierName(supplierId) : paidTo,
      mode,
      invoiceRef,
      note,
      attachments,
      requestId,
      allowDuplicate,
    };
    try {
      if (expense) await updateExpense.mutateAsync([expense.id, input, reason]);
      else await addExpense.mutateAsync(input);
      setDuplicate(null);
      toast(expense ? 'Expense updated' : `Expense of ${formatINR(amount)} saved`);
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
        title={expense ? 'Edit expense' : bill ? 'Pay a supplier bill' : 'Add expense'}
        subtitle={expense ? `Recorded on ${formatDate(expense.createdAt)} by ${expense.createdBy}. Changes are kept in the history.` : 'Money you paid for this project.'}
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
                onChange={(v) => {
                  setProjectId(v);
                  setBillId('');
                }}
                disabled={Boolean(expense)}
                options={choices.map((d) => ({ value: d.project.id, label: d.project.name }))}
                error={errors.projectId}
              />

              <SupplierPicker
                label="Paid to"
                suppliers={finance.suppliers}
                value={supplierId}
                onChange={(v) => {
                  setSupplierId(v);
                  if (bill && bill.supplierId !== v) setBillId('');
                }}
                disabled={Boolean(bill)}
                optional
                placeholder="Not in the supplier list"
              />
              {!supplierId && <TextField label="Payee name" placeholder="e.g. Panchayat office" value={paidTo} onChange={setPaidTo} optional />}

              {projectId && (openBills.length > 0 || bill) && (
                <SelectField
                  label="Is this payment for a bill?"
                  placeholder="No — a direct expense"
                  value={billId}
                  onChange={chooseBill}
                  optional
                  options={openBills.map((b) => ({
                    value: b.id,
                    label: `${supplierName(b.supplierId)} · ${b.billNumber || formatDate(b.billDate)} · ${formatINR(dueByBill.get(b.id) ?? 0)} unpaid`,
                  }))}
                  hint={
                    bill
                      ? `This payment settles part or all of the bill. The cost was already counted when the bill was added, so the budget does not change. ${formatINR(billDue)} is unpaid.`
                      : 'Link the payment to a supplier bill so it is not counted twice.'
                  }
                />
              )}

              <AmountField
                label="How much did you pay?"
                value={amount}
                onChange={setAmount}
                error={errors.amount}
                autoFocus={Boolean(fromProject) && !expense && !bill}
                hint={
                  budgetAfter === null ? undefined : (
                    <span className={budgetAfter < 0 || (categoryAfter ?? 0) < 0 ? 'font-semibold text-red-700' : 'text-blue-800'}>
                      {budgetAfter < 0 ? `After this, the project will be ${formatINR(-budgetAfter)} over budget.` : `After this, ${formatINR(budgetAfter)} of the budget will be left.`}
                      {categoryAfter !== null && category && (
                        <>
                          {' '}
                          {categoryAfter < 0
                            ? `${categoryLabel(category)} will be ${formatINR(-categoryAfter)} over its budget.`
                            : `${categoryLabel(category)}: ${formatINR(categoryAfter)} left.`}
                        </>
                      )}
                    </span>
                  )
                }
              />

              {bill ? (
                <p className="text-sm text-slate-700">
                  Category: <strong>{categoryLabel(bill.category)}</strong> (from the bill)
                </p>
              ) : (
                <ChoiceGrid label="What is it for?" options={EXPENSE_CATEGORIES} value={category} onChange={setCategory} error={errors.category} />
              )}

              <ChoiceGrid label="How did you pay?" options={PAYMENT_MODES} value={mode} onChange={setMode} />

            </FormMain>
            <FormSide>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-1">
                <DateField label="Date paid" value={date} onChange={setDate} max={todayISO()} error={errors.date} />
                <TextField label="Invoice / receipt no." placeholder="e.g. INV-2041" value={invoiceRef} onChange={setInvoiceRef} optional />
              </div>

              <TextAreaField label="Note" placeholder="e.g. 200 bags of cement" value={note} onChange={setNote} />

              <AttachmentField label="Receipt or invoice" value={attachments} onChange={setAttachments} />

              {expense && (
                <div>
                  <TextAreaField optional={false} label="Reason for change" placeholder="e.g. Wrong category chosen" value={reason} onChange={setReason} />
                  {errors.reason && <p className="mt-1.5 text-sm font-medium text-red-700">{errors.reason}</p>}
                </div>
              )}

            </FormSide>
          </FormGrid>

          <FormActions>
            <Link to={backTo} className={buttonClass('secondary', 'lg')}>
              Cancel
            </Link>
            <Button type="submit" variant="expense" size="lg" disabled={saving} className="sm:min-w-56">
              {saving ? 'Saving…' : expense ? 'Save changes' : 'Save expense'}
            </Button>
          </FormActions>
        </form>
      </Card>

      <DuplicateDialog message={duplicate} busy={saving} onCancel={() => setDuplicate(null)} onSaveAnyway={() => void save(true)} />
    </div>
  );
}
