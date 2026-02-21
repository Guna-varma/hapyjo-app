import React from 'react';
import { View, Text } from 'react-native';
import { Smile } from 'lucide-react-native';
import { useResponsiveTheme } from '@/theme/responsive';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
}

export function EmptyState({ icon, title, message }: EmptyStateProps) {
  const theme = useResponsiveTheme();
  const iconSize = theme.scaleMin(48);
  return (
    <View className="flex-1 items-center justify-center p-8" style={{ padding: theme.spacingLg }}>
      <View className="items-center">
        {icon || <Smile size={iconSize} color="#9CA3AF" />}
        <Text className="text-lg font-semibold text-gray-700 mt-4">{title}</Text>
        {message && <Text className="text-sm text-gray-500 mt-2 text-center">{message}</Text>}
      </View>
    </View>
  );
}
