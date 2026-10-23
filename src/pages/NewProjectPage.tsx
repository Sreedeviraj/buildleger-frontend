import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { SlidersHorizontal } from 'lucide-react';
import { useCreateProject, useProject, useUpdateProject } from '../api/hooks';
import { PageHeader } from '../components/layout/PageHeader';
import { Button, buttonClass } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormActions } from '../components/ui/FormLayout';
import { AmountField, DateField, SelectField, TextField } from '../components/ui/Fields';
import { ErrorBlock, LoadingBlock } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { PROJECT_STATUSES } from '../lib/constants';
import { errorMessage } from '../lib/errors';
import { formatINR, todayISO } from '../lib/format';
import type { Project, ProjectStatus } from '../types';

type Field =
  | 'name'
  | 'clientName'
  | 'clientPhone'
  | 'clientEmail'
  | 'location'
  | 'contractValue'
  | 'estimatedCost'
  | 'startDate'
  | 'expectedEndDate'
  | 'progress';
type Errors = Partial<Record<Field, string>>;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

/** Create a project (/projects/new) or edit one (/projects/:id/edit). */
export default function ProjectFormPage() {
  const { id } = useParams();
  const existing = useProject(id ?? '', Boolean(id));
  if (!id) return <ProjectForm />;
  if (existing.isLoading) return <LoadingBlock />;
  if (existing.error || !existing.data) {
    return <ErrorBlock message={existing.error ? errorMessage(existing.error) : undefined} onRetry={() => void existing.refetch()} />;
  }
  return <ProjectForm project={existing.data} />;
}

