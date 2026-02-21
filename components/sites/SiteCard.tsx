import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { formatAmount } from '@/lib/currency';
import { MapPin, DollarSign, TrendingUp } from 'lucide-react-native';
import { Site } from '@/types';

interface SiteCardProps {
  site: Site;
  onPress?: () => void;
}

export function SiteCard({ site, onPress }: SiteCardProps) {
  const budgetUtilization = (site.spent / site.budget) * 100;

  const statusVariant = {
    active: 'success' as const,
    inactive: 'default' as const,
    completed: 'info' as const,
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card className="mb-3">
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">{site.name}</Text>
            <View className="flex-row items-center mt-1">
              <MapPin size={14} color="#6B7280" />
              <Text className="text-sm text-gray-600 ml-1">{site.location}</Text>
            </View>
          </View>
          <Badge variant={statusVariant[site.status]}>{site.status}</Badge>
        </View>

        <View className="mb-3">
          <View className="flex-row justify-between mb-1">
            <Text className="text-xs text-gray-600">Progress</Text>
            <Text className="text-xs font-semibold text-gray-900">{site.progress}%</Text>
          </View>
          <ProgressBar progress={site.progress} showLabel={false} />
        </View>

        <View className="flex-row justify-between">
          <View className="flex-1 mr-2">
            <Text className="text-xs text-gray-600 mb-1">Budget</Text>
            <View className="flex-row items-center">
              <DollarSign size={14} color="#3B82F6" />
              <Text className="text-sm font-semibold text-slate-900 ml-1">
                {formatAmount(site.budget, true)}
              </Text>
            </View>
          </View>
          <View className="flex-1 ml-2">
            <Text className="text-xs text-slate-600 mb-1">Spent</Text>
            <View className="flex-row items-center">
              <TrendingUp size={14} color="#10B981" />
              <Text className="text-sm font-semibold text-slate-900 ml-1">
                {formatAmount(site.spent, true)} ({budgetUtilization.toFixed(0)}%)
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
