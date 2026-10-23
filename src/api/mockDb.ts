// A pretend database stored in the browser (localStorage).
// It will be deleted once the real Node + PostgreSQL backend is ready.
import { toISODate } from '../lib/format';
import type {
  AuditEvent,
  Bill,
  BudgetRevision,
  Company,
  Expense,
  ExpenseCategory,
  Installment,
  Payment,
  PaymentKind,
  PaymentMode,
  Project,
  ProjectStatus,
  Supplier,
  SupplierType,
  User,
} from '../types';

export interface DbUser extends User {
  password: string;
}

export interface Db {
  version: 2;
  companies: Company[];
  users: DbUser[];
  projects: Project[];
  payments: Payment[];
  expenses: Expense[];
  suppliers: Supplier[];
  bills: Bill[];
  installments: Installment[];
  budgetRevisions: BudgetRevision[];
  audit: AuditEvent[];
  /** requestId → id of the record it created, so a repeated submit returns the same record. */
  requests: Record<string, string>;
}

const DB_KEY = 'buildledger-db-v2';
const OLD_DB_KEY = 'buildledger-db-v1';

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function loadDb(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw) as Db;
    const old = localStorage.getItem(OLD_DB_KEY);
    if (old) {
      const db = migrateV1(JSON.parse(old));
      saveDb(db);
      return db;
    }
  } catch {
    // Storage blocked or corrupted: fall back to fresh demo data.
  }
  const db = seed();
  saveDb(db);
  return db;
}

export function saveDb(db: Db): void {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // Ignore: data simply won't survive a page reload.
  }
}

export function resetDb(): void {
  saveDb(seed());
}

/** Data saved by the first version: same records, fewer fields. */
interface DbV1 {
  companies: Company[];
  users: DbUser[];
  projects: Omit<Project, 'clientEmail' | 'clientAddress' | 'categoryBudgets' | 'expectedEndDate' | 'progress' | 'archived' | 'updatedAt'>[];
  payments: Omit<Payment, 'kind' | 'reference' | 'voided' | 'createdById' | 'updatedAt'>[];
  expenses: (Omit<Expense, 'supplierId' | 'billId' | 'invoiceRef' | 'attachments' | 'voided' | 'createdById' | 'updatedAt' | 'category'> & {
    category: string;
  })[];
}

/** Upgrades data saved by the first version, keeping everything the user entered. */
function migrateV1(old: DbV1): Db {
  const now = new Date().toISOString();
  const userIdByName = new Map<string, string>(old.users.map((u) => [u.name, u.id]));
  return {
    version: 2,
    companies: old.companies,
    users: old.users,
    projects: old.projects.map((p) => ({
      ...p,
      clientEmail: '',
      clientAddress: '',
      categoryBudgets: {},
      expectedEndDate: '',
      progress: p.status === 'completed' ? 100 : 0,
      archived: false,
      updatedAt: p.createdAt,
    })),
    payments: old.payments.map((p) => ({
      ...p,
      kind: 'installment' as const,
      reference: '',
      voided: null,
      createdById: userIdByName.get(p.createdBy) ?? '',
      updatedAt: p.createdAt ?? now,
    })),
    // Every v1 category still exists in v2.
    expenses: old.expenses.map((e) => ({
      ...e,
      category: e.category as ExpenseCategory,
      supplierId: null,
      billId: null,
      invoiceRef: '',
      attachments: [],
      voided: null,
      createdById: userIdByName.get(e.createdBy) ?? '',
      updatedAt: e.createdAt ?? now,
    })),
    suppliers: [],
    bills: [],
    installments: [],
    budgetRevisions: [],
    audit: [],
    requests: {},
  };
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toISODate(date);
}

