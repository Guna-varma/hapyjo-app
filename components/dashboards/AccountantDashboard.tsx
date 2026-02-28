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
  const { sites, surveys, contractRateRwf } = useMockAppStore();
  const totalBudget = sites.reduce((sum, site) => sum + site.budget, 0);
  const totalSpent = sites.reduce((sum, site) => sum + site.spent, 0);
  const remaining = totalBudget - totalSpent;
  const workVolume = surveys.filter((s) => s.status === 'approved' && s.workVolume != null).reduce((sum, s) => sum + (s.workVolume ?? 0), 0);
  const revenue = workVolume * contractRateRwf;
  const totalCost = totalSpent;
  const profit = revenue - totalCost;

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
});
