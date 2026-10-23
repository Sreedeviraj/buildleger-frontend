import { useId, useState, type HTMLInputTypeAttribute, type ReactNode } from 'react';
import { Check, CircleAlert, Paperclip, X } from 'lucide-react';
import { ACCEPTED_FILES, fileSize, openAttachment, saveAttachment } from '../../lib/attachments';
import type { Option } from '../../lib/constants';
import { errorMessage } from '../../lib/errors';
import { amountInWords } from '../../lib/format';
import type { Attachment } from '../../types';

const labelClass = 'block text-sm font-semibold text-slate-800';
export const inputClass =
  'mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 min-h-11 text-base text-slate-900 ' +
  'placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 ' +
  'aria-[invalid=true]:border-red-500';

function FieldMessage({ error, hint, id }: { error?: string; hint?: ReactNode; id: string }) {
  if (error) {
    return (
      <p id={id} className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-red-700">
        <CircleAlert className="size-4 shrink-0" aria-hidden />
        {error}
      </p>
    );
  }
  if (hint) {
    return (
      <p id={id} className="mt-1.5 text-sm text-slate-600">
        {hint}
      </p>
    );
  }
  return null;
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric';
  optional?: boolean;
}

export function TextField({ label, value, onChange, error, hint, optional, type = 'text', ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label} {optional && <span className="font-normal text-slate-500">(optional)</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-msg`}
        className={inputClass}
        {...rest}
      />
      <FieldMessage error={error} hint={hint} id={`${id}-msg`} />
    </div>
  );
}

interface AmountFieldProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
  hint?: ReactNode;
  autoFocus?: boolean;
}

/** Large rupee input that formats as you type: 1250000 → 12,50,000 (₹12.5 Lakh). */
export function AmountField({ label, value, onChange, error, hint, autoFocus }: AmountFieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative mt-1.5">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xl font-semibold text-slate-500">
          ₹
        </span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="0"
          value={value === null ? '' : value.toLocaleString('en-IN')}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
            onChange(digits ? Number(digits) : null);
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-msg`}
          className={`${inputClass} !mt-0 min-h-12 pl-9 text-xl font-semibold tabular-nums`}
        />
      </div>
      {value !== null && value >= 1000 && !error && (
        <p className="mt-1.5 text-sm font-medium text-blue-800">{amountInWords(value)}</p>
      )}
      <FieldMessage error={error} hint={hint} id={`${id}-msg`} />
    </div>
  );
}

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  min?: string;
  max?: string;
  optional?: boolean;
}

export function DateField({ label, value, onChange, error, hint, min, max, optional }: DateFieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label} {optional && <span className="font-normal text-slate-500">(optional)</span>}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-msg`}
        className={inputClass}
      />
      <FieldMessage error={error} hint={hint} id={`${id}-msg`} />
    </div>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Notes are optional by default; reasons for a change are not. */
  optional?: boolean;
}

export function TextAreaField({ label, value, onChange, placeholder, optional = true }: TextAreaFieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label} {optional && <span className="font-normal text-slate-500">(optional)</span>}
      </label>
      <textarea
        id={id}
        rows={2}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} py-2`}
      />
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  disabled?: boolean;
}

export function SelectField({ label, value, onChange, options, placeholder, error, hint, optional, disabled }: SelectFieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label} {optional && <span className="font-normal text-slate-500">(optional)</span>}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-msg`}
        className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-600`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldMessage error={error} hint={hint} id={`${id}-msg`} />
    </div>
  );
}

interface ChoiceGridProps<T extends string> {
  label: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
  columns?: string;
}

/** Big tappable choices instead of a dropdown: easier on a phone. */
export function ChoiceGrid<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  columns = 'grid-cols-2 sm:grid-cols-4',
}: ChoiceGridProps<T>) {
  const id = useId();
  return (
    <fieldset aria-describedby={`${id}-msg`}>
      <legend className={labelClass}>{label}</legend>
      <div className={`mt-1.5 grid gap-2 ${columns}`}>
        {options.map((option) => {
          const selected = option.value === value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 ${
                selected
                  ? 'border-blue-600 bg-blue-50 text-blue-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
              }`}
            >
              {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
              <span className="leading-tight">{option.label}</span>
              {selected && <Check className="ml-auto size-4 shrink-0 text-blue-700" aria-hidden />}
            </button>
          );
        })}
      </div>
      <FieldMessage error={error} id={`${id}-msg`} />
    </fieldset>
  );
}

interface AttachmentFieldProps {
  label: string;
  value: Attachment[];
  onChange: (value: Attachment[]) => void;
  hint?: ReactNode;
}

/** Receipt / invoice photos and PDFs. */
export function AttachmentField({ label, value, onChange, hint }: AttachmentFieldProps) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError('');
    try {
      const saved = await Promise.all([...files].map(saveAttachment));
      onChange([...value, ...saved]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className={labelClass}>
        {label} <span className="font-normal text-slate-500">(optional)</span>
      </span>
      {value.length > 0 && (
        <ul className="mt-1.5 space-y-1.5">
          {value.map((file) => (
            <li key={file.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <Paperclip className="size-4 shrink-0 text-slate-500" aria-hidden />
              <button
                type="button"
                onClick={() => void openAttachment(file).catch((err) => setError(errorMessage(err)))}
                className="min-w-0 flex-1 truncate text-left font-medium text-blue-800 hover:underline"
              >
                {file.name}
              </button>
              <span className="text-slate-500">{fileSize(file.size)}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((f) => f.id !== file.id))}
                aria-label={`Remove ${file.name}`}
                className="rounded p-1 text-slate-500 hover:bg-slate-200"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label
        htmlFor={id}
        className="mt-1.5 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
      >
        <Paperclip className="size-4" aria-hidden />
        {busy ? 'Saving file…' : 'Attach photo or PDF'}
      </label>
      <input
        id={id}
        type="file"
        accept={ACCEPTED_FILES}
        multiple
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = '';
        }}
      />
      <FieldMessage error={error} hint={hint ?? 'Photos or PDF, up to 5 MB each.'} id={`${id}-msg`} />
    </div>
  );
}
