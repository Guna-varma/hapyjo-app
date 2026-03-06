import React from 'react';
import { View, Text, useWindowDimensions, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { DashboardLayout } from '@/components/ui/DashboardLayout';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { colors, layout } from '@/theme/tokens';
import { formatAmount } from '@/lib/currency';
import { Banknote, FileText, Lock, TrendingUp } from 'lucide-react-native';
import type { DashboardNavProps } from '@/components/RoleBasedDashboard';

const BREAKPOINT_SMALL = 400;

export function AccountantDashboard(_props: DashboardNavProps = {}) {
  const { t } = useLocale();
  const { width } = useWindowDimensions();
  const { sites, surveys } = useMockAppStore();
  const totalBudget = sites.reduce((sum, site) => sum + (site.budget ?? 0), 0);
  const totalSpent = sites.reduce((sum, site) => sum + (site.spent ?? 0), 0);
  const remaining = Math.max(0, totalBudget - totalSpent);
  const revenue = sites.reduce((sum, site) => {
    const siteVolume = surveys
      .filter((s) => s.status === 'approved' && s.siteId === site.id)
      .reduce((v, s) => v + s.volumeM3, 0);
    return sum + siteVolume * (site.contractRateRwf ?? 0);
  }, 0);
  const totalCost = totalSpent;
  const profit = revenue - totalCost;

  const siteAllocations = sites.map((site) => {
    const siteVolume = surveys
      .filter((s) => s.status === 'approved' && s.siteId === site.id)
      .reduce((v, s) => v + s.volumeM3, 0);
    const siteRevenue = siteVolume * (site.contractRateRwf ?? 0);
    return { site, budget: site.budget ?? 0, spent: site.spent ?? 0, revenue: siteRevenue };
  });

  const isSmall = width < BREAKPOINT_SMALL;
  const cardContainerStyle = isSmall ? styles.cardColumn : styles.cardRow;

  const metricCards = [
    { icon: <Banknote size={24} color="#10B981" />, label: t('dashboard_total_budget'), value: formatAmount(totalBudget, true) },
    { icon: <Banknote size={24} color="#8B5CF6" />, label: t('dashboard_total_spent'), value: formatAmount(totalSpent, true) },
    { icon: <Banknote size={24} color="#059669" />, label: t('dashboard_remaining'), value: formatAmount(remaining, true) },
    { icon: <TrendingUp size={24} color="#3B82F6" />, label: t('dashboard_revenue'), value: formatAmount(revenue, true) },
    { icon: <Banknote size={24} color="#DC2626" />, label: t('dashboard_profit'), value: formatAmount(profit, true), highlight: profit < 0 },
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

        <Text style={styles.sectionTitle}>{t('dashboard_financial_summary')}</Text>
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

        {sites.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('dashboard_allocation_per_site')}</Text>
            {siteAllocations.map(({ site, budget, spent, revenue }) => (
              <Card key={site.id} style={styles.siteAllocCard}>
                <Text style={styles.siteAllocName}>{site.name}</Text>
                <View style={styles.siteAllocRow}>
                  <Text style={styles.siteAllocLabel}>{t('dashboard_total_budget')}</Text>
                  <Text style={styles.siteAllocValue}>{formatAmount(budget, true)}</Text>
                </View>
                <View style={styles.siteAllocRow}>
                  <Text style={styles.siteAllocLabel}>{t('dashboard_total_spent')}</Text>
                  <Text style={styles.siteAllocValue}>{formatAmount(spent, true)}</Text>
                </View>
                <View style={styles.siteAllocRow}>
                  <Text style={styles.siteAllocLabel}>{t('dashboard_revenue')}</Text>
                  <Text style={styles.siteAllocValue}>{formatAmount(revenue, true)}</Text>
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
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 8,
  },
  metricValue: {
    fontSize: 22,
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
  siteAllocName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  siteAllocRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  siteAllocLabel: { fontSize: 13, color: colors.textSecondary },
  siteAllocValue: { fontSize: 14, fontWeight: '600', color: colors.text },
});
