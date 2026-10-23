// "Needs your attention" rules, shared by the dashboard and the project page.
import type { ProjectSummary } from './calc';
import { categoryLabel } from './constants';
import { formatINR } from './format';
import type { Project } from '../types';

export interface Alert {
  key: string;
  projectId: string;
  projectName: string;
  message: string;
  serious: boolean;
}

export function projectAlerts(project: Project, summary: ProjectSummary): Alert[] {
  const alerts: Alert[] = [];
  const add = (key: string, message: string, serious: boolean) =>
    alerts.push({ key: `${project.id}-${key}`, projectId: project.id, projectName: project.name, message, serious });

  if (summary.health === 'over') {
    add('over', `Costs are ${formatINR(-summary.remainingBudget)} more than the estimated cost.`, true);
  } else if (summary.health === 'watch') {
    add('watch', `${summary.budgetUsedPercent}% of the budget is already used.`, false);
  }
  for (const line of summary.overBudgetCategories) {
    add(`cat-${line.category}`, `${categoryLabel(line.category)} is ${formatINR(line.actual - (line.budget ?? 0))} over its budget.`, false);
  }
  if (summary.overdue > 0) {
    add('overdue', `${formatINR(summary.overdue)} from ${project.clientName} is overdue.`, true);
  }
  if (summary.netCash < 0) {
    add('cash', `Cash position is ${formatINR(summary.netCash)}: you have paid out more than the client paid. Ask for the next payment.`, false);
  }
  if (summary.overdueBills > 0) {
    add('bills', `${formatINR(summary.overdueBills)} of supplier bills are past their due date.`, false);
  }
  if (summary.clientOverpaid > 0) {
    add('overpaid', `The client has paid ${formatINR(summary.clientOverpaid)} more than the contract value.`, false);
  }
  return alerts;
}

/** Serious alerts first. */
export function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort((a, b) => Number(b.serious) - Number(a.serious));
}
