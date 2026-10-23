import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { CircleAlert } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Fields';
import { errorMessage } from '../../lib/errors';
import { AuthShell } from './AuthShell';

const DEMO_ACCOUNTS = [
  { label: 'ABC Constructions · Owner', email: 'demo@abc.com' },
  { label: 'ABC Constructions · Site staff', email: 'suresh@abc.com' },
  { label: 'Skyline Builders · Owner', email: 'demo@skyline.com' },
];

export default function LoginPage() {
  const { session, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  async function signIn(emailToUse: string, passwordToUse: string) {
    setBusy(true);
    setError('');
    try {
      await login(emailToUse, passwordToUse);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    void signIn(email, password);
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to see your projects.">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm font-medium text-red-800">
            <CircleAlert className="size-5 shrink-0" aria-hidden /> {error}
          </p>
        )}
        <TextField label="Email" type="email" inputMode="email" autoComplete="email" value={email} onChange={setEmail} />
        <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600">
        New here?{' '}
        <Link to="/signup" className="font-semibold text-navy-800 underline-offset-4 hover:underline">
          Create a free account
        </Link>
      </p>

      {/* Demo shortcuts: remove before going live */}
      <div className="mt-8">
        <div className="flex items-center gap-3 text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
          <span className="h-px flex-1 bg-slate-200" /> Try the demo <span className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              disabled={busy}
              onClick={() => void signIn(account.email, 'demo123')}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-navy-300 hover:bg-navy-50 hover:text-navy-900 disabled:opacity-60"
            >
              {account.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-slate-400">Each company sees only its own projects.</p>
      </div>
    </AuthShell>
  );
}
