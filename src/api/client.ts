// The only file the UI talks to for data. Every function calls the Node backend,
// which checks who is logged in, only touches that user's company, and validates input.
import { resetDb } from './mockDb';
import { DuplicateError, NotFoundError } from '../lib/errors';
import type {
  AuditEvent,
  Bill,
  BillInput,
  BudgetRevision,
  CategoryBudgets,
  Expense,
  ExpenseInput,
  Installment,
  InstallmentInput,
  InviteDetails,
  InviteInput,
  PendingInvite,
  Payment,
  PaymentInput,
  Project,
  ProjectInput,
  ProjectUpdate,
  Session,
  SignupInput,
  Supplier,
  SupplierInput,
  Team,
  TeamMember,
} from '../types';

/** Requests go through the Vite proxy (see vite.config.ts) to the Node backend. */
const API_URL = '/api';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new Error('Cannot reach the server. Please check your internet connection and try again.');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string; code?: string } | null;
    const message = body?.message ?? 'Something went wrong. Please try again.';
    if (res.status === 404) throw new NotFoundError(message);
    if (body?.code === 'DUPLICATE') throw new DuplicateError(message);
    throw new Error(message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  // ---------------- Session ----------------

  async me(): Promise<Session | null> {
    try {
      return await request<Session>('/auth/me');
    } catch {
      return null;
    }
  },

  login(email: string, password: string): Promise<Session> {
    return request<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  },

  signup(input: SignupInput): Promise<Session> {
    return request<Session>('/auth/signup', { method: 'POST', body: JSON.stringify(input) });
  },

  async logout(): Promise<void> {
    await request<void>('/auth/logout', { method: 'POST' });
  },

  // ---------------- Team ----------------

  listTeam(): Promise<Team> {
    return request<Team>('/team');
  },

  /** Returns the one-time join link; the owner shares it (WhatsApp, email…). */
  inviteMember(input: InviteInput): Promise<{ invite: PendingInvite; link: string }> {
    return request('/team/invites', { method: 'POST', body: JSON.stringify(input) });
  },

  revokeInvite(inviteId: string): Promise<void> {
    return request<void>(`/team/invites/${inviteId}`, { method: 'DELETE' });
  },

  changeMemberRole(userId: string, role: PendingInvite['role']): Promise<TeamMember> {
    return request<TeamMember>(`/team/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) });
  },

  removeMember(userId: string): Promise<void> {
    return request<void>(`/team/members/${userId}`, { method: 'DELETE' });
  },

  getInvite(token: string): Promise<InviteDetails> {
    return request<InviteDetails>(`/invites/${encodeURIComponent(token)}`);
  },

  acceptInvite(token: string, password: string): Promise<Session> {
    return request<Session>(`/invites/${encodeURIComponent(token)}/accept`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  /** Clears the old browser-only demo data. Nothing reads it any more; removed in the next step. */
  async resetDemoData(): Promise<void> {
    resetDb();
  },

  // ---------------- Projects ----------------

  listProjects(): Promise<Project[]> {
    return request<Project[]>('/projects');
  },

  getProject(projectId: string): Promise<Project> {
    return request<Project>(`/projects/${projectId}`);
  },

  createProject(input: ProjectInput): Promise<Project> {
    return request<Project>('/projects', { method: 'POST', body: JSON.stringify(input) });
  },

  updateProject(projectId: string, update: ProjectUpdate): Promise<Project> {
    return request<Project>(`/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify(update) });
  },

  setProjectArchived(projectId: string, archived: boolean): Promise<Project> {
    return request<Project>(`/projects/${projectId}/archive`, { method: 'POST', body: JSON.stringify({ archived }) });
  },

  /** Only projects with no money records can be deleted; others must be archived. */
  async deleteProject(projectId: string): Promise<void> {
    await request<void>(`/projects/${projectId}`, { method: 'DELETE' });
  },

  // ---------------- Budget ----------------

  reviseBudget(
    projectId: string,
    revision: { estimatedCost: number; categoryBudgets: CategoryBudgets; reason: string },
  ): Promise<Project> {
    return request<Project>(`/projects/${projectId}/budget`, { method: 'POST', body: JSON.stringify(revision) });
  },

  listBudgetRevisions(projectId: string): Promise<BudgetRevision[]> {
    return request<BudgetRevision[]>(`/projects/${projectId}/budget-revisions`);
  },

  // ---------------- Client payment schedule ----------------

  listInstallments(projectId?: string): Promise<Installment[]> {
    return request<Installment[]>(projectId ? `/installments?projectId=${encodeURIComponent(projectId)}` : '/installments');
  },

  addInstallment(input: InstallmentInput): Promise<Installment> {
    return request<Installment>('/installments', { method: 'POST', body: JSON.stringify(input) });
  },

  async deleteInstallment(installmentId: string): Promise<void> {
    await request<void>(`/installments/${installmentId}`, { method: 'DELETE' });
  },

  // ---------------- Client payments ----------------

  listPayments(projectId?: string): Promise<Payment[]> {
    return request<Payment[]>(projectId ? `/payments?projectId=${encodeURIComponent(projectId)}` : '/payments');
  },

  addPayment(input: PaymentInput): Promise<Payment> {
    return request<Payment>('/payments', { method: 'POST', body: JSON.stringify(input) });
  },

  updatePayment(paymentId: string, input: PaymentInput, reason: string): Promise<Payment> {
    const { requestId: _requestId, ...rest } = input;
    void _requestId;
    return request<Payment>(`/payments/${paymentId}`, { method: 'PUT', body: JSON.stringify({ ...rest, reason }) });
  },

  async voidPayment(paymentId: string, reason: string): Promise<void> {
    await request<void>(`/payments/${paymentId}/void`, { method: 'POST', body: JSON.stringify({ reason }) });
  },

  // ---------------- Expenses: money paid out ----------------

  listExpenses(projectId?: string): Promise<Expense[]> {
    return request<Expense[]>(projectId ? `/expenses?projectId=${encodeURIComponent(projectId)}` : '/expenses');
  },

  addExpense(input: ExpenseInput): Promise<Expense> {
    return request<Expense>('/expenses', { method: 'POST', body: JSON.stringify(input) });
  },

  updateExpense(expenseId: string, input: ExpenseInput, reason: string): Promise<Expense> {
    const { requestId: _requestId, ...rest } = input;
    void _requestId;
    return request<Expense>(`/expenses/${expenseId}`, { method: 'PUT', body: JSON.stringify({ ...rest, reason }) });
  },

  async voidExpense(expenseId: string, reason: string): Promise<void> {
    await request<void>(`/expenses/${expenseId}/void`, { method: 'POST', body: JSON.stringify({ reason }) });
  },

  // ---------------- Supplier bills ----------------

  listBills(projectId?: string): Promise<Bill[]> {
    return request<Bill[]>(projectId ? `/bills?projectId=${encodeURIComponent(projectId)}` : '/bills');
  },

  addBill(input: BillInput): Promise<Bill> {
    return request<Bill>('/bills', { method: 'POST', body: JSON.stringify(input) });
  },

  updateBill(billId: string, input: BillInput, reason: string): Promise<Bill> {
    const { requestId: _requestId, ...rest } = input;
    void _requestId;
    return request<Bill>(`/bills/${billId}`, { method: 'PUT', body: JSON.stringify({ ...rest, reason }) });
  },

  async voidBill(billId: string, reason: string): Promise<void> {
    await request<void>(`/bills/${billId}/void`, { method: 'POST', body: JSON.stringify({ reason }) });
  },

  // ---------------- Suppliers ----------------

  listSuppliers(): Promise<Supplier[]> {
    return request<Supplier[]>('/suppliers');
  },

  addSupplier(input: SupplierInput): Promise<Supplier> {
    return request<Supplier>('/suppliers', { method: 'POST', body: JSON.stringify(input) });
  },

  updateSupplier(supplierId: string, input: SupplierInput): Promise<Supplier> {
    return request<Supplier>(`/suppliers/${supplierId}`, { method: 'PUT', body: JSON.stringify(input) });
  },

  /** Archived suppliers drop out of the pickers; their bills and payments stay. */
  setSupplierArchived(supplierId: string, archived: boolean): Promise<Supplier> {
    return request<Supplier>(`/suppliers/${supplierId}/archive`, { method: 'POST', body: JSON.stringify({ archived }) });
  },

  // ---------------- Audit trail ----------------

  listAudit(filter: { projectId?: string; entityId?: string }): Promise<AuditEvent[]> {
    const query = new URLSearchParams();
    if (filter.projectId) query.set('projectId', filter.projectId);
    if (filter.entityId) query.set('entityId', filter.entityId);
    return request<AuditEvent[]>(`/audit?${query}`);
  },
};
