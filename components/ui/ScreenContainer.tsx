import React from 'react';
import { View, ScrollView, ScrollViewProps, StyleProp, ViewStyle } from 'react-native';
import { layout, scrollConfig } from '@/theme/tokens';

interface ScreenContainerProps extends Omit<ScrollViewProps, 'contentContainerStyle'> {
  children: React.ReactNode;
  /** If true (default), content is in a ScrollView. If false, just a padded View. */
  scroll?: boolean;
  /** Extra class for the inner content container */
  contentClassName?: string;
  /** Optional extra content container styles (merged with default padding) */
  contentContainerStyle?: StyleProp<ViewStyle>;
}

const defaultContentStyle: ViewStyle = {
  paddingHorizontal: layout.screenPaddingHorz,
  paddingVertical: layout.cardSpacingVertical,
  flexGrow: 1,
};

/**
 * Wraps screen content with consistent padding (16px). Use for main screens and forms.
 */
export function ScreenContainer({
  children,
  scroll = true,
  contentClassName = '',
  contentContainerStyle,
  ...scrollProps
}: ScreenContainerProps) {
  const contentStyle = contentContainerStyle
    ? [defaultContentStyle, contentContainerStyle]
    : defaultContentStyle;

  if (scroll) {
    return (
      <ScrollView
        className="flex-1"
        contentContainerStyle={contentStyle}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
        {...scrollConfig}
        {...scrollProps}
      >
        <View className={contentClassName}>{children}</View>
      </ScrollView>
    );
  }

  return (
    <View className={`flex-1 ${contentClassName}`} style={defaultContentStyle}>
      {children}
    </View>
  );
}
