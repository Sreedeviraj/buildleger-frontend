// The only file the UI talks to for data.
// Today it reads the fake browser database; later each function becomes a
// fetch() call to the Node backend, and no screen needs to change.
//
// Like a real backend, every function checks who is logged in, only touches data
// belonging to that user's company, and validates input itself — never trusting the form.
import { loadDb, newId, resetDb, saveDb, type Db, type DbUser } from './mockDb';
import { billPayments, billOutstanding } from '../lib/calc';
import { EXPENSE_CATEGORIES, PAYMENT_KINDS, PAYMENT_MODES, PROJECT_STATUSES, SUPPLIER_TYPES } from '../lib/constants';
import { DuplicateError, NotFoundError } from '../lib/errors';
import { formatINR, todayISO } from '../lib/format';
import type {
  AuditEntity,
  AuditEvent,
  Bill,
  BillInput,
  BudgetRevision,
  CategoryBudgets,
  Expense,
  ExpenseInput,
  Installment,
  InstallmentInput,
  Payment,
  PaymentInput,
  Project,
  ProjectInput,
  ProjectUpdate,
  Session,
  SignupInput,
  Supplier,
  SupplierInput,
} from '../types';

const SESSION_KEY = 'buildledger-session';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

function readSessionUserId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSessionUserId(userId: string | null): void {
  try {
    if (userId) localStorage.setItem(SESSION_KEY, userId);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore: the user will need to log in again after reload.
  }
}

function toSession(db: Db, user: DbUser): Session {
  const company = db.companies.find((c) => c.id === user.companyId)!;
  return {
    user: { id: user.id, companyId: user.companyId, name: user.name, email: user.email, role: user.role },
    company,
  };
}

function requireUser(): { db: Db; user: DbUser } {
  const userId = readSessionUserId();
  const db = loadDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error('Please log in again.');
  return { db, user };
}

function requireOwner(): { db: Db; user: DbUser } {
  const ctx = requireUser();
  if (ctx.user.role !== 'owner') throw new Error('Only the owner can do this.');
  return ctx;
}

function requireProject(db: Db, companyId: string, projectId: string): Project {
  const project = db.projects.find((p) => p.id === projectId && p.companyId === companyId);
  if (!project) throw new NotFoundError('This project was not found.');
  return project;
}

function findOwn<T extends { id: string; companyId: string }>(list: T[], companyId: string, id: string, what: string): T {
  const item = list.find((x) => x.id === id && x.companyId === companyId);
  if (!item) throw new NotFoundError(`This ${what} was not found.`);
  return item;
}

// ---- Validation ----

function requireAmount(amount: number, label = 'an amount'): void {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error(`Please enter ${label} above zero.`);
}

function requireText(value: string, message: string): void {
  if (!value.trim()) throw new Error(message);
}

function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function requireDate(value: string, label: string, { notFuture = false, optional = false } = {}): void {
  if (!value && optional) return;
  if (!value || !isISODate(value)) throw new Error(`Please choose a valid ${label}.`);
  if (notFuture && value > todayISO()) throw new Error(`The ${label} cannot be in the future.`);
}

function requireOneOf<T extends string>(value: T, options: { value: T }[], label: string): void {
  if (!options.some((o) => o.value === value)) throw new Error(`Please choose a valid ${label}.`);
}

function requirePhone(phone: string): void {
  if (!phone.trim()) return;
  const digits = phone.replace(/\D/g, '');
  const ok = digits.length === 10 || (digits.length === 12 && digits.startsWith('91'));
  if (!ok) throw new Error('Please enter a 10-digit mobile number.');
}

function requireCategoryBudgets(budgets: CategoryBudgets): void {
  for (const [category, amount] of Object.entries(budgets)) {
    requireOneOf(category as keyof CategoryBudgets, EXPENSE_CATEGORIES, 'category');
    if (amount !== undefined && (!Number.isInteger(amount) || amount < 0)) {
      throw new Error('Category budgets must be zero or more.');
    }
  }
}

