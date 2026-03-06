import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { MapPin, Calendar } from 'lucide-react-native';
import { Task } from '@/types';
import { useLocale } from '@/context/LocaleContext';

interface TaskCardProps {
  task: Task;
  onPress?: () => void;
}

export function TaskCard({ task, onPress }: TaskCardProps) {
  const { t } = useLocale();
  const statusVariant = {
    pending: 'warning' as const,
    in_progress: 'info' as const,
    completed: 'success' as const,
  };

  const priorityVariant = {
    low: 'default' as const,
    medium: 'warning' as const,
    high: 'danger' as const,
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card className="mb-2" style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
        <View className="flex-row items-start justify-between mb-1.5">
          <View className="flex-1 mr-2">
            <Text className="text-sm font-bold text-gray-900" numberOfLines={2}>{task.title}</Text>
          </View>
          <View className="flex-row gap-1">
            <Badge variant={priorityVariant[task.priority]} size="sm">
              {task.priority}
            </Badge>
            <Badge variant={statusVariant[task.status]} size="sm">
              {task.status.replace('_', ' ')}
            </Badge>
          </View>
        </View>

        <Text className="text-xs text-slate-600 mb-2" numberOfLines={2}>{task.description}</Text>

        <View className="flex-row items-center mb-1">
          <MapPin size={12} color="#6B7280" />
          <Text className="text-xs text-gray-600 ml-1" numberOfLines={1}>{task.siteName}</Text>
        </View>

        <View className="flex-row items-center mb-2">
          <Calendar size={12} color="#6B7280" />
          <Text className="text-xs text-gray-600 ml-1">Due: {task.dueDate}</Text>
        </View>

        {task.status !== 'pending' && (
          <View>
            <View className="flex-row justify-between mb-0.5">
              <Text className="text-xs text-gray-600">{t('task_progress_label')}</Text>
              <Text className="text-xs font-semibold text-gray-900">{task.progress}%</Text>
            </View>
            <ProgressBar progress={task.progress} showLabel={false} />
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}
