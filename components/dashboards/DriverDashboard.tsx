import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Card } from '@/components/ui/Card';
import { TaskCard } from '@/components/tasks/TaskCard';
import { Header } from '@/components/ui/Header';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { Truck, CheckCircle2, Clock, AlertCircle } from 'lucide-react-native';

export function DriverDashboard() {
  const { user } = useAuth();
  const theme = useResponsiveTheme();
  const { tasks } = useMockAppStore();
  const myTasks = tasks.filter((task) => task.assignedTo.includes(user?.id || ''));

  const isTruck = user?.role === 'driver_truck';
  const title = isTruck ? 'My trips' : 'My machine sessions';
  const subtitle = user?.name ? `Welcome back, ${user.name}` : (isTruck ? 'Truck driver' : 'Machine operator');

  const pendingTasks = myTasks.filter((t) => t.status === 'pending').length;
  const inProgressTasks = myTasks.filter((t) => t.status === 'in_progress').length;
  const completedTasks = myTasks.filter((t) => t.status === 'completed').length;

  const stats = [
    {
      icon: <Clock size={20} color="#F59E0B" />,
      label: 'Pending',
      value: pendingTasks,
      bg: 'bg-yellow-50',
    },
    {
      icon: <AlertCircle size={20} color="#3B82F6" />,
      label: 'In Progress',
      value: inProgressTasks,
      bg: 'bg-blue-50',
    },
    {
      icon: <CheckCircle2 size={20} color="#10B981" />,
      label: 'Completed',
      value: completedTasks,
      bg: 'bg-green-50',
    },
  ];

  return (
    <View className="flex-1 bg-gray-50">
      <Header title={title} subtitle={subtitle} />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding }}>
        {/* Stats */}
        <View className="flex-row mb-4 gap-3">
          {stats.map((stat, index) => (
            <Card key={index} className={`flex-1 ${stat.bg}`}>
              <View className="items-center py-2">
                {stat.icon}
                <Text className="text-xl font-bold text-gray-900 mt-1">{stat.value}</Text>
                <Text className="text-xs text-gray-600">{stat.label}</Text>
              </View>
            </Card>
          ))}
        </View>

        {/* Tasks List */}
        <View className="mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">Assigned Tasks</Text>
          {myTasks.length > 0 ? (
            myTasks.map((task) => <TaskCard key={task.id} task={task} />)
          ) : (
            <EmptyState
              icon={<Truck size={48} color="#9CA3AF" />}
              title="No tasks assigned"
              message="You're all caught up! Check back later for new assignments."
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}
