import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Card } from '@/components/ui/Card';
import { TaskCard } from '@/components/tasks/TaskCard';
import { Header } from '@/components/ui/Header';
import { useAuth } from '@/context/AuthContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { formatAmount } from '@/lib/currency';
import { DriverAllocationScreen } from '@/components/screens/DriverAllocationScreen';
import { Users, Fuel, CheckCircle2 } from 'lucide-react-native';

export function AssistantSupervisorDashboard() {
  const { user } = useAuth();
  const theme = useResponsiveTheme();
  const { sites, tasks } = useMockAppStore();
  const [showDriverAllocation, setShowDriverAllocation] = useState(false);

  const siteIds = user?.siteAccess ?? [];
  const assignedSite = sites.find((s) => siteIds.includes(s.id) || s.assistantSupervisorId === user?.id) ?? sites[0];
  const siteTasks = tasks.filter((t) => t.siteId === assignedSite?.id);

  if (showDriverAllocation) {
    return <DriverAllocationScreen onBack={() => setShowDriverAllocation(false)} />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <Header title="Assistant Supervisor" subtitle="Site operations" />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding }}>
        {assignedSite && (
          <Card className="mb-4">
            <Text className="text-base font-bold text-gray-900 mb-2">Your site</Text>
            <Text className="text-lg font-semibold text-gray-800">{assignedSite.name}</Text>
            <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-200">
              <View>
                <Text className="text-xs text-gray-600">Budget</Text>
                <Text className="text-sm font-semibold text-slate-900">
                  {formatAmount(assignedSite.budget, true)}
                </Text>
              </View>
              <View>
                <Text className="text-xs text-slate-600">Spent</Text>
                <Text className="text-sm font-semibold text-slate-900">
                  {formatAmount(assignedSite.spent, true)}
                </Text>
              </View>
            </View>
          </Card>
        )}

        <View className="mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">Tasks at site</Text>
          {siteTasks.length > 0 ? (
            siteTasks.map((task) => <TaskCard key={task.id} task={task} />)
          ) : (
            <Card className="py-4">
              <Text className="text-gray-600 text-center">No tasks at this site</Text>
            </Card>
          )}
        </View>

        <View className="mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">Quick actions</Text>
          <TouchableOpacity onPress={() => setShowDriverAllocation(true)}>
            <Card className="mb-2">
              <View className="flex-row items-center py-2">
                <Users size={20} color="#3B82F6" />
                <Text className="text-gray-900 font-medium ml-3">Reassign drivers to vehicles</Text>
              </View>
            </Card>
          </TouchableOpacity>
          <Card className="mb-2">
            <View className="flex-row items-center py-2">
              <Fuel size={20} color="#10B981" />
              <Text className="text-gray-900 font-medium ml-3">Expense / fuel entry</Text>
              <Text className="text-xs text-gray-500 ml-2">Use Expenses tab</Text>
            </View>
          </Card>
          <Card className="mb-2">
            <View className="flex-row items-center py-2">
              <CheckCircle2 size={20} color="#8B5CF6" />
              <Text className="text-gray-900 font-medium ml-3">Survey approval</Text>
              <Text className="text-xs text-gray-500 ml-2">Use Surveys tab</Text>
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
