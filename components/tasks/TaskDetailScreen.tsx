import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Alert, TouchableOpacity } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Header } from '@/components/ui/Header';
import {
  MapPin,
  Calendar,
  User,
  Camera,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';
import { Task } from '@/types';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { useLocale } from '@/context/LocaleContext';

interface TaskDetailScreenProps {
  task: Task;
  onBack?: () => void;
}

export function TaskDetailScreen({ task, onBack }: TaskDetailScreenProps) {
  const { t } = useLocale();
  const theme = useResponsiveTheme();
  const { updateTask, tasks } = useMockAppStore();
  const currentTask = tasks.find((taskItem) => taskItem.id === task.id) ?? task;
  const [progress, setProgress] = useState(currentTask.progress.toString());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleStartTask = async () => {
    setLoading(true);
    try {
      await updateTask(task.id, { status: 'in_progress' });
      Alert.alert(t('alert_success'), t('task_start_success'));
    } catch {
      Alert.alert(t('alert_error'), t('task_start_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProgress = async () => {
    if (!progress || isNaN(Number(progress))) {
      Alert.alert(t('alert_error'), t('task_progress_invalid'));
      return;
    }
    const pct = Math.min(100, Math.max(0, Number(progress)));
    setLoading(true);
    try {
      await updateTask(task.id, { progress: pct, updatedAt: new Date().toISOString() });
      Alert.alert(t('alert_success'), t('task_progress_success'));
    } catch {
      Alert.alert(t('alert_error'), t('task_progress_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhoto = async () => {
    try {
      const { launchImageLibraryAsync } = await import('expo-image-picker');
      const result = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const uri = result.assets[0].uri;
      const existing = currentTask.photos ?? [];
      await updateTask(task.id, { photos: [...existing, uri], updatedAt: new Date().toISOString() });
      Alert.alert(t('alert_success'), t('gps_camera_photo_saved'));
    } catch (e) {
      Alert.alert(t('alert_error'), e instanceof Error ? e.message : t('alert_capture_error'));
    }
  };

  const handleCompleteTask = () => {
    Alert.alert(
      t('task_details_title'),
      t('task_complete_confirm'),
      [
        { text: t('general_cancel'), style: 'cancel' },
        {
          text: t('task_complete_button'),
          onPress: async () => {
            setLoading(true);
            try {
              await updateTask(task.id, { status: 'completed', progress: 100, updatedAt: new Date().toISOString() });
              Alert.alert(t('alert_success'), t('task_complete_success'));
            } catch {
              Alert.alert(t('alert_error'), t('task_complete_failed'));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <Header
        title={t('task_details_title')}
        leftAction={onBack ? (
          <TouchableOpacity onPress={onBack}>
            <Text className="text-blue-600 font-semibold">{t('common_back')}</Text>
          </TouchableOpacity>
        ) : undefined}
      />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding, paddingBottom: theme.spacingXl }}>
        {/* Task Header */}
        <Card className="mb-3" style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1 mr-2">
              <Text className="text-base font-bold text-gray-900 mb-1.5">{currentTask.title}</Text>
              <View className="flex-row gap-2">
                <Badge variant={priorityVariant[currentTask.priority]} size="sm">
                  {currentTask.priority}
                </Badge>
                <Badge variant={statusVariant[currentTask.status]} size="sm">
                  {currentTask.status.replace('_', ' ')}
                </Badge>
              </View>
            </View>
          </View>

          <Text className="text-sm text-gray-700 mb-3">{currentTask.description}</Text>

          {/* Task Info */}
          <View>
            <View className="flex-row items-center py-1.5 border-t border-gray-200">
              <MapPin size={14} color="#6B7280" />
              <View className="ml-2 flex-1">
                <Text className="text-xs text-gray-600">{t('task_site_label')}</Text>
                <Text className="text-xs font-semibold text-gray-900">{currentTask.siteName}</Text>
              </View>
            </View>

            <View className="flex-row items-center py-1.5 border-t border-gray-200">
              <Calendar size={14} color="#6B7280" />
              <View className="ml-2 flex-1">
                <Text className="text-xs text-gray-600">{t('task_due_date')}</Text>
                <Text className="text-xs font-semibold text-gray-900">{currentTask.dueDate}</Text>
              </View>
            </View>

            <View className="flex-row items-center py-1.5 border-t border-gray-200">
              <User size={14} color="#6B7280" />
              <View className="ml-2 flex-1">
                <Text className="text-xs text-gray-600">{t('task_created_label')}</Text>
                <Text className="text-xs font-semibold text-gray-900">{currentTask.createdAt}</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Progress Card */}
        <Card className="mb-3" style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
          <Text className="text-sm font-bold text-gray-900 mb-2">{t('task_progress_label')}</Text>
          <ProgressBar progress={currentTask.progress} />

          {currentTask.status === 'in_progress' && (
            <View className="mt-3">
              <Text className="text-xs font-medium text-gray-700 mb-1.5">{t('task_update_progress')}</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white mb-2"
                placeholder={t('task_progress_placeholder')}
                value={progress}
                onChangeText={setProgress}
                onFocus={() => { if (progress === '0') setProgress(''); }}
                keyboardType="numeric"
              />
              <Button onPress={handleUpdateProgress} loading={loading} size="sm">
                {t('common_save')} {t('task_progress_label')}
              </Button>
            </View>
          )}
        </Card>

        {/* Notes Card */}
        {currentTask.status === 'in_progress' && (
          <Card className="mb-3" style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
            <Text className="text-sm font-bold text-gray-900 mb-2">{t('task_add_notes')}</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white mb-2"
              placeholder={t('task_notes_placeholder')}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <TouchableOpacity onPress={handleAddPhoto} className="rounded-lg items-center justify-center bg-white border-2 border-blue-600 px-3 py-2 flex-row">
              <Camera size={16} color="#2563eb" />
              <Text className="text-blue-600 font-semibold ml-2 text-sm">{t('task_add_photo')}</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Actions */}
        <Card className="mb-4" style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
          <Text className="text-sm font-bold text-gray-900 mb-2">{t('task_actions')}</Text>
          
          {currentTask.status === 'pending' && (
            <Button onPress={handleStartTask} loading={loading} size="sm" className="mb-2">
              <View className="flex-row items-center">
                <AlertCircle size={16} color="#ffffff" />
                <Text className="text-white font-semibold ml-2 text-sm">{t('task_start_task')}</Text>
              </View>
            </Button>
          )}

          {currentTask.status === 'in_progress' && (
            <Button
              variant="primary"
              onPress={handleCompleteTask}
              loading={loading}
              size="sm"
              className="bg-green-600 active:bg-green-700"
            >
              <View className="flex-row items-center">
                <CheckCircle2 size={16} color="#ffffff" />
                <Text className="text-white font-semibold ml-2 text-sm">{t('task_complete_task')}</Text>
              </View>
            </Button>
          )}

          {currentTask.status === 'completed' && (
            <View className="bg-green-50 rounded-lg p-3 items-center">
              <CheckCircle2 size={24} color="#10B981" />
              <Text className="text-green-800 font-semibold mt-1.5 text-sm">{t('task_completed_title')}</Text>
              <Text className="text-green-600 text-xs mt-0.5">
                {t('task_finished_on')} {currentTask.updatedAt}
              </Text>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