function validateProject(input: ProjectInput): void {
  requireText(input.name, 'Please enter a project name.');
  requireText(input.clientName, 'Please enter the client name.');
  requireText(input.location, 'Please enter the site address.');
  requirePhone(input.clientPhone);
  if (input.clientEmail.trim() && !/^\S+@\S+\.\S+$/.test(input.clientEmail.trim())) {
    throw new Error('Please enter a valid client email.');
  }
  requireAmount(input.contractValue, 'the contract value');
  requireAmount(input.estimatedCost, 'the estimated cost');
  requireDate(input.startDate, 'start date');
  requireDate(input.expectedEndDate, 'expected completion date', { optional: true });
  if (input.expectedEndDate && input.expectedEndDate < input.startDate) {
    throw new Error('The expected completion date must be after the start date.');
  }
}

// ---- Audit trail ----

type Stringable = string | number | boolean | null | undefined;

function diff<T extends object>(before: T, after: Partial<T>, fields: (keyof T & string)[]) {
  const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
  return fields
    .filter((f) => f in after && (after[f] as Stringable) !== (before[f] as Stringable))
    .map((f) => ({ field: f, from: show(before[f]), to: show(after[f]) }));
}

function audit(
  db: Db,
  user: DbUser,
  entry: Pick<AuditEvent, 'entity' | 'entityId' | 'action' | 'projectId'> & Partial<Pick<AuditEvent, 'changes' | 'reason'>>,
): void {
  db.audit.push({
    id: newId('aud'),
    companyId: user.companyId,
    at: new Date().toISOString(),
    byName: user.name,
    changes: [],
    reason: '',
    ...entry,
  });
}

/** A repeated submit with the same requestId returns the record the first one created. */
function alreadyCreated<T extends { id: string }>(db: Db, list: T[], requestId?: string): T | undefined {
  if (!requestId || !db.requests[requestId]) return undefined;
  return list.find((x) => x.id === db.requests[requestId]);
}

function remember(db: Db, requestId: string | undefined, id: string): void {
  if (requestId) db.requests[requestId] = id;
}

function stamp(user: DbUser) {
  const now = new Date().toISOString();
  return { companyId: user.companyId, createdBy: user.name, createdById: user.id, createdAt: now, updatedAt: now, voided: null };
}

const byDateDesc = <T extends { createdAt: string }>(dateOf: (x: T) => string) => (a: T, b: T) =>
  dateOf(b).localeCompare(dateOf(a)) || b.createdAt.localeCompare(a.createdAt);

// ---- Payment/expense/bill checks shared by add and edit ----

function checkPayment(db: Db, companyId: string, input: Omit<PaymentInput, 'requestId'>, editingId?: string): void {
  requireProject(db, companyId, input.projectId);
  requireOneOf(input.kind, PAYMENT_KINDS, 'payment type');
  requireAmount(input.amount);
  requireDate(input.date, 'payment date', { notFuture: true });
  requireOneOf(input.mode, PAYMENT_MODES, 'payment method');
  if (input.kind === 'refund') {
    const received = db.payments
      .filter((p) => p.id !== editingId && !p.voided && p.projectId === input.projectId)
      .reduce((total, p) => total + (p.kind === 'refund' ? -p.amount : p.amount), 0);
    if (input.amount > received) {
      throw new Error(`The client has paid ${formatINR(Math.max(received, 0))} so far. A refund cannot be more than that.`);
    }
  }
  if (input.allowDuplicate) return;
  const twin = db.payments.find(
    (p) =>
      p.id !== editingId &&
      !p.voided &&
      p.projectId === input.projectId &&
      p.kind === input.kind &&
      p.amount === input.amount &&
      p.date === input.date,
  );
  if (twin) {
    throw new DuplicateError(
      `A ${input.kind === 'refund' ? 'refund' : 'payment'} of ${formatINR(input.amount)} on this date is already saved for this project.`,
    );
  }
}

