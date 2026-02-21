import React from 'react';
import { View, ScrollView, ScrollViewProps } from 'react-native';
import { useResponsiveTheme } from '@/theme/responsive';

interface ScreenContainerProps extends Omit<ScrollViewProps, 'contentContainerStyle'> {
  children: React.ReactNode;
  /** If true (default), content is in a ScrollView. If false, just a padded View. */
  scroll?: boolean;
  /** Extra class for the inner content container */
  contentClassName?: string;
}

/**
 * Wraps screen content with consistent responsive padding so all phones get
 * appropriate horizontal/vertical spacing. Use for all main screens and dashboards.
 */
export function ScreenContainer({
  children,
  scroll = true,
  contentClassName = '',
  ...scrollProps
}: ScreenContainerProps) {
  const { screenPadding } = useResponsiveTheme();
  const padding = screenPadding;

  if (scroll) {
    return (
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...scrollProps}
      >
        <View className={contentClassName}>{children}</View>
      </ScrollView>
    );
  }

  return (
    <View className={`flex-1 ${contentClassName}`} style={{ padding }}>
      {children}
    </View>
  );
}
