import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Building2, LogOut, RotateCcw, UserRound } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Card, CardTitle } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';

function Row({ label, value, capitalize = false }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className={`min-w-0 truncate text-sm font-semibold text-slate-900 ${capitalize ? 'capitalize' : ''}`}>{value || '—'}</dd>
    </div>
  );
}

export default function SettingsPage() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  if (!session) return null;

  async function resetDemo() {
    setResetting(true);
    await api.resetDemoData();
    await logout();
    toast('Demo data has been reset');
    navigate('/login');
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Settings" subtitle="Your company and login details." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardTitle>
            <span className="flex items-center gap-2">
              <Building2 className="size-5 text-slate-500" aria-hidden /> Company
            </span>
          </CardTitle>
          <dl className="divide-y divide-slate-100">
            <Row label="Company name" value={session.company.name} />
            <Row label="City" value={session.company.city} capitalize />
          </dl>
        </Card>

        <Card className="flex flex-col p-5">
          <CardTitle
            action={
              <Button variant="secondary" onClick={() => void logout()}>
                <LogOut className="size-4" aria-hidden /> Log out
              </Button>
            }
          >
            <span className="flex items-center gap-2">
              <UserRound className="size-5 text-slate-500" aria-hidden /> Your account
            </span>
          </CardTitle>
          <dl className="divide-y divide-slate-100">
            <Row label="Name" value={session.user.name} />
            <Row label="Email" value={session.user.email} />
            <Row label="Role" value={session.user.role} capitalize />
          </dl>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Demo data</h2>
              <p className="mt-0.5 text-sm text-slate-600">
                This version saves data only in this browser. Resetting brings back the sample projects.
              </p>
            </div>
            <Button variant="secondary" className="shrink-0" onClick={() => setConfirmReset(true)}>
              <RotateCcw className="size-4" aria-hidden /> Reset demo data
            </Button>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset demo data?"
        message="All projects, payments and expenses you added will be removed and the sample data will come back. You will be logged out."
        confirmLabel="Yes, reset"
        danger
        busy={resetting}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => void resetDemo()}
      />
    </div>
  );
}
