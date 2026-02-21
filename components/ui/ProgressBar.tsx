import React from 'react';
import { View, Text } from 'react-native';

interface ProgressBarProps {
  progress: number;
  showLabel?: boolean;
  height?: number;
  color?: string;
}

export function ProgressBar({
  progress,
  showLabel = true,
  height = 8,
  color = 'bg-blue-600',
}: ProgressBarProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <View className="w-full">
      <View className="bg-gray-200 rounded-full overflow-hidden" style={{ height }}>
        <View
          className={`${color} h-full rounded-full`}
          style={{ width: `${clampedProgress}%` }}
        />
      </View>
      {showLabel && (
        <Text className="text-xs text-gray-600 mt-1 text-right">{clampedProgress}%</Text>
      )}
    </View>
  );
}
