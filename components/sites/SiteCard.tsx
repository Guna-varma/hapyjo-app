import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { formatAmount } from '@/lib/currency';
import { formatDateLabel } from '@/components/ui/DatePickerField';
import { MapPin, Banknote, TrendingUp, Calendar } from 'lucide-react-native';
import { Site } from '@/types';
import { useLocale } from '@/context/LocaleContext';

interface SiteCardProps {
  site: Site;
  onPress?: () => void;
}

export function SiteCard({ site, onPress }: SiteCardProps) {
  const { t } = useLocale();
  const budgetUtilization = site.budget && site.budget > 0 ? (site.spent / site.budget) * 100 : 0;

  const statusVariant = {
    active: 'success' as const,
    inactive: 'default' as const,
    completed: 'info' as const,
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card className="mb-3">
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">{site.name}</Text>
            <View className="flex-row items-center mt-1">
              <MapPin size={14} color="#6B7280" />
              <Text className="text-sm text-gray-600 ml-1">{site.location}</Text>
            </View>
          </View>
          <Badge variant={statusVariant[site.status]}>{site.status}</Badge>
        </View>

        <View className="flex-row flex-wrap gap-x-4 gap-y-1 mb-3">
          <View className="flex-row items-center">
            <Calendar size={14} color="#6B7280" />
            <Text className="text-xs text-gray-600 ml-1">{t('site_start_date')}:</Text>
            <Text className="text-xs font-medium text-gray-800 ml-1">
              {site.startDate ? formatDateLabel(site.startDate.slice(0, 10)) : '—'}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-xs text-gray-600">{t('site_expected_end_date')}:</Text>
            <Text className="text-xs font-medium text-gray-800 ml-1">
              {site.expectedEndDate ? formatDateLabel(site.expectedEndDate.slice(0, 10)) : '—'}
            </Text>
          </View>
        </View>

        <View className="mb-3">
          <View className="flex-row justify-between mb-1">
            <Text className="text-xs text-gray-600">{t('site_card_progress')}</Text>
            <Text className="text-xs font-semibold text-gray-900">{site.progress}%</Text>
          </View>
          <ProgressBar progress={site.progress} showLabel={false} />
        </View>

        <View className="flex-row justify-between">
          <View className="flex-1 mr-2">
            <Text className="text-xs text-gray-600 mb-1">{t('site_card_budget')}</Text>
            <View className="flex-row items-center">
              <Banknote size={14} color="#2563eb" />
              <Text className="text-sm font-semibold text-slate-900 ml-1">
                {formatAmount(site.budget, true)}
              </Text>
            </View>
          </View>
          <View className="flex-1 ml-2">
            <Text className="text-xs text-slate-600 mb-1">{t('site_card_spent')}</Text>
            <View className="flex-row items-center">
              <TrendingUp size={14} color="#10B981" />
              <Text className="text-sm font-semibold text-slate-900 ml-1">
                {formatAmount(site.spent, true)} ({(budgetUtilization ?? 0).toFixed(0)}%)
              </Text>
            </View>
          </View>
        </View>

        {site.manager && (
          <View className="mt-3 pt-3 border-t border-gray-200">
            <Text className="text-xs text-gray-600">
              Manager: <Text className="font-semibold text-gray-900">{site.manager}</Text>
            </Text>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}
