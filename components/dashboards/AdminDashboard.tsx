import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { SiteCard } from '@/components/sites/SiteCard';
import { Header } from '@/components/ui/Header';
import { DashboardLayout } from '@/components/ui/DashboardLayout';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { formatAmount } from '@/lib/currency';
import { colors, layout } from '@/theme/tokens';
import {
  Building2,
  Banknote,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  FileText,
  Users,
  Truck,
  Settings,
} from 'lucide-react-native';
import type { DashboardNavProps } from '@/components/RoleBasedDashboard';

export function AdminDashboard({ onNavigateTab }: DashboardNavProps = {}) {
  const { t } = useLocale();
  const { sites, surveys, trips, machineSessions, contractRateRwf } = useMockAppStore();
  const totalBudget = sites.reduce((sum, site) => sum + site.budget, 0);
  const totalSpent = sites.reduce((sum, site) => sum + site.spent, 0);
  const activeSites = sites.filter((s) => s.status === 'active').length;
  const workVolume = surveys
    .filter((s) => s.status === 'approved' && s.workVolume != null)
    .reduce((sum, s) => sum + (s.workVolume ?? 0), 0);
  const revenue = workVolume * contractRateRwf;
  const totalCost = totalSpent;
  const profit = revenue - totalCost;
  const truckDistance = trips.filter((t) => t.status === 'completed').reduce((s, t) => s + t.distanceKm, 0);
  const machineHours = machineSessions.filter((m) => m.status === 'completed').reduce((s, m) => s + (m.durationHours ?? 0), 0);

  const stats = [
    { icon: <Building2 size={24} color="#3B82F6" />, label: t('dashboard_active_sites'), value: activeSites.toString(), bg: 'bg-blue-50' },
    { icon: <Banknote size={24} color="#10B981" />, label: t('dashboard_total_budget'), value: formatAmount(totalBudget, true), bg: 'bg-green-50' },
    { icon: <CheckCircle2 size={24} color="#8B5CF6" />, label: t('dashboard_total_spent'), value: formatAmount(totalSpent, true), bg: 'bg-purple-50' },
    { icon: <AlertTriangle size={24} color="#F59E0B" />, label: t('dashboard_remaining'), value: formatAmount(totalBudget - totalSpent, true), bg: 'bg-yellow-50' },
    { icon: <TrendingUp size={24} color="#059669" />, label: t('dashboard_revenue'), value: formatAmount(revenue, true), bg: 'bg-emerald-50' },
    { icon: <Banknote size={24} color="#DC2626" />, label: t('dashboard_profit'), value: formatAmount(profit, true), bg: profit >= 0 ? 'bg-green-50' : 'bg-red-50' },
  ];

  return (
    <View style={styles.screen}>
      <Header title={t('dashboard_admin_title')} subtitle={t('dashboard_admin_subtitle')} />
      <DashboardLayout>
        {onNavigateTab && (
          <Card style={adminStyles.quickCard}>
            <Text style={adminStyles.quickTitle}>{t('dashboard_quick_actions')}</Text>
            <View style={adminStyles.quickRow}>
              <TouchableOpacity onPress={() => onNavigateTab('reports')} style={adminStyles.quickBtn}>
                <FileText size={18} color="#2563eb" />
                <Text style={adminStyles.quickBtnText}>{t('dashboard_generate_report')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onNavigateTab('sites')} style={adminStyles.quickBtn}>
                <Building2 size={18} color="#059669" />
                <Text style={adminStyles.quickBtnText}>{t('dashboard_all_sites')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onNavigateTab('users')} style={adminStyles.quickBtn}>
                <Users size={18} color="#7c3aed" />
                <Text style={adminStyles.quickBtnText}>{t('dashboard_user_management')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onNavigateTab('vehicles')} style={adminStyles.quickBtn}>
                <Truck size={18} color="#475569" />
                <Text style={adminStyles.quickBtnText}>{t('tab_vehicles')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onNavigateTab('settings')} style={adminStyles.quickBtn}>
                <Settings size={18} color="#475569" />
                <Text style={adminStyles.quickBtnText}>{t('tab_settings')}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        <View style={adminStyles.statsRow}>
          {stats.map((stat, index) => (
            <Card key={index} style={adminStyles.statCard}>
              <View style={adminStyles.statContent}>
                {stat.icon}
                <Text style={adminStyles.statValue}>{stat.value}</Text>
                <Text style={adminStyles.statLabel}>{stat.label}</Text>
              </View>
            </Card>
          ))}
        </View>

        <Card style={adminStyles.workCard}>
          <Text style={adminStyles.workLabel}>{t('dashboard_work_volume_approved')}</Text>
          <Text style={adminStyles.workValue}>{workVolume.toFixed(2)}</Text>
          <Text style={adminStyles.workCaption}>{t('dashboard_truck_km_machine_h').replace('{truck}', String(truckDistance)).replace('{hours}', machineHours.toFixed(1))}</Text>
        </Card>

        <View style={adminStyles.section}>
          <Text style={adminStyles.sectionTitle}>{t('dashboard_all_sites')}</Text>
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </View>
      </DashboardLayout>
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background } });
const adminStyles = StyleSheet.create({
  quickCard: { marginBottom: layout.cardSpacingVertical },
  quickTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: layout.grid },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: layout.grid },
  quickBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.gray100, borderWidth: 1, borderColor: colors.border },
  quickBtnText: { color: colors.gray700, fontWeight: '500', marginLeft: 8 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: layout.cardSpacingVertical },
  statCard: { flexBasis: '48%', marginBottom: layout.cardSpacingVertical },
  statContent: { alignItems: 'center', paddingVertical: layout.grid },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 8 },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  workCard: { marginBottom: layout.cardSpacingVertical, backgroundColor: colors.gray100 },
  workLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  workValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  workCaption: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  section: { marginBottom: layout.cardSpacingVertical },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: layout.grid },
});