function checkExpense(db: Db, companyId: string, input: Omit<ExpenseInput, 'requestId'>, editingId?: string): void {
  requireProject(db, companyId, input.projectId);
  requireAmount(input.amount);
  requireDate(input.date, 'payment date', { notFuture: true });
  requireOneOf(input.category, EXPENSE_CATEGORIES, 'category');
  requireOneOf(input.mode, PAYMENT_MODES, 'payment method');
  if (input.supplierId) findOwn(db.suppliers, companyId, input.supplierId, 'supplier');
  if (input.billId) {
    const bill = findOwn(db.bills, companyId, input.billId, 'bill');
    if (bill.voided) throw new Error('This bill has been voided. Choose another bill.');
    if (bill.projectId !== input.projectId) throw new Error('This bill belongs to a different project.');
    if (input.supplierId && bill.supplierId !== input.supplierId) throw new Error('This bill is from a different supplier.');
    const others = db.expenses.filter((e) => e.id !== editingId);
    const due = billOutstanding(bill, billPayments([bill], others));
    if (input.amount > due) {
      throw new Error(`Only ${formatINR(due)} is unpaid on this bill. Paying more would record the same payment twice.`);
    }
  }
  if (input.allowDuplicate) return;
  const twin = db.expenses.find(
    (e) =>
      e.id !== editingId &&
      !e.voided &&
      e.projectId === input.projectId &&
      e.amount === input.amount &&
      e.date === input.date &&
      (e.supplierId ?? e.paidTo) === (input.supplierId ?? input.paidTo),
  );
  if (twin) throw new DuplicateError(`An expense of ${formatINR(input.amount)} to the same payee on this date is already saved.`);
}

function checkBill(db: Db, companyId: string, input: Omit<BillInput, 'requestId'>, editingId?: string): void {
  requireProject(db, companyId, input.projectId);
  findOwn(db.suppliers, companyId, input.supplierId, 'supplier');
  requireOneOf(input.category, EXPENSE_CATEGORIES, 'category');
  requireAmount(input.amount);
  requireDate(input.billDate, 'bill date', { notFuture: true });
  requireDate(input.dueDate, 'due date', { optional: true });
  if (input.dueDate && input.dueDate < input.billDate) throw new Error('The due date must be on or after the bill date.');
  if (editingId) {
    const paid = billPayments(db.bills.filter((b) => b.id === editingId), db.expenses).get(editingId) ?? 0;
    if (input.amount < paid) throw new Error(`${formatINR(paid)} is already paid against this bill. The amount cannot be lower.`);
  }
  const number = input.billNumber.trim().toLowerCase();
  if (number) {
    const sameNumber = db.bills.find(
      (b) => b.id !== editingId && !b.voided && b.supplierId === input.supplierId && b.billNumber.trim().toLowerCase() === number,
    );
    if (sameNumber) throw new Error(`Bill number ${input.billNumber} from this supplier is already saved.`);
  }
}

const PAYMENT_FIELDS = ['kind', 'amount', 'date', 'mode', 'reference', 'note'] as const;
const EXPENSE_FIELDS = ['amount', 'date', 'category', 'supplierId', 'billId', 'paidTo', 'mode', 'invoiceRef', 'note'] as const;
const BILL_FIELDS = ['supplierId', 'category', 'billNumber', 'billDate', 'dueDate', 'amount', 'note'] as const;
const PROJECT_FIELDS = [
  'name',
  'clientName',
  'clientPhone',
  'clientEmail',
  'clientAddress',
  'location',
  'contractValue',
  'estimatedCost',
  'startDate',
  'expectedEndDate',
  'progress',
  'status',
] as const;

function stripOptions<T extends { requestId?: string; allowDuplicate?: boolean }>(input: T) {
  const { requestId: _r, allowDuplicate: _a, ...rest } = input;
  void _r;
  void _a;
  return rest;
}

function voidRecord(
  db: Db,
  user: DbUser,
  record: { id: string; projectId: string; voided: Payment['voided']; updatedAt: string },
  entity: AuditEntity,
  reason: string,
): void {
  requireText(reason, 'Please give a reason for voiding.');
  if (record.voided) throw new Error('This entry is already voided.');
  record.voided = { at: new Date().toISOString(), byName: user.name, reason: reason.trim() };
  record.updatedAt = record.voided.at;
  audit(db, user, { entity, entityId: record.id, projectId: record.projectId, action: 'voided', reason: reason.trim() });
}

