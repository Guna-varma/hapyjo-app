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
import { buildFinancialSummary } from '@/lib/financeSummary';
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
type SitePerformanceSite = {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'inactive' | 'completed';
  startDate: string;
  expectedEndDate?: string;
  budget: number;
  spent: number;
  progress: number;
  contractRateRwf?: number | null;
};

/** Format period "YYYY-MM" to "Mon-YYYY" e.g. "Mar-2026" */
function formatPeriodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return `${MONTH_LABELS[m - 1]}-${y}`;
}

const YYYY_MM = /^\d{4}-\d{2}$/;
/** Normalize period to YYYY-MM so "This month" and "2026-03" are the same month. */
function normalizePeriodToYYYYMM(period: string): string {
  const p = (period || '').trim();
  if (YYYY_MM.test(p)) return p;
  const lower = p.toLowerCase();
  if (lower === 'this month' || lower === 'this_month') {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  return p;
}

function getCurrentYYYYMM(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getReportsSubtitle(role: string | undefined, t: (key: string) => string): string {
  if (role === 'accountant') return t('reports_subtitle_accountant');
  if (role === 'owner') return t('reports_subtitle_owner');
  if (role === 'head_supervisor') return t('reports_subtitle_head_supervisor');
  if (role === 'admin') return t('reports_subtitle_admin');
  return t('reports_title');
}

/** Group sites by start date month (YYYY-MM). */
function getSitesGroupedByMonth(sites: SitePerformanceSite[]): Map<string, SitePerformanceSite[]> {
  const map = new Map<string, SitePerformanceSite[]>();
  sites.forEach((site) => {
    const d = site.startDate?.slice(0, 7) || '';
    if (!d) return;
    const list = map.get(d) ?? [];
    list.push(site);
    map.set(d, list);
  });
  return map;
}

/** Group fuel expenses by month; return Map<YYYY-MM, { litres, cost }>. */
function getFuelByMonth(expenses: { type: string; date: string; amountRwf?: number; litres?: number }[]): Map<string, { litres: number; cost: number }> {
  const map = new Map<string, { litres: number; cost: number }>();
  expenses.filter((e) => e.type === 'fuel' && e.date).forEach((e) => {
    const ym = e.date.slice(0, 7);
    const cur = map.get(ym) ?? { litres: 0, cost: 0 };
    cur.litres += e.litres ?? 0;
    cur.cost += e.amountRwf ?? 0;
    map.set(ym, cur);
  });
  return map;
}

function daysRemaining(deadline: string | undefined): number | null {
  if (!deadline) return null;
  const end = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function SitePerformanceCard({
  site,
  formatAmount,
  t,
  reportCardStyles,
  ownerStyles,
}: {
  site: { name: string; location: string; status: string; startDate: string; expectedEndDate?: string; budget: number; spent: number; progress: number; contractRateRwf?: number | null };
  formatAmount: (n: number, compact?: boolean) => string;
  t: (k: string) => string;
  reportCardStyles: Record<string, object>;
  ownerStyles: Record<string, object>;
}) {
  const days = daysRemaining(site.expectedEndDate);
  const statusLabel = site.status === 'completed' ? t('reports_status_completed') : t('reports_status_in_progress');
  const daysColor = days == null ? '#64748b' : days < 0 ? '#dc2626' : days <= 10 ? '#b45309' : '#059669';
  const contractRate = site.contractRateRwf ?? 0;
  return (
    <Card style={reportCardStyles.siteCard}>
      <View style={reportCardStyles.siteCardHeader}>
        <TrendingUp size={18} color={colors.primary} />
        <Text style={reportCardStyles.siteCardName}>{site.name}</Text>
      </View>
      <Text style={reportCardStyles.siteCardLocation}>{site.location}</Text>
      <View style={reportCardStyles.siteCardRow}>
        <Text style={reportCardStyles.siteCardLabel}>{t('site_card_progress')}</Text>
        <Text style={reportCardStyles.siteCardValue}>{site.progress ?? 0}%</Text>
      </View>
      <View style={reportCardStyles.progressBarRow}>
        <View style={reportCardStyles.progressBarTrack}>
          <View style={[reportCardStyles.progressBarFill, { width: `${Math.min(100, site.progress ?? 0)}%` }]} />
        </View>
      </View>
      <View style={reportCardStyles.siteCardRow}>
        <Text style={reportCardStyles.siteCardLabel}>{t('reports_total_budget')}</Text>
        <Text style={reportCardStyles.siteCardValue}>{formatAmount(site.budget ?? 0, true)}</Text>
      </View>
      <View style={reportCardStyles.siteCardRow}>
        <Text style={reportCardStyles.siteCardLabel}>{t('reports_total_spent')}</Text>
        <Text style={reportCardStyles.siteCardValue}>{formatAmount(site.spent ?? 0, true)}</Text>
      </View>
      <View style={reportCardStyles.siteCardRow}>
        <Text style={reportCardStyles.siteCardLabel}>{t('reports_contract_rate_rwf_m3')}</Text>
        <Text style={reportCardStyles.siteCardValue}>{contractRate > 0 ? `${contractRate.toLocaleString()} RWF/m³` : t('owner_contract_rate_not_set')}</Text>
      </View>
      {site.expectedEndDate && (
        <View style={reportCardStyles.siteCardRow}>
          <Text style={reportCardStyles.siteCardLabel}>{t('reports_days_remaining')}</Text>
          <Text style={[reportCardStyles.siteCardValue, { color: daysColor }]}>
            {days != null ? (days < 0 ? `${Math.abs(days)} overdue` : days) : '-'}
          </Text>
        </View>
      )}
      {site.startDate && (
        <View style={reportCardStyles.siteCardRow}>
          <Text style={reportCardStyles.siteCardLabel}>Start</Text>
          <Text style={reportCardStyles.siteCardValue}>{site.startDate}</Text>
        </View>
      )}
      {site.expectedEndDate && (
        <View style={reportCardStyles.siteCardRow}>
          <Text style={reportCardStyles.siteCardLabel}>Deadline</Text>
          <Text style={reportCardStyles.siteCardValue}>{site.expectedEndDate}</Text>
        </View>
      )}
      <View style={reportCardStyles.siteCardRow}>
        <Text style={reportCardStyles.siteCardLabel}>Status</Text>
        <Text style={reportCardStyles.siteCardValue}>{statusLabel}</Text>
      </View>
    </Card>
  );
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
  const { sites, vehicles, expenses, trips, machineSessions, surveys, reports, tasks, refetch, loading } = useMockAppStore();
  const [selectedType, setSelectedType] = useState<'all' | 'financial' | 'operations' | 'site_performance'>('all');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('');
  const [monthDropdownVisible, setMonthDropdownVisible] = useState(false);
  const [sitePerfMonthDropdownVisible, setSitePerfMonthDropdownVisible] = useState(false);
  const [selectedSitePerfMonth, setSelectedSitePerfMonth] = useState<string>(getCurrentYYYYMM());
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [siteDropdownVisible, setSiteDropdownVisible] = useState(false);
  const [fuelSiteId, setFuelSiteId] = useState<string | null>(null);
  const [fuelVehicleType, setFuelVehicleType] = useState<'all' | 'truck' | 'machine'>('all');
  const [fuelDateFrom, setFuelDateFrom] = useState('');
  const [fuelDateTo, setFuelDateTo] = useState('');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const readOnly = user ? isReportsReadOnly(user.role) : false;
  const showSummary = user ? canSeeFinancialSummary(user.role) : false;
  const isOwnerLayout = user?.role === 'owner';
  /** Same financial reports layout for Owner and Accountant: Financial Summary, site budgets, contract rates, expenses, Export/Share. */
  const isFinancialReportsLayout = user?.role === 'owner' || user?.role === 'accountant';
  const [selectedSiteForExpenseDetail, setSelectedSiteForExpenseDetail] = useState<typeof sites[0] | null>(null);
  const selectedSiteLabel = selectedSiteId
    ? (sites.find((s) => s.id === selectedSiteId)?.name ?? selectedSiteId)
    : t('reports_all_sites');
  const filteredSites = useMemo(
    () => (selectedSiteId ? sites.filter((s) => s.id === selectedSiteId) : sites),
    [sites, selectedSiteId]
  );
  const filteredExpenses = useMemo(
    () => (selectedSiteId ? expenses.filter((e) => e.siteId === selectedSiteId) : expenses),
    [expenses, selectedSiteId]
  );
  const siteFilterOptions = useMemo(
    () => [
      { id: '', name: t('reports_all_sites') },
      ...sites
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({ id: s.id, name: s.name })),
    ],
    [sites, t]
  );

  // Tabs as data drivers: refetch when report type filter changes so list stays in sync (and future API can filter by type)
  useEffect(() => {
    refetch();
  }, [selectedType, refetch]);

  useEffect(() => {
    if (selectedSiteForExpenseDetail && selectedSiteId && selectedSiteForExpenseDetail.id !== selectedSiteId) {
      setSelectedSiteForExpenseDetail(null);
    }
  }, [selectedSiteForExpenseDetail, selectedSiteId]);


  // One financial report per month: normalize "This month" → current YYYY-MM and prefer YYYY-MM period.
  const financialReportsByMonth = useMemo(() => {
    const map = new Map<string, (typeof reports)[0]>();
    reports.filter((r) => r.type === 'financial').forEach((r) => {
      const norm = normalizePeriodToYYYYMM(r.period);
      const existing = map.get(norm);
      if (!existing || YYYY_MM.test(r.period)) map.set(norm, r);
    });
    return map;
  }, [reports]);

  const financialMonthOptions = useMemo(() => {
    const periods = Array.from(financialReportsByMonth.keys()).filter((p) => YYYY_MM.test(p));
    periods.sort((a, b) => b.localeCompare(a));
    return periods.map((p) => ({ value: p, labelKey: formatPeriodLabel(p) }));
  }, [financialReportsByMonth]);

  const bannerMonth = selectedType === 'financial'
    ? (selectedMonthFilter && financialMonthOptions.some((o) => o.value === selectedMonthFilter) ? selectedMonthFilter : financialMonthOptions[0]?.value ?? '')
    : selectedMonthFilter;
  const selectedBannerReport = selectedType === 'financial' && bannerMonth ? financialReportsByMonth.get(bannerMonth) : null;

  const filteredReports = useMemo(() => {
    let list: (typeof reports) = [];
    if (selectedType === 'all') {
      const oneFinancialPerMonth = Array.from(financialReportsByMonth.values());
      const nonFinancial = reports.filter((r) => r.type !== 'financial');
      list = [...oneFinancialPerMonth, ...nonFinancial].sort((a, b) => (b.generatedDate || b.period).localeCompare(a.generatedDate || a.period));
    } else {
      list = reports.filter((r) => r.type === selectedType);
    }
    if (selectedMonthFilter) list = list.filter((r) => normalizePeriodToYYYYMM(r.period) === selectedMonthFilter || r.period === selectedMonthFilter);
    return list;
  }, [reports, selectedType, selectedMonthFilter, financialReportsByMonth]);

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

  const filteredSurveys = useMemo(
    () => (selectedSiteId ? surveys.filter((s) => s.siteId === selectedSiteId) : surveys),
    [surveys, selectedSiteId]
  );
  const scopedFinancialSummary = useMemo(
    () => buildFinancialSummary({ sites: filteredSites, surveys: filteredSurveys, expenses: filteredExpenses }),
    [filteredSites, filteredSurveys, filteredExpenses]
  );
  const siteExpenseById = useMemo(
    () =>
      filteredSites.reduce<Record<string, number>>((acc, site) => {
        acc[site.id] = scopedFinancialSummary.bySiteId[site.id]?.expensesRwf ?? 0;
        return acc;
      }, {}),
    [filteredSites, scopedFinancialSummary.bySiteId]
  );
  const sitePerformanceByMonth = useMemo(
    () => getSitesGroupedByMonth(filteredSites),
    [filteredSites]
  );
  const sitePerformanceMonthOptions = useMemo(() => {
    const months = Array.from(sitePerformanceByMonth.keys()).filter((m) => YYYY_MM.test(m));
    const currentMonth = getCurrentYYYYMM();
    if (!months.includes(currentMonth)) months.push(currentMonth);
    months.sort((a, b) => b.localeCompare(a));
    return months.map((m) => ({ value: m, labelKey: formatPeriodLabel(m) }));
  }, [sitePerformanceByMonth]);
  useEffect(() => {
    if (sitePerformanceMonthOptions.length === 0) return;
    const stillValid = sitePerformanceMonthOptions.some((o) => o.value === selectedSitePerfMonth);
    if (!stillValid) setSelectedSitePerfMonth(sitePerformanceMonthOptions[0].value);
  }, [sitePerformanceMonthOptions, selectedSitePerfMonth]);
  const selectedMonthSitesForPerformance = useMemo(
    () => sitePerformanceByMonth.get(selectedSitePerfMonth) ?? [],
    [sitePerformanceByMonth, selectedSitePerfMonth]
  );

  // Single source of truth for summary cards: scoped by selected site (or all sites).
  const totalBudget = scopedFinancialSummary.totals.totalBudgetRwf;
  const totalSpent = scopedFinancialSummary.totals.expensesRwf;
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
  const vehicleIdsForFuelSet = useMemo(() => new Set(vehiclesForFuel.map((v) => v.id)), [vehiclesForFuel]);
  const filteredFuelEntries = useMemo(() => {
    return expenses
      .filter((e) => e.type === 'fuel' && e.vehicleId && vehicleIdsForFuelSet.has(e.vehicleId) && inDateRange(e.date ?? ''))
      .map((e) => {
        const vehicle = vehicles.find((v) => v.id === e.vehicleId);
        const site = sites.find((s) => s.id === (e.siteId ?? vehicle?.siteId));
        return {
          date: e.date ?? '',
          vehicleId: e.vehicleId!,
          vehicleName: vehicle?.vehicleNumberOrId ?? e.vehicleId,
          assignedLocation: site?.name ?? (e.siteId ?? ''),
          litres: e.litres ?? 0,
          cost: e.amountRwf ?? 0,
          description: e.description ?? '',
        };
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [expenses, vehicleIdsForFuelSet, vehicles, sites, fuelDateFrom, fuelDateTo]);
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

  const totalSpentAll = totalSpent;
  const totalBudgetAll = totalBudget;
  const remainingBudgetAll = remaining;
  const totalExpensesAll = totalSpent;
  const totalMaintenanceAll = filteredExpenses
    .filter((e) => e.expenseCategory === 'maintenance')
    .reduce((sum, e) => sum + (e.amountRwf ?? 0), 0);
  const revenueAll = scopedFinancialSummary.totals.revenueRwf;
  const netProfitAll = scopedFinancialSummary.totals.profitRwf;

  // Live data for Operations tab (not from saved reports)
  const scopedTasks = selectedSiteId ? tasks.filter((t) => t.siteId === selectedSiteId) : tasks;
  const activeSitesCount = filteredSites.filter((s) => s.status === 'active').length;
  const completedTasksCount = scopedTasks.filter((t) => t.status === 'completed').length;
  const pendingTasksCount = scopedTasks.filter((t) => t.status === 'pending').length;
  const inProgressTasksCount = scopedTasks.filter((t) => t.status === 'in_progress').length;

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

  const handleExportSitePerformanceCSV = async (sitesList: SitePerformanceSite[], monthScope?: string) => {
    setExportingId('site-perf');
    try {
      const scopedMonth = monthScope && YYYY_MM.test(monthScope) ? monthScope : '';
      const scopedMonthLabel = scopedMonth ? formatPeriodLabel(scopedMonth) : t('reports_all_months');
      const headers = ['site_name', 'location', 'status', 'start_date', 'deadline_date', 'days_remaining', 'budget', 'spent', 'progress', 'contract_rate_rwf_m3'];
      const rows = sitesList.map((s) => [
        csvEscape(s.name),
        csvEscape(s.location ?? ''),
        csvEscape(s.status),
        csvEscape(s.startDate ?? ''),
        csvEscape(s.expectedEndDate ?? ''),
        csvEscape(daysRemaining(s.expectedEndDate) ?? ''),
        csvEscape(s.budget ?? 0),
        csvEscape(siteExpenseById[s.id] ?? 0),
        csvEscape(s.progress ?? 0),
        csvEscape((s.contractRateRwf ?? 0) > 0 ? String(s.contractRateRwf) : t('owner_contract_rate_not_set')),
      ].join(','));
      const csv = '\uFEFF' + [
        csvEscape('HapyJo – Monthly Site Performance'),
        '',
        [csvEscape('Site scope'), csvEscape(selectedSiteLabel)].join(','),
        [csvEscape('Month'), csvEscape(scopedMonthLabel)].join(','),
        '',
        headers.join(','),
        ...rows,
      ].join('\r\n');
      const filename = `HapyJo_Monthly_Site_Performance_${scopedMonth || new Date().toISOString().slice(0, 10)}.csv`;
      const dir = documentDirectory ?? cacheDirectory ?? '';
      const path = `${dir}${filename}`;
      await writeAsStringAsync(path, csv, { encoding: EncodingType.UTF8 });
      try {
        const Sharing = await import('expo-sharing');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: t('reports_export_download_share') });
        } else {
          Alert.alert(t('reports_exported'), `${t('reports_exported_path')} ${path}`);
        }
      } catch {
        Alert.alert(t('reports_exported'), `${t('reports_exported_path')} ${path}`);
      }
    } catch (e) {
      Alert.alert(t('reports_export_failed_title'), e instanceof Error ? e.message : t('reports_export_failed'));
    } finally {
      setExportingId(null);
    }
  };

  const handleExportVehicleFuelReport = async () => {
    setExportingId('vehicle-fuel');
    try {
      const siteLabel = fuelSiteId ? (sites.find((s) => s.id === fuelSiteId)?.name ?? fuelSiteId) : t('reports_all_sites');
      const typeLabel = fuelVehicleType === 'all' ? t('vehicles_all') : fuelVehicleType === 'truck' ? t('vehicles_trucks') : t('vehicles_machines');
      const dateRangeLabel = fuelDateFrom && fuelDateTo ? `${fuelDateFrom} to ${fuelDateTo}` : fuelDateFrom ? `${fuelDateFrom} onwards` : fuelDateTo ? `up to ${fuelDateTo}` : t('reports_all_months');
      const rows: string[] = [
        csvEscape('HapyJo – Vehicle Fuel Summary (filtered)'),
        '',
        [csvEscape('Filter'), csvEscape('Value')].join(','),
        [csvEscape('Site'), csvEscape(siteLabel)].join(','),
        [csvEscape('Vehicle type'), csvEscape(typeLabel)].join(','),
        [csvEscape('Date range'), csvEscape(dateRangeLabel)].join(','),
        '',
        [csvEscape('Date'), csvEscape('Vehicle'), csvEscape('Assigned location'), csvEscape('Litres'), csvEscape('Cost (RWF)'), csvEscape('Description')].join(','),
        ...filteredFuelEntries.map((e) =>
          [csvEscape(e.date ?? ''), csvEscape(e.vehicleName ?? ''), csvEscape(e.assignedLocation ?? ''), csvEscape(e.litres), csvEscape(e.cost), csvEscape(e.description ?? '')].join(',')
        ),
        '',
        csvEscape('Approx. fuel remaining in tank (L)'),
        [csvEscape('Vehicle'), csvEscape(t('reports_remaining_l'))].join(','),
        ...vehiclesForFuel.map((v) => [csvEscape(v.vehicleNumberOrId), csvEscape((v.fuelBalanceLitre ?? 0).toFixed(1))].join(',')),
      ];
      const csv = '\uFEFF' + rows.join('\r\n');
      const filename = `HapyJo_Vehicle_Fuel_${new Date().toISOString().slice(0, 10)}.csv`;
      const dir = documentDirectory ?? cacheDirectory ?? '';
      const path = `${dir}${filename}`;
      await writeAsStringAsync(path, csv, { encoding: EncodingType.UTF8 });
      try {
        const Sharing = await import('expo-sharing');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: t('reports_export_download_share') });
        } else {
          Alert.alert(t('reports_exported'), `${t('reports_exported_path')} ${path}`);
        }
      } catch {
        Alert.alert(t('reports_exported'), `${t('reports_exported_path')} ${path}`);
      }
    } catch (e) {
      Alert.alert(t('reports_export_failed_title'), e instanceof Error ? e.message : t('reports_export_failed'));
    } finally {
      setExportingId(null);
    }
  };

  const handleExportFinancialSummaryCSV = async () => {
    setExportingId('financial-summary');
    try {
      const rows: string[] = [
        csvEscape('HapyJo – Financial Summary'),
        '',
        [csvEscape('Metric'), csvEscape('Value (RWF)')].join(','),
        [csvEscape(t('reports_total_budget')), csvEscape(formatAmount(totalBudgetAll, true))].join(','),
        [csvEscape(t('reports_total_expenses')), csvEscape(formatAmount(totalExpensesAll, true))].join(','),
        [csvEscape(t('reports_maintenance_cost')), csvEscape(formatAmount(totalMaintenanceAll, true))].join(','),
        [csvEscape(t('reports_net_profit')), csvEscape(formatAmount(netProfitAll, true))].join(','),
        '',
        [csvEscape('Site'), csvEscape('Location'), csvEscape(t('reports_total_budget')), csvEscape(t('reports_total_spent')), csvEscape(t('reports_contract_rate_rwf_m3'))].join(','),
        ...filteredSites.map((s) => [
          csvEscape(s.name ?? ''),
          csvEscape(s.location ?? ''),
          csvEscape(s.budget ?? 0),
          csvEscape(siteExpenseById[s.id] ?? 0),
          csvEscape((s.contractRateRwf ?? 0) > 0 ? `${(s.contractRateRwf ?? 0).toLocaleString()} RWF/m³` : t('owner_contract_rate_not_set')),
        ].join(',')),
      ];
      const csv = '\uFEFF' + rows.join('\r\n');
      const filename = `HapyJo_Financial_Summary_${new Date().toISOString().slice(0, 10)}.csv`;
      const dir = documentDirectory ?? cacheDirectory ?? '';
      const path = `${dir}${filename}`;
      await writeAsStringAsync(path, csv, { encoding: EncodingType.UTF8 });
      const Sharing = await import('expo-sharing');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: t('reports_export_download_share') });
      } else {
        Alert.alert(t('reports_exported'), `${t('reports_exported_path')} ${path}`);
      }
    } catch (e) {
      Alert.alert(t('reports_export_failed_title'), e instanceof Error ? e.message : t('reports_export_failed'));
    } finally {
      setExportingId(null);
    }
  };

  const handleExportFuelSummaryCSV = async () => {
    setExportingId('fuel-summary');
    try {
      const byMonth = getFuelByMonth(filteredExpenses);
      const months = Array.from(byMonth.keys()).sort((a, b) => b.localeCompare(a));
      const rows: string[] = [
        csvEscape('HapyJo – Fuel Summary (by month)'),
        '',
        [csvEscape('Scope'), csvEscape(selectedSiteLabel)].join(','),
        '',
        [csvEscape('Month'), csvEscape(t('reports_fuel_used')), csvEscape(t('reports_fuel_cost_month'))].join(','),
        ...months.map((ym) => {
          const row = byMonth.get(ym)!;
          return [csvEscape(formatPeriodLabel(ym)), csvEscape(row.litres.toFixed(0) + ' L'), csvEscape(formatAmount(row.cost, true))].join(',');
        }),
      ];
      const csv = '\uFEFF' + rows.join('\r\n');
      const filename = `HapyJo_Fuel_Summary_${new Date().toISOString().slice(0, 10)}.csv`;
      const dir = documentDirectory ?? cacheDirectory ?? '';
      const path = `${dir}${filename}`;
      await writeAsStringAsync(path, csv, { encoding: EncodingType.UTF8 });
      const Sharing = await import('expo-sharing');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: t('reports_export_download_share') });
      } else {
        Alert.alert(t('reports_exported'), `${t('reports_exported_path')} ${path}`);
      }
    } catch (e) {
      Alert.alert(t('reports_export_failed_title'), e instanceof Error ? e.message : t('reports_export_failed'));
    } finally {
      setExportingId(null);
    }
  };

  const handleExportSiteExpensesCSV = async () => {
    setExportingId('site-expenses');
    try {
      const expenseCategoryLabel = (e: (typeof expenses)[0]) => e.type === 'fuel' ? t('expenses_category_fuel') : (e.expenseCategory ? t('expenses_category_' + e.expenseCategory) : t('expenses_category_other'));
      const rows: string[] = [
        csvEscape('HapyJo – Site Expense Reports'),
        '',
        [csvEscape('Site'), csvEscape('Location'), csvEscape(t('reports_total_site_expense')), csvEscape(t('reports_contract_rate_rwf_m3'))].join(','),
        ...filteredSites.map((s) => [
          csvEscape(s.name ?? ''),
          csvEscape(s.location ?? ''),
          csvEscape(formatAmount(siteExpenseById[s.id] ?? 0, true)),
          csvEscape((s.contractRateRwf ?? 0) > 0 ? `${(s.contractRateRwf ?? 0).toLocaleString()} RWF/m³` : t('owner_contract_rate_not_set')),
        ].join(',')),
        '',
        [csvEscape('Date'), csvEscape('Site'), csvEscape('Category'), csvEscape('Amount (RWF)'), csvEscape('Description')].join(','),
        ...filteredExpenses.map((e) => {
          const siteName = sites.find((x) => x.id === e.siteId)?.name ?? '';
          return [csvEscape(e.date ?? ''), csvEscape(siteName), csvEscape(expenseCategoryLabel(e)), csvEscape(e.amountRwf ?? 0), csvEscape(e.description ?? '')].join(',');
        }),
      ];
      const csv = '\uFEFF' + rows.join('\r\n');
      const filename = `HapyJo_Site_Expenses_${new Date().toISOString().slice(0, 10)}.csv`;
      const dir = documentDirectory ?? cacheDirectory ?? '';
      const path = `${dir}${filename}`;
      await writeAsStringAsync(path, csv, { encoding: EncodingType.UTF8 });
      const Sharing = await import('expo-sharing');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: t('reports_export_download_share') });
      } else {
        Alert.alert(t('reports_exported'), `${t('reports_exported_path')} ${path}`);
      }
    } catch (e) {
      Alert.alert(t('reports_export_failed_title'), e instanceof Error ? e.message : t('reports_export_failed'));
    } finally {
      setExportingId(null);
    }
  };

  const handleExportSiteExpenseDetailCSV = async (site: typeof sites[0]) => {
    setExportingId('site-expense-detail');
    try {
      const siteExpenses = expenses.filter((e) => e.siteId === site.id);
      const total = siteExpenses.reduce((s, e) => s + (e.amountRwf ?? 0), 0);
      const byMonth = new Map<string, typeof siteExpenses>();
      siteExpenses.forEach((e) => {
        const ym = e.date?.slice(0, 7) ?? '';
        const list = byMonth.get(ym) ?? [];
        list.push(e);
        byMonth.set(ym, list);
      });
      const months = Array.from(byMonth.keys()).sort((a, b) => b.localeCompare(a));
      const expenseCategoryLabel = (e: (typeof expenses)[0]) => e.type === 'fuel' ? t('expenses_category_fuel') : (e.expenseCategory ? t('expenses_category_' + e.expenseCategory) : t('expenses_category_other'));
      const rows: string[] = [
        csvEscape('HapyJo – Site Expense Detail'),
        csvEscape(site.name ?? ''),
        csvEscape(site.location ?? ''),
        [csvEscape(t('reports_contract_rate_rwf_m3')), csvEscape((site.contractRateRwf ?? 0) > 0 ? `${(site.contractRateRwf ?? 0).toLocaleString()} RWF/m³` : t('owner_contract_rate_not_set'))].join(','),
        [csvEscape(t('reports_total_site_expense')), csvEscape(formatAmount(total, true))].join(','),
        '',
        [csvEscape('Date'), csvEscape('Category'), csvEscape('Amount (RWF)'), csvEscape('Description')].join(','),
        ...months.flatMap((ym) => (byMonth.get(ym) ?? []).map((e) => [csvEscape(e.date ?? ''), csvEscape(expenseCategoryLabel(e)), csvEscape(e.amountRwf ?? 0), csvEscape(e.description ?? '')].join(','))),
      ];
      const csv = '\uFEFF' + rows.join('\r\n');
      const filename = `HapyJo_Site_Expense_${(site.name ?? site.id).replace(/[^a-zA-Z0-9-_]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
      const dir = documentDirectory ?? cacheDirectory ?? '';
      const path = `${dir}${filename}`;
      await writeAsStringAsync(path, csv, { encoding: EncodingType.UTF8 });
      const Sharing = await import('expo-sharing');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: t('reports_export_download_share') });
      } else {
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
        {/* Filter tabs: wrap on small screens so labels are never clipped */}
        <View style={reportCardStyles.tabsWrap}>
          {reportTypes.map((type) => {
            const isSelected = selectedType === type.id;
            const Icon = type.Icon;
            const label = (t(type.labelKey) || '').trim() || (type.id === 'site_performance' ? t('reports_site_performance') : type.id);
            return (
              <TouchableOpacity
                key={type.id}
                onPress={() => setSelectedType(type.id)}
                style={[
                  reportCardStyles.filterTabBtn,
                  isSelected && reportCardStyles.filterTabBtnSelected,
                ]}
              >
                <Icon size={18} color={isSelected ? colors.surface : colors.gray600} />
                <Text style={[reportCardStyles.filterTabText, isSelected && reportCardStyles.filterTabTextSelected]} numberOfLines={1}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={reportCardStyles.siteFilterRow}>
          <Text style={reportCardStyles.siteFilterLabel}>{t('tab_sites')}</Text>
          <Pressable
            onPress={() => setSiteDropdownVisible(true)}
            style={reportCardStyles.monthDropdown}
            accessibilityLabel={t('tab_sites')}
            accessibilityRole="button"
          >
            <Text style={reportCardStyles.monthDropdownText} numberOfLines={1}>
              {selectedSiteLabel}
            </Text>
            <ChevronDown size={18} color={colors.primary} />
          </Pressable>
        </View>
        <Modal
          visible={siteDropdownVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSiteDropdownVisible(false)}
        >
          <Pressable style={reportCardStyles.monthModalOverlay} onPress={() => setSiteDropdownVisible(false)}>
            <View style={reportCardStyles.monthModalContent} onStartShouldSetResponder={() => true}>
              <Text style={reportCardStyles.monthModalTitle}>{t('tab_sites')}</Text>
              <FlatList
                data={siteFilterOptions}
                keyExtractor={(item) => item.id || '__all_sites__'}
                renderItem={({ item }) => {
                  const selected = item.id === selectedSiteId;
                  return (
                    <Pressable
                      onPress={() => {
                        setSelectedSiteId(item.id);
                        setSiteDropdownVisible(false);
                      }}
                      style={[reportCardStyles.monthOption, selected && reportCardStyles.monthOptionSelected]}
                    >
                      <Text style={[reportCardStyles.monthOptionText, selected && reportCardStyles.monthOptionTextSelected]}>
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                }}
              />
            </View>
          </Pressable>
        </Modal>

        {readOnly && (
          <Card className="mb-4 bg-amber-50 border border-amber-200">
            <View className="flex-row items-center py-2">
              <Lock size={20} color={colors.textSecondary} />
              <Text className="text-amber-800 font-semibold ml-2">{t('reports_read_only')}</Text>
            </View>
            <Text className="text-sm text-amber-700">{t('reports_read_only_hint')}</Text>
          </Card>
        )}

        {/* Financial reports layout (Owner & Accountant): Financial Summary, site budgets, contract rates, expenses, Export/Share */}
        {isFinancialReportsLayout && (
          <>
            {(selectedType === 'all' || selectedType === 'financial') && (
              <View style={reportCardStyles.sectionBlock}>
                <Text style={reportCardStyles.sectionTitleText}>{t('reports_financial_summary')}</Text>
                <View style={ownerStyles.financialRow}>
                  <Card style={ownerStyles.metricCard}>
                    <Banknote size={20} color="#059669" />
                    <Text style={ownerStyles.metricLabel}>{t('reports_total_budget')}</Text>
                    <Text style={ownerStyles.metricValue}>{formatAmount(totalBudgetAll, true)}</Text>
                  </Card>
                  <Card style={ownerStyles.metricCard}>
                    <TrendingUp size={20} color="#6366f1" />
                    <Text style={ownerStyles.metricLabel}>{t('reports_total_expenses')}</Text>
                    <Text style={ownerStyles.metricValue}>{formatAmount(totalExpensesAll, true)}</Text>
                  </Card>
                  <Card style={ownerStyles.metricCard}>
                    <BarChart3 size={20} color="#b45309" />
                    <Text style={ownerStyles.metricLabel}>{t('reports_maintenance_cost')}</Text>
                    <Text style={ownerStyles.metricValue}>{formatAmount(totalMaintenanceAll, true)}</Text>
                  </Card>
                  <Card style={ownerStyles.metricCard}>
                    <FileText size={20} color={netProfitAll >= 0 ? '#059669' : '#dc2626'} />
                    <Text style={ownerStyles.metricLabel}>{t('reports_net_profit')}</Text>
                    <Text style={[ownerStyles.metricValue, { color: netProfitAll >= 0 ? '#059669' : '#dc2626' }]}>{formatAmount(netProfitAll, true)}</Text>
                  </Card>
                </View>
                <View style={ownerStyles.bannerActions}>
                  <TouchableOpacity onPress={() => handleExportFinancialSummaryCSV()} disabled={exportingId === 'financial-summary'} style={ownerStyles.exportAndShareBtn}>
                    <Download size={18} color="#fff" />
                    <Text style={ownerStyles.exportAndShareBtnText}>{exportingId === 'financial-summary' ? t('reports_exporting') : t('reports_export_download_share_btn')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {selectedType === 'all' && (
              <View style={reportCardStyles.sectionBlock}>
                <Text style={reportCardStyles.sectionTitleText}>{t('reports_available_categories')}</Text>
                <View style={ownerStyles.categoryRow}>
                  <TouchableOpacity onPress={() => setSelectedType('site_performance')} style={ownerStyles.categoryCard}>
                    <TrendingUp size={22} color={colors.primary} />
                    <Text style={ownerStyles.categoryLabel}>{t('reports_overall_site_perf')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setSelectedType('site_performance')} style={ownerStyles.categoryCard}>
                    <BarChart3 size={22} color="#6366f1" />
                    <Text style={ownerStyles.categoryLabel}>{t('reports_current_site_perf')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setSelectedType('financial')} style={ownerStyles.categoryCard}>
                    <Fuel size={22} color="#3B82F6" />
                    <Text style={ownerStyles.categoryLabel}>{t('reports_fuel_summary')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setSelectedType('financial')} style={ownerStyles.categoryCard}>
                    <Banknote size={22} color="#059669" />
                    <Text style={ownerStyles.categoryLabel}>{t('reports_site_expense_reports')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {(selectedType === 'all' || selectedType === 'operations' || selectedType === 'site_performance') && (
              <View style={reportCardStyles.sectionBlock}>
                <View style={reportCardStyles.sectionHeaderRow}>
                  <Text style={reportCardStyles.sectionTitleText}>{t('reports_overall_site_perf')}</Text>
                  <Pressable
                    onPress={() => setSitePerfMonthDropdownVisible(true)}
                    style={reportCardStyles.monthDropdown}
                    accessibilityLabel={t('reports_month_filter')}
                    accessibilityRole="button"
                  >
                    <Text style={reportCardStyles.monthDropdownText}>
                      {selectedSitePerfMonth ? formatPeriodLabel(selectedSitePerfMonth) : t('reports_all_months')}
                    </Text>
                    <ChevronDown size={18} color={colors.primary} />
                  </Pressable>
                </View>
                <Modal
                  visible={sitePerfMonthDropdownVisible}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setSitePerfMonthDropdownVisible(false)}
                >
                  <Pressable style={reportCardStyles.monthModalOverlay} onPress={() => setSitePerfMonthDropdownVisible(false)}>
                    <View style={reportCardStyles.monthModalContent} onStartShouldSetResponder={() => true}>
                      <Text style={reportCardStyles.monthModalTitle}>{t('reports_month_filter')}</Text>
                      <FlatList
                        data={sitePerformanceMonthOptions}
                        keyExtractor={(item) => item.value}
                        renderItem={({ item }) => {
                          const selected = item.value === selectedSitePerfMonth;
                          return (
                            <Pressable
                              onPress={() => {
                                setSelectedSitePerfMonth(item.value);
                                setSitePerfMonthDropdownVisible(false);
                              }}
                              style={[reportCardStyles.monthOption, selected && reportCardStyles.monthOptionSelected]}
                            >
                              <Text style={[reportCardStyles.monthOptionText, selected && reportCardStyles.monthOptionTextSelected]}>
                                {item.labelKey}
                              </Text>
                            </Pressable>
                          );
                        }}
                      />
                    </View>
                  </Pressable>
                </Modal>
                {(() => {
                  const monthSites = selectedMonthSitesForPerformance;
                  return monthSites.length === 0 ? (
                    <EmptyState
                      icon={<TrendingUp size={32} color={colors.textMuted} />}
                      title={t('reports_no_sites')}
                      message={`${formatPeriodLabel(selectedSitePerfMonth)} ${t('reports_empty_sites_hint')}`}
                    />
                  ) : (
                    <>
                      <View style={ownerStyles.monthSection}>
                        <Text style={ownerStyles.monthTitle}>{formatPeriodLabel(selectedSitePerfMonth)}</Text>
                        {monthSites.map((site) => (
                          <SitePerformanceCard
                            key={site.id}
                            site={{ ...site, spent: siteExpenseById[site.id] ?? 0 }}
                            formatAmount={formatAmount}
                            t={t}
                            reportCardStyles={reportCardStyles}
                            ownerStyles={ownerStyles}
                          />
                        ))}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleExportSitePerformanceCSV(monthSites, selectedSitePerfMonth)}
                        style={ownerStyles.exportReportBtn}
                        disabled={exportingId === 'site-perf'}
                      >
                        <Download size={16} color="#2563eb" />
                        <Text style={ownerStyles.exportReportBtnText}>{exportingId === 'site-perf' ? t('reports_exporting') : t('reports_export_report')}</Text>
                      </TouchableOpacity>
                    </>
                  );
                })()}
                <Text style={[reportCardStyles.sectionTitleText, reportCardStyles.sectionTitleSpaced]}>{t('reports_current_site_perf')}</Text>
                {filteredSites.filter((s) => s.status === 'active').sort((a, b) => (a.expectedEndDate || '').localeCompare(b.expectedEndDate || '')).map((site) => (
                  <SitePerformanceCard
                    key={site.id}
                    site={{ ...site, spent: siteExpenseById[site.id] ?? 0 }}
                    formatAmount={formatAmount}
                    t={t}
                    reportCardStyles={reportCardStyles}
                    ownerStyles={ownerStyles}
                  />
                ))}
              </View>
            )}

            {(selectedType === 'all' || selectedType === 'financial') && (
              <View style={reportCardStyles.sectionBlock}>
                <Text style={reportCardStyles.sectionTitleText}>{t('reports_fuel_summary')}</Text>
                <Text style={ownerStyles.mutedText}>
                  {selectedSiteId ? `${t('tab_sites')}: ${selectedSiteLabel}` : t('reports_fuel_summary_global_hint')}
                </Text>
                <View style={ownerStyles.bannerActions}>
                  <TouchableOpacity onPress={() => handleExportFuelSummaryCSV()} disabled={exportingId === 'fuel-summary'} style={ownerStyles.exportAndShareBtn}>
                    <Download size={18} color="#fff" />
                    <Text style={ownerStyles.exportAndShareBtnText}>{exportingId === 'fuel-summary' ? t('reports_exporting') : t('reports_export_download_share_btn')}</Text>
                  </TouchableOpacity>
                </View>
                {(() => {
                  const byMonth = getFuelByMonth(filteredExpenses);
                  const months = Array.from(byMonth.keys()).sort((a, b) => b.localeCompare(a));
                  return months.length === 0 ? <Text style={ownerStyles.mutedText}>{t('reports_no_sites')}</Text> : months.map((ym) => {
                    const row = byMonth.get(ym)!;
                    return (
                      <Card key={ym} style={ownerStyles.fuelMonthCard}>
                        <Text style={ownerStyles.monthTitle}>{formatPeriodLabel(ym)}</Text>
                        <View style={reportCardStyles.dataRow}>
                          <Text style={reportCardStyles.dataLabel}>{t('reports_fuel_used')}</Text>
                          <Text style={reportCardStyles.dataValue}>{row.litres.toFixed(0)} L</Text>
                        </View>
                        <View style={reportCardStyles.dataRow}>
                          <Text style={reportCardStyles.dataLabel}>{t('reports_fuel_cost_month')}</Text>
                          <Text style={reportCardStyles.dataValue}>{formatAmount(row.cost, true)}</Text>
                        </View>
                      </Card>
                    );
                  });
                })()}
              </View>
            )}

            {(selectedType === 'all' || selectedType === 'financial') && (
              <View style={reportCardStyles.sectionBlock}>
                <Text style={reportCardStyles.sectionTitleText}>{t('reports_site_expense_reports')}</Text>
                <View style={ownerStyles.bannerActions}>
                  <TouchableOpacity onPress={() => handleExportSiteExpensesCSV()} disabled={exportingId === 'site-expenses'} style={ownerStyles.exportAndShareBtn}>
                    <Download size={18} color="#fff" />
                    <Text style={ownerStyles.exportAndShareBtnText}>{exportingId === 'site-expenses' ? t('reports_exporting') : t('reports_export_download_share_btn')}</Text>
                  </TouchableOpacity>
                </View>
                {filteredSites.length === 0 ? (
                  <EmptyState icon={<Banknote size={32} color={colors.textMuted} />} title={t('reports_no_sites')} message="" />
                ) : (
                  filteredSites.map((site) => (
                    <TouchableOpacity key={site.id} onPress={() => setSelectedSiteForExpenseDetail(site)} activeOpacity={0.7}>
                      <Card style={reportCardStyles.siteCard}>
                        <View style={reportCardStyles.siteCardHeader}>
                          <Banknote size={18} color="#059669" />
                          <Text style={reportCardStyles.siteCardName}>{site.name}</Text>
                        </View>
                        <Text style={reportCardStyles.siteCardLocation}>{site.location}</Text>
                        <View style={reportCardStyles.siteCardRow}>
                          <Text style={reportCardStyles.siteCardLabel}>{t('reports_total_site_expense')}</Text>
                          <Text style={reportCardStyles.siteCardValue}>{formatAmount(siteExpenseById[site.id] ?? 0, true)}</Text>
                        </View>
                        <View style={reportCardStyles.siteCardRow}>
                          <Text style={reportCardStyles.siteCardLabel}>{t('reports_contract_rate_rwf_m3')}</Text>
                          <Text style={reportCardStyles.siteCardValue}>{(site.contractRateRwf ?? 0) > 0 ? `${(site.contractRateRwf ?? 0).toLocaleString()} RWF/m³` : t('owner_contract_rate_not_set')}</Text>
                        </View>
                      </Card>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            <Modal visible={selectedSiteForExpenseDetail != null} animationType="slide" onRequestClose={() => setSelectedSiteForExpenseDetail(null)}>
              {selectedSiteForExpenseDetail && (() => {
                const siteExpenses = expenses.filter((e) => e.siteId === selectedSiteForExpenseDetail.id);
                const total = siteExpenses.reduce((s, e) => s + (e.amountRwf ?? 0), 0);
                const byMonth = new Map<string, typeof siteExpenses>();
                siteExpenses.forEach((e) => {
                  const ym = e.date?.slice(0, 7) ?? '';
                  const list = byMonth.get(ym) ?? [];
                  list.push(e);
                  byMonth.set(ym, list);
                });
                const months = Array.from(byMonth.keys()).sort((a, b) => b.localeCompare(a));
                const expenseCategoryLabel = (e: (typeof expenses)[0]) => e.type === 'fuel' ? t('expenses_category_fuel') : (e.expenseCategory ? t('expenses_category_' + e.expenseCategory) : t('expenses_category_other'));
                return (
                  <View style={{ flex: 1, backgroundColor: colors.background }}>
                    <Header title={selectedSiteForExpenseDetail.name} subtitle={t('reports_site_expense_detail')} leftAction={<TouchableOpacity onPress={() => setSelectedSiteForExpenseDetail(null)}><Text style={{ color: colors.primary, fontSize: 16 }}>{t('common_back')}</Text></TouchableOpacity>} />
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
                      <Card style={ownerStyles.metricCard}>
                        <Text style={ownerStyles.metricLabel}>{t('reports_total_site_expense')}</Text>
                        <Text style={ownerStyles.metricValue}>{formatAmount(total, true)}</Text>
                      </Card>
                      <View style={[ownerStyles.bannerActions, { marginTop: 12 }]}>
                        <TouchableOpacity onPress={() => handleExportSiteExpenseDetailCSV(selectedSiteForExpenseDetail)} disabled={exportingId === 'site-expense-detail'} style={ownerStyles.exportAndShareBtn}>
                          <Download size={18} color="#fff" />
                          <Text style={ownerStyles.exportAndShareBtnText}>{exportingId === 'site-expense-detail' ? t('reports_exporting') : t('reports_export_download_share_btn')}</Text>
                        </TouchableOpacity>
                      </View>
                      {months.map((ym) => (
                        <View key={ym} style={ownerStyles.monthSection}>
                          <Text style={ownerStyles.monthTitle}>{formatPeriodLabel(ym)}</Text>
                          {(byMonth.get(ym) ?? []).map((e) => (
                            <View key={e.id} style={{ marginBottom: 6 }}>
                              <View style={reportCardStyles.dataRow}>
                                <Text style={reportCardStyles.dataLabel}>{expenseCategoryLabel(e)}</Text>
                                <Text style={reportCardStyles.dataValue}>{formatAmount(e.amountRwf ?? 0, true)}</Text>
                              </View>
                              {e.description ? <Text style={[reportCardStyles.dataLabel, { fontSize: 12 }]} numberOfLines={2}>{e.description}</Text> : null}
                              <Text style={[reportCardStyles.dataLabel, { fontSize: 11, color: '#94a3b8' }]}>{e.date}</Text>
                            </View>
                          ))}
                          <View style={reportCardStyles.dataRow}>
                            <Text style={reportCardStyles.dataLabel}>{t('reports_monthly_total')}</Text>
                            <Text style={reportCardStyles.dataValue}>
                              {formatAmount((byMonth.get(ym) ?? []).reduce((s, x) => s + (x.amountRwf ?? 0), 0), true)}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                );
              })()}
            </Modal>
          </>
        )}

        {/* Non–financial layout: Operations / Site performance / Financial tab for Admin, Head Supervisor */}
        {!isFinancialReportsLayout && (
        <View style={{ flex: 1 }}>
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
            {filteredSites.map((site) => {
              const siteSpent = siteExpenseById[site.id] ?? 0;
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

        {/* Financial tab: single banner with month dropdown, summary, Export Excel, Share */}
        {selectedType === 'financial' && (
          <View className="mb-4">
            {financialMonthOptions.length === 0 ? (
              <EmptyState
                icon={<Banknote size={32} color={colors.textMuted} />}
                title={t('reports_no_financial_yet')}
                message={t('reports_empty_financial_hint')}
              />
            ) : (
              <Card style={reportCardStyles.bannerCard}>
                <View style={reportCardStyles.bannerHeader}>
                  <Text style={reportCardStyles.bannerTitle}>{t('reports_financial_summary')}</Text>
                  <Pressable
                    onPress={() => setMonthDropdownVisible(true)}
                    style={reportCardStyles.monthDropdown}
                    accessibilityLabel={t('reports_month_filter')}
                    accessibilityRole="button"
                  >
                    <Text style={reportCardStyles.monthDropdownText}>
                      {bannerMonth ? formatPeriodLabel(bannerMonth) : t('reports_all_months')}
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
                        data={financialMonthOptions}
                        keyExtractor={(item) => item.value}
                        renderItem={({ item }) => {
                          const selected = item.value === bannerMonth;
                          return (
                            <Pressable
                              onPress={() => {
                                setSelectedMonthFilter(item.value);
                                setMonthDropdownVisible(false);
                              }}
                              style={[reportCardStyles.monthOption, selected && reportCardStyles.monthOptionSelected]}
                            >
                              <Text style={[reportCardStyles.monthOptionText, selected && reportCardStyles.monthOptionTextSelected]}>{item.labelKey}</Text>
                            </Pressable>
                          );
                        }}
                      />
                    </View>
                  </Pressable>
                </Modal>
                {selectedBannerReport && (
                  <View style={reportCardStyles.bannerSummary}>
                    {(() => {
                      const d = selectedBannerReport.data ?? {};
                      const hasData = !selectedSiteId && ((Number(d.totalBudget) ?? 0) !== 0 || (Number(d.totalSpent) ?? 0) !== 0);
                      const budget = hasData ? (Number(d.totalBudget) || 0) : totalBudgetAll;
                      const spent = hasData ? (Number(d.totalSpent) || 0) : totalSpentAll;
                      const remaining = hasData ? (Number(d.remainingBudget) ?? budget - spent) : remainingBudgetAll;
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
                        </>
                      );
                    })()}
                  </View>
                )}
                {!readOnly && selectedBannerReport && (
                  <View style={reportCardStyles.bannerActions}>
                    <TouchableOpacity
                      onPress={() => handleExportCSV(selectedBannerReport)}
                      disabled={exportingId === selectedBannerReport.id}
                      style={reportCardStyles.exportPrimaryBtn}
                    >
                      <Download size={18} color="#fff" />
                      <Text style={reportCardStyles.exportPrimaryBtnText}>
                        {exportingId === selectedBannerReport.id ? t('reports_exporting') : t('reports_export_excel')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleExportCSV(selectedBannerReport)}
                      disabled={exportingId === selectedBannerReport.id}
                      style={reportCardStyles.shareSecondaryBtn}
                    >
                      <Text style={reportCardStyles.shareSecondaryBtnText}>{t('reports_share_whatsapp')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Card>
            )}
          </View>
        )}

        {/* Available Reports – list (All / Operations / Site performance); month filter on the right */}
        {selectedType !== 'financial' && (
        <View className="mb-4">
          <View style={reportCardStyles.sectionHeaderRow}>
            <Text style={reportCardStyles.sectionTitleText}>
              {selectedType === 'all' ? t('reports_available') : selectedType === 'operations' ? t('reports_saved_operations') : t('reports_saved_sites')}
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
              message={selectedType === 'operations' ? t('reports_empty_operations_hint') : selectedType === 'site_performance' ? t('reports_empty_sites_hint') : t('reports_empty_hint')}
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
                    <Text style={reportCardStyles.badgeText}>
                      {report.type === 'financial' && YYYY_MM.test(report.period) ? formatPeriodLabel(report.period) : report.type === 'financial' ? formatPeriodLabel(normalizePeriodToYYYYMM(report.period)) : report.period}
                    </Text>
                  </View>
                </View>
                <Text style={reportCardStyles.typeLabel}>{report.type.replace('_', ' ')}</Text>

                <View style={reportCardStyles.dataBox}>
                  {report.type === 'financial' && (() => {
                    const hasData = !selectedSiteId && report.data && (Number(report.data.totalBudget) != null && Number(report.data.totalBudget) !== 0 || Number(report.data.totalSpent) != null && Number(report.data.totalSpent) !== 0);
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
        )}
        </View>
        )}

        {/* Current site performance – live list so all sites (e.g. Demo 25%) show in Reports */}
        {(selectedType === 'all' || selectedType === 'financial') && showSummary && filteredSites.length > 0 && (
          <View className="mb-4">
            <Text className="text-lg font-bold text-gray-900 mb-3">{t('reports_current_site_performance')}</Text>
            {filteredSites.map((site) => {
              const siteSpent = siteExpenseById[site.id] ?? 0;
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

        {/* Vehicle Fuel Summary – All or Financial tab, with filters; Export & Share (Owner and others) */}
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
            <Text className="text-xs text-slate-500 mb-2">{t('reports_vehicle_fuel_filter_hint')}</Text>
            <View style={ownerStyles.bannerActions}>
              <TouchableOpacity
                onPress={() => handleExportVehicleFuelReport()}
                disabled={exportingId === 'vehicle-fuel'}
                style={ownerStyles.exportAndShareBtn}
              >
                <Download size={18} color="#fff" />
                <Text style={ownerStyles.exportAndShareBtnText}>
                  {exportingId === 'vehicle-fuel' ? t('reports_exporting') : t('reports_export_download_share_btn')}
                </Text>
              </TouchableOpacity>
            </View>
            {filteredFuelEntries.length > 0 && (
              <View className="mb-3">
                <Text className="text-sm font-semibold text-slate-700 mb-2">{t('reports_vehicle_fuel_entries_title')}</Text>
                <Card style={{ padding: 12, marginBottom: 8 }}>
                  {filteredFuelEntries.slice(0, 30).map((e, idx) => (
                    <View key={`${e.date}-${e.vehicleId}-${idx}`} style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6, borderBottomWidth: idx < Math.min(30, filteredFuelEntries.length) - 1 ? 1 : 0, borderBottomColor: '#f1f5f9', paddingBottom: 6 }}>
                      <Text style={{ fontSize: 12, color: '#64748b', width: '22%' }}>{e.date}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155', width: '20%' }} numberOfLines={1}>{e.vehicleName}</Text>
                      <Text style={{ fontSize: 12, color: '#475569', width: '28%' }} numberOfLines={1}>{e.assignedLocation}</Text>
                      <Text style={{ fontSize: 12, color: '#1e293b' }}>{e.litres} L</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#1e293b' }}>{formatAmount(e.cost, true)}</Text>
                    </View>
                  ))}
                  {filteredFuelEntries.length > 30 && (
                    <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{filteredFuelEntries.length - 30} {t('reports_vehicle_fuel_entries_more')}</Text>
                  )}
                </Card>
              </View>
            )}
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

          </>
        )}
      </ScrollView>
    </View>
  );
}

const reportCardStyles = StyleSheet.create({
  tabsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  filterTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    marginRight: 8,
    marginBottom: 8,
  },
  filterTabBtnSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterTabText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  filterTabTextSelected: {
    color: '#ffffff',
  },
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
    marginBottom: 12,
  },
  sectionBlock: {
    marginBottom: 24,
  },
  siteFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  siteFilterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  sectionTitleSpaced: {
    marginTop: 20,
    marginBottom: 12,
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
  bannerCard: {
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0c4a6e',
  },
  bannerSummary: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  exportPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#2563eb',
    borderRadius: 8,
  },
  exportPrimaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  shareSecondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563eb',
    backgroundColor: '#fff',
  },
  shareSecondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563eb',
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
    marginBottom: 14,
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

const ownerStyles = StyleSheet.create({
  financialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 4,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    padding: 14,
    alignItems: 'center',
    margin: 2,
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 2,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 4,
  },
  categoryCard: {
    flex: 1,
    minWidth: '47%',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    margin: 2,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginTop: 8,
    textAlign: 'center',
  },
  monthSection: {
    marginBottom: 20,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  exportReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  exportReportBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  fuelMonthCard: {
    marginBottom: 14,
    padding: 14,
  },
  mutedText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  exportAndShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: '#2563eb',
    borderRadius: 8,
  },
  exportAndShareBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  exportPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#2563eb',
    borderRadius: 8,
  },
  exportPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  shareSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  shareSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
});
