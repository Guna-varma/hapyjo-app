import React from 'react';
import { View, ScrollView, ScrollViewProps, StyleSheet } from 'react-native';
import { colors, layout, scrollConfig } from '@/theme/tokens';

interface DashboardLayoutProps extends Omit<ScrollViewProps, 'contentContainerStyle'> {
  children: React.ReactNode;
  scroll?: boolean;
}

/**
 * Shared layout wrapper for all dashboards and forms.
 * Responsive: horizontal padding, vertical spacing, extra bottom padding so content is not cut off on any device.
 */
export function DashboardLayout({ children, scroll = true, ...scrollProps }: DashboardLayoutProps) {
  const contentStyle = {
    paddingHorizontal: layout.screenPaddingHorz,
    paddingTop: layout.cardSpacingVertical,
    paddingBottom: layout.cardSpacingVertical * 2.5,
    flexGrow: 1,
  };

  if (scroll) {
    return (
      <ScrollView
        style={styles.fill}
        contentContainerStyle={contentStyle}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={true}
        {...scrollConfig}
        {...scrollProps}
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[styles.fill, contentStyle]}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
});
