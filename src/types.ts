// Shared data shapes. The backend API will return exactly these shapes.
// All money amounts are whole rupees stored as numbers — never formatted strings.

/** owner: everything. manager: everything except the team and deleting projects. staff: adds entries only. */
export type Role = 'owner' | 'manager' | 'staff';

export interface Company {
  id: string;
  name: string;
  city: string;
}

export interface User {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: Role;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface PendingInvite {
  id: string;
  name: string;
  email: string;
  role: Exclude<Role, 'owner'>;
  expiresAt: string;
  createdAt: string;
}

export interface Team {
  members: TeamMember[];
  invites: PendingInvite[];
}

export type InviteInput = Pick<PendingInvite, 'name' | 'email' | 'role'>;

/** What the invite page shows before the person sets a password. */
export interface InviteDetails {
  name: string;
  email: string;
  role: PendingInvite['role'];
  companyName: string;
}

export interface Session {
  user: User;
  company: Company;
}

export type ProjectStatus = 'ongoing' | 'on_hold' | 'completed';

export type ExpenseCategory =
  | 'materials'
  | 'labour'
  | 'subcontractor'
  | 'equipment'
  | 'transport'
  | 'rent'
  | 'permits'
  | 'electrical'
  | 'plumbing'
  | 'other';

export type CategoryBudgets = Partial<Record<ExpenseCategory, number>>;

export interface Project {
  id: string;
  companyId: string;
  name: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientAddress: string;
  /** Site address. */
  location: string;
  /** Total amount the client agreed to pay. */
  contractValue: number;
  /** Approved total budget: what the contractor expects to spend to finish the work. */
  estimatedCost: number;
  /** Optional split of the budget by category. Whatever is not split is "unallocated". */
  categoryBudgets: CategoryBudgets;
  startDate: string;
  /** Expected completion date, '' when not set. */
  expectedEndDate: string;
  /** Work completed, 0–100. Used for percentage-of-completion profit. */
  progress: number;
  status: ProjectStatus;
  /** Archived projects are hidden from everyday lists but keep all their records. */
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMode = 'cash' | 'upi' | 'bank' | 'cheque';

export interface Voided {
  at: string;
  byName: string;
  reason: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
}

/** advance / installment / final are money in; refund is money paid back to the client. */
export type PaymentKind = 'advance' | 'installment' | 'final' | 'refund';

/** Money received from (or refunded to) the client. Amount is always positive. */
export interface Payment {
  id: string;
  companyId: string;
  projectId: string;
  kind: PaymentKind;
  amount: number;
  date: string;
  mode: PaymentMode;
  reference: string;
  note: string;
  voided: Voided | null;
  createdBy: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

/** Money paid out for the project. Linked to a bill when it settles one. */
export interface Expense {
  id: string;
  companyId: string;
  projectId: string;
  amount: number;
  date: string;
  category: ExpenseCategory;
  supplierId: string | null;
  billId: string | null;
  paidTo: string;
  mode: PaymentMode;
  invoiceRef: string;
  note: string;
  attachments: Attachment[];
  voided: Voided | null;
  createdBy: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export type SupplierType = 'supplier' | 'subcontractor' | 'labour';

export interface Supplier {
  id: string;
  companyId: string;
  name: string;
  type: SupplierType;
  phone: string;
  note: string;
  archived: boolean;
  createdAt: string;
}

/** A supplier/subcontractor bill: cost incurred, paid later through linked expenses. */
export interface Bill {
  id: string;
  companyId: string;
  projectId: string;
  supplierId: string;
  category: ExpenseCategory;
  billNumber: string;
  billDate: string;
  dueDate: string;
  amount: number;
  note: string;
  attachments: Attachment[];
  voided: Voided | null;
  createdBy: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

/** A scheduled client payment (milestone). Used to work out overdue amounts. */
export interface Installment {
  id: string;
  companyId: string;
  projectId: string;
  label: string;
  amount: number;
  dueDate: string;
}

export interface BudgetRevision {
  id: string;
  companyId: string;
  projectId: string;
  at: string;
  byName: string;
  reason: string;
  before: { estimatedCost: number; categoryBudgets: CategoryBudgets };
  after: { estimatedCost: number; categoryBudgets: CategoryBudgets };
}

export type AuditEntity = 'project' | 'payment' | 'expense' | 'bill' | 'supplier' | 'installment';
export type AuditAction = 'created' | 'updated' | 'voided' | 'archived' | 'restored' | 'deleted';

export interface AuditEvent {
  id: string;
  companyId: string;
  projectId: string | null;
  entity: AuditEntity;
  entityId: string;
  action: AuditAction;
  at: string;
  byName: string;
  changes: { field: string; from: string; to: string }[];
  reason: string;
}

// ---- Inputs ----

export type ProjectInput = Pick<
  Project,
  | 'name'
  | 'clientName'
  | 'clientPhone'
  | 'clientEmail'
  | 'clientAddress'
  | 'location'
  | 'contractValue'
  | 'estimatedCost'
  | 'startDate'
  | 'expectedEndDate'
>;
export type ProjectUpdate = Partial<ProjectInput & Pick<Project, 'progress' | 'status'>>;

/** requestId is generated once per form so a double submit can never save twice. */
interface WriteOptions {
  requestId?: string;
  /** Set after the user confirms that a look-alike entry is not a duplicate. */
  allowDuplicate?: boolean;
}

export type PaymentInput = Pick<Payment, 'projectId' | 'kind' | 'amount' | 'date' | 'mode' | 'reference' | 'note'> &
  WriteOptions;
export type ExpenseInput = Pick<
  Expense,
  'projectId' | 'amount' | 'date' | 'category' | 'supplierId' | 'billId' | 'paidTo' | 'mode' | 'invoiceRef' | 'note' | 'attachments'
> &
  WriteOptions;
export type BillInput = Pick<
  Bill,
  'projectId' | 'supplierId' | 'category' | 'billNumber' | 'billDate' | 'dueDate' | 'amount' | 'note' | 'attachments'
> &
  WriteOptions;
export type SupplierInput = Pick<Supplier, 'name' | 'type' | 'phone' | 'note'>;
export type InstallmentInput = Pick<Installment, 'projectId' | 'label' | 'amount' | 'dueDate'>;

export interface SignupInput {
  companyName: string;
  city: string;
  name: string;
  email: string;
  password: string;
}

export type BudgetHealth = 'good' | 'watch' | 'over';
