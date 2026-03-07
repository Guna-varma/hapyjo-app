import React, { useMemo } from 'react';
import { View, Text, useWindowDimensions, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { DashboardLayout } from '@/components/ui/DashboardLayout';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { colors, layout } from '@/theme/tokens';
import { formatAmount } from '@/lib/currency';
import { Banknote, FileText, Lock, TrendingUp, Fuel, PieChart } from 'lucide-react-native';
import type { DashboardNavProps } from '@/components/RoleBasedDashboard';
import { buildFinancialSummary } from '@/lib/financeSummary';

const BREAKPOINT_SMALL = 400;

export function AccountantDashboard(_props: DashboardNavProps = {}) {
  const { t } = useLocale();
  const { width } = useWindowDimensions();
  const { sites, surveys, expenses } = useMockAppStore();
  const financialSummary = useMemo(
    () => buildFinancialSummary({ sites, surveys, expenses }),
    [sites, surveys, expenses]
  );
  const siteFinancialRows = useMemo(
    () => financialSummary.sites.filter((site) => site.isKnownSite),
    [financialSummary.sites]
  );

  const totalBudget = financialSummary.totals.totalBudgetRwf;
  const totalSpent = financialSummary.totals.expensesRwf;
  const remaining = financialSummary.totals.remainingBudgetRwf;
  const revenue = financialSummary.totals.revenueRwf;
  const totalFuel = financialSummary.totals.fuelExpensesRwf;
  const totalGeneral = financialSummary.totals.generalExpensesRwf;
  const profit = financialSummary.totals.profitRwf;

  const isSmall = width < BREAKPOINT_SMALL;
  const cardContainerStyle = isSmall ? styles.cardColumn : styles.cardRow;

  const metricCards = [
    { icon: <Banknote size={24} color="#10B981" />, label: t('dashboard_total_budget'), value: formatAmount(totalBudget, true) },
    { icon: <Banknote size={24} color="#8B5CF6" />, label: t('dashboard_total_spent'), value: formatAmount(totalSpent, true) },
    { icon: <PieChart size={24} color="#0f766e" />, label: t('dashboard_remaining'), value: formatAmount(remaining, true) },
    { icon: <TrendingUp size={24} color="#3B82F6" />, label: t('dashboard_revenue'), value: formatAmount(revenue, true) },
    { icon: <Fuel size={24} color="#2563EB" />, label: t('expenses_category_fuel'), value: formatAmount(totalFuel, true) },
    { icon: <Banknote size={24} color="#0369A1" />, label: t('reports_expense_general'), value: formatAmount(totalGeneral, true) },
    { icon: <Banknote size={24} color={profit >= 0 ? '#059669' : '#DC2626'} />, label: t('dashboard_profit'), value: formatAmount(profit, true), highlight: profit < 0 },
  ];

  return (
    <View style={styles.screen}>
      <Header title={t('dashboard_accountant_title')} subtitle={t('dashboard_accountant_subtitle')} />
      <DashboardLayout>
        <Card style={styles.infoCard}>
          <View style={styles.cardRowInner}>
            <Lock size={20} color={colors.primary} />
            <Text style={styles.infoTitle}>{t('dashboard_read_only_access')}</Text>
          </View>
          <Text style={styles.infoHint}>{t('dashboard_read_only_hint')}</Text>
        </Card>

        <Card style={styles.heroCard}>
          <Text style={styles.heroTitle}>{t('dashboard_financial_summary')}</Text>
          <Text style={styles.heroValue}>{formatAmount(profit, true)}</Text>
          <Text style={styles.heroCaption}>{t('reports_net_profit')}</Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>{t('dashboard_revenue')}</Text>
              <Text style={styles.heroStatValue}>{formatAmount(revenue, true)}</Text>
            </View>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>{t('reports_total_expenses')}</Text>
              <Text style={styles.heroStatValue}>{formatAmount(totalSpent, true)}</Text>
            </View>
          </View>
        </Card>

        <View style={cardContainerStyle}>
          {metricCards.map((item, index) => (
            <Card key={index} style={[styles.metricCard, isSmall && styles.metricCardFull]}>
              <View style={styles.metricRow}>
                {item.icon}
                <Text style={styles.metricLabel}>{item.label}</Text>
              </View>
              <Text style={[styles.metricValue, item.highlight && styles.metricValueNegative]}>
                {item.value}
              </Text>
            </Card>
          ))}
        </View>

        {siteFinancialRows.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('dashboard_allocation_per_site')}</Text>
            {siteFinancialRows.map((site) => (
              <Card key={site.siteId} style={styles.siteAllocCard}>
                <View style={styles.siteHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.siteAllocName}>{site.siteName}</Text>
                    <Text style={styles.siteAllocLocation}>{site.location}</Text>
                  </View>
                  <View style={styles.siteProfitWrap}>
                    <Text style={styles.siteAllocLabel}>{t('dashboard_profit')}</Text>
                    <Text style={[styles.siteProfitValue, site.profitRwf < 0 && styles.metricValueNegative]}>{formatAmount(site.profitRwf, true)}</Text>
                  </View>
                </View>
                <View style={styles.siteGrid}>
                  <View style={styles.siteGridItem}>
                    <Text style={styles.siteAllocLabel}>{t('dashboard_work_volume_approved')}</Text>
                    <Text style={styles.siteAllocValue}>{site.approvedVolumeM3.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³</Text>
                  </View>
                  <View style={styles.siteGridItem}>
                    <Text style={styles.siteAllocLabel}>{t('reports_contract_rate_rwf_m3')}</Text>
                    <Text style={styles.siteAllocValue}>{site.contractRateRwf > 0 ? `${site.contractRateRwf.toLocaleString()} RWF/m³` : t('owner_contract_rate_not_set')}</Text>
                  </View>
                  <View style={styles.siteGridItem}>
                    <Text style={styles.siteAllocLabel}>{t('dashboard_revenue')}</Text>
                    <Text style={styles.siteAllocValue}>{formatAmount(site.revenueRwf, true)}</Text>
                  </View>
                  <View style={styles.siteGridItem}>
                    <Text style={styles.siteAllocLabel}>{t('reports_total_expenses')}</Text>
                    <Text style={styles.siteAllocValue}>{formatAmount(site.expensesRwf, true)}</Text>
                  </View>
                  <View style={styles.siteGridItem}>
                    <Text style={styles.siteAllocLabel}>{t('expenses_category_fuel')}</Text>
                    <Text style={styles.siteAllocValue}>{formatAmount(site.fuelExpensesRwf, true)}</Text>
                  </View>
                  <View style={styles.siteGridItem}>
                    <Text style={styles.siteAllocLabel}>{t('site_card_progress')}</Text>
                    <Text style={styles.siteAllocValue}>{site.progressPct.toFixed(0)}%</Text>
                  </View>
                </View>
              </Card>
            ))}
          </>
        )}

        <Card style={styles.reportsCard}>
          <View style={styles.cardRowInner}>
            <FileText size={20} color={colors.gray700} />
            <Text style={styles.reportsTitle}>{t('dashboard_reports_tab')}</Text>
          </View>
          <Text style={styles.infoHint}>{t('dashboard_reports_tab_hint')}</Text>
        </Card>
      </DashboardLayout>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: layout.cardSpacingVertical,
  },
  cardColumn: {
    marginBottom: layout.cardSpacingVertical,
  },
  metricCard: {
    flexBasis: '48%',
    marginBottom: layout.cardSpacingVertical,
  },
  metricCardFull: {
    flexBasis: '100%',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 8,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  metricValueNegative: {
    color: '#b91c1c',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: layout.grid,
  },
  infoCard: {
    marginBottom: layout.cardSpacingVertical,
    backgroundColor: colors.blue50,
    borderColor: colors.blue600,
  },
  infoTitle: {
    color: colors.blue600,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  cardRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroCard: {
    marginBottom: layout.cardSpacingVertical,
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
  },
  heroTitle: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: '600',
  },
  heroValue: {
    marginTop: 6,
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '800',
  },
  heroCaption: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 2,
  },
  heroStatsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 16,
  },
  heroStatItem: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#111827',
  },
  heroStatLabel: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 2,
  },
  heroStatValue: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  reportsCard: {
    backgroundColor: colors.gray100,
    marginBottom: layout.cardSpacingVertical,
  },
  reportsTitle: {
    color: colors.gray700,
    fontWeight: '500',
    marginLeft: 8,
  },
  siteAllocCard: {
    marginBottom: layout.cardSpacingVertical,
    backgroundColor: colors.gray50,
  },
  siteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  siteAllocName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  siteAllocLocation: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  siteProfitWrap: {
    alignItems: 'flex-end',
  },
  siteProfitValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#047857',
  },
  siteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  siteGridItem: {
    width: '48%',
  },
  siteAllocLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  siteAllocValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
});