function ProjectForm({ project }: { project?: Project }) {
  const navigate = useNavigate();
  const toast = useToast();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const editing = Boolean(project);
  const saving = createProject.isPending || updateProject.isPending;

  const [name, setName] = useState(project?.name ?? '');
  const [location, setLocation] = useState(project?.location ?? '');
  const [startDate, setStartDate] = useState(project?.startDate ?? todayISO());
  const [expectedEndDate, setExpectedEndDate] = useState(project?.expectedEndDate ?? '');
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'ongoing');
  const [progress, setProgress] = useState(String(project?.progress ?? 0));
  const [clientName, setClientName] = useState(project?.clientName ?? '');
  const [clientPhone, setClientPhone] = useState(project?.clientPhone ?? '');
  const [clientEmail, setClientEmail] = useState(project?.clientEmail ?? '');
  const [clientAddress, setClientAddress] = useState(project?.clientAddress ?? '');
  const [contractValue, setContractValue] = useState<number | null>(project?.contractValue ?? null);
  const [estimatedCost, setEstimatedCost] = useState<number | null>(project?.estimatedCost ?? null);
  const [errors, setErrors] = useState<Errors>({});

  const profit = contractValue && estimatedCost ? contractValue - estimatedCost : null;
  const backTo = project ? `/projects/${project.id}` : '/projects';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    const phoneDigits = clientPhone.replace(/\D/g, '');
    const progressNumber = Number(progress);
    if (!name.trim()) next.name = 'Please enter a project name.';
    if (!clientName.trim()) next.clientName = 'Please enter the client name.';
    if (!location.trim()) next.location = 'Please enter the site address.';
    if (clientPhone.trim() && !(phoneDigits.length === 10 || (phoneDigits.length === 12 && phoneDigits.startsWith('91')))) {
      next.clientPhone = 'Please enter a 10-digit mobile number.';
    }
    if (clientEmail.trim() && !/^\S+@\S+\.\S+$/.test(clientEmail.trim())) next.clientEmail = 'Please enter a valid email.';
    if (!contractValue) next.contractValue = 'Please enter the contract amount.';
    if (!editing && !estimatedCost) next.estimatedCost = 'Please enter how much you expect to spend.';
    if (!startDate) next.startDate = 'Please choose a start date.';
    if (expectedEndDate && startDate && expectedEndDate < startDate) next.expectedEndDate = 'This must be after the start date.';
    if (!Number.isInteger(progressNumber) || progressNumber < 0 || progressNumber > 100) next.progress = 'Enter a whole number from 0 to 100.';
    setErrors(next);
    if (Object.keys(next).length > 0 || !contractValue || (!editing && !estimatedCost)) return;

    const details = {
      name: name.trim(),
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      clientEmail: clientEmail.trim(),
      clientAddress: clientAddress.trim(),
      location: location.trim(),
      contractValue,
      startDate,
      expectedEndDate,
    };
    try {
      if (project) {
        await updateProject.mutateAsync([project.id, { ...details, status, progress: progressNumber }]);
        toast('Project details saved');
        navigate(`/projects/${project.id}`);
      } else {
        const created = await createProject.mutateAsync({ ...details, estimatedCost: estimatedCost! });
        toast(`Project “${created.name}” created`);
        navigate(`/projects/${created.id}`);
      }
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={editing ? 'Edit project' : 'New project'}
        subtitle={editing ? 'Changes are recorded in the project’s activity log.' : 'You can change these details later.'}
        back={{ to: backTo, label: editing ? 'Back to project' : 'All projects' }}
      />
      <Card className="p-5 sm:p-7">
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-x-10">
            <div className="space-y-8">
              <Section title="1. Project">
                <TextField label="Project name" placeholder="e.g. Villa – Kakkanad" value={name} onChange={setName} error={errors.name} />
                <TextField label="Site address" placeholder="e.g. Plot 12, Kakkanad, Kochi" value={location} onChange={setLocation} error={errors.location} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DateField label="Start date" value={startDate} onChange={setStartDate} error={errors.startDate} />
                  <DateField
                    label="Expected completion"
                    value={expectedEndDate}
                    min={startDate}
                    onChange={setExpectedEndDate}
                    error={errors.expectedEndDate}
                    optional
                  />
                </div>
                {editing && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <SelectField
                      label="Status"
                      placeholder="Choose status"
                      value={status}
                      onChange={(v) => v && setStatus(v as ProjectStatus)}
                      options={PROJECT_STATUSES}
                    />
                    <TextField
                      label="Work completed (%)"
                      inputMode="numeric"
                      value={progress}
                      onChange={(v) => setProgress(v.replace(/\D/g, '').slice(0, 3))}
                      error={errors.progress}
                      hint="Used for the “work completed” profit view."
                    />
                  </div>
                )}
              </Section>

              <Section title="2. Client">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField label="Client name" value={clientName} onChange={setClientName} error={errors.clientName} />
                  <TextField
                    label="Client phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="10-digit mobile"
                    value={clientPhone}
                    onChange={setClientPhone}
                    error={errors.clientPhone}
                    optional
                    hint="Used to send statements on WhatsApp."
                  />
                  <TextField label="Client email" type="email" inputMode="email" value={clientEmail} onChange={setClientEmail} error={errors.clientEmail} optional />
                  <TextField label="Client address" value={clientAddress} onChange={setClientAddress} optional />
                </div>
              </Section>

            </div>
            <div className="lg:border-l lg:border-slate-100 lg:pl-10">
              <Section title="3. Money">
                <AmountField
                  label="Contract amount"
                  value={contractValue}
                  onChange={setContractValue}
                  error={errors.contractValue}
                  hint="Total amount the client agreed to pay you."
                />
                {project ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    Estimated cost: <strong className="tabular-nums">{formatINR(project.estimatedCost)}</strong>. Budget changes keep a history, so they are made on the budget page.
                    <Link to={`/projects/${project.id}/budget`} className="mt-2 flex items-center gap-1.5 font-semibold text-blue-800 hover:underline">
                      <SlidersHorizontal className="size-4" aria-hidden /> Revise budget
                    </Link>
                  </div>
                ) : (
                  <AmountField
                    label="Estimated cost"
                    value={estimatedCost}
                    onChange={setEstimatedCost}
                    error={errors.estimatedCost}
                    hint="How much you expect to spend to finish the work. You can split it by category later."
                  />
                )}
                {profit !== null && (
                  <p className={`rounded-xl px-4 py-3 text-base font-medium ${profit >= 0 ? 'bg-blue-50 text-blue-900' : 'bg-red-50 text-red-800'}`}>
                    {profit >= 0
                      ? `Expected profit: ${formatINR(profit)} (${Math.round((profit / (contractValue ?? 1)) * 100)}%)`
                      : `Warning: the cost is ${formatINR(-profit)} more than the contract amount.`}
                  </p>
                )}
              </Section>

            </div>
          </div>

          <FormActions>
            <Link to={backTo} className={buttonClass('secondary', 'lg')}>
              Cancel
            </Link>
            <Button type="submit" size="lg" disabled={saving} className="sm:min-w-56">
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create project'}
            </Button>
          </FormActions>
        </form>
      </Card>
    </div>
  );
}
