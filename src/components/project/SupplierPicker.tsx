import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAddSupplier } from '../../api/hooks';
import { SUPPLIER_TYPES, findOption } from '../../lib/constants';
import { errorMessage } from '../../lib/errors';
import type { Supplier, SupplierType } from '../../types';
import { Button } from '../ui/Button';
import { inputClass, SelectField } from '../ui/Fields';

interface SupplierPickerProps {
  label: string;
  suppliers: Supplier[];
  value: string;
  onChange: (supplierId: string) => void;
  error?: string;
  optional?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

/** Choose a supplier, or add a new one without leaving the form. */
export function SupplierPicker({ label, suppliers, value, onChange, error, optional, disabled, placeholder = 'Choose a supplier' }: SupplierPickerProps) {
  const addSupplier = useAddSupplier();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<SupplierType>('supplier');
  const [addError, setAddError] = useState('');

  async function add() {
    setAddError('');
    try {
      const created = await addSupplier.mutateAsync({ name, type, phone: '', note: '' });
      onChange(created.id);
      setAdding(false);
      setName('');
    } catch (err) {
      setAddError(errorMessage(err));
    }
  }

  return (
    <div>
      <SelectField
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        optional={optional}
        error={error}
        options={suppliers
          .filter((s) => !s.archived || s.id === value)
          .map((s) => ({ value: s.id, label: `${s.name} (${findOption(SUPPLIER_TYPES, s.type).label})` }))}
      />
      {!disabled &&
        (adding ? (
          <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Supplier or team name"
                aria-label="New supplier name"
                autoFocus
                className={inputClass.replace('mt-1.5 ', '')}
              />
              <select value={type} onChange={(e) => setType(e.target.value as SupplierType)} aria-label="Supplier type" className={inputClass.replace('mt-1.5 ', '')}>
                {SUPPLIER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {addError && <p className="text-sm font-medium text-red-700">{addError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" className="min-h-9" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button className="min-h-9" disabled={!name.trim() || addSupplier.isPending} onClick={() => void add()}>
                {addSupplier.isPending ? 'Adding…' : 'Add supplier'}
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="mt-1.5 flex items-center gap-1 text-sm font-semibold text-blue-800 hover:underline">
            <Plus className="size-4" aria-hidden /> New supplier
          </button>
        ))}
    </div>
  );
}