function seed(): Db {
  const companies: Company[] = [
    { id: 'c_abc', name: 'ABC Constructions', city: 'Kochi' },
    { id: 'c_sky', name: 'Skyline Builders', city: 'Thrissur' },
  ];

  const users: DbUser[] = [
    { id: 'u_ravi', companyId: 'c_abc', name: 'Ravi Kumar', email: 'demo@abc.com', password: 'demo123', role: 'owner' },
    { id: 'u_suresh', companyId: 'c_abc', name: 'Suresh P', email: 'suresh@abc.com', password: 'demo123', role: 'staff' },
    { id: 'u_anil', companyId: 'c_sky', name: 'Anil Varghese', email: 'demo@skyline.com', password: 'demo123', role: 'owner' },
  ];
  const userId = (name: string) => users.find((u) => u.name === name)!.id;

  const project = (
    id: string,
    companyId: string,
    name: string,
    clientName: string,
    clientPhone: string,
    location: string,
    contractValue: number,
    estimatedCost: number,
    startedDaysAgo: number,
    endsInDays: number,
    progress: number,
    status: ProjectStatus,
    categoryBudgets: Project['categoryBudgets'] = {},
  ): Project => ({
    id,
    companyId,
    name,
    clientName,
    clientPhone,
    clientEmail: '',
    clientAddress: '',
    location,
    contractValue,
    estimatedCost,
    categoryBudgets,
    startDate: daysAgo(startedDaysAgo),
    expectedEndDate: daysAgo(-endsInDays),
    progress,
    status,
    archived: false,
    createdAt: `${daysAgo(startedDaysAgo)}T09:00:00`,
    updatedAt: `${daysAgo(startedDaysAgo)}T09:00:00`,
  });

  const projects: Project[] = [
    project('p_aluva', 'c_abc', 'House – Aluva', 'Thomas Mathew', '9846098460', 'Aluva, Ernakulam', 42_00_000, 34_00_000, 30, 300, 10, 'ongoing', {
      materials: 15_00_000,
      labour: 9_00_000,
      electrical: 3_00_000,
      plumbing: 2_50_000,
    }),
    project('p_villa', 'c_abc', 'Villa – Kakkanad', 'Rajesh Menon', '9847012345', 'Kakkanad, Kochi', 85_00_000, 68_00_000, 180, 120, 65, 'ongoing', {
      materials: 26_00_000,
      labour: 18_00_000,
      equipment: 3_00_000,
      transport: 2_00_000,
      electrical: 6_00_000,
      plumbing: 5_00_000,
      permits: 1_00_000,
    }),
    project('p_mall', 'c_abc', 'Commercial Complex – Edappally', 'Sunrise Traders', '9895011223', 'Edappally, Kochi', 2_40_00_000, 1_95_00_000, 310, 150, 70, 'ongoing', {
      materials: 95_00_000,
      labour: 55_00_000,
      equipment: 10_00_000,
      electrical: 15_00_000,
      plumbing: 10_00_000,
    }),
    project('p_reno', 'c_abc', 'Apartment Renovation – Vyttila', 'Anita Joseph', '9744556677', 'Vyttila, Kochi', 18_50_000, 14_00_000, 150, -40, 100, 'completed'),
    project('p_office', 'c_sky', 'Office Interior – Infopark', 'TechNova Solutions', '9633221100', 'Infopark, Kochi', 32_00_000, 25_00_000, 70, 60, 40, 'ongoing'),
  ];

  const companyOf = (projectId: string) => projects.find((p) => p.id === projectId)!.companyId;

  const suppliers: Supplier[] = [];
  const supplier = (id: string, companyId: string, name: string, type: SupplierType, phone: string) =>
    suppliers.push({ id, companyId, name, type, phone, note: '', archived: false, createdAt: `${daysAgo(320)}T09:00:00` });
  supplier('s_kcs', 'c_abc', 'Kerala Cements & Steel', 'supplier', '9847100200');
  supplier('s_babu', 'c_abc', 'Babu – Mason team', 'labour', '9846500600');
  supplier('s_joseph', 'c_abc', 'Joseph – Labour contractor', 'subcontractor', '9895300400');
  supplier('s_jcb', 'c_abc', 'JCB & Crane Rentals', 'supplier', '9744200300');
  supplier('s_malabar', 'c_abc', 'Malabar Bricks', 'supplier', '9633400500');
  supplier('s_aqua', 'c_abc', 'AquaFlow Plumbing', 'subcontractor', '9847600700');
  supplier('s_bright', 'c_abc', 'Bright Electricals', 'subcontractor', '9846700800');
  supplier('s_sree', 'c_abc', 'Sree Transports', 'supplier', '9895800900');
  supplier('s_decor', 'c_abc', 'Home Decor Mart', 'supplier', '9744900100');
  supplier('s_interior', 'c_sky', 'Interior World', 'supplier', '9633111222');
  supplier('s_carp', 'c_sky', 'Carpentry team', 'labour', '9633333444');
  const supplierByName = (companyId: string, name: string) =>
    suppliers.find((s) => s.companyId === companyId && s.name === name)?.id ?? null;

  const payments: Payment[] = [];
  const expenses: Expense[] = [];
  const bills: Bill[] = [];
  const installments: Installment[] = [];

  const pay = (projectId: string, amount: number, ago: number, mode: PaymentMode, note: string, by: string, kind: PaymentKind = 'installment', reference = '') =>
    payments.push({
      id: newId('pay'),
      companyId: companyOf(projectId),
      projectId,
      kind,
      amount,
      date: daysAgo(ago),
      mode,
      reference,
      note,
      voided: null,
      createdBy: by,
      createdById: userId(by),
      createdAt: `${daysAgo(ago)}T11:00:00`,
      updatedAt: `${daysAgo(ago)}T11:00:00`,
    });

  const spend = (
    projectId: string,
    category: ExpenseCategory,
    amount: number,
    ago: number,
    paidTo: string,
    mode: PaymentMode,
    note: string,
    by: string,
    billId: string | null = null,
  ) =>
    expenses.push({
      id: newId('exp'),
      companyId: companyOf(projectId),
      projectId,
      amount,
      date: daysAgo(ago),
      category,
      supplierId: supplierByName(companyOf(projectId), paidTo),
      billId,
      paidTo,
      mode,
      invoiceRef: '',
      note,
      attachments: [],
      voided: null,
      createdBy: by,
      createdById: userId(by),
      createdAt: `${daysAgo(ago)}T15:00:00`,
      updatedAt: `${daysAgo(ago)}T15:00:00`,
    });

  const bill = (id: string, projectId: string, supplierName: string, category: ExpenseCategory, amount: number, ago: number, dueInDays: number, billNumber: string, note: string) =>
    bills.push({
      id,
      companyId: companyOf(projectId),
      projectId,
      supplierId: supplierByName(companyOf(projectId), supplierName)!,
      category,
      billNumber,
      billDate: daysAgo(ago),
      dueDate: daysAgo(ago - dueInDays),
      amount,
      note,
      attachments: [],
      voided: null,
      createdBy: 'Ravi Kumar',
      createdById: 'u_ravi',
      createdAt: `${daysAgo(ago)}T10:00:00`,
      updatedAt: `${daysAgo(ago)}T10:00:00`,
    });

  const schedule = (projectId: string, label: string, amount: number, dueAgo: number) =>
    installments.push({ id: newId('ins'), companyId: companyOf(projectId), projectId, label, amount, dueDate: daysAgo(dueAgo) });

  // Villa – Kakkanad: healthy project
  pay('p_villa', 15_00_000, 170, 'bank', 'Advance payment', 'Ravi Kumar', 'advance', 'NEFT 88231');
  pay('p_villa', 15_00_000, 120, 'bank', 'Foundation completed', 'Ravi Kumar');
  pay('p_villa', 12_00_000, 70, 'cheque', 'Ground floor slab', 'Ravi Kumar', 'installment', 'Chq 004512');
  pay('p_villa', 10_00_000, 20, 'upi', 'First floor slab', 'Ravi Kumar');
  schedule('p_villa', 'Advance', 15_00_000, 175);
  schedule('p_villa', 'Foundation', 15_00_000, 125);
  schedule('p_villa', 'Ground floor slab', 12_00_000, 75);
  schedule('p_villa', 'First floor slab', 10_00_000, 25);
  schedule('p_villa', 'Plastering', 15_00_000, -30);
  schedule('p_villa', 'Handover', 18_00_000, -120);
  spend('p_villa', 'materials', 6_50_000, 165, 'Kerala Cements & Steel', 'bank', 'Cement and steel for foundation', 'Ravi Kumar');
  spend('p_villa', 'labour', 3_80_000, 150, 'Babu – Mason team', 'cash', 'Foundation labour', 'Suresh P');
  spend('p_villa', 'materials', 4_80_000, 118, 'Kerala Cements & Steel', 'bank', 'Steel rods', 'Ravi Kumar');
  spend('p_villa', 'labour', 4_20_000, 100, 'Babu – Mason team', 'cash', 'Ground floor labour', 'Suresh P');
  spend('p_villa', 'equipment', 2_40_000, 90, 'JCB & Crane Rentals', 'bank', 'Excavation and concrete mixer rent', 'Ravi Kumar');
  spend('p_villa', 'materials', 5_60_000, 75, 'Malabar Bricks', 'bank', 'Bricks and blocks', 'Ravi Kumar');
  spend('p_villa', 'transport', 1_30_000, 60, 'Sree Transports', 'cash', 'Material transport', 'Suresh P');
  spend('p_villa', 'labour', 3_60_000, 50, 'Babu – Mason team', 'cash', 'First floor labour', 'Suresh P');
  spend('p_villa', 'plumbing', 2_85_000, 40, 'AquaFlow Plumbing', 'bank', 'Pipes and fittings', 'Ravi Kumar');
  bill('b_villa_elec', 'p_villa', 'Bright Electricals', 'electrical', 4_50_000, 35, 30, 'BE/2026/118', 'Conduits and wiring – stage 1');
  spend('p_villa', 'electrical', 3_20_000, 30, 'Bright Electricals', 'upi', 'Part payment – wiring stage 1', 'Ravi Kumar', 'b_villa_elec');
  spend('p_villa', 'materials', 5_50_000, 25, 'Kerala Cements & Steel', 'upi', 'Cement for first floor slab', 'Ravi Kumar');
  spend('p_villa', 'permits', 50_000, 12, 'Panchayat office', 'bank', 'Permit and approval fees', 'Ravi Kumar');
  spend('p_villa', 'labour', 2_50_000, 8, 'Babu – Mason team', 'cash', 'Weekly wages', 'Suresh P');

  // Commercial Complex – Edappally: over budget, spent more than received, client payment overdue
  pay('p_mall', 50_00_000, 300, 'bank', 'Advance payment', 'Ravi Kumar', 'advance');
  pay('p_mall', 40_00_000, 220, 'bank', 'Basement completed', 'Ravi Kumar');
  pay('p_mall', 40_00_000, 130, 'bank', 'Second floor slab', 'Ravi Kumar');
  pay('p_mall', 30_00_000, 45, 'cheque', 'Fourth floor slab', 'Ravi Kumar');
  schedule('p_mall', 'Advance', 50_00_000, 305);
  schedule('p_mall', 'Basement', 40_00_000, 225);
  schedule('p_mall', 'Second floor slab', 40_00_000, 135);
  schedule('p_mall', 'Fourth floor slab', 30_00_000, 50);
  schedule('p_mall', 'Roof slab', 40_00_000, 10);
  schedule('p_mall', 'Finishing', 40_00_000, -60);
  spend('p_mall', 'materials', 40_00_000, 280, 'Kerala Cements & Steel', 'bank', 'Basement materials', 'Ravi Kumar');
  spend('p_mall', 'labour', 22_00_000, 250, 'Joseph – Labour contractor', 'bank', 'Basement and ground floor labour', 'Ravi Kumar');
  spend('p_mall', 'equipment', 7_40_000, 200, 'JCB & Crane Rentals', 'bank', 'Tower crane rent', 'Ravi Kumar');
  spend('p_mall', 'materials', 35_00_000, 180, 'Kerala Cements & Steel', 'bank', 'Steel price increase', 'Ravi Kumar');
  spend('p_mall', 'labour', 20_00_000, 150, 'Joseph – Labour contractor', 'bank', 'Floors 1–3 labour', 'Ravi Kumar');
  spend('p_mall', 'materials', 30_00_000, 60, 'Kerala Cements & Steel', 'bank', 'Floors 4–5 materials', 'Ravi Kumar');
  spend('p_mall', 'plumbing', 9_50_000, 50, 'AquaFlow Plumbing', 'bank', 'Plumbing – all floors', 'Ravi Kumar');
  spend('p_mall', 'electrical', 14_00_000, 40, 'Bright Electricals', 'bank', 'Electrical – all floors', 'Ravi Kumar');
  spend('p_mall', 'labour', 20_00_000, 30, 'Joseph – Labour contractor', 'bank', 'Floors 4–5 labour', 'Ravi Kumar');
  spend('p_mall', 'transport', 3_50_000, 15, 'Sree Transports', 'cash', 'Material transport', 'Suresh P');
  bill('b_mall_steel', 'p_mall', 'Kerala Cements & Steel', 'materials', 6_00_000, 20, 15, 'KCS/7781', 'Roof slab steel – on credit');

  // Apartment Renovation – Vyttila: completed and fully paid
  pay('p_reno', 9_00_000, 140, 'bank', 'Advance payment', 'Ravi Kumar', 'advance');
  pay('p_reno', 9_50_000, 60, 'bank', 'Final payment', 'Ravi Kumar', 'final');
  spend('p_reno', 'materials', 6_20_000, 130, 'Home Decor Mart', 'bank', 'Tiles, paint and fittings', 'Ravi Kumar');
  spend('p_reno', 'labour', 4_50_000, 100, 'Babu – Mason team', 'cash', 'Renovation labour', 'Suresh P');
  spend('p_reno', 'electrical', 1_30_000, 90, 'Bright Electricals', 'upi', 'Rewiring', 'Ravi Kumar');
  spend('p_reno', 'plumbing', 1_20_000, 80, 'AquaFlow Plumbing', 'upi', 'Bathroom plumbing', 'Ravi Kumar');

  // House – Aluva: just started
  pay('p_aluva', 8_00_000, 28, 'bank', 'Advance payment', 'Ravi Kumar', 'advance');
  schedule('p_aluva', 'Advance', 8_00_000, 30);
  schedule('p_aluva', 'Foundation', 8_00_000, -20);
  schedule('p_aluva', 'Ground floor slab', 10_00_000, -90);
  spend('p_aluva', 'materials', 2_40_000, 20, 'Kerala Cements & Steel', 'upi', 'Foundation materials', 'Ravi Kumar');
  spend('p_aluva', 'labour', 1_20_000, 10, 'Babu – Mason team', 'cash', 'Foundation labour', 'Suresh P');
  spend('p_aluva', 'labour', 20_000, 3, 'Babu – Mason team', 'cash', 'Advance to mason team', 'Suresh P');

  // Skyline Builders (a different company — must never appear for ABC users)
  pay('p_office', 10_00_000, 60, 'bank', 'Advance payment', 'Anil Varghese', 'advance');
  spend('p_office', 'materials', 4_50_000, 50, 'Interior World', 'bank', 'Plywood and glass', 'Anil Varghese');
  spend('p_office', 'labour', 3_00_000, 20, 'Carpentry team', 'cash', 'Carpentry work', 'Anil Varghese');

  return {
    version: 2,
    companies,
    users,
    projects,
    payments,
    expenses,
    suppliers,
    bills,
    installments,
    budgetRevisions: [],
    audit: [],
    requests: {},
  };
}
