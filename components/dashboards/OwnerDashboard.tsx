import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { Card } from '@/components/ui/Card';
import { SiteCard } from '@/components/sites/SiteCard';
import { Header } from '@/components/ui/Header';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { formatAmount } from '@/lib/currency';
import { TrendingUp, DollarSign, PieChart, Settings } from 'lucide-react-native';

export function OwnerDashboard() {
  const theme = useResponsiveTheme();
  const { sites, surveys, expenses, contractRateRwf, setContractRateRwf } = useMockAppStore();
  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [rateInput, setRateInput] = useState(String(contractRateRwf));

  const totalBudget = sites.reduce((sum, site) => sum + site.budget, 0);
  const totalSpent = sites.reduce((sum, site) => sum + site.spent, 0);
  const remaining = totalBudget - totalSpent;
  const utilizationRate = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const workVolume = surveys
    .filter((s) => s.status === 'approved' && s.workVolume != null)
    .reduce((sum, s) => sum + (s.workVolume ?? 0), 0);
  const revenue = workVolume * contractRateRwf;
  const totalCost = totalSpent;
  const profit = revenue - totalCost;

  const saveContractRate = () => {
    const r = parseInt(rateInput, 10);
    if (!isNaN(r) && r >= 0) setContractRateRwf(r);
    setRateModalVisible(false);
  };

  return (
    <View className="flex-1 bg-gray-50">
      <Header
        title="Financial Overview"
        subtitle="Business Owner Dashboard"
        rightAction={
          <TouchableOpacity onPress={() => { setRateInput(String(contractRateRwf)); setRateModalVisible(true); }} className="bg-blue-600 rounded-lg px-4 py-2 flex-row items-center">
            <Settings size={18} color="#fff" />
            <Text className="text-white font-semibold ml-1">Set contract rate</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding }}>
        {/* Financial Summary */}
        <Card className="mb-4 bg-gradient-to-br from-blue-600 to-blue-700">
          <View className="py-2">
            <Text className="text-white text-sm font-medium mb-2">Total Investment</Text>
            <Text className="text-white text-4xl font-bold mb-4">
              {formatAmount(totalBudget, true)}
            </Text>
            <View className="flex-row justify-between pt-3 border-t border-blue-500">
              <View>
                <Text className="text-blue-200 text-xs">Spent</Text>
                <Text className="text-white text-lg font-semibold">
                  {(totalSpent / 1000000).toFixed(1)}M
                </Text>
              </View>
              <View>
                <Text className="text-blue-200 text-xs">Remaining</Text>
                <Text className="text-white text-lg font-semibold">
                  {(remaining / 1000000).toFixed(1)}M
                </Text>
              </View>
              <View>
                <Text className="text-blue-200 text-xs">Utilization</Text>
                <Text className="text-white text-lg font-semibold">
                  {utilizationRate.toFixed(0)}%
                </Text>
              </View>
            </View>
          </View>
        </Card>

        <View className="flex-row mb-4 gap-2">
          <Card className="flex-1 bg-green-50">
            <View className="items-center py-2">
              <TrendingUp size={24} color="#10B981" />
              <Text className="text-lg font-bold text-slate-900 mt-1">{formatAmount(revenue, true)}</Text>
              <Text className="text-xs text-slate-600">Revenue</Text>
            </View>
          </Card>
          <Card className="flex-1 bg-purple-50">
            <View className="items-center py-2">
              <DollarSign size={24} color="#8B5CF6" />
              <Text className="text-lg font-bold text-slate-900 mt-1">{formatAmount(totalCost, true)}</Text>
              <Text className="text-xs text-slate-600">Total cost</Text>
            </View>
          </Card>
          <Card className={`flex-1 ${profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <View className="items-center py-2">
              <PieChart size={24} color={profit >= 0 ? '#059669' : '#DC2626'} />
              <Text className={`text-lg font-bold mt-1 ${profit >= 0 ? 'text-slate-900' : 'text-red-700'}`}>
                {formatAmount(profit, true)}
              </Text>
              <Text className="text-xs text-gray-600">Profit</Text>
            </View>
          </Card>
        </View>

        <Card className="mb-4 bg-gray-50">
          <Text className="text-sm text-gray-600">Contract rate</Text>
          <Text className="text-xl font-bold text-gray-900">{contractRateRwf.toLocaleString()} RWF per unit volume</Text>
        </Card>

        <View className="flex-row mb-4 gap-3">
          <Card className="flex-1 bg-green-50">
            <View className="items-center py-3">
              <TrendingUp size={28} color="#10B981" />
              <Text className="text-xl font-bold text-gray-900 mt-2">{sites.filter((s) => s.status === 'active').length}</Text>
              <Text className="text-xs text-gray-600 mt-1">Active Sites</Text>
            </View>
          </Card>
          <Card className="flex-1 bg-purple-50">
            <View className="items-center py-3">
              <PieChart size={28} color="#8B5CF6" />
              <Text className="text-xl font-bold text-gray-900 mt-2">
                {sites.length ? (sites.reduce((sum, s) => sum + s.progress, 0) / sites.length).toFixed(0) : 0}%
              </Text>
              <Text className="text-xs text-gray-600 mt-1">Avg Progress</Text>
            </View>
          </Card>
        </View>

        <View className="mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">Site Performance</Text>
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </View>
      </ScrollView>

      <Modal visible={rateModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-center bg-black/50 px-4">
          <View className="bg-white rounded-2xl p-6">
            <Text className="text-lg font-bold mb-4">Set contract rate (RWF per unit volume)</Text>
            <TextInput
              value={rateInput}
              onChangeText={setRateInput}
              placeholder="e.g. 500"
              keyboardType="number-pad"
              className="border border-gray-300 rounded-lg px-3 py-2 mb-4 bg-white"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setRateModalVisible(false)} className="flex-1 py-3 rounded-lg bg-gray-200 items-center">
                <Text className="font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveContractRate} className="flex-1 py-3 rounded-lg bg-blue-600 items-center">
                <Text className="font-semibold text-white">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
