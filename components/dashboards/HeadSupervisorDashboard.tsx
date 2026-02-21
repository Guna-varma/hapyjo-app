import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Card } from '@/components/ui/Card';
import { SiteCard } from '@/components/sites/SiteCard';
import { Header } from '@/components/ui/Header';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { formatAmount } from '@/lib/currency';
import { Building2, DollarSign, MapPin, TrendingUp } from 'lucide-react-native';

export function HeadSupervisorDashboard() {
  const theme = useResponsiveTheme();
  const { sites, surveys, trips, machineSessions, expenses, contractRateRwf } = useMockAppStore();
  const totalBudget = sites.reduce((sum, site) => sum + site.budget, 0);
  const totalSpent = sites.reduce((sum, site) => sum + site.spent, 0);
  const activeSites = sites.filter((s) => s.status === 'active').length;
  const workVolume = surveys.filter((s) => s.status === 'approved' && s.workVolume != null).reduce((sum, s) => sum + (s.workVolume ?? 0), 0);
  const revenue = workVolume * contractRateRwf;
  const totalCost = totalSpent;
  const profit = revenue - totalCost;

  const stats = [
    { icon: <Building2 size={24} color="#3B82F6" />, label: 'Active Sites', value: activeSites.toString(), bg: 'bg-blue-50' },
    { icon: <DollarSign size={24} color="#10B981" />, label: 'Budget', value: formatAmount(totalBudget, true), bg: 'bg-green-50' },
    { icon: <MapPin size={24} color="#8B5CF6" />, label: 'Spent', value: formatAmount(totalSpent, true), bg: 'bg-purple-50' },
    { icon: <TrendingUp size={24} color="#059669" />, label: 'Profit', value: formatAmount(profit, true), bg: profit >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
  ];

  return (
    <View className="flex-1 bg-gray-50">
      <Header title="Head Supervisor" subtitle="Site and budget overview" />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding }}>
        <View className="flex-row flex-wrap -mx-1 mb-4">
          {stats.map((stat, index) => (
            <View key={index} className="w-1/2 p-1">
              <Card className={stat.bg}>
                <View className="items-center py-2">
                  {stat.icon}
                  <Text className="text-lg font-bold text-gray-900 mt-2">{stat.value}</Text>
                  <Text className="text-xs text-gray-600 mt-1">{stat.label}</Text>
                </View>
              </Card>
            </View>
          ))}
        </View>
        <View className="mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">Site locations</Text>
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
