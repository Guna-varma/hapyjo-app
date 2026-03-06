import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { SiteCard } from '@/components/sites/SiteCard';
import { Header } from '@/components/ui/Header';
import { DashboardLayout } from '@/components/ui/DashboardLayout';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { formatAmount } from '@/lib/currency';
import { colors, layout } from '@/theme/tokens';
import { Building2, Banknote, MapPin, TrendingUp, FileText, ClipboardCheck, AlertCircle, Truck } from 'lucide-react-native';
import type { DashboardNavProps } from '@/components/RoleBasedDashboard';
import { SiteTasksScreen } from '@/components/screens/SiteTasksScreen';

/** Head Supervisor allocates vehicles to sites (Vehicles tab). Driver/operator assignment is done by Assistant Supervisor only. */
export function HeadSupervisorDashboard({ onNavigateTab }: DashboardNavProps = {}) {
  const { t } = useLocale();
  const { sites, surveys } = useMockAppStore();
  const [tasksSiteId, setTasksSiteId] = useState<string | null>(null);
  const totalBudget = sites.reduce((sum, site) => sum + (site.budget ?? 0), 0);
  const totalSpent = sites.reduce((sum, site) => sum + (site.spent ?? 0), 0);
  const activeSites = sites.filter((s) => s.status === 'active').length;
  const revenue = sites.reduce((sum, site) => {
    const siteVolume = surveys
      .filter((s) => s.status === 'approved' && s.workVolume != null && s.siteId === site.id)
      .reduce((v, s) => v + (s.workVolume ?? 0), 0);
    return sum + siteVolume * (site.contractRateRwf ?? 0);
  }, 0);
  const profit = revenue - totalSpent;

  const stats = [
    { icon: <Building2 size={24} color="#3B82F6" />, label: t('dashboard_active_sites'), value: activeSites.toString(), bg: 'bg-blue-50' },
    { icon: <Banknote size={24} color="#10B981" />, label: t('dashboard_total_investment'), value: formatAmount(totalBudget, true), bg: 'bg-green-50' },
    { icon: <MapPin size={24} color="#8B5CF6" />, label: t('dashboard_spent'), value: formatAmount(totalSpent, true), bg: 'bg-purple-50' },
    { icon: <TrendingUp size={24} color="#059669" />, label: t('dashboard_profit'), value: formatAmount(profit, true), bg: profit >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
  ];

  const selectedSite = tasksSiteId ? sites.find((s) => s.id === tasksSiteId) ?? null : null;

  if (selectedSite) {
    return (
      <SiteTasksScreen
        initialSiteId={selectedSite.id}
        readOnly
        onBack={() => setTasksSiteId(null)}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <Header title={t('dashboard_head_supervisor_title')} subtitle={t('dashboard_head_supervisor_subtitle')} />
      <DashboardLayout>
        {onNavigateTab && (
          <Card style={hsStyles.quickCard}>
            <Text style={hsStyles.quickTitle}>{t('dashboard_quick_actions')}</Text>
            <View style={hsStyles.quickRow}>
              <TouchableOpacity onPress={() => onNavigateTab('vehicles')} style={hsStyles.quickBtn}>
                <Truck size={18} color="#0ea5e9" />
                <Text style={hsStyles.quickBtnText}>{t('tab_vehicles')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onNavigateTab('sites')} style={hsStyles.quickBtn}>
                <Building2 size={18} color="#059669" />
                <Text style={hsStyles.quickBtnText}>{t('dashboard_all_sites')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onNavigateTab('reports')} style={hsStyles.quickBtn}>
                <FileText size={18} color="#2563eb" />
                <Text style={hsStyles.quickBtnText}>{t('dashboard_generate_report')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onNavigateTab('surveys')} style={hsStyles.quickBtn}>
                <MapPin size={18} color="#b45309" />
                <Text style={hsStyles.quickBtnText}>{t('tab_surveys')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onNavigateTab('issues')} style={hsStyles.quickBtn}>
                <AlertCircle size={18} color="#e11d48" />
                <Text style={hsStyles.quickBtnText}>{t('tab_issues')}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}
        <View style={hsStyles.statsRow}>
          {stats.map((stat, index) => (
            <Card key={index} style={hsStyles.statCard}>
              <View style={hsStyles.statContent}>
                {stat.icon}
                <Text style={hsStyles.statValue}>{stat.value}</Text>
                <Text style={hsStyles.statLabel}>{stat.label}</Text>
              </View>
            </Card>
          ))}
        </View>
        {sites.length > 0 && (
          <View style={hsStyles.section}>
            <Text style={hsStyles.sectionTitle}>{t('dashboard_site_locations')}</Text>
            {sites.map((site) => (
              <SiteCard key={site.id} site={site} onPress={() => setTasksSiteId(site.id)} />
            ))}
          </View>
        )}
      </DashboardLayout>
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background } });
const hsStyles = StyleSheet.create({
  quickCard: { marginBottom: layout.cardSpacingVertical },
  quickTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: layout.grid },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: layout.grid },
  quickBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.gray100, borderWidth: 1, borderColor: colors.border },
  quickBtnText: { color: colors.text, fontWeight: '500', marginLeft: 8 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: layout.cardSpacingVertical },
  statCard: { flexBasis: '48%', marginBottom: layout.cardSpacingVertical },
  statContent: { alignItems: 'center', paddingVertical: layout.grid },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 8 },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  section: { marginBottom: layout.cardSpacingVertical },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: layout.grid,
    letterSpacing: 0.4,
  },
});
