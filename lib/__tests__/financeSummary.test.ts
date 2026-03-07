import { buildFinancialSummary } from "../financeSummary";
import type { Expense, Site, Survey } from "../../types";

describe("buildFinancialSummary", () => {
  const sites: Site[] = [
    {
      id: "site_a",
      name: "Alpha",
      location: "Kigali",
      status: "active",
      startDate: "2026-01-01",
      budget: 1_000_000,
      spent: 0,
      progress: 60,
      contractRateRwf: 500,
    },
    {
      id: "site_b",
      name: "Beta",
      location: "Musanze",
      status: "active",
      startDate: "2026-01-01",
      budget: 500_000,
      spent: 0,
      progress: 40,
      contractRateRwf: 700,
    },
  ];

  const surveys: Survey[] = [
    {
      id: "s1",
      siteId: "site_a",
      surveyDate: "2026-03-01",
      volumeM3: 100,
      status: "approved",
      surveyorId: "u1",
      createdAt: "2026-03-01T08:00:00.000Z",
    },
    {
      id: "s2",
      siteId: "site_b",
      surveyDate: "2026-03-02",
      volumeM3: 50,
      status: "approved",
      surveyorId: "u1",
      createdAt: "2026-03-02T08:00:00.000Z",
    },
    {
      id: "s3",
      siteId: "site_a",
      surveyDate: "2026-03-03",
      volumeM3: 80,
      status: "rejected",
      surveyorId: "u1",
      createdAt: "2026-03-03T08:00:00.000Z",
    },
  ];

  const expenses: Expense[] = [
    {
      id: "e1",
      siteId: "site_a",
      amountRwf: 10_000,
      description: "Fuel truck",
      date: "2026-03-01",
      type: "fuel",
      expenseCategory: "fuel",
      createdAt: "2026-03-01T10:00:00.000Z",
    },
    {
      id: "e2",
      siteId: "site_a",
      amountRwf: 20_000,
      description: "Maintenance",
      date: "2026-03-04",
      type: "general",
      expenseCategory: "maintenance",
      createdAt: "2026-03-04T10:00:00.000Z",
    },
    {
      id: "e3",
      siteId: "site_b",
      amountRwf: 50_000,
      description: "Fuel machine",
      date: "2026-03-02",
      type: "fuel",
      expenseCategory: "fuel",
      createdAt: "2026-03-02T10:00:00.000Z",
    },
  ];

  it("calculates revenue/expenses/profit for each site and totals", () => {
    const summary = buildFinancialSummary({ sites, surveys, expenses });

    const siteA = summary.bySiteId.site_a;
    const siteB = summary.bySiteId.site_b;

    expect(siteA.approvedVolumeM3).toBe(100);
    expect(siteA.revenueRwf).toBe(50_000);
    expect(siteA.expensesRwf).toBe(30_000);
    expect(siteA.fuelExpensesRwf).toBe(10_000);
    expect(siteA.generalExpensesRwf).toBe(20_000);
    expect(siteA.profitRwf).toBe(20_000);

    expect(siteB.approvedVolumeM3).toBe(50);
    expect(siteB.revenueRwf).toBe(35_000);
    expect(siteB.expensesRwf).toBe(50_000);
    expect(siteB.profitRwf).toBe(-15_000);

    expect(summary.totals.revenueRwf).toBe(85_000);
    expect(summary.totals.expensesRwf).toBe(80_000);
    expect(summary.totals.fuelExpensesRwf).toBe(60_000);
    expect(summary.totals.generalExpensesRwf).toBe(20_000);
    expect(summary.totals.profitRwf).toBe(5_000);
  });

  it("applies date range filter consistently to surveys and expenses", () => {
    const summary = buildFinancialSummary({
      sites,
      surveys,
      expenses,
      dateRange: { from: "2026-03-02", to: "2026-03-02" },
    });

    expect(summary.bySiteId.site_a.approvedVolumeM3).toBe(0);
    expect(summary.bySiteId.site_a.expensesRwf).toBe(0);
    expect(summary.bySiteId.site_b.approvedVolumeM3).toBe(50);
    expect(summary.bySiteId.site_b.expensesRwf).toBe(50_000);
    expect(summary.totals.revenueRwf).toBe(35_000);
    expect(summary.totals.expensesRwf).toBe(50_000);
  });
});
