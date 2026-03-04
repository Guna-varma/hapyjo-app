import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskDetailScreen } from '@/components/tasks/TaskDetailScreen';
import { Header } from '@/components/ui/Header';
import { DashboardLayout } from '@/components/ui/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { formatAmount } from '@/lib/currency';
import { colors } from '@/theme/tokens';
import { DriverAllocationScreen } from '@/components/screens/DriverAllocationScreen';
import { Users, Fuel, CheckCircle2 } from 'lucide-react-native';
import type { Task } from '@/types';
import type { DashboardNavProps } from '@/components/RoleBasedDashboard';

export function AssistantSupervisorDashboard({ onNavigateTab }: DashboardNavProps = {}) {
  const { user } = useAuth();
  const { t } = useLocale();
  const { sites, tasks } = useMockAppStore();
  const [showDriverAllocation, setShowDriverAllocation] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const siteIds = user?.siteAccess ?? [];
  const assignedSite = sites.find((s) => siteIds.includes(s.id) || s.assistantSupervisorId === user?.id) ?? sites[0] ?? null;
  const siteTasks = assignedSite ? tasks.filter((taskItem) => taskItem.siteId === assignedSite.id) : [];

  if (showDriverAllocation) {
    return <DriverAllocationScreen onBack={() => setShowDriverAllocation(false)} />;
  }

  if (selectedTask) {
    return (
      <TaskDetailScreen
        task={selectedTask}
        onBack={() => setSelectedTask(null)}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <Header title={t('dashboard_assistant_title')} subtitle={t('dashboard_assistant_subtitle')} />
      <DashboardLayout>
        {assignedSite && (
          <Card className="mb-4">
            <Text className="text-base font-bold text-gray-900 mb-2">{t('dashboard_your_site')}</Text>
            <Text className="text-lg font-semibold text-gray-800">{assignedSite.name}</Text>
            <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-200">
              <View>
                <Text className="text-xs text-gray-600">{t('dashboard_total_investment')}</Text>
                <Text className="text-sm font-semibold text-slate-900">
                  {formatAmount(assignedSite.budget ?? 0, true)}
                </Text>
              </View>
              <View>
                <Text className="text-xs text-slate-600">{t('dashboard_spent')}</Text>
                <Text className="text-sm font-semibold text-slate-900">
                  {formatAmount(assignedSite.spent ?? 0, true)}
                </Text>
              </View>
            </View>
          </Card>
        )}

        <View className="mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">{t('dashboard_tasks_at_site')}</Text>
          {siteTasks.length > 0 ? (
            siteTasks.map((task) => <TaskCard key={task.id} task={task} onPress={() => setSelectedTask(task)} />)
          ) : (
            <Card className="py-4">
              <Text className="text-gray-600 text-center">{t('dashboard_no_tasks_site')}</Text>
            </Card>
          )}
        </View>

        <View className="mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">{t('dashboard_quick_actions')}</Text>
          <TouchableOpacity onPress={() => setShowDriverAllocation(true)}>
            <Card className="mb-2">
              <View className="flex-row items-center py-2">
                <Users size={20} color="#3B82F6" />
                <Text className="text-gray-900 font-medium ml-3">{t('dashboard_reassign_drivers')}</Text>
              </View>
            </Card>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onNavigateTab?.('expenses')}>
            <Card className="mb-2">
              <View className="flex-row items-center py-2">
                <Fuel size={20} color="#10B981" />
                <Text className="text-gray-900 font-medium ml-3">{t('dashboard_expense_fuel_entry')}</Text>
                <Text className="text-xs text-gray-500 ml-2">{t('dashboard_use_expenses_tab')}</Text>
              </View>
            </Card>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onNavigateTab?.('surveys')}>
            <Card className="mb-2">
              <View className="flex-row items-center py-2">
                <CheckCircle2 size={20} color="#8B5CF6" />
                <Text className="text-gray-900 font-medium ml-3">{t('dashboard_survey_approval')}</Text>
                <Text className="text-xs text-gray-500 ml-2">{t('dashboard_use_surveys_tab')}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        </View>
      </DashboardLayout>
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background } });
