import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  confirmDisabled?: boolean;
  /** Extra content such as a reason field. */
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  busy,
  confirmDisabled,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const id = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  // Focus "Cancel" once when the dialog opens (not on every re-render).
  // Dialogs with a field focus that field instead.
  const hasFields = Boolean(children);
  useEffect(() => {
    if (!open) return;
    if (!hasFields) cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancelRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, hasFields]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-message`}
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 id={`${id}-title`} className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <div id={`${id}-message`} className="mt-2 text-base text-slate-700">
          {message}
        </div>
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={busy}>
            No, go back
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy || confirmDisabled}>
            {busy ? 'Please wait…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Confirm dialog that requires a written reason (used for voiding and editing money records). */
export function ReasonDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: Omit<ConfirmDialogProps, 'onConfirm' | 'children' | 'confirmDisabled'> & { onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  const fieldId = useId();
  useEffect(() => {
    if (open) setReason('');
  }, [open]);
  return (
    <ConfirmDialog
      open={open}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      danger={danger}
      busy={busy}
      confirmDisabled={!reason.trim()}
      onCancel={onCancel}
      onConfirm={() => onConfirm(reason.trim())}
    >
      <label htmlFor={fieldId} className="block text-sm font-semibold text-slate-800">
        Reason
      </label>
      <textarea
        id={fieldId}
        rows={2}
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Entered twice by mistake"
        className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
      />
    </ConfirmDialog>
  );
}
