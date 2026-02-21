import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { formatAmount } from '@/lib/currency';
import { DollarSign, FileText, Lock, TrendingUp } from 'lucide-react-native';

export function AccountantDashboard() {
  const theme = useResponsiveTheme();
  const { sites, surveys, expenses, contractRateRwf } = useMockAppStore();
  const totalBudget = sites.reduce((sum, site) => sum + site.budget, 0);
  const totalSpent = sites.reduce((sum, site) => sum + site.spent, 0);
  const remaining = totalBudget - totalSpent;
  const workVolume = surveys.filter((s) => s.status === 'approved' && s.workVolume != null).reduce((sum, s) => sum + (s.workVolume ?? 0), 0);
  const revenue = workVolume * contractRateRwf;
  const totalCost = totalSpent;
  const profit = revenue - totalCost;

  return (
    <View className="flex-1 bg-gray-50">
      <Header title="Accountant" subtitle="Read-only financial overview" />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding }}>
        <Card className="mb-4 bg-blue-50 border border-blue-200">
          <View className="flex-row items-center py-2">
            <Lock size={20} color="#2563EB" />
            <Text className="text-blue-800 font-semibold ml-2">Read-only access</Text>
          </View>
          <Text className="text-sm text-blue-700 mt-1">
            Detailed reports are available in the Reports tab. You can view but not generate or edit.
          </Text>
        </Card>

        <View className="mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">Financial summary</Text>
          <Card className="mb-3">
            <View className="flex-row items-center mb-2">
              <DollarSign size={24} color="#10B981" />
              <Text className="text-base font-semibold text-gray-900 ml-2">Total budget</Text>
            </View>
            <Text className="text-2xl font-bold text-slate-900">{formatAmount(totalBudget, true)}</Text>
          </Card>
          <Card className="mb-3">
            <View className="flex-row items-center mb-2">
              <DollarSign size={24} color="#8B5CF6" />
              <Text className="text-base font-semibold text-slate-900 ml-2">Total spent</Text>
            </View>
            <Text className="text-2xl font-bold text-slate-900">{formatAmount(totalSpent, true)}</Text>
          </Card>
          <Card className="mb-3">
            <View className="flex-row items-center mb-2">
              <DollarSign size={24} color="#059669" />
              <Text className="text-base font-semibold text-slate-900 ml-2">Remaining</Text>
            </View>
            <Text className="text-2xl font-bold text-green-700">{formatAmount(remaining, true)}</Text>
          </Card>
          <Card className="mb-3">
            <View className="flex-row items-center mb-2">
              <TrendingUp size={24} color="#3B82F6" />
              <Text className="text-base font-semibold text-slate-900 ml-2">Revenue</Text>
            </View>
            <Text className="text-2xl font-bold text-slate-900">{formatAmount(revenue, true)}</Text>
          </Card>
          <Card className="mb-3">
            <View className="flex-row items-center mb-2">
              <DollarSign size={24} color="#DC2626" />
              <Text className="text-base font-semibold text-slate-900 ml-2">Profit</Text>
            </View>
            <Text className={`text-2xl font-bold ${profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatAmount(profit, true)}
            </Text>
          </Card>
        </View>

        <Card className="bg-gray-50">
          <View className="flex-row items-center py-2">
            <FileText size={20} color="#6B7280" />
            <Text className="text-gray-700 font-medium ml-2">Reports tab</Text>
          </View>
          <Text className="text-sm text-gray-600 mt-1">
            View fuel cost, expenses, revenue and profit reports in read-only mode.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}
