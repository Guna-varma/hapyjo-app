import type { Expense, Site, Survey } from "@/types";

export interface FinanceDateRange {
  from?: string;
  to?: string;
}

export interface SiteFinancialSummary {
  siteId: string;
  siteName: string;
  location: string;
  status: Site["status"] | "unknown";
  progressPct: number;
  contractRateRwf: number;
  approvedVolumeM3: number;
  revenueRwf: number;
  expensesRwf: number;
  fuelExpensesRwf: number;
  generalExpensesRwf: number;
  profitRwf: number;
  budgetRwf: number;
  remainingBudgetRwf: number;
  utilizationPct: number;
  isKnownSite: boolean;
}

export interface FinancialSummaryTotals {
  totalSites: number;
  activeSites: number;
  avgProgressPct: number;
  approvedVolumeM3: number;
  revenueRwf: number;
  expensesRwf: number;
  fuelExpensesRwf: number;
  generalExpensesRwf: number;
  profitRwf: number;
  totalBudgetRwf: number;
  remainingBudgetRwf: number;
  utilizationPct: number;
}

export interface FinancialSummary {
  sites: SiteFinancialSummary[];
  bySiteId: Record<string, SiteFinancialSummary>;
  totals: FinancialSummaryTotals;
}

function toDateKey(value: string | null | undefined): string {
  return value ? String(value).slice(0, 10) : "";
}

function isInDateRange(value: string | null | undefined, range: FinanceDateRange): boolean {
  if (!range.from && !range.to) return true;
  const d = toDateKey(value);
  if (!d) return false;
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function buildFinancialSummary({
  sites,
  surveys,
  expenses,
  dateRange = {},
}: {
  sites: Site[];
  surveys: Survey[];
  expenses: Expense[];
  dateRange?: FinanceDateRange;
}): FinancialSummary {
  const byId = new Map<string, SiteFinancialSummary>();

  for (const site of sites) {
    byId.set(site.id, {
      siteId: site.id,
      siteName: site.name,
      location: site.location ?? "",
      status: site.status,
      progressPct: safeNumber(site.progress),
      contractRateRwf: safeNumber(site.contractRateRwf),
      approvedVolumeM3: 0,
      revenueRwf: 0,
      expensesRwf: 0,
      fuelExpensesRwf: 0,
      generalExpensesRwf: 0,
      profitRwf: 0,
      budgetRwf: safeNumber(site.budget),
      remainingBudgetRwf: safeNumber(site.budget),
      utilizationPct: 0,
      isKnownSite: true,
    });
  }

  const ensureSite = (siteId: string): SiteFinancialSummary => {
    const id = siteId || "unknown_site";
    const existing = byId.get(id);
    if (existing) return existing;
    const created: SiteFinancialSummary = {
      siteId: id,
      siteName: id,
      location: "",
      status: "unknown",
      progressPct: 0,
      contractRateRwf: 0,
      approvedVolumeM3: 0,
      revenueRwf: 0,
      expensesRwf: 0,
      fuelExpensesRwf: 0,
      generalExpensesRwf: 0,
      profitRwf: 0,
      budgetRwf: 0,
      remainingBudgetRwf: 0,
      utilizationPct: 0,
      isKnownSite: false,
    };
    byId.set(id, created);
    return created;
  };

  for (const survey of surveys) {
    if (survey.status !== "approved") continue;
    if (!isInDateRange(survey.surveyDate, dateRange)) continue;
    const site = ensureSite(survey.siteId);
    site.approvedVolumeM3 += safeNumber(survey.volumeM3);
  }

  for (const expense of expenses) {
    if (!isInDateRange(expense.date ?? expense.createdAt, dateRange)) continue;
    const site = ensureSite(expense.siteId);
    const amount = safeNumber(expense.amountRwf);
    site.expensesRwf += amount;
    if (expense.type === "fuel" || expense.expenseCategory === "fuel") {
      site.fuelExpensesRwf += amount;
    } else {
      site.generalExpensesRwf += amount;
    }
  }

  const sitesSummary = Array.from(byId.values()).map((site) => {
    const revenue = site.approvedVolumeM3 * site.contractRateRwf;
    const profit = revenue - site.expensesRwf;
    const remaining = Math.max(0, site.budgetRwf - site.expensesRwf);
    const utilization = site.budgetRwf > 0
      ? Math.min(100, Math.round((site.expensesRwf / site.budgetRwf) * 100))
      : 0;
    return {
      ...site,
      revenueRwf: revenue,
      profitRwf: profit,
      remainingBudgetRwf: remaining,
      utilizationPct: utilization,
    };
  });

  sitesSummary.sort((a, b) => {
    if (a.isKnownSite !== b.isKnownSite) return a.isKnownSite ? -1 : 1;
    return a.siteName.localeCompare(b.siteName);
  });

  const totals = sitesSummary.reduce<FinancialSummaryTotals>(
    (acc, site) => {
      acc.approvedVolumeM3 += site.approvedVolumeM3;
      acc.revenueRwf += site.revenueRwf;
      acc.expensesRwf += site.expensesRwf;
      acc.fuelExpensesRwf += site.fuelExpensesRwf;
      acc.generalExpensesRwf += site.generalExpensesRwf;
      acc.profitRwf += site.profitRwf;
      if (site.isKnownSite) {
        acc.totalBudgetRwf += site.budgetRwf;
      }
      return acc;
    },
    {
      totalSites: sites.length,
      activeSites: sites.filter((s) => s.status === "active").length,
      avgProgressPct: sites.length > 0
        ? Math.round(sites.reduce((sum, s) => sum + safeNumber(s.progress), 0) / sites.length)
        : 0,
      approvedVolumeM3: 0,
      revenueRwf: 0,
      expensesRwf: 0,
      fuelExpensesRwf: 0,
      generalExpensesRwf: 0,
      profitRwf: 0,
      totalBudgetRwf: 0,
      remainingBudgetRwf: 0,
      utilizationPct: 0,
    }
  );

  totals.remainingBudgetRwf = Math.max(0, totals.totalBudgetRwf - totals.expensesRwf);
  totals.utilizationPct = totals.totalBudgetRwf > 0
    ? Math.min(100, Math.round((totals.expensesRwf / totals.totalBudgetRwf) * 100))
    : 0;

  return {
    sites: sitesSummary,
    bySiteId: sitesSummary.reduce<Record<string, SiteFinancialSummary>>((acc, site) => {
      acc[site.siteId] = site;
      return acc;
    }, {}),
    totals,
  };
}
