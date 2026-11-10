import { useState } from 'react';
import { Check, Copy, Link2, MessageCircle, Trash2, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useChangeMemberRole, useInviteMember, useRemoveMember, useRevokeInvite, useTeam } from '../../api/hooks';
import { ROLE_HINT, ROLE_LABEL } from '../../lib/constants';
import { errorMessage } from '../../lib/errors';
import { formatDate } from '../../lib/format';
import type { InviteInput, PendingInvite, TeamMember } from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardTitle } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ChoiceGrid, TextField } from '../ui/Fields';
import { useToast } from '../ui/Toast';

type TeamRole = PendingInvite['role'];

const ROLE_CHOICES: { value: TeamRole; label: string }[] = [
  { value: 'manager', label: ROLE_LABEL.manager },
  { value: 'staff', label: ROLE_LABEL.staff },
];

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** Settings → Team: who can log in to this company, and inviting new people. Only the owner can change it. */
export function TeamCard() {
  const { session } = useAuth();
  const team = useTeam();
  const toast = useToast();
  const invite = useInviteMember();
  const revoke = useRevokeInvite();
  const changeRole = useChangeMemberRole();
  const remove = useRemoveMember();
  const [inviting, setInviting] = useState(false);
  const [shared, setShared] = useState<{ name: string; role: TeamRole; link: string } | null>(null);
  const [toRemove, setToRemove] = useState<TeamMember | null>(null);

  const isOwner = session?.user.role === 'owner';

  async function sendInvite(input: InviteInput) {
    const { link } = await invite.mutateAsync(input);
    setInviting(false);
    setShared({ name: input.name, role: input.role, link });
  }

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      toast(done);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  return (
    <Card className="p-5 lg:col-span-2">
      <CardTitle
        action={
          isOwner && (
            <Button onClick={() => setInviting(true)}>
              <UserPlus className="size-4" aria-hidden /> Invite member
            </Button>
          )
        }
      >
        <span className="flex items-center gap-2">
          <Users className="size-5 text-slate-500" aria-hidden /> Team
        </span>
      </CardTitle>

      {team.isLoading ? (
        <p className="text-sm text-slate-500">Loading team…</p>
      ) : team.error || !team.data ? (
        <p className="text-sm text-red-700">{errorMessage(team.error)}</p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {team.data.members.map((member) => {
              const isYou = member.id === session?.user.id;
              const editable = isOwner && !isYou && member.role !== 'owner';
              return (
                <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-50 text-sm font-semibold text-navy-800">
                    {initials(member.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {member.name} {isYou && <span className="font-normal text-slate-500">(you)</span>}
                    </span>
                    <span className="block truncate text-xs text-slate-500">{member.email}</span>
                  </span>
                  {editable ? (
                    <span className="flex items-center gap-1">
                      <select
                        value={member.role}
                        aria-label={`Role of ${member.name}`}
                        disabled={changeRole.isPending}
                        onChange={(e) => {
                          const role = e.target.value as TeamRole;
                          void run(() => changeRole.mutateAsync([member.id, role]), `${member.name} is now ${ROLE_LABEL[role]}`);
                        }}
                        className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                      >
                        {ROLE_CHOICES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setToRemove(member)}
                        aria-label={`Remove ${member.name}`}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </span>
                  ) : (
                    <Badge tone={member.role === 'owner' ? 'indigo' : 'neutral'}>{ROLE_LABEL[member.role]}</Badge>
                  )}
                </li>
              );
            })}
          </ul>

          {team.data.invites.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Waiting to join</p>
              <ul className="divide-y divide-slate-100 rounded-lg border border-dashed border-slate-300">
                {team.data.invites.map((pending) => (
                  <li key={pending.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {pending.name} <Badge tone="neutral">{ROLE_LABEL[pending.role]}</Badge>
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {pending.email} · link valid until {formatDate(pending.expiresAt)}
                      </span>
                    </span>
                    {isOwner && (
                      <span className="flex gap-1">
                        <Button
                          variant="ghost"
                          className="min-h-9"
                          disabled={invite.isPending}
                          onClick={() =>
                            void sendInvite({ name: pending.name, email: pending.email, role: pending.role }).catch((err) =>
                              toast(errorMessage(err), 'error'),
                            )
                          }
                        >
                          <Link2 className="size-4" aria-hidden /> New link
                        </Button>
                        <Button
                          variant="ghost"
                          className="min-h-9 text-red-700 hover:bg-red-50"
                          disabled={revoke.isPending}
                          onClick={() => void run(() => revoke.mutateAsync(pending.id), 'Invite cancelled')}
                        >
                          Cancel invite
                        </Button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!isOwner && <p className="mt-3 text-xs text-slate-500">Only the owner can invite people or change roles.</p>}
        </>
      )}

      {inviting && <InviteDialog busy={invite.isPending} onCancel={() => setInviting(false)} onSend={sendInvite} />}
      {shared && <ShareLinkDialog {...shared} companyName={session?.company.name ?? ''} onClose={() => setShared(null)} />}

      <ConfirmDialog
        open={toRemove !== null}
        title={`Remove ${toRemove?.name ?? ''}?`}
        message="They will be logged out and can no longer open this company. Entries they added stay, with their name."
        confirmLabel="Yes, remove"
        danger
        busy={remove.isPending}
        onCancel={() => setToRemove(null)}
        onConfirm={() => {
          if (!toRemove) return;
          void run(() => remove.mutateAsync(toRemove.id), `${toRemove.name} removed`).finally(() => setToRemove(null));
        }}
      />
    </Card>
  );
}

function InviteDialog({ busy, onCancel, onSend }: { busy: boolean; onCancel: () => void; onSend: (input: InviteInput) => Promise<void> }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('staff');
  const [error, setError] = useState('');

  async function send() {
    setError('');
    if (!name.trim()) return setError('Please enter their name.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Please enter a valid email.');
    try {
      await onSend({ name: name.trim(), email: email.trim(), role });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <ConfirmDialog open title="Invite a team member" message="" confirmLabel="Create invite link" busy={busy} onCancel={onCancel} onConfirm={() => void send()}>
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <TextField label="Name" value={name} onChange={setName} placeholder="e.g. Suresh P" />
        <TextField label="Email" type="email" inputMode="email" value={email} onChange={setEmail} placeholder="They will log in with this" />
        <div>
          <ChoiceGrid label="Role" options={ROLE_CHOICES} value={role} onChange={setRole} columns="grid-cols-2" />
          <p className="mt-1.5 text-sm text-slate-600">{ROLE_HINT[role]}</p>
        </div>
        {error && (
          <p className="text-sm font-medium text-red-700" role="alert">
            {error}
          </p>
        )}
      </form>
    </ConfirmDialog>
  );
}

/** The link is shown once: the server only keeps its hash. */
function ShareLinkDialog({ name, role, link, companyName, onClose }: { name: string; role: TeamRole; link: string; companyName: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const message = `Hi ${name}, you are invited to join ${companyName} on BuildLedger as ${ROLE_LABEL[role]}. Open this link to set your password: ${link}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <ConfirmDialog
      open
      title="Invite link ready"
      message={`Send this link to ${name}. It works once and expires in 7 days.`}
      confirmLabel="Done"
      onCancel={onClose}
      onConfirm={onClose}
    >
      <div className="space-y-3">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          aria-label="Invite link"
          className="block min-h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700"
        />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => void copy()}>
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border-2 border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">
            <MessageCircle className="size-4" aria-hidden /> WhatsApp
          </a>
        </div>
      </div>
    </ConfirmDialog>
  );
}
