import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CircleAlert } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Fields';
import { ROLE_HINT, ROLE_LABEL } from '../../lib/constants';
import { errorMessage } from '../../lib/errors';
import { AuthShell } from './AuthShell';

/** /invite/:token: someone invited by the owner sets a password and joins the company. */
export default function AcceptInvitePage() {
  const { token = '' } = useParams();
  const { session, acceptInvite } = useAuth();
  const navigate = useNavigate();
  const invite = useQuery({ queryKey: ['invite', token], queryFn: () => api.getInvite(token), retry: false });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Someone already logged in on this device must log out first, so they don't join as the wrong person.
  if (session) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('The two passwords are not the same.');
    setError('');
    setBusy(true);
    try {
      await acceptInvite(token, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (invite.isLoading) {
    return (
      <AuthShell title="Opening your invite…" subtitle="One moment.">
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />
      </AuthShell>
    );
  }

  if (invite.error || !invite.data) {
    return (
      <AuthShell title="This invite can’t be used" subtitle={errorMessage(invite.error)}>
        <Link to="/login" className="font-semibold text-navy-800 hover:underline">
          Go to log in
        </Link>
      </AuthShell>
    );
  }

  const { name, email, role, companyName } = invite.data;
  return (
    <AuthShell title={`Join ${companyName}`} subtitle={`Hi ${name}, set a password to start using BuildLedger.`}>
      <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <p className="text-slate-600">
          You are joining as <strong className="text-slate-900">{ROLE_LABEL[role]}</strong>
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{ROLE_HINT[role]}</p>
        <p className="mt-2 text-slate-600">
          Login email: <strong className="text-slate-900">{email}</strong>
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm font-medium text-red-800">
            <CircleAlert className="size-5 shrink-0" aria-hidden /> {error}
          </p>
        )}
        <TextField label="Password" type="password" autoComplete="new-password" value={password} onChange={setPassword} hint="At least 8 characters." />
        <TextField label="Type it again" type="password" autoComplete="new-password" value={confirm} onChange={setConfirm} />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Joining…' : `Join ${companyName}`}
        </Button>
      </form>
    </AuthShell>
  );
}
