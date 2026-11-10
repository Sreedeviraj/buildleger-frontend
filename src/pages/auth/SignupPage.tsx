import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Fields';
import { useToast } from '../../components/ui/Toast';
import { errorMessage } from '../../lib/errors';
import { AuthShell } from './AuthShell';

export default function SignupPage() {
  const { session, signup } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ companyName: '', city: '', name: '', email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const set = (field: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [field]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!form.companyName.trim()) next.companyName = 'Please enter your company name.';
    if (!form.city.trim()) next.city = 'Please enter your city.';
    if (!form.name.trim()) next.name = 'Please enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Please enter a valid email.';
    if (form.password.length < 8) next.password = 'Password must have at least 8 characters.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await signup(form);
      toast(`Welcome to BuildLedger, ${form.name.trim().split(' ')[0]}!`);
    } catch (err) {
      toast(errorMessage(err), 'error');
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Set up your company. You can invite your team after this.">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <TextField label="Company name" placeholder="e.g. ABC Constructions" value={form.companyName} onChange={set('companyName')} error={errors.companyName} />
        <TextField label="City" placeholder="e.g. Kochi" value={form.city} onChange={set('city')} error={errors.city} />
        <TextField label="Your name" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} />
        <TextField label="Email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          hint="At least 8 characters."
        />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-navy-800 underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
