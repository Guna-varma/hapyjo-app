import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, Modal, Pressable, FlatList } from 'react-native';
import {
  documentDirectory,
  cacheDirectory,
  writeAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { EmptyState } from '@/components/ui/EmptyState';
import { colors } from '@/theme/tokens';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { formatAmount } from '@/lib/currency';
import { canSeeFinancialSummary, isReportsReadOnly } from '@/lib/rbac';
import { generateId } from '@/lib/id';
import {
  FileText,
  TrendingUp,
  Banknote,
  BarChart3,
  Download,
  Lock,
  Fuel,
  ChevronDown,
} from 'lucide-react-native';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format period "YYYY-MM" to "Mon YYYY" e.g. "Mar 2026" */
function formatPeriodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return `${MONTH_LABELS[m - 1]}-${y}`;
}

function getReportsSubtitle(role: string | undefined, t: (key: string) => string): string {
  if (role === 'accountant') return t('reports_subtitle_accountant');
  if (role === 'owner') return t('reports_subtitle_owner');
  if (role === 'head_supervisor') return t('reports_subtitle_head_supervisor');
  if (role === 'admin') return t('reports_subtitle_admin');
  return t('reports_title');
}

/** Escape a value for CSV (quotes and internal double-quotes). */
function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Build a detailed, readable CSV from a report (financial or operations). */
function buildDetailedReportCSV(
  report: { title: string; type: string; period: string; generatedDate: string; data?: Record<string, unknown> },
  formatAmountFn: (n: number, compact?: boolean) => string
): string {
  const rows: string[] = [];
  const d = report.data ?? {};
  const periodStart = (d.periodStart as string) ?? report.generatedDate;
  const periodEnd = (d.periodEnd as string) ?? report.generatedDate;

  // ----- Header -----
  rows.push(csvEscape('HapyJo Ltd - Report Export'));
  rows.push('');
  rows.push([csvEscape('Field'), csvEscape('Value')].join(','));
  rows.push([csvEscape('Report Title'), csvEscape(report.title)].join(','));
  rows.push([csvEscape('Report Type'), csvEscape(report.type)].join(','));
  rows.push([csvEscape('Period'), csvEscape(report.period)].join(','));
  rows.push([csvEscape('Period Start'), csvEscape(periodStart)].join(','));
  rows.push([csvEscape('Period End'), csvEscape(periodEnd)].join(','));
  rows.push([csvEscape('Generated At'), csvEscape((d.generatedAt as string) ?? report.generatedDate)].join(','));
  rows.push('');

  if (report.type === 'financial') {
    // ----- Financial summary -----
    rows.push([csvEscape('Section'), csvEscape('Metric'), csvEscape('Value'), csvEscape('Unit')].join(','));
    const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);
    rows.push([csvEscape('Summary'), csvEscape('Total Budget'), csvEscape(formatAmountFn(num(d.totalBudget))), csvEscape('RWF')].join(','));
    rows.push([csvEscape('Summary'), csvEscape('Total Spent'), csvEscape(formatAmountFn(num(d.totalSpent))), csvEscape('RWF')].join(','));
    rows.push([csvEscape('Summary'), csvEscape('Remaining Budget'), csvEscape(formatAmountFn(num(d.remainingBudget))), csvEscape('RWF')].join(','));
    rows.push([csvEscape('Summary'), csvEscape('Revenue (period)'), csvEscape(formatAmountFn(num(d.revenue))), csvEscape('RWF')].join(','));
    rows.push([csvEscape('Summary'), csvEscape('Expenses (period)'), csvEscape(formatAmountFn(num(d.expenses))), csvEscape('RWF')].join(','));
    rows.push([csvEscape('Summary'), csvEscape('Fuel Cost (period)'), csvEscape(formatAmountFn(num(d.fuel_cost))), csvEscape('RWF')].join(','));
    rows.push([csvEscape('Summary'), csvEscape('Profit (period)'), csvEscape(formatAmountFn(num(d.profit))), csvEscape('RWF')].join(','));
    rows.push([csvEscape('Summary'), csvEscape('Trips Completed'), csvEscape(String(num(d.trips))), csvEscape('count')].join(','));
    rows.push([csvEscape('Summary'), csvEscape('Machine Hours'), csvEscape(String(d.machine_hours ?? 0)), csvEscape('hours')].join(','));
    rows.push([csvEscape('Summary'), csvEscape('Expense Entries (period)'), csvEscape(String(d.expenseCount ?? '')), csvEscape('count')].join(','));
    rows.push('');

    // ----- Sites breakdown -----
    const sitesSummary = (d.sitesSummary as { siteName: string; budget: number; spent: number; remaining: number; utilizationPct: number }[]) ?? [];
    if (sitesSummary.length > 0) {
      rows.push([csvEscape('Sites Breakdown'), csvEscape('Site Name'), csvEscape('Budget (RWF)'), csvEscape('Spent (RWF)'), csvEscape('Remaining (RWF)'), csvEscape('Utilization %')].join(','));
      sitesSummary.forEach((site) => {
        rows.push([
          csvEscape('Sites Breakdown'),
          csvEscape(site.siteName ?? ''),
          csvEscape(formatAmountFn(site.budget ?? 0)),
          csvEscape(formatAmountFn(site.spent ?? 0)),
          csvEscape(formatAmountFn(site.remaining ?? 0)),
          csvEscape(String(site.utilizationPct ?? 0)),
        ].join(','));
      });
      rows.push('');
    }
  }

  if (report.type === 'operations') {
    rows.push([csvEscape('Section'), csvEscape('Metric'), csvEscape('Value'), csvEscape('Unit')].join(','));
    rows.push([csvEscape('Summary'), csvEscape('Active Sites'), csvEscape(String(d.activeSites ?? '')), csvEscape('count')].join(','));
    rows.push([csvEscape('Summary'), csvEscape('Completed Tasks'), csvEscape(String(d.completedTasks ?? '')), csvEscape('count')].join(','));
    rows.push([csvEscape('Summary'), csvEscape('In Progress Tasks'), csvEscape(String(d.inProgressTasks ?? '')), csvEscape('count')].join(','));
    rows.push([csvEscape('Summary'), csvEscape('Pending Tasks'), csvEscape(String(d.pendingTasks ?? '')), csvEscape('count')].join(','));
    rows.push('');
  }

  if (report.type === 'site_performance') {
    rows.push([csvEscape('Section'), csvEscape('Metric'), csvEscape('Value'), csvEscape('Unit')].join(','));
    rows.push([csvEscape('Summary'), csvEscape('Active Sites'), csvEscape(String(d.activeSites ?? '')), csvEscape('count')].join(','));
    rows.push('');
    const sitesSummary = (d.sitesSummary as { siteName: string; progress?: number; budget: number; spent: number; remaining: number; utilizationPct: number }[]) ?? [];
    if (sitesSummary.length > 0) {
      rows.push([csvEscape('Site Performance'), csvEscape('Site Name'), csvEscape('Progress %'), csvEscape('Budget (RWF)'), csvEscape('Spent (RWF)'), csvEscape('Remaining (RWF)'), csvEscape('Utilization %')].join(','));
      sitesSummary.forEach((site) => {
        rows.push([
          csvEscape('Site Performance'),
          csvEscape(site.siteName ?? ''),
          csvEscape(String(site.progress ?? 0)),
          csvEscape(formatAmountFn(site.budget ?? 0)),
          csvEscape(formatAmountFn(site.spent ?? 0)),
          csvEscape(formatAmountFn(site.remaining ?? 0)),
          csvEscape(String(site.utilizationPct ?? 0)),
        ].join(','));
      });
      rows.push('');
    }
    const sitesExpenses = (d.sitesExpenses as { siteName: string; totalExpenses: number; fuelExpenses: number; generalExpenses: number }[]) ?? [];
    if (sitesExpenses.length > 0) {
      rows.push([csvEscape('Site Expenses'), csvEscape('Site Name'), csvEscape('Total (RWF)'), csvEscape('Fuel (RWF)'), csvEscape('General (RWF)')].join(','));
      sitesExpenses.forEach((site) => {
        rows.push([
          csvEscape('Site Expenses'),
          csvEscape(site.siteName ?? ''),
          csvEscape(formatAmountFn(site.totalExpenses ?? 0)),
          csvEscape(formatAmountFn(site.fuelExpenses ?? 0)),
          csvEscape(formatAmountFn(site.generalExpenses ?? 0)),
        ].join(','));
      });
      rows.push('');
    }
  }

  // If we have other data keys not yet printed, add a "Raw data" section so nothing is lost
  const knownKeys = new Set(['periodStart', 'periodEnd', 'generatedAt', 'totalBudget', 'totalSpent', 'remainingBudget', 'revenue', 'expenses', 'fuel_cost', 'profit', 'trips', 'machine_hours', 'expenseCount', 'sitesSummary', 'sitesExpenses', 'activeSites', 'completedTasks', 'inProgressTasks', 'pendingTasks']);
  const extra = Object.entries(d).filter(([k]) => !knownKeys.has(k) && d[k] != null && typeof d[k] !== 'object');
  if (extra.length > 0) {
    rows.push([csvEscape('Additional Data'), csvEscape('Key'), csvEscape('Value')].join(','));
    extra.forEach(([k, v]) => rows.push([csvEscape('Additional Data'), csvEscape(k), csvEscape(String(v))].join(',')));
  }

  return '\uFEFF' + rows.join('\r\n');
}