export const api = {
  // ---------------- Session ----------------

  async me(): Promise<Session | null> {
    await wait(100);
    const userId = readSessionUserId();
    const db = loadDb();
    const user = db.users.find((u) => u.id === userId);
    return user ? toSession(db, user) : null;
  },

  async login(email: string, password: string): Promise<Session> {
    await wait();
    const db = loadDb();
    const user = db.users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
    );
    if (!user) throw new Error('Email or password is wrong. Please try again.');
    writeSessionUserId(user.id);
    return toSession(db, user);
  },

  async signup(input: SignupInput): Promise<Session> {
    await wait();
    const db = loadDb();
    const email = input.email.trim().toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      throw new Error('An account with this email already exists. Please log in.');
    }
    const company = { id: newId('c'), name: input.companyName.trim(), city: input.city.trim() };
    const user: DbUser = {
      id: newId('u'),
      companyId: company.id,
      name: input.name.trim(),
      email,
      password: input.password,
      role: 'owner',
    };
    db.companies.push(company);
    db.users.push(user);
    saveDb(db);
    writeSessionUserId(user.id);
    return toSession(db, user);
  },

  async logout(): Promise<void> {
    writeSessionUserId(null);
  },

  async resetDemoData(): Promise<void> {
    await wait();
    resetDb();
    writeSessionUserId(null);
  },

  // ---------------- Projects ----------------

  async listProjects(): Promise<Project[]> {
    await wait();
    const { db, user } = requireUser();
    return db.projects
      .filter((p) => p.companyId === user.companyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getProject(projectId: string): Promise<Project> {
    await wait();
    const { db, user } = requireUser();
    return requireProject(db, user.companyId, projectId);
  },

  async createProject(input: ProjectInput): Promise<Project> {
    await wait();
    const { db, user } = requireUser();
    validateProject(input);
    const now = new Date().toISOString();
    const project: Project = {
      ...input,
      name: input.name.trim(),
      clientName: input.clientName.trim(),
      location: input.location.trim(),
      categoryBudgets: {},
      progress: 0,
      id: newId('p'),
      companyId: user.companyId,
      status: 'ongoing',
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    db.projects.push(project);
    audit(db, user, { entity: 'project', entityId: project.id, projectId: project.id, action: 'created' });
    saveDb(db);
    return project;
  },

  async updateProject(projectId: string, update: ProjectUpdate): Promise<Project> {
    await wait();
    const { db, user } = requireOwner();
    const project = requireProject(db, user.companyId, projectId);
    if (update.estimatedCost !== undefined && update.estimatedCost !== project.estimatedCost) {
      throw new Error('Change the estimated cost with “Revise budget” so the change is recorded.');
    }
    const next = { ...project, ...update };
    validateProject(next);
    if (!Number.isInteger(next.progress) || next.progress < 0 || next.progress > 100) {
      throw new Error('Progress must be between 0 and 100.');
    }
    requireOneOf(next.status, PROJECT_STATUSES, 'status');
    const changes = diff(project, update, [...PROJECT_FIELDS]);
    if (changes.length === 0) return project;
    Object.assign(project, update, { updatedAt: new Date().toISOString() });
    audit(db, user, { entity: 'project', entityId: project.id, projectId: project.id, action: 'updated', changes });
    saveDb(db);
    return project;
  },

  async setProjectArchived(projectId: string, archived: boolean): Promise<Project> {
    await wait();
    const { db, user } = requireOwner();
    const project = requireProject(db, user.companyId, projectId);
    project.archived = archived;
    project.updatedAt = new Date().toISOString();
    audit(db, user, { entity: 'project', entityId: project.id, projectId: project.id, action: archived ? 'archived' : 'restored' });
    saveDb(db);
    return project;
  },

  /** Only projects with no money records can be deleted; others must be archived. */
  async deleteProject(projectId: string): Promise<void> {
    await wait();
    const { db, user } = requireOwner();
    requireProject(db, user.companyId, projectId);
    const hasRecords =
      db.payments.some((p) => p.projectId === projectId) ||
      db.expenses.some((e) => e.projectId === projectId) ||
      db.bills.some((b) => b.projectId === projectId);
    if (hasRecords) throw new Error('This project has money records, so it cannot be deleted. Archive it instead.');
    db.projects = db.projects.filter((p) => p.id !== projectId);
    db.installments = db.installments.filter((i) => i.projectId !== projectId);
    audit(db, user, { entity: 'project', entityId: projectId, projectId: null, action: 'deleted' });
    saveDb(db);
  },

  // ---------------- Budget ----------------

  async reviseBudget(
    projectId: string,
    revision: { estimatedCost: number; categoryBudgets: CategoryBudgets; reason: string },
  ): Promise<Project> {
    await wait();
    const { db, user } = requireOwner();
    const project = requireProject(db, user.companyId, projectId);
    requireAmount(revision.estimatedCost, 'the estimated cost');
    requireCategoryBudgets(revision.categoryBudgets);
    requireText(revision.reason, 'Please give a reason for this budget change.');
    const categoryBudgets = Object.fromEntries(
      Object.entries(revision.categoryBudgets).filter(([, v]) => v !== undefined && v > 0),
    ) as CategoryBudgets;
    const before = { estimatedCost: project.estimatedCost, categoryBudgets: project.categoryBudgets };
    const after = { estimatedCost: revision.estimatedCost, categoryBudgets };
    if (JSON.stringify(before) === JSON.stringify(after)) throw new Error('Nothing was changed.');
    db.budgetRevisions.push({
      id: newId('bud'),
      companyId: user.companyId,
      projectId,
      at: new Date().toISOString(),
      byName: user.name,
      reason: revision.reason.trim(),
      before,
      after,
    });
    Object.assign(project, after, { updatedAt: new Date().toISOString() });
    audit(db, user, {
      entity: 'project',
      entityId: project.id,
      projectId: project.id,
      action: 'updated',
      changes: [{ field: 'budget', from: formatINR(before.estimatedCost), to: formatINR(after.estimatedCost) }],
      reason: revision.reason.trim(),
    });
    saveDb(db);
    return project;
  },

  async listBudgetRevisions(projectId: string): Promise<BudgetRevision[]> {
    await wait();
    const { db, user } = requireUser();
    return db.budgetRevisions
      .filter((r) => r.companyId === user.companyId && r.projectId === projectId)
      .sort((a, b) => b.at.localeCompare(a.at));
  },

  // ---------------- Client payment schedule ----------------

  async listInstallments(projectId?: string): Promise<Installment[]> {
    await wait();
    const { db, user } = requireUser();
    return db.installments
      .filter((i) => i.companyId === user.companyId && (!projectId || i.projectId === projectId))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  },

  async addInstallment(input: InstallmentInput): Promise<Installment> {
    await wait();
    const { db, user } = requireOwner();
    requireProject(db, user.companyId, input.projectId);
    requireText(input.label, 'Please enter what this payment is for.');
    requireAmount(input.amount);
    requireDate(input.dueDate, 'due date');
    const installment: Installment = { ...input, label: input.label.trim(), id: newId('ins'), companyId: user.companyId };
    db.installments.push(installment);
    audit(db, user, { entity: 'installment', entityId: installment.id, projectId: input.projectId, action: 'created' });
    saveDb(db);
    return installment;
  },

  async deleteInstallment(installmentId: string): Promise<void> {
    await wait();
    const { db, user } = requireOwner();
    const installment = findOwn(db.installments, user.companyId, installmentId, 'scheduled payment');
    db.installments = db.installments.filter((i) => i.id !== installmentId);
    audit(db, user, {
      entity: 'installment',
      entityId: installmentId,
      projectId: installment.projectId,
      action: 'deleted',
      changes: [{ field: installment.label, from: formatINR(installment.amount), to: '—' }],
    });
    saveDb(db);
  },

  // ---------------- Client payments ----------------

  async listPayments(projectId?: string): Promise<Payment[]> {
    await wait();
    const { db, user } = requireUser();
    return db.payments
      .filter((p) => p.companyId === user.companyId && (!projectId || p.projectId === projectId))
      .sort(byDateDesc((p) => p.date));
  },

  async addPayment(input: PaymentInput): Promise<Payment> {
    await wait();
    const { db, user } = requireUser();
    const existing = alreadyCreated(db, db.payments, input.requestId);
    if (existing) return existing;
    checkPayment(db, user.companyId, input);
    const payment: Payment = {
      ...stripOptions(input),
      reference: input.reference.trim(),
      note: input.note.trim(),
      id: newId('pay'),
      ...stamp(user),
    };
    db.payments.push(payment);
    remember(db, input.requestId, payment.id);
    audit(db, user, { entity: 'payment', entityId: payment.id, projectId: payment.projectId, action: 'created' });
    saveDb(db);
    return payment;
  },

  async updatePayment(paymentId: string, input: PaymentInput, reason: string): Promise<Payment> {
    await wait();
    const { db, user } = requireOwner();
    const payment = findOwn(db.payments, user.companyId, paymentId, 'payment');
    if (payment.voided) throw new Error('A voided entry cannot be edited.');
    if (input.projectId !== payment.projectId) throw new Error('A payment cannot be moved to another project. Void it and add it again.');
    checkPayment(db, user.companyId, input, paymentId);
    const update = { ...stripOptions(input), reference: input.reference.trim(), note: input.note.trim() };
    const changes = diff(payment, update, [...PAYMENT_FIELDS]);
    if (changes.length === 0) return payment;
    Object.assign(payment, update, { updatedAt: new Date().toISOString() });
    audit(db, user, { entity: 'payment', entityId: payment.id, projectId: payment.projectId, action: 'updated', changes, reason: reason.trim() });
    saveDb(db);
    return payment;
  },

  async voidPayment(paymentId: string, reason: string): Promise<void> {
    await wait();
    const { db, user } = requireOwner();
    voidRecord(db, user, findOwn(db.payments, user.companyId, paymentId, 'payment'), 'payment', reason);
    saveDb(db);
  },

  // ---------------- Expenses (money paid out) ----------------

  async listExpenses(projectId?: string): Promise<Expense[]> {
    await wait();
    const { db, user } = requireUser();
    return db.expenses
      .filter((e) => e.companyId === user.companyId && (!projectId || e.projectId === projectId))
      .sort(byDateDesc((e) => e.date));
  },

  async addExpense(input: ExpenseInput): Promise<Expense> {
    await wait();
    const { db, user } = requireUser();
    const existing = alreadyCreated(db, db.expenses, input.requestId);
    if (existing) return existing;
    const linked = input.billId ? findOwn(db.bills, user.companyId, input.billId, 'bill') : null;
    const supplierId = linked ? linked.supplierId : input.supplierId;
    const normalized = { ...input, supplierId, category: linked ? linked.category : input.category };
    checkExpense(db, user.companyId, normalized);
    const supplier = supplierId ? db.suppliers.find((s) => s.id === supplierId) : undefined;
    const expense: Expense = {
      ...stripOptions(normalized),
      paidTo: supplier?.name ?? input.paidTo.trim(),
      invoiceRef: input.invoiceRef.trim(),
      note: input.note.trim(),
      id: newId('exp'),
      ...stamp(user),
    };
    db.expenses.push(expense);
    remember(db, input.requestId, expense.id);
    audit(db, user, { entity: 'expense', entityId: expense.id, projectId: expense.projectId, action: 'created' });
    saveDb(db);
    return expense;
  },

  async updateExpense(expenseId: string, input: ExpenseInput, reason: string): Promise<Expense> {
    await wait();
    const { db, user } = requireOwner();
    const expense = findOwn(db.expenses, user.companyId, expenseId, 'expense');
    if (expense.voided) throw new Error('A voided entry cannot be edited.');
    if (input.projectId !== expense.projectId) throw new Error('An expense cannot be moved to another project. Void it and add it again.');
    const linked = input.billId ? findOwn(db.bills, user.companyId, input.billId, 'bill') : null;
    const supplierId = linked ? linked.supplierId : input.supplierId;
    const normalized = { ...input, supplierId, category: linked ? linked.category : input.category };
    checkExpense(db, user.companyId, normalized, expenseId);
    const supplier = supplierId ? db.suppliers.find((s) => s.id === supplierId) : undefined;
    const update = {
      ...stripOptions(normalized),
      paidTo: supplier?.name ?? input.paidTo.trim(),
      invoiceRef: input.invoiceRef.trim(),
      note: input.note.trim(),
    };
    const changes = diff(expense, update, [...EXPENSE_FIELDS]);
    const attachmentsChanged = JSON.stringify(expense.attachments) !== JSON.stringify(update.attachments);
    if (attachmentsChanged) changes.push({ field: 'attachments', from: String(expense.attachments.length), to: String(update.attachments.length) });
    if (changes.length === 0) return expense;
    Object.assign(expense, update, { updatedAt: new Date().toISOString() });
    audit(db, user, { entity: 'expense', entityId: expense.id, projectId: expense.projectId, action: 'updated', changes, reason: reason.trim() });
    saveDb(db);
    return expense;
  },

  async voidExpense(expenseId: string, reason: string): Promise<void> {
    await wait();
    const { db, user } = requireOwner();
    voidRecord(db, user, findOwn(db.expenses, user.companyId, expenseId, 'expense'), 'expense', reason);
    saveDb(db);
  },

  // ---------------- Supplier bills (money owed) ----------------

  async listBills(projectId?: string): Promise<Bill[]> {
    await wait();
    const { db, user } = requireUser();
    return db.bills
      .filter((b) => b.companyId === user.companyId && (!projectId || b.projectId === projectId))
      .sort(byDateDesc((b) => b.billDate));
  },

  async addBill(input: BillInput): Promise<Bill> {
    await wait();
    const { db, user } = requireUser();
    const existing = alreadyCreated(db, db.bills, input.requestId);
    if (existing) return existing;
    checkBill(db, user.companyId, input);
    const bill: Bill = {
      ...stripOptions(input),
      billNumber: input.billNumber.trim(),
      note: input.note.trim(),
      id: newId('bill'),
      ...stamp(user),
    };
    db.bills.push(bill);
    remember(db, input.requestId, bill.id);
    audit(db, user, { entity: 'bill', entityId: bill.id, projectId: bill.projectId, action: 'created' });
    saveDb(db);
    return bill;
  },

  async updateBill(billId: string, input: BillInput, reason: string): Promise<Bill> {
    await wait();
    const { db, user } = requireOwner();
    const bill = findOwn(db.bills, user.companyId, billId, 'bill');
    if (bill.voided) throw new Error('A voided bill cannot be edited.');
    if (input.projectId !== bill.projectId) throw new Error('A bill cannot be moved to another project. Void it and add it again.');
    if (input.supplierId !== bill.supplierId && db.expenses.some((e) => e.billId === billId && !e.voided)) {
      throw new Error('Payments are linked to this bill, so its supplier cannot be changed.');
    }
    checkBill(db, user.companyId, input, billId);
    const update = { ...stripOptions(input), billNumber: input.billNumber.trim(), note: input.note.trim() };
    const changes = diff(bill, update, [...BILL_FIELDS]);
    if (JSON.stringify(bill.attachments) !== JSON.stringify(update.attachments)) {
      changes.push({ field: 'attachments', from: String(bill.attachments.length), to: String(update.attachments.length) });
    }
    if (changes.length === 0) return bill;
    Object.assign(bill, update, { updatedAt: new Date().toISOString() });
    // Linked payments follow the bill's category so costs are reported in one place.
    for (const e of db.expenses) if (e.billId === billId) e.category = bill.category;
    audit(db, user, { entity: 'bill', entityId: bill.id, projectId: bill.projectId, action: 'updated', changes, reason: reason.trim() });
    saveDb(db);
    return bill;
  },

  async voidBill(billId: string, reason: string): Promise<void> {
    await wait();
    const { db, user } = requireOwner();
    const bill = findOwn(db.bills, user.companyId, billId, 'bill');
    if (db.expenses.some((e) => e.billId === billId && !e.voided)) {
      throw new Error('Payments are linked to this bill. Void those payments first.');
    }
    voidRecord(db, user, bill, 'bill', reason);
    saveDb(db);
  },

  // ---------------- Suppliers ----------------

  async listSuppliers(): Promise<Supplier[]> {
    await wait();
    const { db, user } = requireUser();
    return db.suppliers.filter((s) => s.companyId === user.companyId).sort((a, b) => a.name.localeCompare(b.name));
  },

  async addSupplier(input: SupplierInput): Promise<Supplier> {
    await wait();
    const { db, user } = requireUser();
    requireText(input.name, 'Please enter the supplier name.');
    requireOneOf(input.type, SUPPLIER_TYPES, 'supplier type');
    requirePhone(input.phone);
    const name = input.name.trim();
    if (db.suppliers.some((s) => s.companyId === user.companyId && s.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`${name} is already in your supplier list.`);
    }
    const supplier: Supplier = {
      ...input,
      name,
      phone: input.phone.trim(),
      note: input.note.trim(),
      id: newId('s'),
      companyId: user.companyId,
      archived: false,
      createdAt: new Date().toISOString(),
    };
    db.suppliers.push(supplier);
    audit(db, user, { entity: 'supplier', entityId: supplier.id, projectId: null, action: 'created' });
    saveDb(db);
    return supplier;
  },

  async updateSupplier(supplierId: string, input: SupplierInput): Promise<Supplier> {
    await wait();
    const { db, user } = requireUser();
    const supplier = findOwn(db.suppliers, user.companyId, supplierId, 'supplier');
    requireText(input.name, 'Please enter the supplier name.');
    requireOneOf(input.type, SUPPLIER_TYPES, 'supplier type');
    requirePhone(input.phone);
    const update = { ...input, name: input.name.trim(), phone: input.phone.trim(), note: input.note.trim() };
    if (
      db.suppliers.some((s) => s.id !== supplierId && s.companyId === user.companyId && s.name.toLowerCase() === update.name.toLowerCase())
    ) {
      throw new Error(`${update.name} is already in your supplier list.`);
    }
    const changes = diff(supplier, update, ['name', 'type', 'phone', 'note']);
    if (changes.length === 0) return supplier;
    Object.assign(supplier, update);
    // Keep the payee name on past payments in step with the supplier record.
    for (const e of db.expenses) if (e.supplierId === supplierId) e.paidTo = supplier.name;
    audit(db, user, { entity: 'supplier', entityId: supplier.id, projectId: null, action: 'updated', changes });
    saveDb(db);
    return supplier;
  },

  /** Archived suppliers drop out of the pickers; their bills and payments stay. */
  async setSupplierArchived(supplierId: string, archived: boolean): Promise<Supplier> {
    await wait();
    const { db, user } = requireOwner();
    const supplier = findOwn(db.suppliers, user.companyId, supplierId, 'supplier');
    if (supplier.archived === archived) return supplier;
    if (archived) {
      const paidByBill = billPayments(db.bills, db.expenses);
      const unpaid = db.bills.filter((b) => b.supplierId === supplierId).reduce((t, b) => t + billOutstanding(b, paidByBill), 0);
      if (unpaid > 0) throw new Error(`${formatINR(unpaid)} is still unpaid to ${supplier.name}. Pay or void those bills before archiving.`);
    }
    supplier.archived = archived;
    audit(db, user, { entity: 'supplier', entityId: supplier.id, projectId: null, action: archived ? 'archived' : 'restored' });
    saveDb(db);
    return supplier;
  },

  // ---------------- Audit trail ----------------

  async listAudit(filter: { projectId?: string; entityId?: string }): Promise<AuditEvent[]> {
    await wait(100);
    const { db, user } = requireUser();
    return db.audit
      .filter(
        (a) =>
          a.companyId === user.companyId &&
          (!filter.projectId || a.projectId === filter.projectId) &&
          (!filter.entityId || a.entityId === filter.entityId),
      )
      .sort((a, b) => b.at.localeCompare(a.at));
  },
};
