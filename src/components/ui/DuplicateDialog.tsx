import { ConfirmDialog } from './ConfirmDialog';

/** Shown when the server says an entry looks like one already saved. */
export function DuplicateDialog({
  message,
  busy,
  onSaveAnyway,
  onCancel,
}: {
  message: string | null;
  busy: boolean;
  onSaveAnyway: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      open={message !== null}
      title="This looks like a duplicate"
      message={
        <>
          <p>{message}</p>
          <p className="mt-2">Save it only if this is really a separate payment.</p>
        </>
      }
      confirmLabel="Yes, it’s separate — save"
      busy={busy}
      onCancel={onCancel}
      onConfirm={onSaveAnyway}
    />
  );
}

/** One id per open form: if “Save” is pressed twice, the server stores it only once. */
export function newRequestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