export function ReportsScreen() {
  const { user } = useAuth();
  const { t } = useLocale();
  const theme = useResponsiveTheme();
  const { sites, vehicles, expenses, trips, machineSessions, surveys, reports, tasks, addReport, updateReport, refetch, loading } = useMockAppStore();
  const [selectedType, setSelectedType] = useState<'all' | 'financial' | 'operations' | 'site_performance'>('all');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('');
  const [monthDropdownVisible, setMonthDropdownVisible] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<'this_month' | 'last_month'>('this_month');
  const [fuelSiteId, setFuelSiteId] = useState<string | null>(null);
  const [fuelVehicleType, setFuelVehicleType] = useState<'all' | 'truck' | 'machine'>('all');
  const [fuelDateFrom, setFuelDateFrom] = useState('');
  const [fuelDateTo, setFuelDateTo] = useState('');
  const [generating, setGenerating] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const readOnly = user ? isReportsReadOnly(user.role) : false;
  const showSummary = user ? canSeeFinancialSummary(user.role) : false;
  const canGenerate = user ? ['admin', 'owner', 'head_supervisor', 'assistant_supervisor'].includes(user.role) : false;

  // Tabs as data drivers: refetch when report type filter changes so list stays in sync (and future API can filter by type)
  useEffect(() => {
    refetch();
  }, [selectedType, refetch]);

  const getPeriodForGenerate = (): string => {
    const now = new Date();
    if (reportPeriod === 'last_month') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const getMonthRange = (period: string): { start: string; end: string } => {
    const [y, m] = period.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  };

  const filteredReports = useMemo(() => {
    let list = selectedType === 'all' ? reports : reports.filter((r) => r.type === selectedType);
    if (selectedMonthFilter) list = list.filter((r) => r.period === selectedMonthFilter);
    return list;
  }, [reports, selectedType, selectedMonthFilter]);

  const monthOptions = useMemo(() => {
    const periods = Array.from(new Set(reports.map((r) => r.period).filter(Boolean)) as Set<string>);
    periods.sort((a, b) => b.localeCompare(a));
    return [{ value: '', labelKey: 'reports_all_months' }, ...periods.map((p) => ({ value: p, labelKey: formatPeriodLabel(p) }))];
  }, [reports]);

  const reportTypes: { id: 'all' | 'financial' | 'operations' | 'site_performance'; labelKey: string; Icon: React.ComponentType<{ size: number; color: string }> }[] = [
    { id: 'all', labelKey: 'reports_all', Icon: FileText },
    { id: 'financial', labelKey: 'reports_financial', Icon: Banknote },
    { id: 'operations', labelKey: 'reports_operations', Icon: BarChart3 },
    { id: 'site_performance', labelKey: 'reports_site_perf', Icon: TrendingUp },
  ];

  // Single source of truth: budget from sites, spent from expenses (sync with actual data)
  const totalBudget = sites.reduce((sum, site) => sum + (site.budget ?? 0), 0);
  const totalSpent = expenses.reduce((sum, e) => sum + (e.amountRwf ?? 0), 0);
  const remaining = Math.max(0, totalBudget - totalSpent);
  const utilizationPct = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;

  const fuelExpensesByVehicle = expenses
    .filter((e) => e.type === 'fuel' && e.vehicleId)
    .reduce<Record<string, { litres: number; cost: number }>>((acc, e) => {
      const id = e.vehicleId!;
      if (!acc[id]) acc[id] = { litres: 0, cost: 0 };
      acc[id].litres += e.litres ?? 0;
      acc[id].cost += e.amountRwf ?? 0;
      return acc;
    }, {});
  const tripDistanceByVehicle = trips
    .filter((t) => t.status === 'completed')
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.vehicleId] = (acc[t.vehicleId] ?? 0) + t.distanceKm;
      return acc;
    }, {});
  const sessionHoursByVehicle = machineSessions
    .filter((m) => m.status === 'completed')
    .reduce<Record<string, number>>((acc, m) => {
      acc[m.vehicleId] = (acc[m.vehicleId] ?? 0) + (m.durationHours ?? 0);
      return acc;
    }, {});

  const inDateRange = (iso: string) => {
    if (!fuelDateFrom && !fuelDateTo) return true;
    const d = iso.slice(0, 10);
    if (fuelDateFrom && d < fuelDateFrom) return false;
    if (fuelDateTo && d > fuelDateTo) return false;
    return true;
  };

  const vehiclesBySite = fuelSiteId
    ? vehicles.filter((v) => v.siteId === fuelSiteId)
    : vehicles;
  const vehiclesForFuel = fuelVehicleType === 'all'
    ? vehiclesBySite
    : vehiclesBySite.filter((v) => v.type === fuelVehicleType);
  const tripsForFuel = trips.filter((t) => t.status === 'completed' && inDateRange(t.startTime));
  const sessionsForFuel = machineSessions.filter((m) => m.status === 'completed' && inDateRange(m.startTime));

  const expectedFuelByVehicle: Record<string, number> = {};
  const actualFuelByVehicle: Record<string, number> = {};
  vehiclesForFuel.forEach((v) => {
    if (v.type === 'truck' && v.mileageKmPerLitre) {
      const distance = tripsForFuel.filter((t) => t.vehicleId === v.id).reduce((s, t) => s + t.distanceKm, 0);
      expectedFuelByVehicle[v.id] = distance / v.mileageKmPerLitre;
    } else if (v.type === 'machine' && v.hoursPerLitre && v.hoursPerLitre > 0) {
      const hours = sessionsForFuel.filter((m) => m.vehicleId === v.id).reduce((s, m) => s + (m.durationHours ?? 0), 0);
      expectedFuelByVehicle[v.id] = hours / v.hoursPerLitre;
    } else {
      expectedFuelByVehicle[v.id] = 0;
    }
    const fromTrips = tripsForFuel.filter((t) => t.vehicleId === v.id).reduce((s, t) => s + (t.fuelConsumed ?? 0), 0);
    const fromSessions = sessionsForFuel.filter((m) => m.vehicleId === v.id).reduce((s, m) => s + (m.fuelConsumed ?? 0), 0);
    actualFuelByVehicle[v.id] = fromTrips + fromSessions;
  });

  const totalSpentAll = sites.reduce((sum, s) => sum + (s.spent ?? 0), 0);
  const totalBudgetAll = sites.reduce((sum, s) => sum + (s.budget ?? 0), 0);
  const remainingBudgetAll = Math.max(0, totalBudgetAll - totalSpentAll);

  // Live data for Operations tab (not from saved reports)
  const activeSitesCount = sites.filter((s) => s.status === 'active').length;
  const completedTasksCount = tasks.filter((t) => t.status === 'completed').length;
  const pendingTasksCount = tasks.filter((t) => t.status === 'pending').length;
  const inProgressTasksCount = tasks.filter((t) => t.status === 'in_progress').length;

  const handleGenerateReport = async () => {
    if (!canGenerate) return;
    const period = getPeriodForGenerate();
    const existing = reports.find((r) => r.period === period && r.type === 'financial');
    if (existing) {
      setGenerating(true);
      try {
        const { start, end } = getMonthRange(period);
        const inMonth = (iso: string) => {
          const d = iso.slice(0, 10);
          return d >= start && d <= end;
        };
        const tripsInMonth = trips.filter((t) => t.status === 'completed' && inMonth(t.startTime));
        const sessionsInMonth = machineSessions.filter((m) => m.status === 'completed' && inMonth(m.startTime));
        const expensesInMonth = expenses.filter((e) => e.date && inMonth(e.date));
        const surveysInMonth = surveys.filter((s) => s.status === 'approved' && s.createdAt && inMonth(s.createdAt));
        const revenueInMonth = surveysInMonth.reduce((sum, s) => {
          const site = sites.find((site) => site.id === s.siteId);
          return sum + (s.volumeM3 * (site?.contractRateRwf ?? 0));
        }, 0);
        const spentInMonth = expensesInMonth.reduce((s, e) => s + e.amountRwf, 0);
        const fuelCostInMonth = expensesInMonth.filter((e) => e.type === 'fuel').reduce((s, e) => s + e.amountRwf, 0);
        const sitesSummary = sites.map((site) => {
          const siteSpent = site.spent ?? 0;
          const siteBudget = site.budget ?? 0;
          const siteRemaining = Math.max(0, siteBudget - siteSpent);
          const utilizationPct = siteBudget > 0 ? Math.round((siteSpent / siteBudget) * 100) : 0;
          return { siteName: site.name, budget: siteBudget, spent: siteSpent, remaining: siteRemaining, utilizationPct };
        });
        const reportData = {
          periodStart: start,
          periodEnd: end,
          trips: tripsInMonth.length,
          machine_hours: Math.round(sessionsInMonth.reduce((a, m) => a + (m.durationHours ?? 0), 0) * 100) / 100,
          fuel_cost: fuelCostInMonth,
          expenses: spentInMonth,
          revenue: revenueInMonth,
          profit: revenueInMonth - spentInMonth,
          totalBudget: totalBudgetAll,
          totalSpent: totalSpentAll,
          remainingBudget: remainingBudgetAll,
          expenseCount: expensesInMonth.length,
          sitesSummary,
          generatedAt: new Date().toISOString(),
        };
        await updateReport(existing.id, {
          data: reportData,
          generatedDate: end,
          title: `Financial Report ${period}`,
        });
        Alert.alert(t('reports_updated'), t('reports_updated_message'));
      } catch (e) {
        Alert.alert(t('alert_error'), e instanceof Error ? e.message : t('reports_report_failed'));
      } finally {
        setGenerating(false);
      }
      return;
    }
    setGenerating(true);
    try {
      const now = new Date();
      const { start, end } = getMonthRange(period);
      const inMonth = (iso: string) => {
        const d = iso.slice(0, 10);
        return d >= start && d <= end;
      };
      const tripsInMonth = trips.filter((t) => t.status === 'completed' && inMonth(t.startTime));
      const sessionsInMonth = machineSessions.filter((m) => m.status === 'completed' && inMonth(m.startTime));
      const expensesInMonth = expenses.filter((e) => e.date && inMonth(e.date));
      const surveysInMonth = surveys.filter((s) => s.status === 'approved' && s.createdAt && inMonth(s.createdAt));
      const revenueInMonth = surveysInMonth.reduce((sum, s) => {
        const site = sites.find((site) => site.id === s.siteId);
        return sum + (s.volumeM3 * (site?.contractRateRwf ?? 0));
      }, 0);
      const spentInMonth = expensesInMonth.reduce((s, e) => s + e.amountRwf, 0);
      const fuelCostInMonth = expensesInMonth.filter((e) => e.type === 'fuel').reduce((s, e) => s + e.amountRwf, 0);
      const sitesSummary = sites.map((site) => {
        const siteSpent = site.spent ?? 0;
        const siteBudget = site.budget ?? 0;
        const siteRemaining = Math.max(0, siteBudget - siteSpent);
        const utilizationPct = siteBudget > 0 ? Math.round((siteSpent / siteBudget) * 100) : 0;
        return { siteName: site.name, budget: siteBudget, spent: siteSpent, remaining: siteRemaining, utilizationPct };
      });
      const reportData = {
        periodStart: start,
        periodEnd: end,
        trips: tripsInMonth.length,
        machine_hours: Math.round(sessionsInMonth.reduce((a, m) => a + (m.durationHours ?? 0), 0) * 100) / 100,
        fuel_cost: fuelCostInMonth,
        expenses: spentInMonth,
        revenue: revenueInMonth,
        profit: revenueInMonth - spentInMonth,
        totalBudget: totalBudgetAll,
        totalSpent: totalSpentAll,
        remainingBudget: remainingBudgetAll,
        expenseCount: expensesInMonth.length,
        sitesSummary,
        generatedAt: now.toISOString(),
      };
      await addReport({
        id: generateId('r'),
        title: `Financial Report ${period}`,
        type: 'financial',
        generatedDate: end,
        period,
        data: reportData,
      });
      // Per-site expenses for the period (from expenses in month)
      const sitesExpenses = sites.map((site) => {
        const siteExpensesInMonth = expensesInMonth.filter((e) => e.siteId === site.id);
        const totalExpenses = siteExpensesInMonth.reduce((s, e) => s + (e.amountRwf ?? 0), 0);
        const fuelExpenses = siteExpensesInMonth.filter((e) => e.type === 'fuel').reduce((s, e) => s + (e.amountRwf ?? 0), 0);
        const generalExpenses = siteExpensesInMonth.filter((e) => e.type === 'general').reduce((s, e) => s + (e.amountRwf ?? 0), 0);
        return { siteId: site.id, siteName: site.name, totalExpenses, fuelExpenses, generalExpenses };
      });
      const sitesSummaryWithProgress = sites.map((site) => {
        const siteSpent = site.spent ?? 0;
        const siteBudget = site.budget ?? 0;
        const siteRemaining = Math.max(0, siteBudget - siteSpent);
        const utilizationPct = siteBudget > 0 ? Math.round((siteSpent / siteBudget) * 100) : 0;
        return { siteId: site.id, siteName: site.name, progress: site.progress ?? 0, budget: siteBudget, spent: siteSpent, remaining: siteRemaining, utilizationPct };
      });
      const existingSitePerf = reports.find((r) => r.period === period && r.type === 'site_performance');
      if (!existingSitePerf) {
        await addReport({
          id: generateId('r'),
          title: `Site Performance ${period}`,
          type: 'site_performance',
          generatedDate: end,
          period,
          data: {
            periodStart: start,
            periodEnd: end,
            activeSites: sites.filter((s) => s.status === 'active').length,
            sitesSummary: sitesSummaryWithProgress,
            sitesExpenses,
            generatedAt: now.toISOString(),
          },
        });
      } else {
        await updateReport(existingSitePerf.id, {
          data: {
            periodStart: start,
            periodEnd: end,
            activeSites: sites.filter((s) => s.status === 'active').length,
            sitesSummary: sitesSummaryWithProgress,
            sitesExpenses,
            generatedAt: now.toISOString(),
          },
          generatedDate: end,
        });
      }
      Alert.alert(t('reports_generated'), t('reports_generated_message'));
    } catch (e) {
      Alert.alert(t('alert_error'), e instanceof Error ? e.message : t('reports_generate_failed'));
    } finally {
      setGenerating(false);
    }
  };

  const handleExportCSV = async (report: (typeof reports)[0]) => {
    if (!report.data || typeof report.data !== 'object') {
      Alert.alert(t('reports_export'), t('reports_no_export_data'));
      return;
    }
    setExportingId(report.id);
    try {
      const csv = buildDetailedReportCSV(
        { title: report.title, type: report.type, period: report.period, generatedDate: report.generatedDate, data: report.data as Record<string, unknown> },
        formatAmount
      );
      const safeDate = (report.generatedDate ?? '').replace(/[/\\?*:]/g, '-');
      const filename = `HapyJo_Report_${report.type}_${report.period}_${safeDate}.csv`;
      const dir = documentDirectory ?? cacheDirectory ?? '';
      const path = `${dir}${filename}`;
      await writeAsStringAsync(path, csv, { encoding: EncodingType.UTF8 });
      let shareShown = false;
      try {
        const Sharing = await import('expo-sharing');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path, {
            mimeType: 'text/csv',
            dialogTitle: t('reports_export_download_share'),
          });
          shareShown = true;
        }
      } catch {
        // expo-sharing not available
      }
      if (!shareShown) {
        Alert.alert(t('reports_exported'), `${t('reports_exported_path')} ${path}`);
      }
    } catch (e) {
      Alert.alert(t('reports_export_failed_title'), e instanceof Error ? e.message : t('reports_export_failed'));
    } finally {
      setExportingId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={t('reports_title')} subtitle={getReportsSubtitle(user?.role, t)} />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding, paddingBottom: theme.spacingXl }}>
        {loading ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-gray-600 mt-3">{t('reports_loading')}</Text>
          </View>
        ) : (
          <>
        {/* Filter Tabs – horizontal scroll so all 4 buttons visible, no cut-off */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4"
          contentContainerStyle={{
            paddingRight: theme.screenPadding + 24,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {reportTypes.map((type) => {
            const isSelected = selectedType === type.id;
            const Icon = type.Icon;
            return (
              <TouchableOpacity
                key={type.id}
                onPress={() => setSelectedType(type.id)}
                className={`px-3.5 py-2 rounded-lg flex-row items-center ${
                  isSelected ? 'bg-blue-600' : 'bg-white border border-gray-300'
                }`}
                style={{ marginRight: 8 }}
              >
                <Icon size={18} color={isSelected ? colors.surface : colors.gray600} />
                <Text
                  className={`ml-2 font-semibold ${isSelected ? 'text-white' : 'text-gray-700'}`}
                  style={{ fontSize: 13 }}
                >
                  {t(type.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {readOnly && (
          <Card className="mb-4 bg-amber-50 border border-amber-200">
            <View className="flex-row items-center py-2">
              <Lock size={20} color={colors.textSecondary} />
              <Text className="text-amber-800 font-semibold ml-2">{t('reports_read_only')}</Text>
            </View>
            <Text className="text-sm text-amber-700">{t('reports_read_only_hint')}</Text>
          </Card>
        )}

        {/* Live Operations summary – only when Operations tab selected */}
        {selectedType === 'operations' && (
          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-600 mb-2">{t('reports_live_operations_title')}</Text>
            <View style={reportCardStyles.liveGrid}>
              <Card style={reportCardStyles.liveCard}>
                <Text style={reportCardStyles.liveValue}>{activeSitesCount}</Text>
                <Text style={reportCardStyles.liveLabel}>{t('dashboard_active_sites')}</Text>
              </Card>
              <Card style={reportCardStyles.liveCard}>
                <Text style={reportCardStyles.liveValue}>{completedTasksCount}</Text>
                <Text style={reportCardStyles.liveLabel}>{t('reports_completed_tasks')}</Text>
              </Card>
              <Card style={reportCardStyles.liveCard}>
                <Text style={reportCardStyles.liveValue}>{inProgressTasksCount}</Text>
                <Text style={reportCardStyles.liveLabel}>{t('task_in_progress')}</Text>
              </Card>
              <Card style={reportCardStyles.liveCard}>
                <Text style={reportCardStyles.liveValue}>{pendingTasksCount}</Text>
                <Text style={reportCardStyles.liveLabel}>{t('reports_pending_tasks')}</Text>
              </Card>
            </View>
          </View>
        )}

        {/* Live Site performance – only when Sites tab selected */}
        {selectedType === 'site_performance' && (
          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-600 mb-2">{t('reports_live_sites_title')}</Text>
            {sites.map((site) => {
              const siteSpent = site.spent ?? 0;
              const siteBudget = site.budget ?? 0;
              const utilization = siteBudget > 0 ? Math.round((siteSpent / siteBudget) * 100) : 0;
              return (
                <Card key={site.id} style={reportCardStyles.siteCard}>
                  <View style={reportCardStyles.siteCardHeader}>
                    <TrendingUp size={18} color={colors.primary} />
                    <Text style={reportCardStyles.siteCardName}>{site.name}</Text>
                  </View>
                  <Text style={reportCardStyles.siteCardLocation}>{site.location}</Text>
                  <View style={reportCardStyles.siteCardRow}>
                    <Text style={reportCardStyles.siteCardLabel}>{t('site_card_progress')}</Text>
                    <Text style={reportCardStyles.siteCardValue}>{site.progress ?? 0}%</Text>
                  </View>
                  <View style={reportCardStyles.siteCardRow}>
                    <Text style={reportCardStyles.siteCardLabel}>{t('site_card_budget')}</Text>
                    <Text style={reportCardStyles.siteCardValue}>{formatAmount(siteBudget, true)}</Text>
                  </View>
                  <View style={reportCardStyles.siteCardRow}>
                    <Text style={reportCardStyles.siteCardLabel}>{t('site_card_spent')}</Text>
                    <Text style={reportCardStyles.siteCardValue}>{formatAmount(siteSpent, true)} ({utilization}%)</Text>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* Available Reports – at top; label varies by tab; month dropdown on the right */}
        <View className="mb-4">
          <View style={reportCardStyles.sectionHeaderRow}>
            <Text style={reportCardStyles.sectionTitleText}>
              {selectedType === 'all' ? t('reports_available') : selectedType === 'financial' ? t('reports_saved_financial') : selectedType === 'operations' ? t('reports_saved_operations') : t('reports_saved_sites')}
            </Text>
            <Pressable
              onPress={() => setMonthDropdownVisible(true)}
              style={reportCardStyles.monthDropdown}
              accessibilityLabel={t('reports_month_filter')}
              accessibilityRole="button"
            >
              <Text style={reportCardStyles.monthDropdownText}>
                {selectedMonthFilter ? formatPeriodLabel(selectedMonthFilter) : t('reports_all_months')}
              </Text>
              <ChevronDown size={18} color={colors.primary} />
            </Pressable>
          </View>
          <Modal
            visible={monthDropdownVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setMonthDropdownVisible(false)}
          >
            <Pressable style={reportCardStyles.monthModalOverlay} onPress={() => setMonthDropdownVisible(false)}>
              <View style={reportCardStyles.monthModalContent} onStartShouldSetResponder={() => true}>
                <Text style={reportCardStyles.monthModalTitle}>{t('reports_month_filter')}</Text>
                <FlatList
                  data={monthOptions}
                  keyExtractor={(item) => item.value || 'all'}
                  renderItem={({ item }) => {
                    const label = item.labelKey === 'reports_all_months' ? t('reports_all_months') : item.labelKey;
                    const selected = item.value === selectedMonthFilter;
                    return (
                      <Pressable
                        onPress={() => {
                          setSelectedMonthFilter(item.value);
                          setMonthDropdownVisible(false);
                        }}
                        style={[reportCardStyles.monthOption, selected && reportCardStyles.monthOptionSelected]}
                      >
                        <Text style={[reportCardStyles.monthOptionText, selected && reportCardStyles.monthOptionTextSelected]}>{label}</Text>
                      </Pressable>
                    );
                  }}
                />
              </View>
            </Pressable>
          </Modal>
          {filteredReports.length === 0 ? (
            <EmptyState
              icon={<FileText size={32} color={colors.textMuted} />}
              title={selectedType === 'all' ? t('reports_no_reports') : t('reports_no_reports_for_type')}
              message={selectedType === 'financial' ? t('reports_empty_financial_hint') : selectedType === 'operations' ? t('reports_empty_operations_hint') : selectedType === 'site_performance' ? t('reports_empty_sites_hint') : t('reports_empty_hint')}
            />
          ) : (
            filteredReports.map((report) => (
              <Card key={report.id} style={reportCardStyles.card}>
                <View style={reportCardStyles.cardHeader}>
                  <View style={reportCardStyles.titleRow}>
                    {report.type === 'financial' && <Banknote size={18} color="#059669" />}
                    {report.type === 'operations' && <BarChart3 size={18} color="#6366f1" />}
                    {report.type === 'site_performance' && <TrendingUp size={18} color={colors.primary} />}
                    {report.type !== 'financial' && report.type !== 'operations' && report.type !== 'site_performance' && <FileText size={18} color="#64748b" />}
                    <Text style={reportCardStyles.cardTitle} numberOfLines={2}>{report.title}</Text>
                  </View>
                  <View style={reportCardStyles.badge}>
                    <Text style={reportCardStyles.badgeText}>{report.period}</Text>
                  </View>
                </View>
                <Text style={reportCardStyles.typeLabel}>{report.type.replace('_', ' ')}</Text>

                <View style={reportCardStyles.dataBox}>
                  {report.type === 'financial' && (() => {
                    const hasData = report.data && (Number(report.data.totalBudget) != null && Number(report.data.totalBudget) !== 0 || Number(report.data.totalSpent) != null && Number(report.data.totalSpent) !== 0);
                    const budget = hasData ? (Number(report.data?.totalBudget) || 0) : totalBudgetAll;
                    const spent = hasData ? (Number(report.data?.totalSpent) || 0) : totalSpentAll;
                    const remaining = hasData ? (Number(report.data?.remainingBudget) ?? (budget - spent)) : remainingBudgetAll;
                    return (
                      <>
                        <View style={reportCardStyles.dataRow}>
                          <Text style={reportCardStyles.dataLabel}>{t('reports_total_budget')}</Text>
                          <Text style={reportCardStyles.dataValue}>{formatAmount(budget, true)}</Text>
                        </View>
                        <View style={reportCardStyles.dataRow}>
                          <Text style={reportCardStyles.dataLabel}>{t('reports_total_spent')}</Text>
                          <Text style={reportCardStyles.dataValue}>{formatAmount(spent, true)}</Text>
                        </View>
                        <View style={reportCardStyles.dataRow}>
                          <Text style={reportCardStyles.dataLabel}>{t('dashboard_remaining')}</Text>
                          <Text style={[reportCardStyles.dataValue, reportCardStyles.dataValueGreen]}>{formatAmount(remaining, true)}</Text>
                        </View>
                        {!hasData && (
                          <Text style={[reportCardStyles.dataLabel, { fontSize: 11, marginTop: 4, color: '#94a3b8' }]}>{t('reports_live_totals_hint')}</Text>
                        )}
                      </>
                    );
                  })()}
                  {report.type === 'operations' && report.data && (
                    <>
                      <View style={reportCardStyles.dataRow}>
                        <Text style={reportCardStyles.dataLabel}>{t('dashboard_active_sites')}</Text>
                        <Text style={reportCardStyles.dataValue}>{String(report.data.activeSites ?? '')}</Text>
                      </View>
                      <View style={reportCardStyles.dataRow}>
                        <Text style={reportCardStyles.dataLabel}>{t('reports_completed_tasks')}</Text>
                        <Text style={[reportCardStyles.dataValue, reportCardStyles.dataValueGreen]}>{String(report.data.completedTasks ?? '')}</Text>
                      </View>
                      <View style={reportCardStyles.dataRow}>
                        <Text style={reportCardStyles.dataLabel}>{t('reports_pending_tasks')}</Text>
                        <Text style={reportCardStyles.dataValueYellow}>{String(report.data.pendingTasks ?? '')}</Text>
                      </View>
                    </>
                  )}
                  {report.type === 'site_performance' && report.data && (() => {
                    const sitesSummary = (report.data.sitesSummary as { siteName: string; progress?: number; budget: number; spent: number; remaining: number; utilizationPct: number }[]) ?? [];
                    const sitesExpenses = (report.data.sitesExpenses as { siteName: string; totalExpenses: number; fuelExpenses: number; generalExpenses: number }[]) ?? [];
                    return (
                      <>
                        <Text style={reportCardStyles.sectionTitle}>{t('reports_site_performance_section')}</Text>
                        {sitesSummary.length === 0 ? (
                          <Text style={reportCardStyles.dataLabel}>{t('reports_no_sites')}</Text>
                        ) : (
                          sitesSummary.map((site, idx) => {
                            const progressPct = Math.min(100, Math.max(0, Number(site.progress ?? 0)));
                            return (
                            <View key={`perf-${idx}`} style={reportCardStyles.siteBlock}>
                              <Text style={reportCardStyles.siteBlockName}>{site.siteName}</Text>
                              <View style={reportCardStyles.progressBarRow}>
                                <Text style={reportCardStyles.dataLabel}>{t('site_card_progress')}</Text>
                                <View style={reportCardStyles.progressBarTrack}>
                                  <View style={[reportCardStyles.progressBarFill, { width: `${progressPct}%` }]} />
                                </View>
                                <Text style={reportCardStyles.progressBarPct}>{progressPct}%</Text>
                              </View>
                              <View style={reportCardStyles.dataRow}>
                                <Text style={reportCardStyles.dataLabel}>{t('reports_total_budget')}</Text>
                                <Text style={reportCardStyles.dataValue}>{formatAmount(Number(site.budget ?? 0), true)}</Text>
                              </View>
                              <View style={reportCardStyles.dataRow}>
                                <Text style={reportCardStyles.dataLabel}>{t('dashboard_spent')}</Text>
                                <Text style={reportCardStyles.dataValue}>{formatAmount(Number(site.spent ?? 0), true)}</Text>
                              </View>
                              <View style={reportCardStyles.dataRow}>
                                <Text style={reportCardStyles.dataLabel}>{t('dashboard_remaining')}</Text>
                                <Text style={[reportCardStyles.dataValue, reportCardStyles.dataValueGreen]}>{formatAmount(Number(site.remaining ?? 0), true)}</Text>
                              </View>
                              <View style={reportCardStyles.dataRow}>
                                <Text style={reportCardStyles.dataLabel}>{t('dashboard_utilization')}</Text>
                                <Text style={reportCardStyles.dataValue}>{Number(site.utilizationPct ?? 0)}%</Text>
                              </View>
                            </View>
                            );
                          })
                        )}
                        <Text style={[reportCardStyles.sectionTitle, { marginTop: 16 }]}>{t('reports_site_expenses_section')}</Text>
                        {sitesExpenses.length === 0 ? (
                          <Text style={reportCardStyles.dataLabel}>{t('reports_no_sites')}</Text>
                        ) : (
                          sitesExpenses.map((site, idx) => (
                            <View key={`exp-${idx}`} style={reportCardStyles.siteBlock}>
                              <Text style={reportCardStyles.siteBlockName}>{site.siteName}</Text>
                              <View style={reportCardStyles.dataRow}>
                                <Text style={reportCardStyles.dataLabel}>{t('dashboard_spent')}</Text>
                                <Text style={reportCardStyles.dataValue}>{formatAmount(Number(site.totalExpenses ?? 0), true)}</Text>
                              </View>
                              <View style={reportCardStyles.dataRow}>
                                <Text style={reportCardStyles.dataLabel}>{t('reports_expense_fuel')}</Text>
                                <Text style={reportCardStyles.dataValue}>{formatAmount(Number(site.fuelExpenses ?? 0), true)}</Text>
                              </View>
                              <View style={reportCardStyles.dataRow}>
                                <Text style={reportCardStyles.dataLabel}>{t('reports_expense_general')}</Text>
                                <Text style={reportCardStyles.dataValue}>{formatAmount(Number(site.generalExpenses ?? 0), true)}</Text>
                              </View>
                            </View>
                          ))
                        )}
                      </>
                    );
                  })()}
                </View>

                <View style={reportCardStyles.cardFooter}>
                  <Text style={reportCardStyles.generatedLabel}>{t('reports_generated_label')}: {report.generatedDate}</Text>
                  {!readOnly && (
                    <TouchableOpacity
                      onPress={() => handleExportCSV(report)}
                      disabled={exportingId === report.id}
                      style={reportCardStyles.exportBtn}
                    >
                      <Download size={16} color="#2563eb" />
                      <Text style={reportCardStyles.exportBtnText}>
                        {exportingId === report.id ? t('reports_exporting') : t('reports_export_download_share_btn')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            ))
          )}
        </View>

        {/* Current site performance – live list so all sites (e.g. Demo 25%) show in Reports */}
        {(selectedType === 'all' || selectedType === 'financial') && showSummary && sites.length > 0 && (
          <View className="mb-4">
            <Text className="text-lg font-bold text-gray-900 mb-3">{t('reports_current_site_performance')}</Text>
            {sites.map((site) => {
              const siteSpent = site.spent ?? 0;
              const siteBudget = site.budget ?? 0;
              const utilization = siteBudget > 0 ? Math.round((siteSpent / siteBudget) * 100) : 0;
              const progressPct = Math.min(100, Math.max(0, site.progress ?? 0));
              return (
                <Card key={site.id} style={[reportCardStyles.siteCard, { marginBottom: 12 }]}>
                  <View style={reportCardStyles.siteCardHeader}>
                    <TrendingUp size={18} color={colors.primary} />
                    <Text style={reportCardStyles.siteCardName}>{site.name}</Text>
                  </View>
                  {site.location ? <Text style={reportCardStyles.siteCardLocation}>{site.location}</Text> : null}
                  <View style={reportCardStyles.progressBarRow}>
                    <Text style={reportCardStyles.dataLabel}>{t('site_card_progress')}</Text>
                    <View style={reportCardStyles.progressBarTrack}>
                      <View style={[reportCardStyles.progressBarFill, { width: `${progressPct}%` }]} />
                    </View>
                    <Text style={reportCardStyles.progressBarPct}>{progressPct}%</Text>
                  </View>
                  <View style={reportCardStyles.siteCardRow}>
                    <Text style={reportCardStyles.siteCardLabel}>{t('site_card_budget')}</Text>
                    <Text style={reportCardStyles.siteCardValue}>{formatAmount(siteBudget, true)}</Text>
                  </View>
                  <View style={reportCardStyles.siteCardRow}>
                    <Text style={reportCardStyles.siteCardLabel}>{t('site_card_spent')}</Text>
                    <Text style={reportCardStyles.siteCardValue}>{formatAmount(siteSpent, true)} ({utilization}%)</Text>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* Financial stats: 2x2 grid – only when All or Financial tab */}
        {(selectedType === 'all' || selectedType === 'financial') && showSummary ? (
          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-600 mb-2">{t('reports_financial_summary')}</Text>
            <View className="flex-row gap-3 mb-3">
              <View className="flex-1">
                <Card className="bg-slate-50 border border-slate-200 p-3">
                  <Text className="text-xs text-slate-500 mb-1">{t('dashboard_total_investment')}</Text>
                  <Text className="text-base font-bold text-slate-900">{formatAmount(totalBudget, true)}</Text>
                </Card>
              </View>
              <View className="flex-1">
                <Card className="bg-slate-50 border border-slate-200 p-3">
                  <Text className="text-xs text-slate-500 mb-1">{t('dashboard_spent')}</Text>
                  <Text className="text-base font-bold text-slate-900">{formatAmount(totalSpent, true)}</Text>
                </Card>
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Card className="bg-slate-50 border border-slate-200 p-3">
                  <Text className="text-xs text-slate-500 mb-1">{t('dashboard_remaining')}</Text>
                  <Text className="text-base font-bold text-slate-900">{formatAmount(remaining, true)}</Text>
                </Card>
              </View>
              <View className="flex-1">
                <Card className="bg-slate-50 border border-slate-200 p-3">
                  <Text className="text-xs text-slate-500 mb-1">{t('dashboard_utilization')}</Text>
                  <Text className="text-base font-bold text-slate-900">{utilizationPct}%</Text>
                </Card>
              </View>
            </View>
          </View>
        ) : null}

        {/* Vehicle Fuel Summary – only when All or Financial tab */}
        {(selectedType === 'all' || selectedType === 'financial') && showSummary && (
          <View className="mb-4">
            <Text className="text-lg font-bold text-gray-900 mb-3">{t('reports_vehicle_fuel_title')}</Text>
            <View className="flex-row flex-wrap gap-2 mb-3">
              <TouchableOpacity
                onPress={() => setFuelSiteId(null)}
                className={`px-3 py-2 rounded-lg ${fuelSiteId === null ? 'bg-blue-600' : 'bg-white border border-gray-300'}`}
              >
                <Text className={fuelSiteId === null ? 'text-white font-medium' : 'text-gray-700'}>{t('reports_all_sites')}</Text>
              </TouchableOpacity>
              {sites.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setFuelSiteId(s.id)}
                  className={`px-3 py-2 rounded-lg ${fuelSiteId === s.id ? 'bg-blue-600' : 'bg-white border border-gray-300'}`}
                >
                  <Text className={fuelSiteId === s.id ? 'text-white font-medium' : 'text-gray-700'}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row flex-wrap gap-2 mb-3">
              <TouchableOpacity
                onPress={() => setFuelVehicleType('all')}
                className={`px-3 py-2 rounded-lg ${fuelVehicleType === 'all' ? 'bg-blue-600' : 'bg-white border border-gray-300'}`}
              >
                <Text className={fuelVehicleType === 'all' ? 'text-white font-medium' : 'text-gray-700'}>{t('vehicles_all')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setFuelVehicleType('truck')}
                className={`px-3 py-2 rounded-lg ${fuelVehicleType === 'truck' ? 'bg-blue-600' : 'bg-white border border-gray-300'}`}
              >
                <Text className={fuelVehicleType === 'truck' ? 'text-white font-medium' : 'text-gray-700'}>{t('vehicles_trucks')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setFuelVehicleType('machine')}
                className={`px-3 py-2 rounded-lg ${fuelVehicleType === 'machine' ? 'bg-blue-600' : 'bg-white border border-gray-300'}`}
              >
                <Text className={fuelVehicleType === 'machine' ? 'text-white font-medium' : 'text-gray-700'}>{t('vehicles_machines')}</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row gap-2 mb-2">
              <View className="flex-1">
                <DatePickerField
                  label={t('reports_from_date_label')}
                  value={fuelDateFrom}
                  onValueChange={setFuelDateFrom}
                  placeholder={t('reports_from_placeholder')}
                />
              </View>
              <View className="flex-1">
                <DatePickerField
                  label={t('reports_to_date_label')}
                  value={fuelDateTo}
                  onValueChange={setFuelDateTo}
                  placeholder={t('reports_to_placeholder')}
                />
              </View>
            </View>
            <View className="flex-row flex-wrap gap-2 mb-3">
              <TouchableOpacity
                onPress={() => {
                  const end = new Date();
                  const start = new Date(end);
                  start.setDate(start.getDate() - 6);
                  setFuelDateFrom(start.toISOString().slice(0, 10));
                  setFuelDateTo(end.toISOString().slice(0, 10));
                }}
                className="px-3 py-2 rounded-lg bg-slate-100 border border-slate-200"
              >
                <Text className="text-slate-700 text-sm font-medium">{t('reports_last_7_days')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const now = new Date();
                  setFuelDateFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
                  setFuelDateTo(now.toISOString().slice(0, 10));
                }}
                className="px-3 py-2 rounded-lg bg-slate-100 border border-slate-200"
              >
                <Text className="text-slate-700 text-sm font-medium">{t('reports_this_month')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setFuelDateFrom(''); setFuelDateTo(''); }}
                className="px-3 py-2 rounded-lg bg-slate-100 border border-slate-200"
              >
                <Text className="text-slate-700 text-sm font-medium">{t('reports_clear_dates')}</Text>
              </TouchableOpacity>
            </View>
            {vehiclesForFuel.length === 0 ? (
              <EmptyState
                icon={<Fuel size={32} color={colors.textMuted} />}
                title={t('reports_no_vehicles_allocated')}
                message=""
              />
            ) : vehiclesForFuel.map((v) => {
              const filled = fuelExpensesByVehicle[v.id];
              const totalFilled = filled?.litres ?? 0;
              const totalCost = filled?.cost ?? 0;
              const distance = tripDistanceByVehicle[v.id] ?? 0;
              const hours = sessionHoursByVehicle[v.id] ?? 0;
              const expected = expectedFuelByVehicle[v.id] ?? 0;
              const actual = actualFuelByVehicle[v.id] ?? 0;
              const variance = expected > 0 ? ((actual - expected) / expected) * 100 : 0;
              return (
                <Card key={v.id} className="mb-2">
                  <View className="flex-row items-center mb-2">
                    <Fuel size={18} color="#3B82F6" />
                    <Text className="font-semibold text-gray-900 ml-2">{v.vehicleNumberOrId}</Text>
                    <Text className="text-xs text-gray-500 ml-2 capitalize">{v.type}</Text>
                  </View>
                  <View className="flex-row flex-wrap gap-4 mb-2">
                    <View>
                      <Text className="text-xs text-gray-500">{t('reports_expected_l')}</Text>
                      <Text className="text-sm font-semibold">{expected.toFixed(1)}</Text>
                    </View>
                    <View>
                      <Text className="text-xs text-gray-500">{t('reports_actual_l')}</Text>
                      <Text className="text-sm font-semibold">{actual.toFixed(1)}</Text>
                    </View>
                    <View>
                      <Text className="text-xs text-gray-500">{t('reports_variance')}</Text>
                      <Text className={`text-sm font-semibold ${variance > 0 ? 'text-amber-600' : variance < 0 ? 'text-green-600' : 'text-gray-700'}`}>
                        {variance > 0 ? '+' : ''}{variance.toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row flex-wrap gap-4 pt-2 border-t border-gray-100">
                    <View>
                      <Text className="text-xs text-gray-500">{t('reports_total_filled_l')}</Text>
                      <Text className="text-sm font-semibold">{totalFilled.toFixed(1)}</Text>
                    </View>
                    <View>
                      <Text className="text-xs text-gray-500">{t('reports_fuel_cost')}</Text>
                      <Text className="text-sm font-semibold">{formatAmount(totalCost)}</Text>
                    </View>
                    <View>
                      <Text className="text-xs text-gray-500">{v.type === 'truck' ? t('reports_distance_km') : t('reports_hours')}</Text>
                      <Text className="text-sm font-semibold">{v.type === 'truck' ? distance : hours.toFixed(1)}</Text>
                    </View>
                    <View>
                      <Text className="text-xs text-gray-500">{t('reports_remaining_l')}</Text>
                      <Text className="text-sm font-semibold">{(v.fuelBalanceLitre ?? 0).toFixed(1)}</Text>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* Generate Report – Owner / Admin / Head Supervisor */}
        {canGenerate && (
          <Card className="bg-blue-50 mb-4">
            <View className="py-2">
            <Text className="text-base font-bold text-gray-900 mb-2">{t('reports_generate')}</Text>
            <Text className="text-sm text-gray-600 mb-2">
                {t('reports_generate_hint')}
              </Text>
              <Text className="text-xs text-gray-600 mb-2">{t('reports_period')}</Text>
              <View className="flex-row gap-2 mb-4">
                <TouchableOpacity
                  onPress={() => setReportPeriod('this_month')}
                  className={`flex-1 py-2.5 rounded-lg ${reportPeriod === 'this_month' ? 'bg-blue-600' : 'bg-white border border-gray-300'}`}
                >
                  <Text className={`text-center font-medium ${reportPeriod === 'this_month' ? 'text-white' : 'text-gray-700'}`}>
                    {t('users_period_this_month')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setReportPeriod('last_month')}
                  className={`flex-1 py-2.5 rounded-lg ${reportPeriod === 'last_month' ? 'bg-blue-600' : 'bg-white border border-gray-300'}`}
                >
                  <Text className={`text-center font-medium ${reportPeriod === 'last_month' ? 'text-white' : 'text-gray-700'}`}>
                    {t('users_period_last_month')}
                  </Text>
                </TouchableOpacity>
              </View>
              <Button onPress={handleGenerateReport} disabled={generating}>
                {generating ? t('reports_generating') : t('reports_generate')}
              </Button>
            </View>
          </Card>
        )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const reportCardStyles = StyleSheet.create({
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionTitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
    minWidth: 0,
  },
  monthDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  monthDropdownText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  monthModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  monthModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    maxHeight: '70%',
  },
  monthModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  monthOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  monthOptionSelected: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  monthOptionText: {
    fontSize: 15,
    color: '#334155',
  },
  monthOptionTextSelected: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  card: {
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  badge: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  typeLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'capitalize',
    marginBottom: 12,
  },
  dataBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  siteBlock: {
    marginBottom: 12,
    padding: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    marginTop: 4,
  },
  progressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  progressBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#e2e8f0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 5,
  },
  progressBarPct: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    minWidth: 36,
    textAlign: 'right',
  },
  siteBlockName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dataLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  dataValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  dataValueGreen: { color: '#059669' },
  dataValueYellow: { color: '#b45309' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  generatedLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  exportBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 6,
    textAlign: 'center',
  },
  liveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  liveCard: {
    flexBasis: '47%',
    alignItems: 'center',
    paddingVertical: 16,
  },
  liveValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  liveLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  siteCard: {
    marginBottom: 12,
  },
  siteCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  siteCardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  siteCardLocation: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  siteCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  siteCardLabel: { fontSize: 13, color: '#64748b' },
  siteCardValue: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
});
