// React Query hooks: loading, caching and refreshing data after changes.
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { summarizeProject, type FinanceRecords, type ProjectSummary } from '../lib/calc';
import { isNotFoundError } from '../lib/errors';
import { todayISO } from '../lib/format';
import type { Project, Supplier } from '../types';

// Never retry "not found": it will not appear by asking again.
const retry = (count: number, error: unknown) => !isNotFoundError(error) && count < 1;

export function useProjects() {
  return useQuery({ queryKey: ['projects'], queryFn: api.listProjects, retry });
}

export function useProject(projectId: string, enabled = true) {
  return useQuery({ queryKey: ['projects', projectId], queryFn: () => api.getProject(projectId), retry, enabled });
}

export function useSuppliers() {
  return useQuery({ queryKey: ['suppliers'], queryFn: api.listSuppliers });
}

export function useBudgetRevisions(projectId: string) {
  return useQuery({ queryKey: ['budgetRevisions', projectId], queryFn: () => api.listBudgetRevisions(projectId) });
}

export function useTeam() {
  return useQuery({ queryKey: ['team'], queryFn: api.listTeam });
}

export function useAudit(filter: { projectId?: string; entityId?: string }, enabled = true) {
  return useQuery({ queryKey: ['audit', filter], queryFn: () => api.listAudit(filter), enabled });
}

export interface FinanceData extends FinanceRecords {
  projects: Project[];
  suppliers: Supplier[];
}

/**
 * Every money record of the company. Dashboard, project pages and reports all read from here
 * and use the same calculations, so their totals always agree.
 */
export function useFinance() {
  const queries = [
    useProjects(),
    useQuery({ queryKey: ['payments'], queryFn: () => api.listPayments() }),
    useQuery({ queryKey: ['expenses'], queryFn: () => api.listExpenses() }),
    useQuery({ queryKey: ['bills'], queryFn: () => api.listBills() }),
    useQuery({ queryKey: ['installments'], queryFn: () => api.listInstallments() }),
    useSuppliers(),
  ] as const;
  const [projects, payments, expenses, bills, installments, suppliers] = queries;

  const data = useMemo<FinanceData | undefined>(() => {
    if (!projects.data || !payments.data || !expenses.data || !bills.data || !installments.data || !suppliers.data) {
      return undefined;
    }
    return {
      projects: projects.data,
      payments: payments.data,
      expenses: expenses.data,
      bills: bills.data,
      installments: installments.data,
      suppliers: suppliers.data,
    };
  }, [projects.data, payments.data, expenses.data, bills.data, installments.data, suppliers.data]);

  return {
    data,
    isLoading: queries.some((q) => q.isLoading),
    error: queries.find((q) => q.error)?.error ?? null,
    refetch: () => queries.forEach((q) => void q.refetch()),
  };
}

export interface ProjectWithSummary {
  project: Project;
  summary: ProjectSummary;
}

/** Every project of the company together with its money summary. */
export function useProjectsOverview() {
  const finance = useFinance();
  const data = useMemo<ProjectWithSummary[] | undefined>(() => {
    if (!finance.data) return undefined;
    const today = todayISO();
    return finance.data.projects.map((project) => ({
      project,
      summary: summarizeProject(project, finance.data!, today),
    }));
  }, [finance.data]);
  return { ...finance, finance: finance.data, data };
}

/** Wraps an API call; after it succeeds every list and total is refreshed at once. */
function useApiMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/** Lets a multi-argument API call be used as a mutation: mutateAsync([id, input, reason]). */
const spread =
  <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
  (args: A) =>
    fn(...args);

export const useCreateProject = () => useApiMutation(api.createProject);
export const useUpdateProject = () => useApiMutation(spread(api.updateProject));
export const useSetProjectArchived = () => useApiMutation(spread(api.setProjectArchived));
export const useDeleteProject = () => useApiMutation(api.deleteProject);
export const useReviseBudget = () => useApiMutation(spread(api.reviseBudget));

export const useAddInstallment = () => useApiMutation(api.addInstallment);
export const useDeleteInstallment = () => useApiMutation(api.deleteInstallment);

export const useAddPayment = () => useApiMutation(api.addPayment);
export const useUpdatePayment = () => useApiMutation(spread(api.updatePayment));
export const useVoidPayment = () => useApiMutation(spread(api.voidPayment));

export const useAddExpense = () => useApiMutation(api.addExpense);
export const useUpdateExpense = () => useApiMutation(spread(api.updateExpense));
export const useVoidExpense = () => useApiMutation(spread(api.voidExpense));

export const useAddBill = () => useApiMutation(api.addBill);
export const useUpdateBill = () => useApiMutation(spread(api.updateBill));
export const useVoidBill = () => useApiMutation(spread(api.voidBill));

export const useAddSupplier = () => useApiMutation(api.addSupplier);
export const useUpdateSupplier = () => useApiMutation(spread(api.updateSupplier));
export const useSetSupplierArchived = () => useApiMutation(spread(api.setSupplierArchived));

export const useInviteMember = () => useApiMutation(api.inviteMember);
export const useRevokeInvite = () => useApiMutation(api.revokeInvite);
export const useChangeMemberRole = () => useApiMutation(spread(api.changeMemberRole));
export const useRemoveMember = () => useApiMutation(api.removeMember);
