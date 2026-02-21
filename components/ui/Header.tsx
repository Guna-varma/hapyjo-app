import React from 'react';
import { View, Text } from 'react-native';
import { useResponsiveTheme } from '@/theme/responsive';

interface HeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
}

export function Header({ title, subtitle, leftAction, rightAction }: HeaderProps) {
  const { screenPadding, spacingMd } = useResponsiveTheme();
  return (
    <View
      className="bg-white border-b border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      style={{ paddingHorizontal: screenPadding, paddingVertical: spacingMd }}
    >
      <View className="flex-row items-center justify-between">
        {leftAction && <View className="mr-3">{leftAction}</View>}
        <View className="flex-1 min-w-0">
          <Text className="text-lg font-bold text-slate-900">{title}</Text>
          {subtitle ? <Text className="text-sm text-slate-500 mt-0.5">{subtitle}</Text> : null}
        </View>
        {rightAction && <View className="ml-3 shrink-0">{rightAction}</View>}
      </View>
    </View>
  );
}
