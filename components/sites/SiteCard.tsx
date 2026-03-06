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

function SiteCardInner({ site, onPress }: SiteCardProps) {
  const { t } = useLocale();
  const budgetUtilization = site.budget && site.budget > 0 ? (site.spent / site.budget) * 100 : 0;
  const progressPct = Math.round(site.progress ?? 0);

  let remainingLabel: string | null = null;
  let remainingStyle: { color: string; fontWeight?: '600'; } | null = null;
  if (site.status !== 'completed' && site.expectedEndDate) {
    const end = new Date(site.expectedEndDate.slice(0, 10));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((end.getTime() - today.getTime()) / 86400000);
    if (diffDays > 5) {
      remainingLabel = `${diffDays} ${t('dashboard_remaining_days').toLowerCase()}`;
      remainingStyle = { color: '#64748b' };
    } else if (diffDays > 0) {
      remainingLabel = `${diffDays} ${t('dashboard_remaining_days').toLowerCase()}`;
      remainingStyle = { color: '#b91c1c', fontWeight: '600' };
    } else if (diffDays === 0) {
      remainingLabel = t('dashboard_overdue');
      remainingStyle = { color: '#b91c1c', fontWeight: '600' };
    } else if (diffDays < 0) {
      remainingLabel = t('dashboard_overdue');
      remainingStyle = { color: '#b91c1c', fontWeight: '600' };
    }
  }

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
          {remainingLabel && remainingStyle && (
            <View className="ml-auto px-2 py-1 rounded-full bg-red-50">
              <Text
                className="text-xs"
                style={remainingStyle}
              >
                {remainingLabel}
              </Text>
            </View>
          )}
        </View>

        <View className="mb-3">
          <View className="flex-row justify-between mb-1">
            <Text className="text-xs text-gray-600">{t('site_card_progress')}</Text>
            <Text className="text-xs font-semibold text-gray-900">{progressPct}%</Text>
          </View>
          <ProgressBar progress={progressPct} showLabel={false} />
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

export const SiteCard = React.memo(SiteCardInner);
