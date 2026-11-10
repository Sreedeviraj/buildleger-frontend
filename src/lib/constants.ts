import {
  Banknote,
  Building,
  Droplets,
  FileBadge,
  FileText,
  HandCoins,
  HardHat,
  Landmark,
  Package,
  Shapes,
  Smartphone,
  Truck,
  Undo2,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { ExpenseCategory, PaymentKind, PaymentMode, ProjectStatus, Role, SupplierType } from '../types';

export interface Option<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

export const EXPENSE_CATEGORIES: Option<ExpenseCategory>[] = [
  { value: 'materials', label: 'Materials', icon: Package },
  { value: 'labour', label: 'Labour', icon: HardHat },
  { value: 'subcontractor', label: 'Subcontractor', icon: Users },
  { value: 'equipment', label: 'Equipment', icon: Wrench },
  { value: 'transport', label: 'Transport', icon: Truck },
  { value: 'rent', label: 'Rent', icon: Building },
  { value: 'permits', label: 'Permits & fees', icon: FileBadge },
  { value: 'electrical', label: 'Electrical', icon: Zap },
  { value: 'plumbing', label: 'Plumbing', icon: Droplets },
  { value: 'other', label: 'Miscellaneous', icon: Shapes },
];

export const PAYMENT_MODES: Option<PaymentMode>[] = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'bank', label: 'Bank transfer', icon: Landmark },
  { value: 'cheque', label: 'Cheque', icon: FileText },
];

export const PAYMENT_KINDS: Option<PaymentKind>[] = [
  { value: 'advance', label: 'Advance', icon: HandCoins },
  { value: 'installment', label: 'Installment / part payment', icon: HandCoins },
  { value: 'final', label: 'Final payment', icon: HandCoins },
  { value: 'refund', label: 'Refund to client', icon: Undo2 },
];

export const SUPPLIER_TYPES: Option<SupplierType>[] = [
  { value: 'supplier', label: 'Material supplier', icon: Package },
  { value: 'subcontractor', label: 'Subcontractor', icon: Users },
  { value: 'labour', label: 'Labour / mason team', icon: HardHat },
];

export const PROJECT_STATUSES: Option<ProjectStatus>[] = [
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  ongoing: 'Ongoing',
  on_hold: 'On hold',
  completed: 'Completed',
};

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Site staff',
};

export const ROLE_HINT: Record<Role, string> = {
  owner: 'Full access, including the team.',
  manager: 'Can add, edit and void entries, budgets and projects.',
  staff: 'Can add payments, expenses and bills. Cannot edit or void.',
};

/** Owners and managers may edit, void and change budgets; site staff only add entries. */
export const canManage = (role: Role | undefined) => role === 'owner' || role === 'manager';

export function findOption<T extends string>(options: Option<T>[], value: T): Option<T> {
  return options.find((o) => o.value === value) ?? { value, label: value };
}

export const categoryLabel = (c: ExpenseCategory) => findOption(EXPENSE_CATEGORIES, c).label;
