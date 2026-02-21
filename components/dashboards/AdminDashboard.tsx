import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Card } from '@/components/ui/Card';
import { SiteCard } from '@/components/sites/SiteCard';
import { Header } from '@/components/ui/Header';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { formatAmount } from '@/lib/currency';
import {
  Building2,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react-native';

export function AdminDashboard() {
  const theme = useResponsiveTheme();
  const { sites, surveys, trips, machineSessions, expenses, contractRateRwf } = useMockAppStore();
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
    { icon: <Building2 size={24} color="#3B82F6" />, label: 'Active Sites', value: activeSites.toString(), bg: 'bg-blue-50' },
    { icon: <DollarSign size={24} color="#10B981" />, label: 'Total Budget', value: formatAmount(totalBudget, true), bg: 'bg-green-50' },
    { icon: <CheckCircle2 size={24} color="#8B5CF6" />, label: 'Total Spent', value: formatAmount(totalSpent, true), bg: 'bg-purple-50' },
    { icon: <AlertTriangle size={24} color="#F59E0B" />, label: 'Remaining', value: formatAmount(totalBudget - totalSpent, true), bg: 'bg-yellow-50' },
    { icon: <TrendingUp size={24} color="#059669" />, label: 'Revenue', value: formatAmount(revenue, true), bg: 'bg-emerald-50' },
    { icon: <DollarSign size={24} color="#DC2626" />, label: 'Profit', value: formatAmount(profit, true), bg: profit >= 0 ? 'bg-green-50' : 'bg-red-50' },
  ];

  return (
    <View className="flex-1 bg-gray-50">
      <Header title="Admin Dashboard" subtitle="Overview of all operations" />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding }}>
        {/* Stats Grid */}
        <View className="flex-row flex-wrap -mx-1 mb-4">
          {stats.map((stat, index) => (
            <View key={index} className="w-1/2 p-1">
              <Card className={stat.bg}>
                <View className="items-center py-2">
                  {stat.icon}
                  <Text className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</Text>
                  <Text className="text-xs text-gray-600 mt-1">{stat.label}</Text>
                </View>
              </Card>
            </View>
          ))}
        </View>

        <Card className="mb-4 bg-gray-50">
          <Text className="text-sm font-semibold text-gray-700 mb-1">Work volume (approved)</Text>
          <Text className="text-lg font-bold text-gray-900">{workVolume.toFixed(2)}</Text>
          <Text className="text-xs text-gray-500 mt-1">Truck km: {truckDistance} · Machine h: {machineHours.toFixed(1)}</Text>
        </Card>

        <View className="mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">All Sites</Text>
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
